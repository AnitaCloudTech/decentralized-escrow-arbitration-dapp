import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import "./App.css";

// Kopirati iz artifacts/contracts/Escrow.sol/ConditionalEscrow.json nakon kompajliranja
const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "arbiter", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "winner", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "ArbitrationDecision",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "raisedBy", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "DisputeRaised",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": false, "internalType": "address", "name": "arbiter", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "EscrowCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "EscrowFunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "FundsReleased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "RefundIssued",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "confirmDelivery",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address payable", "name": "_seller", "type": "address" },
      { "internalType": "address", "name": "_arbiter", "type": "address" },
      { "internalType": "string", "name": "_description", "type": "string" }
    ],
    "name": "createEscrow",
    "outputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "escrowCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "escrows",
    "outputs": [
      { "internalType": "address payable", "name": "buyer", "type": "address" },
      { "internalType": "address payable", "name": "seller", "type": "address" },
      { "internalType": "address", "name": "arbiter", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "enum ConditionalEscrow.State", "name": "state", "type": "uint8" },
      { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
      { "internalType": "uint256", "name": "fundedAt", "type": "uint256" },
      { "internalType": "uint256", "name": "completedAt", "type": "uint256" },
      { "internalType": "string", "name": "description", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "fundEscrow",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getContractBalance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "getEscrow",
    "outputs": [
      {
        "components": [
          { "internalType": "address payable", "name": "buyer", "type": "address" },
          { "internalType": "address payable", "name": "seller", "type": "address" },
          { "internalType": "address", "name": "arbiter", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "enum ConditionalEscrow.State", "name": "state", "type": "uint8" },
          { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
          { "internalType": "uint256", "name": "fundedAt", "type": "uint256" },
          { "internalType": "uint256", "name": "completedAt", "type": "uint256" },
          { "internalType": "string", "name": "description", "type": "string" }
        ],
        "internalType": "struct ConditionalEscrow.EscrowData",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "getState",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "raiseDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "refundBuyer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_escrowId", "type": "uint256" },
      { "internalType": "bool", "name": "_buyerWins", "type": "bool" }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = "0x6c04D3Ef8675a5c5222729c4c1AbbcB558B578c2";

const STATE_LABELS = {
  0: { label: "Kreiran", color: "#6b7280", emoji: "📋" },
  1: { label: "Finansiran", color: "#2563eb", emoji: "💰" },
  2: { label: "U sporu", color: "#dc2626", emoji: "⚠️" },
  3: { label: "Završen", color: "#16a34a", emoji: "✅" },
  4: { label: "Refundovan", color: "#9333ea", emoji: "↩️" },
  5: { label: "Rešen", color: "#d97706", emoji: "⚖️" },
};

function Alert({ type, message, onClose }) {
  const colors = { success: "#16a34a", error: "#dc2626", info: "#2563eb" };
  return (
    <div style={{
      padding: "12px 16px",
      borderRadius: "8px",
      backgroundColor: colors[type] + "20",
      border: `1px solid ${colors[type]}`,
      color: colors[type],
      marginBottom: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>×</button>
    </div>
  );
}

function btnStyle(color) {
  return {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: color,
    color: "white",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600"
  };
}

function EscrowCard({ escrowData, escrowId, currentAccount, contract, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const state = Number(escrowData.state);
  const stateInfo = STATE_LABELS[state];
  const amount = ethers.formatEther(escrowData.amount);

  const isbuyer = currentAccount?.toLowerCase() === escrowData.buyer.toLowerCase();
  const isSeller = currentAccount?.toLowerCase() === escrowData.seller.toLowerCase();
  const isArbiter = currentAccount?.toLowerCase() === escrowData.arbiter.toLowerCase();

  const handleAction = async (action, ...args) => {
    setLoading(true);
    setAlert(null);
    try {
      const tx = await contract[action](escrowId, ...args);
      await tx.wait();
      setAlert({ type: "success", message: "Transakcija uspešna!" });
      onRefresh();
    } catch (err) {
      setAlert({ type: "error", message: err.reason || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "16px",
      backgroundColor: "white",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, color: "#111827" }}>Escrow #{escrowId}</h3>
        <span style={{
          padding: "4px 12px",
          borderRadius: "999px",
          backgroundColor: stateInfo.color + "20",
          color: stateInfo.color,
          fontSize: "14px",
          fontWeight: "600"
        }}>
          {stateInfo.emoji} {stateInfo.label}
        </span>
      </div>

      <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 12px" }}>
        📝 {escrowData.description}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", marginBottom: "16px" }}>
        <div><span style={{ color: "#9ca3af" }}>Kupac:</span> <br /><code style={{ fontSize: "11px" }}>{escrowData.buyer.slice(0, 6)}...{escrowData.buyer.slice(-4)}</code></div>
        <div><span style={{ color: "#9ca3af" }}>Prodavac:</span> <br /><code style={{ fontSize: "11px" }}>{escrowData.seller.slice(0, 6)}...{escrowData.seller.slice(-4)}</code></div>
        <div><span style={{ color: "#9ca3af" }}>Arbitar:</span> <br /><code style={{ fontSize: "11px" }}>{escrowData.arbiter.slice(0, 6)}...{escrowData.arbiter.slice(-4)}</code></div>
        <div><span style={{ color: "#9ca3af" }}>Iznos:</span> <br /><strong>{amount} ETH</strong></div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {isbuyer && state === 1 && (
          <button onClick={() => handleAction("confirmDelivery")} disabled={loading} style={btnStyle("#16a34a")}>
            ✅ Potvrdi prijem
          </button>
        )}

        {(isbuyer || isSeller) && state === 1 && (
          <button onClick={() => handleAction("raiseDispute")} disabled={loading} style={btnStyle("#dc2626")}>
            ⚠️ Pokreni spor
          </button>
        )}

        {isArbiter && state === 2 && (
          <>
            <button onClick={() => handleAction("resolveDispute", true)} disabled={loading} style={btnStyle("#2563eb")}>
              ⚖️ Kupac pobeđuje
            </button>
            <button onClick={() => handleAction("resolveDispute", false)} disabled={loading} style={btnStyle("#9333ea")}>
              ⚖️ Prodavac pobeđuje
            </button>
          </>
        )}

        {isSeller && state === 1 && (
          <button onClick={() => handleAction("refundBuyer")} disabled={loading} style={btnStyle("#d97706")}>
            ↩️ Refunduj kupca
          </button>
        )}
      </div>

      {loading && <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "8px" }}>⏳ Čekanje potvrde...</p>}
    </div>
  );
}

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const [form, setForm] = useState({
    seller: "",
    arbiter: "",
    description: "",
    amount: ""
  });

  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = () => window.location.reload();
    const handleAccountsChanged = () => window.location.reload();

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setAlert({ type: "error", message: "MetaMask nije instaliran!" });
      return;
    }

    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const network = await _provider.getNetwork();

      if (network.chainId !== 11155111n) {
        setAlert({ type: "error", message: "Molimo povežite se na Sepolia testnu mrežu!" });
        return;
      }

      const _signer = await _provider.getSigner();
      const _account = await _signer.getAddress();
      const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);
      setContract(_contract);
      setAlert(null);
    } catch (err) {
      setAlert({ type: "error", message: "Greška pri povezivanju: " + err.message });
    }
  };

  const loadEscrows = useCallback(async () => {
    if (!contract) return;
    try {
      const count = Number(await contract.escrowCount());
      const all = [];
      for (let i = 0; i < count; i++) {
        const data = await contract.getEscrow(i);
        all.push({ id: i, data });
      }
      setEscrows(all);
    } catch (err) {
      console.error("Greška pri učitavanju:", err);
    }
  }, [contract]);

  useEffect(() => {
    loadEscrows();
  }, [loadEscrows]);

  const handleCreate = async () => {
    if (!contract) return;
    if (!form.seller || !form.arbiter || !form.description || !form.amount) {
      setAlert({ type: "error", message: "Sva polja su obavezna!" });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const createTx = await contract.createEscrow(form.seller, form.arbiter, form.description);
      const receipt = await createTx.wait();

      const iface = contract.interface;
      const createdEvent = receipt.logs
        .map(log => { try { return iface.parseLog(log); } catch { return null; } })
        .find(e => e && e.name === "EscrowCreated");

      const escrowId = createdEvent.args[0];

      const fundTx = await contract.fundEscrow(escrowId, {
        value: ethers.parseEther(form.amount)
      });
      await fundTx.wait();

      setAlert({ type: "success", message: `Escrow #${escrowId} kreiran i finansiran!` });
      setForm({ seller: "", arbiter: "", description: "", amount: "" });
      loadEscrows();
    } catch (err) {
      setAlert({ type: "error", message: err.reason || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "24px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "800", color: "#111827", margin: "0 0 8px" }}>
            ⚖️ Escrow DApp
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Decentralizovani escrow sa arbitražom na Sepolia mreži
          </p>
        </div>

        {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        {!account ? (
          <div style={{ textAlign: "center", padding: "48px", backgroundColor: "white", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <p style={{ color: "#6b7280", marginBottom: "16px" }}>Povežite MetaMask novčanik da biste nastavili</p>
            <button onClick={connectWallet} style={{ ...btnStyle("#2563eb"), fontSize: "16px", padding: "12px 24px" }}>
              🦊 Poveži MetaMask
            </button>
          </div>
        ) : (
          <>
            <div style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "13px", color: "#1d4ed8" }}>
                🟢 Povezano: <code>{account.slice(0, 6)}...{account.slice(-4)}</code>
              </span>
              <span style={{ fontSize: "13px", color: "#1d4ed8" }}>Sepolia Testnet</span>
            </div>

            <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "18px", color: "#111827" }}>
                ➕ Kreiraj novi Escrow
              </h2>

              {[
                { key: "seller", label: "Adresa prodavca", placeholder: "0x..." },
                { key: "arbiter", label: "Adresa arbitara", placeholder: "0x..." },
                { key: "description", label: "Opis (šta se kupuje)", placeholder: "npr. Laptop Dell XPS 15" },
                { key: "amount", label: "Iznos (ETH)", placeholder: "0.01" },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              ))}

              <button
                onClick={handleCreate}
                disabled={loading}
                style={{ ...btnStyle("#2563eb"), width: "100%", padding: "12px", fontSize: "15px", marginTop: "8px" }}
              >
                {loading ? "⏳ Kreiranje..." : "🚀 Kreiraj i finansiraj Escrow"}
              </button>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>
                  📋 Svi Escrow-ovi ({escrows.length})
                </h2>
                <button onClick={loadEscrows} style={btnStyle("#6b7280")}>
                  🔄 Osveži
                </button>
              </div>

              {escrows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af", backgroundColor: "white", borderRadius: "12px" }}>
                  Nema escrow-ova. Kreirajte prvi!
                </div>
              ) : (
                escrows.map(({ id, data }) => (
                  <EscrowCard
                    key={id}
                    escrowId={id}
                    escrowData={data}
                    currentAccount={account}
                    contract={contract}
                    onRefresh={loadEscrows}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;