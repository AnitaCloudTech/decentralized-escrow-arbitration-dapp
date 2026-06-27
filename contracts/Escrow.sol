// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ConditionalEscrow
 * @dev Decentralizovani escrow sa podrškom za arbitražu
 * 
 * Tok rada:
 * 1. Kupac kreira escrow i deponuje ETH
 * 2. Prodavac isporuči robu/uslugu
 * 3. Kupac potvrdi prijem -> sredstva idu prodavcu
 *    ILI
 * 4. Jedna strana pokrene spor
 * 5. Arbitar odlučuje ko dobija sredstva
 */
contract ConditionalEscrow {
    
    enum State {
        CREATED,    // Escrow kreiran, čeka finansiranje
        FUNDED,     // Sredstva deponovana
        IN_DISPUTE, // Spor pokrenut
        COMPLETED,  // Uspešno završen (sredstva oslobođena prodavcu)
        REFUNDED,   // Sredstva vraćena kupcu
        RESOLVED    // Spor rešen arbitražnom odlukom
    }
    
    struct EscrowData {
        address payable buyer;    // Kupac koji deponuje sredstva
        address payable seller;   // Prodavac koji prima sredstva
        address arbiter;          // Arbitar koji rešava sporove
        uint256 amount;           // Iznos u wei
        State state;              // Trenutno stanje
        uint256 createdAt;        // Vreme kreiranja
        uint256 fundedAt;         // Vreme finansiranja
        uint256 completedAt;      // Vreme završetka
        string description;       // Opis transakcije
    }
    
    mapping(uint256 => EscrowData) public escrows;
    uint256 public escrowCount;
    
    // Reentrancy zaštita
    mapping(uint256 => bool) private locked;
    
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        uint256 amount,
        uint256 timestamp
    );
    
    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsReleased(
        uint256 indexed escrowId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed raisedBy,
        uint256 timestamp
    );
    
    event ArbitrationDecision(
        uint256 indexed escrowId,
        address indexed arbiter,
        address indexed winner,
        uint256 amount,
        uint256 timestamp
    );
    
    event RefundIssued(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    
    modifier onlyBuyer(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].buyer,
            "Escrow: Samo kupac moze izvrsiti ovu akciju"
        );
        _;
    }
    
    modifier onlySeller(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].seller,
            "Escrow: Samo prodavac moze izvrsiti ovu akciju"
        );
        _;
    }
    
    modifier onlyArbiter(uint256 _escrowId) {
        require(
            msg.sender == escrows[_escrowId].arbiter,
            "Escrow: Samo arbitar moze izvrsiti ovu akciju"
        );
        _;
    }
    
    modifier onlyParties(uint256 _escrowId) {
        EscrowData storage e = escrows[_escrowId];
        require(
            msg.sender == e.buyer || msg.sender == e.seller,
            "Escrow: Samo kupac ili prodavac mogu pokrenuti spor"
        );
        _;
    }
    
    modifier inState(uint256 _escrowId, State _state) {
        require(
            escrows[_escrowId].state == _state,
            "Escrow: Pogresno stanje za ovu akciju"
        );
        _;
    }
    
    modifier noReentrancy(uint256 _escrowId) {
        require(!locked[_escrowId], "Escrow: Reentrancy napad detektovan");
        locked[_escrowId] = true;
        _;
        locked[_escrowId] = false;
    }
    
    modifier validEscrow(uint256 _escrowId) {
        require(_escrowId < escrowCount, "Escrow: Nepostojeci escrow ID");
        _;
    }
    
    /**
     * @dev Kreiranje novog escrow-a
     * @param _seller Adresa prodavca
     * @param _arbiter Adresa arbitara
     * @param _description Opis transakcije
     * @return escrowId ID novokreiranog escrow-a
     */
    function createEscrow(
        address payable _seller,
        address _arbiter,
        string calldata _description
    ) external returns (uint256 escrowId) {
        // Validacija ulaznih parametara
        require(_seller != address(0), "Escrow: Nevalidna adresa prodavca");
        require(_arbiter != address(0), "Escrow: Nevalidna adresa arbitara");
        require(_seller != msg.sender, "Escrow: Kupac i prodavac moraju biti razliciti");
        require(_arbiter != msg.sender, "Escrow: Kupac ne moze biti arbitar");
        require(_arbiter != _seller, "Escrow: Prodavac ne moze biti arbitar");
        require(bytes(_description).length > 0, "Escrow: Opis ne sme biti prazan");
        
        escrowId = escrowCount++;
        
        escrows[escrowId] = EscrowData({
            buyer: payable(msg.sender),
            seller: _seller,
            arbiter: _arbiter,
            amount: 0,
            state: State.CREATED,
            createdAt: block.timestamp,
            fundedAt: 0,
            completedAt: 0,
            description: _description
        });
        
        emit EscrowCreated(
            escrowId,
            msg.sender,
            _seller,
            _arbiter,
            0,
            block.timestamp
        );
        
        return escrowId;
    }
    
    /**
     * @dev Finansiranje escrow-a od strane kupca
     * @param _escrowId ID escrow-a koji se finansira
     */
    function fundEscrow(uint256 _escrowId)
        external
        payable
        validEscrow(_escrowId)
        onlyBuyer(_escrowId)
        inState(_escrowId, State.CREATED)
    {
        require(msg.value > 0, "Escrow: Iznos mora biti veci od nule");
        
        EscrowData storage e = escrows[_escrowId];
        e.amount = msg.value;
        e.state = State.FUNDED;
        e.fundedAt = block.timestamp;
        
        emit EscrowFunded(_escrowId, msg.value, block.timestamp);
    }
    
    /**
     * @dev Kupac potvrđuje prijem i oslobađa sredstva prodavcu
     * @param _escrowId ID escrow-a
     */
    function confirmDelivery(uint256 _escrowId)
        external
        validEscrow(_escrowId)
        onlyBuyer(_escrowId)
        inState(_escrowId, State.FUNDED)
        noReentrancy(_escrowId)
    {
        EscrowData storage e = escrows[_escrowId];
        uint256 amount = e.amount;
        
        e.state = State.COMPLETED;
        e.amount = 0; // Zaštita od dvostrukog oslobađanja
        e.completedAt = block.timestamp;
        
        // Transfer sredstava prodavcu
        (bool success, ) = e.seller.call{value: amount}("");
        require(success, "Escrow: Transfer prodavcu nije uspeo");
        
        emit FundsReleased(_escrowId, e.seller, amount, block.timestamp);
    }
    
    /**
     * @dev Pokretanje spora od strane kupca ili prodavca
     * @param _escrowId ID escrow-a
     */
    function raiseDispute(uint256 _escrowId)
        external
        validEscrow(_escrowId)
        onlyParties(_escrowId)
        inState(_escrowId, State.FUNDED)
    {
        escrows[_escrowId].state = State.IN_DISPUTE;
        
        emit DisputeRaised(_escrowId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Arbitar donosi odluku o sporu
     * @param _escrowId ID escrow-a
     * @param _buyerWins true ako kupac dobija sredstva, false ako prodavac
     */
    function resolveDispute(uint256 _escrowId, bool _buyerWins)
        external
        validEscrow(_escrowId)
        onlyArbiter(_escrowId)
        inState(_escrowId, State.IN_DISPUTE)
        noReentrancy(_escrowId)
    {
        EscrowData storage e = escrows[_escrowId];
        uint256 amount = e.amount;
        address payable winner;
        
        e.amount = 0; // Zaštita od dvostrukog oslobađanja
        e.state = State.RESOLVED;
        e.completedAt = block.timestamp;
        
        if (_buyerWins) {
            winner = e.buyer;
        } else {
            winner = e.seller;
        }
        
        (bool success, ) = winner.call{value: amount}("");
        require(success, "Escrow: Transfer pri arbitrazi nije uspeo");
        
        emit ArbitrationDecision(
            _escrowId,
            msg.sender,
            winner,
            amount,
            block.timestamp
        );
    }
    
    /**
     * @dev Povraćaj sredstava kupcu (može inicirati samo prodavac)
     * @param _escrowId ID escrow-a
     */
    function refundBuyer(uint256 _escrowId)
        external
        validEscrow(_escrowId)
        onlySeller(_escrowId)
        inState(_escrowId, State.FUNDED)
        noReentrancy(_escrowId)
    {
        EscrowData storage e = escrows[_escrowId];
        uint256 amount = e.amount;
        
        e.amount = 0;
        e.state = State.REFUNDED;
        e.completedAt = block.timestamp;
        
        (bool success, ) = e.buyer.call{value: amount}("");
        require(success, "Escrow: Povracaj kupcu nije uspeo");
        
        emit RefundIssued(_escrowId, e.buyer, amount, block.timestamp);
    }
    
    /**
     * @dev Vraća sve detalje escrow-a
     */
    function getEscrow(uint256 _escrowId)
        external
        view
        validEscrow(_escrowId)
        returns (EscrowData memory)
    {
        return escrows[_escrowId];
    }
    
    /**
     * @dev Vraća trenutno stanje escrow-a kao string
     */
    function getState(uint256 _escrowId)
        external
        view
        validEscrow(_escrowId)
        returns (string memory)
    {
        State s = escrows[_escrowId].state;
        if (s == State.CREATED) return "CREATED";
        if (s == State.FUNDED) return "FUNDED";
        if (s == State.IN_DISPUTE) return "IN_DISPUTE";
        if (s == State.COMPLETED) return "COMPLETED";
        if (s == State.REFUNDED) return "REFUNDED";
        if (s == State.RESOLVED) return "RESOLVED";
        return "UNKNOWN";
    }
    
    /**
     * @dev Vraća balans ugovora (za verifikaciju)
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}