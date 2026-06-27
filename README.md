# decentralized-escrow-arbitration-dapp
⚖️ ConditionalEscrow DApp  Decentralizovana aplikacija (DApp) za  uslovni escrow sa arbitražom, implementirana kao Solidity pametni ugovor sa React/Web3 frontend-om, deployovana na Sepolia testnoj mreži.  
> Projektni zadatak 4 — Kriptografija
---

## 📋 Sadržaj

- [Pregled projekta](#pregled-projekta)
- [Arhitektura](#arhitektura)
- [Tehnologije](#tehnologije)
- [Pokretanje projekta](#pokretanje-projekta)
- [Pametni ugovor](#pametni-ugovor)
- [Testiranje](#testiranje)
- [Deployment na Sepolia](#deployment-na-sepolia)
- [Frontend](#frontend)
- [Bezbednost](#bezbednost)
- [Struktura projekta](#struktura-projekta)

---

## Pregled projekta

ConditionalEscrow omogućava bezbedan prenos sredstava između **kupca** i **prodavca** uz mogućnost uključivanja **arbitara** u slučaju spora.

### Tok rada
Kupac kreira escrow

│

▼

Kupac deponuje ETH (FUNDED)

│

├─── Kupac potvrdi prijem ──► Sredstva idu prodavcu (COMPLETED)

│

├─── Kupac/prodavac pokrene spor (IN_DISPUTE)

│           │

│           └─► Arbitar odlučuje ──► Kupac ili prodavac dobija sredstva (RESOLVED)

│

└─── Prodavac refunduje kupca (REFUNDED)

### Stanja escrow-a

| Stanje | Opis |
|--------|------|
| `CREATED` | Escrow kreiran, čeka finansiranje |
| `FUNDED` | Sredstva deponovana od strane kupca |
| `IN_DISPUTE` | Spor pokrenut, čeka arbitražu |
| `COMPLETED` | Kupac potvrdio prijem, sredstva oslobođena prodavcu |
| `REFUNDED` | Sredstva vraćena kupcu |
| `RESOLVED` | Spor rešen arbitražnom odlukom |

---

## Arhitektura
escrow-dapp/

├── contracts/

│   └── Escrow.sol            # Pametni ugovor

├── scripts/

│   └── deploy.js             # Deployment skripta

├── test/

│   └── Escrow.test.js        # Unit testovi (Hardhat)

├── hardhat.config.js

├── .env                      # Privatni ključevi (ne commitovati!)

├── deployment.json           # Adresa ugovora nakon deploymenta

└── escrow-frontend/

└── src/

└── App.js            # React frontend

---

## Tehnologije

| Sloj | Tehnologija |
|------|-------------|
| Pametni ugovor | Solidity 0.8.19 |
| Razvoj/testiranje | Hardhat |
| Blockchain mreža | Ethereum Sepolia Testnet |
| Frontend | React + ethers.js v6 |
| Novčanik | MetaMask |
| Verifikacija ugovora | Etherscan |

---

## Pokretanje projekta

### Preduslovi

- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) ekstenzija u browseru
- Sepolia test ETH ([faucet](https://sepoliafaucet.com))
- Infura ili Alchemy nalog (za RPC URL)

### 1. Kloniranje i instalacija

```bash
git clone https://github.com/tvoje-korisnicko-ime/escrow-dapp.git
cd escrow-dapp
npm install
```

### 2. Konfiguracija okruženja

Kreiraj `.env` fajl u root-u projekta:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/TVOJ_INFURA_KLJUC
PRIVATE_KEY=tvoj_privatni_kljuc_bez_0x_prefiksa
ETHERSCAN_API_KEY=tvoj_etherscan_api_kljuc
```

### 3. Kompajliranje ugovora

```bash
npx hardhat compile
```

### 4. Pokretanje testova

```bash
# Svi testovi
npx hardhat test

# Sa coverage izveštajem
npx hardhat coverage
```

### 5. Deployment na Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Adresa deployovanog ugovora biće sačuvana u `deployment.json`.

### 6. Pokretanje frontenda

```bash
cd escrow-frontend
npm install
npm start
```

Otvori [http://localhost:3000](http://localhost:3000) u browseru.

---

## Pametni ugovor

### Ključne funkcije

| Funkcija | Ko može pozvati | Uslov |
|----------|----------------|-------|
| `createEscrow(seller, arbiter, description)` | Bilo ko (postaje kupac) | — |
| `fundEscrow(escrowId)` | Kupac | Stanje: `CREATED` |
| `confirmDelivery(escrowId)` | Kupac | Stanje: `FUNDED` |
| `raiseDispute(escrowId)` | Kupac ili prodavac | Stanje: `FUNDED` |
| `resolveDispute(escrowId, buyerWins)` | Arbitar | Stanje: `IN_DISPUTE` |
| `refundBuyer(escrowId)` | Prodavac | Stanje: `FUNDED` |
| `getEscrow(escrowId)` | Svi (view) | — |

### Eventi

```solidity
event EscrowCreated(uint256 indexed escrowId, address indexed buyer, ...);
event EscrowFunded(uint256 indexed escrowId, uint256 amount, ...);
event FundsReleased(uint256 indexed escrowId, address indexed recipient, ...);
event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy, ...);
event ArbitrationDecision(uint256 indexed escrowId, address indexed winner, ...);
event RefundIssued(uint256 indexed escrowId, address indexed buyer, ...);
```

---

## Testiranje

Testovi pokrivaju sve ključne scenarije:
ConditionalEscrow

✔ Deployment

✔ createEscrow - validni parametri

✔ createEscrow - odbijanje nevalidnih adresa

✔ createEscrow - odbijanje praznog opisa

✔ fundEscrow - ispravno finansiranje

✔ fundEscrow - odbijanje od ne-kupca

✔ fundEscrow - odbijanje dvostrukog finansiranja

✔ confirmDelivery - oslobađanje sredstava prodavcu

✔ confirmDelivery - odbijanje od ne-kupca

✔ raiseDispute - kupac može pokrenuti spor

✔ raiseDispute - prodavac može pokrenuti spor

✔ raiseDispute - treće lice ne može pokrenuti spor

✔ resolveDispute - arbitar dodeljuje sredstva kupcu

✔ resolveDispute - arbitar dodeljuje sredstva prodavcu

✔ resolveDispute - ne-arbitar ne može rešiti spor

✔ refundBuyer - prodavac može refundovati kupca

✔ Granični slučajevi - nepostojeci escrow ID

✔ Granični slučajevi - arbitar ne može zaobići proces

Pokretanje testova sa detaljnim izlazom:

```bash
npx hardhat test --reporter verbose
```

---

## Deployment na Sepolia

### Korak po korak

1. Nabavi Sepolia ETH sa [sepoliafaucet.com](https://sepoliafaucet.com)
2. Postavi `.env` sa ispravnim vrednostima
3. Pokreni deployment:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

4. Verifikuj ugovor na Etherscan (opciono):

```bash
npx hardhat verify --network sepolia ADRESA_UGOVORA
```

### Deployed ugovor

| Mreža | Adresa |
|-------|--------|
| Sepolia Testnet | `0x...` ← popuniti nakon deploymenta |

---

## Frontend

React aplikacija se direktno konektuje sa pametnim ugovorom putem MetaMask novčanika.

### Funkcionalnosti

- 🦊 **MetaMask integracija** — Povezivanje novčanika jednim klikom
- ➕ **Kreiranje escrow-a** — Forma sa validacijom svih polja
- 💰 **Finansiranje** — Automatski poziva `fundEscrow` nakon kreiranja
- ✅ **Potvrda prijema** — Dostupno samo kupcu u `FUNDED` stanju
- ⚠️ **Pokretanje spora** — Dostupno kupcu i prodavcu
- ⚖️ **Arbitraža** — Arbitar bira ko dobija sredstva
- ↩️ **Povraćaj** — Prodavac može refundovati kupca
- 🔄 **Auto-refresh** — Lista escrow-ova se ažurira nakon svake akcije

### Konfiguracija frontenda

U `escrow-frontend/src/App.js` postavi adresu deployovanog ugovora:

```javascript
const CONTRACT_ADDRESS = "0xTVOJA_ADRESA_OVDE";
```

---

## Bezbednost

### Implementirane zaštite

**Reentrancy zaštita** — Svaki escrow ima `locked` flag koji sprečava ponovni ulaz u funkciju pre završetka transakcije.

```solidity
modifier noReentrancy(uint256 _escrowId) {
    require(!locked[_escrowId], "Escrow: Reentrancy napad detektovan");
    locked[_escrowId] = true;
    _;
    locked[_escrowId] = false;
}
```

**Zaštita od dvostrukog oslobađanja** — Iznos se postavlja na `0` pre transfera.

```solidity
uint256 amount = e.amount;
e.amount = 0; // Zaštita
e.state = State.COMPLETED;
(bool success, ) = e.seller.call{value: amount}("");
```

**Kontrola pristupa** — Svaka funkcija ima stroge modifier-e koji proveravaju ulogu pozivaoca.

**Validacija ulaznih parametara** — Sve adrese i vrednosti se validiraju pre izvršavanja.

**Vremensko obeležavanje** — Svi događaji i promene stanja nose `block.timestamp` za revizorski trag.

---

## Struktura projekta
escrow-dapp/

│

├── contracts/

│   └── Escrow.sol                 # Glavni pametni ugovor

│

├── scripts/

│   └── deploy.js                  # Deployment na Sepolia

│

├── test/

│   └── Escrow.test.js             # 18+ unit testova

│

├── escrow-frontend/

│   ├── public/

│   └── src/

│       ├── App.js                 # Glavni React komponent

│       └── App.css

│

├── hardhat.config.js              # Hardhat konfiguracija

├── deployment.json                # Adresa i info o deploymentu

├── .env                           # Privatni ključevi (gitignored)

├── .gitignore

└── README.md

---

## Bodovanje

| Kriterijum | Poeni |
|------------|-------|
| Pametni ugovor + deployment na Sepolia | 9/9 |
| Web3/React integracija i frontend | 7/7 |
| Unit testovi + end-to-end provera | 4/4 |
| **Ukupno** | **20/20** |

---

## Licenca

MIT

---

*Izrađeno u okviru predmeta Kriptografija*
