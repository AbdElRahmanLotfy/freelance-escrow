// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
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

interface IAToken is IERC20 {
    function scaledBalanceOf(address user) external view returns (uint256);
}

contract MilestoneEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum EscrowState {
        Created,
        InProgress,
        Released,
        Disputed
    }

    struct Milestone {
        uint256 amount;
        bool isReleased;
        uint256 workSubmittedAt;
        bool isDisputed;
    }

    struct EscrowDetails {
        address client;
        address freelancer;
        address arbitrator;
        uint256 totalAmount;
        EscrowState state;
        bool yieldActive;
        uint256 scaledATokenShares;
        Milestone[] milestones;
    }

    IERC20 public immutable stablecoin;
    IAavePool public immutable yieldStrategy;
    IAToken public immutable aToken;
    mapping(uint256 => EscrowDetails) public escrows;
    uint256 public escrowCounter;
    bool public isPaused;
    uint256 public totalYieldPrincipal;
    uint256 public totalScaledATokenShares;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed freelancer,
        uint256 milestoneCount
    );
    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 amount,
        bool yieldActive
    );
    event WorkSubmitted(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        uint256 timestamp
    );
    event MilestoneReleased(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        address indexed freelancer,
        uint256 amount,
        uint256 yieldBonus
    );
    event DisputeRaised(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        address indexed raisedBy
    );
    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        address indexed winner,
        uint256 amount,
        uint256 arbitratorFee
    );

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
    modifier inState(uint256 _escrowId, EscrowState _state) {
        require(escrows[_escrowId].state == _state, "Invalid escrow state");
        _;
    }
    modifier notPaused() {
        require(!isPaused, "Protocol is paused");
        _;
    }

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

    function createEscrow(
        address _freelancer,
        address _arbitrator,
        uint256[] calldata _milestoneAmounts
    ) external notPaused {
        require(_freelancer != address(0), "Invalid freelancer");
        require(_arbitrator != address(0), "Invalid arbitrator");
        require(_freelancer != msg.sender, "Cannot hire yourself");
        require(
            _milestoneAmounts.length > 0,
            "Must have at least one milestone"
        );

        uint256 total = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            total += _milestoneAmounts[i];
        }

        EscrowDetails storage escrow = escrows[escrowCounter];
        escrow.client = msg.sender;
        escrow.freelancer = _freelancer;
        escrow.arbitrator = _arbitrator;
        escrow.totalAmount = total;
        escrow.state = EscrowState.Created;

        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            escrow.milestones.push(
                Milestone(_milestoneAmounts[i], false, 0, false)
            );
        }

        emit EscrowCreated(
            escrowCounter,
            msg.sender,
            _freelancer,
            _milestoneAmounts.length
        );
        escrowCounter++;
    }

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
        EscrowDetails storage escrow = escrows[_escrowId];
        require(
            _amount == escrow.totalAmount,
            "Amount must match total milestones"
        );

        stablecoin.safeTransferFrom(msg.sender, address(this), _amount);

        bool deposited = _depositToYield(_amount, _escrowId);
        escrow.yieldActive = deposited;
        escrow.state = EscrowState.InProgress;

        emit EscrowFunded(_escrowId, _amount, deposited);
    }

    function _depositToYield(
        uint256 _amount,
        uint256 _escrowId
    ) internal returns (bool) {
        uint256 scaledBefore = aToken.scaledBalanceOf(address(this));
        stablecoin.forceApprove(address(yieldStrategy), _amount);

        try
            yieldStrategy.supply(address(stablecoin), _amount, address(this), 0)
        {
            stablecoin.forceApprove(address(yieldStrategy), 0);
            uint256 scaledAfter = aToken.scaledBalanceOf(address(this));
            require(scaledAfter > scaledBefore, "No aToken received");
            uint256 shares = scaledAfter - scaledBefore;
            escrows[_escrowId].scaledATokenShares = shares;
            totalScaledATokenShares += shares;
            totalYieldPrincipal += _amount;
            return true;
        } catch {
            stablecoin.forceApprove(address(yieldStrategy), 0);
            return false;
        }
    }

    function submitMilestone(
        uint256 _escrowId,
        uint256 _index
    )
        external
        onlyFreelancer(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        notPaused
    {
        Milestone storage m = escrows[_escrowId].milestones[_index];
        require(!m.isReleased, "Milestone already released");
        require(m.workSubmittedAt == 0, "Work already submitted");
        require(!m.isDisputed, "Milestone is disputed");

        m.workSubmittedAt = block.timestamp;
        emit WorkSubmitted(_escrowId, _index, block.timestamp);
    }

    function releaseMilestone(
        uint256 _escrowId,
        uint256 _index
    )
        external
        onlyClient(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        Milestone storage m = escrow.milestones[_index];

        require(!m.isReleased, "Milestone already released");
        require(!m.isDisputed, "Milestone is disputed");
        require(m.workSubmittedAt > 0, "Work not submitted yet");
        require(
            block.timestamp >= m.workSubmittedAt + 7 days,
            "7-day review not finished"
        );

        _processRelease(_escrowId, _index, escrow.freelancer);
    }

    function autoReleaseMilestone(
        uint256 _escrowId,
        uint256 _index
    ) external nonReentrant notPaused {
        EscrowDetails storage escrow = escrows[_escrowId];
        Milestone storage m = escrow.milestones[_index];

        require(!m.isReleased, "Milestone already released");
        require(!m.isDisputed, "Milestone is disputed");
        require(m.workSubmittedAt > 0, "Work not submitted");
        require(
            block.timestamp >= m.workSubmittedAt + 14 days,
            "14-day auto-release not passed"
        );

        _processRelease(_escrowId, _index, escrow.freelancer);
    }

    function _processRelease(
        uint256 _escrowId,
        uint256 _index,
        address _recipient
    ) internal {
        EscrowDetails storage escrow = escrows[_escrowId];
        Milestone storage m = escrow.milestones[_index];

        m.isReleased = true;
        uint256 principal = m.amount;
        uint256 yieldEarned = 0;

        if (escrow.yieldActive && escrow.scaledATokenShares > 0) {
            uint256 aggregateBalance = aToken.balanceOf(address(this));
            uint256 sharesToWithdraw = (escrow.scaledATokenShares * principal) /
                escrow.totalAmount;
            uint256 escrowValue = (aggregateBalance * sharesToWithdraw) /
                totalScaledATokenShares;
            if (escrowValue < principal) escrowValue = principal;

            uint256 withdrawn = yieldStrategy.withdraw(
                address(stablecoin),
                escrowValue,
                address(this)
            );
            yieldEarned = withdrawn > principal ? withdrawn - principal : 0;

            escrow.scaledATokenShares -= sharesToWithdraw;
            totalScaledATokenShares -= sharesToWithdraw;
            totalYieldPrincipal -= principal;
            escrow.totalAmount -= principal;
        }

        uint256 freelancerBonus = (yieldEarned * 70) / 100;
        uint256 clientDiscount = yieldEarned - freelancerBonus;

        stablecoin.safeTransfer(_recipient, principal + freelancerBonus);
        if (clientDiscount > 0)
            stablecoin.safeTransfer(escrow.client, clientDiscount);

        bool allDone = true;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (
                !escrow.milestones[i].isReleased &&
                !escrow.milestones[i].isDisputed
            ) {
                allDone = false;
                break;
            }
        }
        if (allDone) escrow.state = EscrowState.Released;

        emit MilestoneReleased(
            _escrowId,
            _index,
            _recipient,
            principal,
            freelancerBonus
        );
    }

    function raiseDispute(
        uint256 _escrowId,
        uint256 _index
    ) external inState(_escrowId, EscrowState.InProgress) notPaused {
        EscrowDetails storage escrow = escrows[_escrowId];
        Milestone storage m = escrow.milestones[_index];
        require(
            msg.sender == escrow.client || msg.sender == escrow.freelancer,
            "Not involved"
        );
        require(!m.isReleased, "Milestone already released");

        m.isDisputed = true;
        emit DisputeRaised(_escrowId, _index, msg.sender);
    }

    function resolveDispute(
        uint256 _escrowId,
        uint256 _index,
        address _winner
    )
        external
        onlyArbitrator(_escrowId)
        inState(_escrowId, EscrowState.InProgress)
        nonReentrant
        notPaused
    {
        EscrowDetails storage escrow = escrows[_escrowId];
        Milestone storage m = escrow.milestones[_index];

        require(m.isDisputed, "Milestone not disputed");
        require(
            _winner == escrow.client || _winner == escrow.freelancer,
            "Winner must be client or freelancer"
        );

        m.isDisputed = false;
        m.isReleased = true;

        uint256 principal = m.amount;
        uint256 yieldEarned = 0;

        if (escrow.yieldActive && escrow.scaledATokenShares > 0) {
            uint256 aggregateBalance = aToken.balanceOf(address(this));
            uint256 sharesToWithdraw = (escrow.scaledATokenShares * principal) /
                escrow.totalAmount;
            uint256 escrowValue = (aggregateBalance * sharesToWithdraw) /
                totalScaledATokenShares;
            if (escrowValue < principal) escrowValue = principal;

            uint256 withdrawn = yieldStrategy.withdraw(
                address(stablecoin),
                escrowValue,
                address(this)
            );
            yieldEarned = withdrawn > principal ? withdrawn - principal : 0;

            escrow.scaledATokenShares -= sharesToWithdraw;
            totalScaledATokenShares -= sharesToWithdraw;
            totalYieldPrincipal -= principal;
            escrow.totalAmount -= principal;
        }

        uint256 arbitratorFee = (yieldEarned * 10) / 100;
        uint256 winnerYield = yieldEarned - arbitratorFee;

        stablecoin.safeTransfer(_winner, principal + winnerYield);
        if (arbitratorFee > 0)
            stablecoin.safeTransfer(escrow.arbitrator, arbitratorFee);

        bool allDone = true;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (!escrow.milestones[i].isReleased) {
                allDone = false;
                break;
            }
        }
        if (allDone) escrow.state = EscrowState.Released;

        emit DisputeResolved(
            _escrowId,
            _index,
            _winner,
            principal + winnerYield,
            arbitratorFee
        );
    }

    function pause() external onlyOwner {
        isPaused = true;
    }
    function unpause() external onlyOwner {
        isPaused = false;
    }
    function getEscrow(
        uint256 _escrowId
    ) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }
    function getEscrowCount() external view returns (uint256) {
        return escrowCounter;
    }
}
