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

    function getReserveData(address asset)
        external
        view
        returns (
            uint256 liquidityRate,
            uint256 variableBorrowRate,
            uint256 stableBorrowRate,
            uint256 averageStableBorrowRate,
            uint256 liquidityIndex,
            uint256 variableBorrowIndex,
            uint40 lastUpdateTimestamp
        );
}

contract MockYieldStrategy is Ownable, ReentrancyGuard {
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
        uint256 duration;
        EscrowState state;
        bool clientDisputed;
        bool freelancerDisputed;
        bool yieldActive;
    }

    // State variables
    IERC20 public stablecoin;
    IAavePool public aavePool;
    mapping(uint256 => EscrowDetails) public escrows;
    uint256 public escrowCounter;
    bool public isPaused;

    // Events
    event EscrowCreated(uint256 indexed escrowId, address client, address freelancer, uint256 duration);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
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
        aavePool = IAavePool(_aavePool);
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

    // Fund escrow with USDC (deposits to Aave)
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

        // Supply to Aave V3
        stablecoin.approve(address(aavePool), _amount);
        aavePool.supply(address(stablecoin), _amount, address(this), 0);

        EscrowDetails storage escrow = escrows[_escrowId];
        escrow.amount = _amount;
        escrow.yieldActive = true;
        escrow.state = EscrowState.Funded;

        emit EscrowFunded(_escrowId, _amount);
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

    // Release payment to freelancer
    function releasePayment(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalReceived = escrow.amount;

        // Withdraw from Aave
        if (escrow.yieldActive) {
            uint256 withdrawn = aavePool.withdraw(
                address(stablecoin),
                type(uint256).max,
                address(this)
            );
            totalReceived = withdrawn;
            escrow.yieldEarned = withdrawn > escrow.amount ? withdrawn - escrow.amount : 0;
        }

        // Calculate yield split
        uint256 freelancerBonus = (escrow.yieldEarned * 70) / 100;
        uint256 clientDiscount = escrow.yieldEarned - freelancerBonus;

        uint256 freelancerPayment = escrow.amount + freelancerBonus;
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
        emit EscrowReleased(_escrowId, escrow.freelancer, freelancerPayment, freelancerBonus);
    }

    // Refund client
    function refundClient(uint256 _escrowId)
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        uint256 totalReceived = escrow.amount;

        if (escrow.yieldActive) {
            uint256 withdrawn = aavePool.withdraw(
                address(stablecoin),
                type(uint256).max,
                address(this)
            );
            totalReceived = withdrawn;
            escrow.yieldEarned = withdrawn > escrow.amount ? withdrawn - escrow.amount : 0;
        }

        if (totalReceived > 0) {
            stablecoin.transfer(escrow.client, totalReceived);
        }

        escrow.amount = 0;
        escrow.state = EscrowState.Refunded;
        emit EscrowRefunded(_escrowId, escrow.client, totalReceived, escrow.yieldEarned);
    }

    // Raise dispute
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

        if (escrow.yieldActive) {
            uint256 withdrawn = aavePool.withdraw(
                address(stablecoin),
                type(uint256).max,
                address(this)
            );
            escrow.yieldEarned = withdrawn > escrow.amount ? withdrawn - escrow.amount : 0;
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
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(_winner == escrow.client || _winner == escrow.freelancer, "Winner must be client or freelancer");

        // Arbitrator gets 10% of yield as fee
        uint256 arbitratorFee = (escrow.yieldEarned * 10) / 100;
        uint256 amountToWinner = escrow.amount + (escrow.yieldEarned - arbitratorFee);

        stablecoin.transfer(_winner, amountToWinner);
        if (arbitratorFee > 0) {
            stablecoin.transfer(escrow.arbitrator, arbitratorFee);
        }

        escrow.amount = 0;
        emit DisputeResolved(_escrowId, _winner, amountToWinner, arbitratorFee);
    }

    // Admin functions
    function pause() external onlyOwner {
        isPaused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        isPaused = false;
        emit Unpaused();
    }

    // View function
    function getEscrow(uint256 _escrowId) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }
}