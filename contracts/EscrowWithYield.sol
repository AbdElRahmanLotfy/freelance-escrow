// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
        bool yieldActive; // Track if yield is active
    }

    // State variables
    IERC20 public stablecoin;
    address public yieldStrategy;
    mapping(uint256 => EscrowDetails) public escrows;
    uint256 public escrowCounter;

    // Events
    event EscrowCreated(uint256 indexed escrowId, address client, address freelancer, uint256 duration);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event EscrowStarted(uint256 indexed escrowId, uint256 startTime);
    event EscrowReleased(uint256 indexed escrowId, address freelancer, uint256 amount, uint256 yieldBonus);
    event EscrowRefunded(uint256 indexed escrowId, address client, uint256 amount, uint256 yieldDiscount);
    event DisputeRaised(uint256 indexed escrowId, address raisedBy);
    event DisputeResolved(uint256 indexed escrowId, address winner, uint256 amount, uint256 arbitratorFee);

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

    // Constructor
    constructor(address _stablecoin, address _yieldStrategy) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin");
        require(_yieldStrategy != address(0), "Invalid yield strategy");
        stablecoin = IERC20(_stablecoin);
        yieldStrategy = _yieldStrategy;
    }

    // Create escrow
    function createEscrow(
        address _freelancer,
        address _arbitrator,
        uint256 _duration
    ) external {
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

    // Fund escrow with USDC
    function fundEscrow(uint256 _escrowId, uint256 _amount)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Created)
        nonReentrant
    {
        require(_amount > 0, "Amount must be > 0");

        // Transfer USDC from client to contract
        stablecoin.transferFrom(msg.sender, address(this), _amount);

        EscrowDetails storage escrow = escrows[_escrowId];
        escrow.amount = _amount;

        // Try to deposit into yield strategy
        bool depositSuccess = false;
        try this._depositToYield(_amount) {
            depositSuccess = true;
        } catch {
            // Deposit failed, keep funds in contract
            depositSuccess = false;
        }

        escrow.yieldActive = depositSuccess;
        escrow.state = EscrowState.Funded;

        emit EscrowFunded(_escrowId, _amount);
    }

    // Internal function for yield deposit
    function _depositToYield(uint256 _amount) external {
        require(msg.sender == address(this), "Only contract can call");
        stablecoin.approve(yieldStrategy, _amount);
        (bool success, ) = yieldStrategy.call(
            abi.encodeWithSignature("deposit(uint256)", _amount)
        );
        require(success, "Yield deposit failed");
    }

    // Start work (client approves freelancer to begin)
    function startWork(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Funded)
    {
        escrows[_escrowId].startTime = block.timestamp;
        escrows[_escrowId].state = EscrowState.InProgress;
        emit EscrowStarted(_escrowId, block.timestamp);
    }

    // Release payment to freelancer
    function releasePayment(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalAmount = escrow.amount;
        uint256 yieldBonus = 0;
        uint256 clientDiscount = 0;

        // Only calculate yield if yield strategy is active
        if (escrow.yieldActive) {
            uint256 timeElapsed = block.timestamp - escrow.startTime;
            uint256 yieldEarned = calculateYield(escrow.amount, timeElapsed);
            escrow.yieldEarned = yieldEarned;

            // Split yield: 70% freelancer bonus, 30% client discount
            yieldBonus = (yieldEarned * 70) / 100;
            clientDiscount = yieldEarned - yieldBonus;

            // Try to withdraw from yield strategy
            try this._withdrawFromYield(escrow.amount + yieldEarned) {
                // Withdrawal succeeded
                totalAmount = escrow.amount + yieldEarned;
            } catch {
                // If withdrawal fails, use contract balance
                totalAmount = escrow.amount;
                escrow.yieldActive = false;
                yieldBonus = 0;
                clientDiscount = 0;
            }
        }

        uint256 freelancerPayment = escrow.amount + yieldBonus;
        uint256 clientRefund = clientDiscount;

        // Send payments
        if (freelancerPayment > 0) {
            stablecoin.transfer(escrow.freelancer, freelancerPayment);
        }
        if (clientRefund > 0) {
            stablecoin.transfer(escrow.client, clientRefund);
        }

        escrow.amount = 0;
        escrow.state = EscrowState.Released;
        emit EscrowReleased(_escrowId, escrow.freelancer, escrow.amount, yieldBonus);
    }

    // Refund client (if freelancer fails to deliver)
    function refundClient(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalRefund = escrow.amount;
        uint256 yieldCompensation = 0;

        // Only calculate yield if yield strategy is active
        if (escrow.yieldActive) {
            uint256 timeElapsed = block.timestamp - escrow.startTime;
            uint256 yieldEarned = calculateYield(escrow.amount, timeElapsed);
            escrow.yieldEarned = yieldEarned;

            // Try to withdraw from yield strategy
            try this._withdrawFromYield(escrow.amount + yieldEarned) {
                // Withdrawal succeeded
                totalRefund = escrow.amount + yieldEarned;
                yieldCompensation = yieldEarned;
            } catch {
                // If withdrawal fails, use contract balance
                totalRefund = escrow.amount;
                escrow.yieldActive = false;
            }
        }

        // Send refund
        if (totalRefund > 0) {
            stablecoin.transfer(escrow.client, totalRefund);
        }

        escrow.amount = 0;
        escrow.state = EscrowState.Refunded;
        emit EscrowRefunded(_escrowId, escrow.client, escrow.amount, yieldCompensation);
    }

    // Internal function for yield withdrawal
    function _withdrawFromYield(uint256 _amount) external {
        require(msg.sender == address(this), "Only contract can call");
        (bool success, ) = yieldStrategy.call(
            abi.encodeWithSignature("withdraw(uint256)", _amount)
        );
        require(success, "Yield withdraw failed");
    }

    // Raise dispute
    function raiseDispute(uint256 _escrowId)
        external
        inState(_escrowId, EscrowState.InProgress)
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.freelancer, "Not involved");

        if (msg.sender == escrow.client) {
            escrow.clientDisputed = true;
        } else {
            escrow.freelancerDisputed = true;
        }

        require(escrow.clientDisputed && escrow.freelancerDisputed, "Both parties must agree");

        // Calculate current yield only if active
        if (escrow.yieldActive) {
            uint256 timeElapsed = block.timestamp - escrow.startTime;
            escrow.yieldEarned = calculateYield(escrow.amount, timeElapsed);
        }

        escrow.state = EscrowState.Disputed;
        emit DisputeRaised(_escrowId, msg.sender);
    }

    // Resolve dispute
    function resolveDispute(uint256 _escrowId, address _winner)
        external
        onlyArbitrator(_escrowId)
        inState(_escrowId, EscrowState.Disputed)
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(_winner == escrow.client || _winner == escrow.freelancer, "Winner must be client or freelancer");

        uint256 amountToWinner = escrow.amount;
        uint256 arbitratorFee = 0;

        if (escrow.yieldActive && escrow.yieldEarned > 0) {
            try this._withdrawFromYield(escrow.amount + escrow.yieldEarned) {
                // Arbitrator gets 10% of yield as fee
                arbitratorFee = (escrow.yieldEarned * 10) / 100;
                amountToWinner = escrow.amount + (escrow.yieldEarned - arbitratorFee);
            } catch {
                // If withdrawal fails, use contract balance
                amountToWinner = escrow.amount;
                arbitratorFee = 0;
            }
        }

        stablecoin.transfer(_winner, amountToWinner);
        if (arbitratorFee > 0) {
            stablecoin.transfer(escrow.arbitrator, arbitratorFee);
        }

        escrow.amount = 0;
        emit DisputeResolved(_escrowId, _winner, amountToWinner, arbitratorFee);
    }

    // Helper: Calculate yield (simplified - 5% APY)
    function calculateYield(uint256 _amount, uint256 _timeElapsed)
        internal
        pure
        returns (uint256)
    {
        uint256 apy = 5; // 5% APY
        return (_amount * apy * _timeElapsed) / (100 * 365 days);
    }

    // View function to get escrow details
    function getEscrow(uint256 _escrowId) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }
}