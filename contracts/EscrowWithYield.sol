// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

contract EscrowWithYield is Ownable, ReentrancyGuard {
    // State enum
    enum EscrowState {
        Created,
        Funded,
        InProgress,
        Released,
        Refunded,
        Disputed
    }

    // Struct to store escrow details
    struct EscrowDetails {
        address client;
        address freelancer;
        address arbitrator;
        uint256 amount;
        uint256 yieldEarned;
        uint256 startTime;
        uint256 duration; // in seconds
        EscrowState state;
        bool clientDisputed;
        bool freelancerDisputed;
        bool yieldActive;
    }

    // State variables
    IERC20 public stablecoin;
    IAavePool public yieldStrategy;
    mapping(uint256 => EscrowDetails) public escrows;
    uint256 public escrowCounter;
    bool public isPaused;

    // Events
    event EscrowCreated(uint256 indexed escrowId, address client, address freelancer, uint256 duration);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount, bool yieldActive);
    event EscrowStarted(uint256 indexed escrowId, uint256 startTime);
    event EscrowReleased(uint256 indexed escrowId, address freelancer, uint256 amount, uint256 yieldBonus);
    event EscrowRefunded(uint256 indexed escrowId, address client, uint256 amount, uint256 yieldCompensation);
    event DisputeRaised(uint256 indexed escrowId, address raisedBy);
    event DisputeResolved(uint256 indexed escrowId, address winner, uint256 amount, uint256 arbitratorFee);
    event Paused();
    event Unpaused();

    // Modifiers
    modifier onlyClient(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].client, "Only client can call");
        _;
    }

    modifier onlyFreelancer(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].freelancer, "Only freelancer can call");
        _;
    }

    modifier onlyArbitrator(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].arbitrator, "Only arbitrator can call");
        _;
    }

    modifier inState(uint256 _escrowId, EscrowState _state) {
        require(escrows[_escrowId].state == _state, "Invalid escrow state");
        _;
    }

    modifier notPaused() {
        require(!isPaused, "Protocol is paused");
        _;
    }

    // Constructor
    constructor(address _stablecoin, address _aavePool) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin");
        require(_aavePool != address(0), "Invalid Aave pool");
        stablecoin = IERC20(_stablecoin);
        yieldStrategy = IAavePool(_aavePool);
    }

    // Create escrow
    function createEscrow(
        address _freelancer,
        address _arbitrator,
        uint256 _duration
    ) external notPaused {
        require(_freelancer != address(0), "Invalid freelancer");
        require(_arbitrator != address(0), "Invalid arbitrator");
        require(_duration > 0, "Duration must be > 0");
        require(_freelancer != msg.sender, "Cannot hire yourself");

        escrows[escrowCounter] = EscrowDetails({
            client: msg.sender,
            freelancer: _freelancer,
            arbitrator: _arbitrator,
            amount: 0,
            yieldEarned: 0,
            startTime: 0,
            duration: _duration,
            state: EscrowState.Created,
            clientDisputed: false,
            freelancerDisputed: false,
            yieldActive: false
        });

        emit EscrowCreated(escrowCounter, msg.sender, _freelancer, _duration);
        escrowCounter++;
    }

    // Fund escrow with USDC and deposit to Aave
    function fundEscrow(uint256 _escrowId, uint256 _amount)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Created)
        nonReentrant
        notPaused
    {
        require(_amount > 0, "Amount must be > 0");

        // Transfer USDC from client to contract
        stablecoin.transferFrom(msg.sender, address(this), _amount);

        EscrowDetails storage escrow = escrows[_escrowId];
        escrow.amount = _amount;

        // Deposit into Aave V3
        bool depositSuccess = _depositToYield(_amount);

        escrow.yieldActive = depositSuccess;
        escrow.state = EscrowState.Funded;

        emit EscrowFunded(_escrowId, _amount, depositSuccess);
    }

    // Internal: Deposit USDC to Aave V3
    function _depositToYield(uint256 _amount) internal returns (bool) {
        // Reset approval to 0 first (protection against front-running)
        stablecoin.approve(address(yieldStrategy), 0);

        // Approve Aave to spend USDC
        bool approveSuccess = stablecoin.approve(address(yieldStrategy), _amount);
        if (!approveSuccess) {
            return false;
        }

        // Call Aave V3 supply
        try yieldStrategy.supply(address(stablecoin), _amount, address(this), 0) {
            return true;
        } catch {
            return false;
        }
    }

    // Internal: Withdraw USDC from Aave V3
    function _withdrawFromYield(uint256 _amount) internal returns (bool) {
        try yieldStrategy.withdraw(address(stablecoin), _amount, address(this)) {
            return true;
        } catch {
            return false;
        }
    }

    // Start work
    function startWork(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Funded)
        notPaused
    {
        escrows[_escrowId].startTime = block.timestamp;
        escrows[_escrowId].state = EscrowState.InProgress;
        emit EscrowStarted(_escrowId, block.timestamp);
    }

    // Release payment to freelancer with yield split
    function releasePayment(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalReceived = escrow.amount;
        uint256 yieldEarned = 0;

        // Withdraw from Aave (withdraw all — use max uint to get principal + yield)
        if (escrow.yieldActive) {
            bool withdrawSuccess = _withdrawFromYield(type(uint256).max);
            if (withdrawSuccess) {
                uint256 contractBalance = stablecoin.balanceOf(address(this));
                if (contractBalance > escrow.amount) {
                    yieldEarned = contractBalance - escrow.amount;
                }
                totalReceived = contractBalance;
            }
        }

        escrow.yieldEarned = yieldEarned;

        // Split yield: 70% freelancer bonus, 30% client discount
        uint256 freelancerBonus = (yieldEarned * 70) / 100;
        uint256 clientDiscount = yieldEarned - freelancerBonus;

        uint256 freelancerPayment = escrow.amount + freelancerBonus;
        uint256 clientRefund = clientDiscount;

        // Send payments
        if (freelancerPayment > 0) {
            stablecoin.transfer(escrow.freelancer, freelancerPayment);
        }
        if (clientRefund > 0) {
            stablecoin.transfer(escrow.client, clientRefund);
        }

        uint256 escrowAmount = escrow.amount;
        escrow.amount = 0;
        escrow.state = EscrowState.Released;

        emit EscrowReleased(_escrowId, escrow.freelancer, escrowAmount, freelancerBonus);
    }

    // Refund client with yield compensation
    function refundClient(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalRefund = escrow.amount;
        uint256 yieldEarned = 0;

        // Withdraw from Aave
        if (escrow.yieldActive) {
            bool withdrawSuccess = _withdrawFromYield(type(uint256).max);
            if (withdrawSuccess) {
                uint256 contractBalance = stablecoin.balanceOf(address(this));
                if (contractBalance > escrow.amount) {
                    yieldEarned = contractBalance - escrow.amount;
                }
                totalRefund = contractBalance;
            }
        }

        escrow.yieldEarned = yieldEarned;

        // Send refund to client
        if (totalRefund > 0) {
            stablecoin.transfer(escrow.client, totalRefund);
        }

        uint256 escrowAmount = escrow.amount;
        escrow.amount = 0;
        escrow.state = EscrowState.Refunded;

        emit EscrowRefunded(_escrowId, escrow.client, escrowAmount, yieldEarned);
    }

    // Raise dispute (both parties must agree)
    function raiseDispute(uint256 _escrowId)
        external
        inState(_escrowId, EscrowState.InProgress)
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.freelancer, "Not involved");

        if (msg.sender == escrow.client) {
            escrow.clientDisputed = true;
        } else {
            escrow.freelancerDisputed = true;
        }

        require(escrow.clientDisputed && escrow.freelancerDisputed, "Both parties must agree");

        escrow.state = EscrowState.Disputed;
        emit DisputeRaised(_escrowId, msg.sender);
    }

    // Resolve dispute (arbitrator only)
    function resolveDispute(uint256 _escrowId, address _winner)
        external
        onlyArbitrator(_escrowId)
        inState(_escrowId, EscrowState.Disputed)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(_winner == escrow.client || _winner == escrow.freelancer, "Winner must be client or freelancer");

        uint256 totalReceived = escrow.amount;
        uint256 yieldEarned = 0;

        // Withdraw from Aave
        if (escrow.yieldActive) {
            bool withdrawSuccess = _withdrawFromYield(type(uint256).max);
            if (withdrawSuccess) {
                uint256 contractBalance = stablecoin.balanceOf(address(this));
                if (contractBalance > escrow.amount) {
                    yieldEarned = contractBalance - escrow.amount;
                }
                totalReceived = contractBalance;
            }
        }

        escrow.yieldEarned = yieldEarned;

        // Arbitrator gets 10% of yield as fee
        uint256 arbitratorFee = (yieldEarned * 10) / 100;
        uint256 amountToWinner = escrow.amount + (yieldEarned - arbitratorFee);

        stablecoin.transfer(_winner, amountToWinner);
        if (arbitratorFee > 0) {
            stablecoin.transfer(escrow.arbitrator, arbitratorFee);
        }

        escrow.amount = 0;
        escrow.state = EscrowState.Released;

        emit DisputeResolved(_escrowId, _winner, amountToWinner, arbitratorFee);
    }

    // Admin: Pause protocol
    function pause() external onlyOwner {
        isPaused = true;
        emit Paused();
    }

    // Admin: Unpause protocol
    function unpause() external onlyOwner {
        isPaused = false;
        emit Unpaused();
    }

    // View: Get escrow details
    function getEscrow(uint256 _escrowId) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }
}