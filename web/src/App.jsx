import { useState } from "react";
import { ethers } from "ethers";
import addrs from "./addresses.local.json";
import { FACTORY_ABI } from "./factoryAbi";
import { ERC20_ABI } from "./erc20Abi";

export default function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [name, setName] = useState("My Token");
  const [symbol, setSymbol] = useState("MYT");
  const [supply, setSupply] = useState("1000000"); // human units
  const [issued, setIssued] = useState(null); // {address, name, symbol, balance}

  async function connect() {
    if (!window.ethereum) return alert("Install MetaMask");
    const p = new ethers.BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const signer = await p.getSigner();
    setProvider(p);
    setAccount(await signer.getAddress());
  }

  async function issueToken() {
    if (!provider) return alert("Connect wallet first");
    const signer = await provider.getSigner();
    const factory = new ethers.Contract(addrs.FACTORY, FACTORY_ABI, signer);

    // parse supply with 18 decimals
    const supplyWei = ethers.parseUnits(supply || "0", 18);

    // predict the returned address with a static call (no gas)
    const predicted = await factory.issueToken.staticCall(name, symbol, supplyWei);

    // send the real tx
    const tx = await factory.issueToken(name, symbol, supplyWei);
    await tx.wait();

    // read balance to confirm
    const token = new ethers.Contract(predicted, ERC20_ABI, signer);
    const bal = await token.balanceOf(account);
    const dec = await token.decimals();
    const human = ethers.formatUnits(bal, dec);

    setIssued({ address: predicted, name, symbol, balance: human });
  }

  async function watchInMetamask() {
    if (!issued) return;
    await window.ethereum?.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: { address: issued.address, symbol: issued.symbol, decimals: 18 }
      }
    });
  }

  return (
    <div style={{fontFamily:"ui-sans-serif", maxWidth:720, margin:"36px auto"}}>
      <h1>DEX MVP — Issue ERC-20</h1>

      <button onClick={connect} style={{padding:"8px 14px", borderRadius:8}}>
        {account ? `Connected: ${account.slice(0,6)}…${account.slice(-4)}` : "Connect Wallet"}
      </button>

      <div style={{marginTop:24, padding:16, border:"1px solid #eee", borderRadius:12}}>
        <h3>New Token</h3>
        <div style={{display:"grid", gridTemplateColumns:"140px 1fr", gap:8, alignItems:"center"}}>
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} />

          <label>Symbol</label>
          <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} />

          <label>Initial Supply</label>
          <input value={supply} onChange={e=>setSupply(e.target.value)} />
          <div />
          <small style={{color:"#666"}}>Supply uses 18 decimals. Example: 1000000 = 1,000,000 tokens.</small>
        </div>

        <div style={{marginTop:12}}>
          <button onClick={issueToken} style={{padding:"8px 12px", borderRadius:8}}>Issue Token</button>
        </div>

        {issued && (
          <div style={{marginTop:16, padding:12, background:"#f8fafc", borderRadius:8}}>
            <div><b>Deployed:</b> {issued.name} ({issued.symbol})</div>
            <div><b>Address:</b> {issued.address}</div>
            <div><b>Your balance:</b> {issued.balance} {issued.symbol}</div>
            <button onClick={watchInMetamask} style={{marginTop:8, padding:"6px 12px", borderRadius:8}}>
              Add to MetaMask
            </button>
          </div>
        )}
      </div>

      <p style={{marginTop:16, color:"#666"}}>
        Tip: Make sure MetaMask is on the Hardhat network (RPC http://127.0.0.1:8545, Chain ID 31337).
      </p>
    </div>
  );
}
