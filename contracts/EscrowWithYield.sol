// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAaveProtocolDataProvider {
    function getReserveTokensAddresses(
        address asset
    )
        external
        view
        returns (
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress
        );
}

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

    function getReserveData(
        address asset
    )
        external
        view
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress
        );
}

interface IAToken is IERC20 {
    function scaledBalanceOf(address user) external view returns (uint256);
}

contract EscrowWithYield is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           TYPES
    // =============================================================

    enum EscrowState {
        Created,
        Funded,
        InProgress,
        Released,
        Refunded,
        Disputed
    }

    struct EscrowDetails {
        address client;
        address freelancer;
        address arbitrator;
        // Original principal deposited by the client.
        uint256 amount;
        // Yield allocated to this escrow when settled.
        uint256 yieldEarned;
        // Timestamp at which work started.
        uint256 startTime;
        // Work duration in seconds.
        uint256 duration;
        EscrowState state;
        bool clientDisputed;
        bool freelancerDisputed;
        // Whether this escrow currently owns an Aave position.
        bool yieldActive;
        /*
         * Scaled aToken units belonging to this escrow.
         *
         * Aave aTokens use a scaled balance internally.
         * Tracking this allows multiple escrows to share one
         * aUSDC position safely.
         */
        uint256 scaledATokenShares;
    }

    // =============================================================
    //                       STATE VARIABLES
    // =============================================================

    IERC20 public immutable stablecoin;

    IAavePool public immutable yieldStrategy;

    IAToken public immutable aToken;

    mapping(uint256 => EscrowDetails) public escrows;

    uint256 public escrowCounter;

    bool public isPaused;

    /*
     * Sum of all original principals currently represented by
     * active Aave positions.
     */
    uint256 public totalYieldPrincipal;

    /*
     * Sum of all scaled aToken shares belonging to active escrows.
     */
    uint256 public totalScaledATokenShares;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed freelancer,
        uint256 duration
    );

    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 amount,
        bool yieldActive
    );

    event EscrowStarted(uint256 indexed escrowId, uint256 startTime);

    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed freelancer,
        uint256 amount,
        uint256 yieldBonus
    );

    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed client,
        uint256 amount,
        uint256 yieldCompensation
    );

    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy);

    event DisputeResolved(
        uint256 indexed escrowId,
        address indexed winner,
        uint256 amount,
        uint256 arbitratorFee
    );

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    // =============================================================
    //                         MODIFIERS
    // =============================================================

    modifier onlyClient(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].client,
            "Only client can call"
        );
        _;
    }

    modifier onlyFreelancer(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].freelancer,
            "Only freelancer can call"
        );
        _;
    }

    modifier onlyArbitrator(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].arbitrator,
            "Only arbitrator can call"
        );
        _;
    }

    // slither-disable-next-line incorrect-equality
    modifier inState(uint256 _escrowId, EscrowState _state) {
        require(escrows[_escrowId].state == _state, "Invalid escrow state");
        _;
    }

    modifier notPaused() {
        require(!isPaused, "Protocol is paused");
        _;
    }

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    constructor(
        address _stablecoin,
        address _aavePool,
        address _aToken
    ) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin");

        require(_aavePool != address(0), "Invalid Aave pool");

        require(_aToken != address(0), "Invalid aToken");

        stablecoin = IERC20(_stablecoin);

        yieldStrategy = IAavePool(_aavePool);

        aToken = IAToken(_aToken);
    }
    // =============================================================
    //                       CREATE ESCROW
    // =============================================================

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
            yieldActive: false,
            scaledATokenShares: 0
        });

        emit EscrowCreated(escrowCounter, msg.sender, _freelancer, _duration);

        escrowCounter++;
    }

    // =============================================================
    //                       FUND ESCROW
    // =============================================================

    // slither-disable-next-line reentrancy-no-eth
    function fundEscrow(
        uint256 _escrowId,
        uint256 _amount
    )
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Created)
        nonReentrant
        notPaused
    {
        require(_amount > 0, "Amount must be > 0");

        EscrowDetails storage escrow = escrows[_escrowId];

        /*
         * Pull USDC from client.
         */
        stablecoin.safeTransferFrom(msg.sender, address(this), _amount);

        escrow.amount = _amount;

        /*
         * Attempt to deposit into Aave.
         */
        bool deposited = _depositToYield(_amount, _escrowId);

        escrow.yieldActive = deposited;

        if (!deposited) {
            /*
             * Fallback:
             *
             * The escrow remains usable without yield.
             * The USDC stays inside this contract.
             */
            escrow.state = EscrowState.Funded;

            emit EscrowFunded(_escrowId, _amount, false);

            return;
        }

        escrow.state = EscrowState.Funded;

        emit EscrowFunded(_escrowId, _amount, true);
    }

    // =============================================================
    //                    DEPOSIT INTO AAVE
    // =============================================================

    function _depositToYield(
        uint256 _amount,
        uint256 _escrowId
    ) internal returns (bool) {
        /*
         * Record scaled balance before supply.
         */
        uint256 scaledBefore = aToken.scaledBalanceOf(address(this));

        /*
         * Approve Aave.
         */
        stablecoin.forceApprove(address(yieldStrategy), _amount);

        try
            yieldStrategy.supply(address(stablecoin), _amount, address(this), 0)
        {
            /*
             * Clear allowance after supply.
             */
            stablecoin.forceApprove(address(yieldStrategy), 0);

            /*
             * Record scaled balance after supply.
             */
            uint256 scaledAfter = aToken.scaledBalanceOf(address(this));

            require(scaledAfter > scaledBefore, "No aToken received");

            uint256 shares = scaledAfter - scaledBefore;

            escrows[_escrowId].scaledATokenShares = shares;

            totalScaledATokenShares += shares;

            totalYieldPrincipal += escrows[_escrowId].amount;

            return true;
        } catch {
            stablecoin.forceApprove(address(yieldStrategy), 0);

            return false;
        }
    }

    // =============================================================
    //                CURRENT AAVE VALUE FOR ESCROW
    // =============================================================

    // slither-disable-next-line incorrect-equality
    function getEscrowYieldValue(
        uint256 _escrowId
    )
        public
        view
        returns (uint256 principal, uint256 currentValue, uint256 currentYield)
    {
        EscrowDetails memory escrow = escrows[_escrowId];

        principal = escrow.amount;

        if (
            !escrow.yieldActive ||
            escrow.scaledATokenShares == 0 ||
            totalScaledATokenShares == 0
        ) {
            return (principal, principal, 0);
        }

        uint256 currentATokenBalance = aToken.balanceOf(address(this));

        currentValue =
            (currentATokenBalance * escrow.scaledATokenShares) /
            totalScaledATokenShares;

        if (currentValue > principal) {
            currentYield = currentValue - principal;
        }
    }

    // =============================================================
    //                   WITHDRAW ESCROW POSITION
    // =============================================================

    function _withdrawEscrowFromYield(
        uint256 _escrowId
    )
        internal
        returns (uint256 principal, uint256 totalReceived, uint256 yieldEarned)
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        principal = escrow.amount;

        if (!escrow.yieldActive || escrow.scaledATokenShares == 0) {
            return (principal, principal, 0);
        }

        require(
            totalScaledATokenShares >= escrow.scaledATokenShares,
            "Invalid aToken accounting"
        );

        /*
         * Current aggregate aToken balance includes accrued yield.
         */
        uint256 aggregateATokenBalance = aToken.balanceOf(address(this));

        /*
         * Calculate this escrow's proportional position.
         */
        uint256 escrowValue = (aggregateATokenBalance *
            escrow.scaledATokenShares) / totalScaledATokenShares;

        /*
         * Protect against rounding or unexpected index behavior.
         */
        if (escrowValue < principal) {
            escrowValue = principal;
        }

        /*
         * Withdraw exactly this escrow's current Aave value.
         */

        // slither-disable-next-line reentrancy-balance
        uint256 withdrawn = yieldStrategy.withdraw(
            address(stablecoin),
            escrowValue,
            address(this)
        );

        require(withdrawn >= principal, "Aave returned less than principal");

        totalReceived = withdrawn;

        yieldEarned = withdrawn - principal;

        /*
         * Remove accounting shares.
         */
        totalScaledATokenShares -= escrow.scaledATokenShares;

        totalYieldPrincipal -= principal;

        escrow.scaledATokenShares = 0;
        escrow.yieldActive = false;
    }

    // =============================================================
    //                         START WORK
    // =============================================================

    function startWork(
        uint256 _escrowId
    )
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.Funded)
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        escrow.startTime = block.timestamp;

        escrow.state = EscrowState.InProgress;

        emit EscrowStarted(_escrowId, block.timestamp);
    }

    // =============================================================
    //                     RELEASE PAYMENT
    // =============================================================

    // slither-disable-next-line reentrancy-no-eth
    function releasePayment(
        uint256 _escrowId
    )
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        // slither-disable-next-line timestamp
        require(
            block.timestamp >= escrow.startTime + escrow.duration,
            "Work period not finished"
        );

        (
            uint256 principal,
            uint256 totalReceived,
            uint256 yieldEarned
        ) = _withdrawEscrowFromYield(_escrowId);

        /*
         * If yield was disabled, totalReceived is principal.
         */
        escrow.yieldEarned = yieldEarned;

        /*
         * 70% -> freelancer
         * 30% -> client
         */
        uint256 freelancerBonus = (yieldEarned * 70) / 100;

        uint256 clientDiscount = yieldEarned - freelancerBonus;

        uint256 freelancerPayment = principal + freelancerBonus;

        require(
            totalReceived >= freelancerPayment + clientDiscount,
            "Insufficient escrow value"
        );

        stablecoin.safeTransfer(escrow.freelancer, freelancerPayment);

        if (clientDiscount > 0) {
            stablecoin.safeTransfer(escrow.client, clientDiscount);
        }

        escrow.amount = 0;

        escrow.state = EscrowState.Released;

        emit EscrowReleased(
            _escrowId,
            escrow.freelancer,
            principal,
            freelancerBonus
        );
    }

    // =============================================================
    //                       REFUND CLIENT
    // =============================================================

    // slither-disable-next-line reentrancy-no-eth
    function refundClient(
        uint256 _escrowId
    )
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        (
            uint256 principal,
            uint256 totalReceived,
            uint256 yieldEarned
        ) = _withdrawEscrowFromYield(_escrowId);

        require(totalReceived >= principal, "Insufficient refund");

        escrows[_escrowId].yieldEarned = yieldEarned;

        /*
         * Client receives principal + all yield on refund.
         */
        stablecoin.safeTransfer(escrows[_escrowId].client, totalReceived);

        escrows[_escrowId].amount = 0;

        escrows[_escrowId].state = EscrowState.Refunded;

        emit EscrowRefunded(
            _escrowId,
            escrows[_escrowId].client,
            principal,
            yieldEarned
        );
    }

    // =============================================================
    //                       RAISE DISPUTE
    // =============================================================

    function raiseDispute(
        uint256 _escrowId
    ) external inState(_escrowId, EscrowState.InProgress) notPaused {
        EscrowDetails storage escrow = escrows[_escrowId];

        require(
            msg.sender == escrow.client || msg.sender == escrow.freelancer,
            "Not involved"
        );

        if (msg.sender == escrow.client) {
            escrow.clientDisputed = true;
        } else {
            escrow.freelancerDisputed = true;
        }

        /*
         * IMPORTANT:
         *
         * Do NOT withdraw from Aave here.
         *
         * The funds remain earning yield while the arbitrator
         * decides the dispute.
         */
        escrow.state = EscrowState.Disputed;

        emit DisputeRaised(_escrowId, msg.sender);
    }

    // =============================================================
    //                    RESOLVE DISPUTE
    // =============================================================

    // slither-disable-next-line reentrancy-no-eth
    function resolveDispute(
        uint256 _escrowId,
        address _winner
    )
        external
        onlyArbitrator(_escrowId)
        inState(_escrowId, EscrowState.Disputed)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];

        require(
            _winner == escrow.client || _winner == escrow.freelancer,
            "Winner must be client or freelancer"
        );

        (
            uint256 principal,
            uint256 totalReceived,
            uint256 yieldEarned
        ) = _withdrawEscrowFromYield(_escrowId);

        escrow.yieldEarned = yieldEarned;

        /*
         * Arbitrator receives 10% of yield ONLY.
         *
         * Principal is never charged.
         */
        uint256 arbitratorFee = (yieldEarned * 10) / 100;

        uint256 winnerYield = yieldEarned - arbitratorFee;

        uint256 winnerAmount = principal + winnerYield;

        require(
            totalReceived >= winnerAmount + arbitratorFee,
            "Insufficient dispute value"
        );

        stablecoin.safeTransfer(_winner, winnerAmount);

        if (arbitratorFee > 0) {
            stablecoin.safeTransfer(escrow.arbitrator, arbitratorFee);
        }

        escrow.amount = 0;

        escrow.state = EscrowState.Released;

        emit DisputeResolved(_escrowId, _winner, winnerAmount, arbitratorFee);
    }

    // =============================================================
    //                           ADMIN
    // =============================================================

    function pause() external onlyOwner {
        isPaused = true;

        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        isPaused = false;

        emit Unpaused(msg.sender);
    }

    // =============================================================
    //                           VIEWS
    // =============================================================

    function getEscrow(
        uint256 _escrowId
    ) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }

    function getEscrowCount() external view returns (uint256) {
        return escrowCounter;
    }

    function getTotalYieldPrincipal() external view returns (uint256) {
        return totalYieldPrincipal;
    }

    function getTotalScaledATokenShares() external view returns (uint256) {
        return totalScaledATokenShares;
    }

    function getATokenBalance() external view returns (uint256) {
        return aToken.balanceOf(address(this));
    }
}
