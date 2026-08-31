// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Escrow {
    // States
    enum EscrowState { Created, Funded, Released, Refunded, Disputed }

    // Struct to hold escrow details
    struct EscrowDetails {
        address client;
        address freelancer;
        address arbitrator;
        uint256 amount;
        EscrowState state;
        bool clientDisputed;
        bool freelancerDisputed;
    }

    // Mapping: escrowId -> EscrowDetails
    mapping(uint256 => EscrowDetails) public escrows;
    uint256 public escrowCounter;

    // Events
    event EscrowCreated(uint256 indexed escrowId, address client, address freelancer, uint256 amount);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, address freelancer, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address client, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address raisedBy);
    event DisputeResolved(uint256 indexed escrowId, address winner, uint256 amount);

    // Modifiers
    modifier onlyClient(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].client, "Only client can call this");
        _;
    }

    modifier onlyFreelancer(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].freelancer, "Only freelancer can call this");
        _;
    }

    modifier onlyArbitrator(uint256 _escrowId) {
        require(msg.sender == escrows[_escrowId].arbitrator, "Only arbitrator can call this");
        _;
    }

    modifier inState(uint256 _escrowId, EscrowState _state) {
        require(escrows[_escrowId].state == _state, "Invalid escrow state");
        _;
    }

    // Create a new escrow
    function createEscrow(address _freelancer, address _arbitrator) external {
        require(_freelancer != address(0), "Freelancer cannot be zero address");
        require(_arbitrator != address(0), "Arbitrator cannot be zero address");
        require(_freelancer != msg.sender, "Cannot be your own freelancer");

        escrows[escrowCounter] = EscrowDetails({
            client: msg.sender,
            freelancer: _freelancer,
            arbitrator: _arbitrator,
            amount: 0,
            state: EscrowState.Created,
            clientDisputed: false,
            freelancerDisputed: false
        });

        emit EscrowCreated(escrowCounter, msg.sender, _freelancer, 0);
        escrowCounter++;
    }

    // Fund an escrow
    function fundEscrow(uint256 _escrowId) external payable onlyClient(_escrowId) inState(_escrowId, EscrowState.Created) {
        require(msg.value > 0, "Must send ETH to fund");

        escrows[_escrowId].amount = msg.value;
        escrows[_escrowId].state = EscrowState.Funded;

        emit EscrowFunded(_escrowId, msg.value);
    }

    // Client releases payment to freelancer
    function releasePayment(uint256 _escrowId) external onlyClient(_escrowId) inState(_escrowId, EscrowState.Funded) {
        EscrowDetails storage escrow = escrows[_escrowId];
        escrow.state = EscrowState.Released;

        uint256 amount = escrow.amount;
        escrow.amount = 0; // Prevent re-entrancy

        payable(escrow.freelancer).transfer(amount);
        emit EscrowReleased(_escrowId, escrow.freelancer, amount);
    }

    // Client refunds themselves (if freelancer never delivered)
    function refundClient(uint256 _escrowId) external onlyClient(_escrowId) inState(_escrowId, EscrowState.Funded) {
        EscrowDetails storage escrow = escrows[_escrowId];
        escrow.state = EscrowState.Refunded;

        uint256 amount = escrow.amount;
        escrow.amount = 0;

        payable(escrow.client).transfer(amount);
        emit EscrowRefunded(_escrowId, escrow.client, amount);
    }

    // Raise a dispute (client or freelancer)
    function raiseDispute(uint256 _escrowId) external inState(_escrowId, EscrowState.Funded) {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.freelancer, "Not involved in escrow");

        if (msg.sender == escrow.client) {
            escrow.clientDisputed = true;
        } else {
            escrow.freelancerDisputed = true;
        }

        require(escrow.clientDisputed && escrow.freelancerDisputed, "Both parties must agree to dispute");
        escrow.state = EscrowState.Disputed;

        emit DisputeRaised(_escrowId, msg.sender);
    }

    // Arbitrator resolves dispute
    function resolveDispute(uint256 _escrowId, address _winner) external onlyArbitrator(_escrowId) inState(_escrowId, EscrowState.Disputed) {
        EscrowDetails storage escrow = escrows[_escrowId];
        require(_winner == escrow.client || _winner == escrow.freelancer, "Winner must be client or freelancer");

        uint256 amount = escrow.amount;
        escrow.amount = 0;

        payable(_winner).transfer(amount);
        emit DisputeResolved(_escrowId, _winner, amount);
    }

    // View function to get escrow details
    function getEscrow(uint256 _escrowId) external view returns (EscrowDetails memory) {
        return escrows[_escrowId];
    }
}