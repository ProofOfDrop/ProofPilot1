// ====== State ======
let web3Modal;
let externalProvider; // from Web3Modal
let ethersProvider;
let signer;
let userAddress;
let chainId;

// ====== On load: web3 modal ======
document.addEventListener('DOMContentLoaded', () => {
  web3Modal = new window.Web3Modal.default({
    cacheProvider: false,
    theme: 'dark',
    providerOptions: WEB3MODAL_PROVIDER_OPTIONS
  });
});

// Expose for render-json.js button handlers
window.onConnect = onConnect;
window.onFetch = onFetch;
window.onMint = onMint;

// ====== Connect & auto-sign ======
async function onConnect() {
  try {
    externalProvider = await web3Modal.connect();
    ethersProvider = new ethers.providers.Web3Provider(externalProvider);
    signer = ethersProvider.getSigner();
    userAddress = await signer.getAddress();

    const net = await ethersProvider.getNetwork();
    chainId = net.chainId;

    setText('walletInfo', `Wallet: ${shorten(userAddress)} · Network: ${net.name} (${chainId})`);

    // Auto sign verification message after connect
    await autoSignMessage();

    // Enable deliberate fetch
    setDisabled('fetchBtn', false);

    // React to changes
    externalProvider.on && externalProvider.on('accountsChanged', handleAccountsChanged);
    externalProvider.on && externalProvider.on('chainChanged', handleChainChanged);
    externalProvider.on && externalProvider.on('disconnect', resetApp);
  } catch (e) {
    console.error('Connect error', e);
    setHTML('walletInfo', `<span class="text-danger">Connection failed.</span>`);
  }
}

async function autoSignMessage() {
  try {
    const now = new Date().toISOString();
    const nonce = Math.floor(Math.random() * 1e9);
    const message = [
      'ProofDrop — Wallet Verification',
      `Address: ${userAddress}`,
      `ChainId: ${chainId}`,
      `Timestamp: ${now}`,
      `Nonce: ${nonce}`
    ].join('\n');

    const signature = await signer.signMessage(message);
    const recovered = ethers.utils.verifyMessage(message, signature);
    const ok = recovered.toLowerCase() === userAddress.toLowerCase();

    setText('signedMessage', message);
    setText('signature', signature);
    setBadge('verified', ok ? 'Yes' : 'No', ok ? 'bg-success' : 'bg-danger');

    setHTML('signInfo', ok ? `<span class="text-success">Signature verified.</span>` : `<span class="text-danger">Signature mismatch.</span>`);
    show('signatureSection');
  } catch (e) {
    console.error('Sign error', e);
    setHTML('signInfo', `<span class="text-warning">Signing cancelled.</span>`);
  }
}

// ====== Fetch metrics (deliberate button) ======
async function onFetch() {
  if (!userAddress) return;

  ethersProvider = new ethers.providers.Web3Provider(externalProvider);
  signer = ethersProvider.getSigner();
  const net = await ethersProvider.getNetwork();
  chainId = net.chainId;
  setText('walletInfo', `Wallet: ${shorten(userAddress)} · Network: ${net.name} (${chainId})`);

  const metrics = await fetchAllMetrics(userAddress, chainId);
  const points = {
    governance: scoreGovernance(metrics.governanceVotes),
    defi: scoreDeFi(metrics.defiTx),
    unique: scoreUniqueContracts(metrics.uniqueContracts),
    airdrops: scoreAirdrops(metrics.airdropsClaimed),
    swaps: scoreDexSwaps(metrics.dexSwaps),
    balance: scoreBalance(metrics.balanceUSD)
  };
  const total = clamp(Math.round(points.governance + points.defi + points.unique + points.airdrops + points.swaps + points.balance), 0, 100);
  const tier = total >= 85 ? 'Platinum' : total >= 70 ? 'Gold' : total >= 50 ? 'Silver' : 'Bronze';

  // Summary
  setText('totalScore', total);
  setText('tierLabel', `Tier: ${tier}`);
  setHTML('summaryText', `
    <div><strong>Address:</strong> ${shorten(userAddress)}</div>
    <div><strong>Chain:</strong> ${getChainName(chainId)} (${chainId})</div>
    <div><strong>Method:</strong> Live data via The Graph, Moralis, Covalent</div>
  `);
  show('summarySection');

  // Breakdown
  setText('m-gov', `${metrics.governanceVotes} proposal(s) voted`);
  setText('m-defi', `${metrics.defiTx} DeFi tx`);
  setText('m-uniq', `${metrics.uniqueContracts} contracts`);
  setText('m-air', `${metrics.airdropsClaimed} airdrops`);
  setText('m-swaps', `${metrics.dexSwaps} swaps`);
  setText('m-bal', `$${metrics.balanceUSD.toFixed(2)} USD`);

  setText('p-gov', `${points.governance}/20`);
  setText('p-defi', `${points.defi}/20`);
  setText('p-uniq', `${points.unique}/15`);
  setText('p-air', `${points.airdrops}/15`);
  setText('p-swaps', `${points.swaps}/15`);
  setText('p-bal', `${points.balance}/15`);

  show('breakdownSection');

  // Enable mint
  setDisabled('mintBtn', false);

  // Cache last score for mint
  window._proofdropLastScore = { metrics, points, total, chainId, address: userAddress, chainName: getChainName(chainId) };
}

// ====== Data fetchers (Graph + Moralis + Covalent) ======
async function fetchAllMetrics(address, chainId) {
  const base = { governanceVotes: 0, defiTx: 0, uniqueContracts: 0, airdropsClaimed: 0, dexSwaps: 0, balanceUSD: 0 };
  const chainCfg = CHAIN_MAP[chainId];
  if (!chainCfg) return base;

  const [gov, defi, uniq, air, swaps, bal] = await Promise.allSettled([
    fetchGovernanceVotes(address, chainId),
    fetchDeFiTxCount(address, chainId),
    fetchUniqueContracts(address, chainId),
    fetchAirdropsClaimed(address, chainId),
    fetchDexSwaps(address, chainId),
    fetchBalanceUSD(address, chainId)
  ]);

  return {
    governanceVotes: gov.value ?? 0,
    defiTx: defi.value ?? 0,
    uniqueContracts: uniq.value ?? 0,
    airdropsClaimed: air.value ?? 0,
    dexSwaps: swaps.value ?? 0,
    balanceUSD: bal.value ?? 0
  };
}

// --- Governance via The Graph (adjust query to your subgraph schema) ---
async function fetchGovernanceVotes(address, chainId) {
  const url = GRAPH_ENDPOINTS.governance[chainId];
  if (!url) return 0;
  const query = `
    query Votes($voter: String!) {
      votes(where: { voter: $voter }) { id }
    }
  `;
  const data = await graphQuery(url, query, { voter: address.toLowerCase() });
  return (data?.votes?.length) || 0;
}

// --- DeFi engagement count via Moralis (heuristic; refine with protocol lists) ---
async function fetchDeFiTxCount(address, chainId) {
  if (!MORALIS_API_KEY) return 0;
  const chainSlug = CHAIN_MAP[chainId].moralis;
  const url = `https://deep-index.moralis.io/api/v2.2/${address}/verbose?chain=${encodeURIComponent(chainSlug)}&limit=100`;
  const res = await fetch(url, { headers: { 'X-API-Key': MORALIS_API_KEY } });
  if (!res.ok) return 0;
  const json = await res.json();
  const tx = Array.isArray(json.result) ? json.result : [];
  const defiLike = tx.filter(t => t.input && t.input !== '0x'); // TODO: filter to known DeFi contracts
  return defiLike.length;
}

// --- Unique contract interactions via Moralis (unique to_address) ---
async function fetchUniqueContracts(address, chainId) {
  if (!MORALIS_API_KEY) return 0;
  const chainSlug = CHAIN_MAP[chainId].moralis;
  const url = `https://deep-index.moralis.io/api/v2.2/${address}/transactions?chain=${encodeURIComponent(chainSlug)}&limit=100`;
  const res = await fetch(url, { headers: { 'X-API-Key': MORALIS_API_KEY } });
  if (!res.ok) return 0;
  const json = await res.json();
  const tx = Array.isArray(json.result) ? json.result : [];
  const uniq = new Set(tx.map(t => (t.to_address || '').toLowerCase()).filter(Boolean));
  return uniq.size;
}

// --- Airdrops claimed via Moralis (approx: inbound ERC20 transfers) ---
async function fetchAirdropsClaimed(address, chainId) {
  if (!MORALIS_API_KEY) return 0;
  const chainSlug = CHAIN_MAP[chainId].moralis;
  const url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=${encodeURIComponent(chainSlug)}&direction=to&limit=100`;
  const res = await fetch(url, { headers: { 'X-API-Key': MORALIS_API_KEY } });
  if (!res.ok) return 0;
  const json = await res.json();
  const transfers = Array.isArray(json.result) ? json.result : [];
  // TODO: replace heuristic with a whitelist of airdrop contract addresses
  return transfers.length;
}

// --- DEX swaps via The Graph preferred; Covalent fallback matching decoded "swap" calls ---
async function fetchDexSwaps(address, chainId) {
  const dexUrl = GRAPH_ENDPOINTS.dex[chainId];
  if (dexUrl) {
    const query = `
      query Swaps($who: Bytes!) {
        swaps(where: { recipient: $who }) { id }
      }
    `;
    const data = await graphQuery(dexUrl, query, { who: address.toLowerCase() });
    const count = (data?.swaps?.length) || 0;
    if (count) return count;
  }
  if (!COVALENT_API_KEY) return 0;
  const chain = CHAIN_MAP[chainId].covalent;
  const url = `https://api.covalenthq.com/v1/${chain}/address/${address}/transactions_v3/?key=${encodeURIComponent(COVALENT_API_KEY)}&page-size=100`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const json = await res.json();
  const txs = json?.data?.items || [];
  const swapLike = txs.filter(t => {
    const fname = (t?.decoded?.name || '').toLowerCase();
    return fname.includes('swap');
  });
  return swapLike.length;
}

// --- Balance USD via Covalent ---
async function fetchBalanceUSD(address, chainId) {
  if (!COVALENT_API_KEY) return 0;
  const chain = CHAIN_MAP[chainId].covalent;
  const url = `https://api.covalenthq.com/v1/${chain}/address/${address}/balances_v2/?quote-currency=USD&nft=false&no-nft-fetch=true&key=${encodeURIComponent(COVALENT_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const json = await res.json();
  const items = json?.data?.items || [];
  const usd = items.reduce((sum, it) => sum + (Number(it.quote) || 0), 0);
  return usd;
}

// --- Graph helper ---
async function graphQuery(url, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data || null;
}

// ====== Scoring rules (exact spec) ======
function scoreGovernance(votes) {
  if (votes >= 5) return 20;
  if (votes >= 3) return 15;
  if (votes >= 1) return 5;
  return 0;
}
function scoreDeFi(txCount) {
  if (txCount >= 10) return 20;
  if (txCount >= 5) return 10;
  if (txCount >= 1) return 5;
  return 0;
}
function scoreUniqueContracts(n) {
  if (n >= 20) return 15;
  if (n >= 10) return 10;
  if (n >= 5) return 5;
  return 0;
}
function scoreAirdrops(n) {
  if (n >= 5) return 15;
  if (n >= 3) return 10;
  if (n >= 1) return 5;
  return 0;
}
function scoreDexSwaps(n) {
  if (n >= 25) return 15;
  if (n >= 15) return 10;
  if (n >= 5) return 5;
  if (n >= 2) return 1;
  return 0;
}
function scoreBalance(usd) {
  if (usd > 250) return 15;
  if (usd >= 50) return 10;
  if (usd >= 10) return 5;
  return 0;
}

// ====== Mint reputation NFT (data URI metadata) ======
async function onMint() {
  try {
    if (!window._proofdropLastScore) {
      alert('Please fetch your reputation first.');
      return;
    }
    const { total, metrics, points, chainId: scoredChain, address } = window._proofdropLastScore;

    const meta = {
      name: `ProofDrop Reputation — ${total}`,
      description: `Reputation NFT for ${address} on chain ${scoredChain}.`,
      attributes: [
        { trait_type: 'Score', value: total },
        { trait_type: 'Governance', value: points.governance },
        { trait_type: 'DeFi', value: points.defi },
        { trait_type: 'Unique Contracts', value: points.unique },
        { trait_type: 'Airdrops', value: points.airdrops },
        { trait_type: 'DEX Swaps', value: points.swaps },
        { trait_type: 'Balance Points', value: points.balance },
        { trait_type: 'ChainId', value: scoredChain }
      ],
      proofdrop_metrics: metrics
    };
    const tokenURI = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(meta))));

    const contract = new ethers.Contract(NFT_MINT.CONTRACT_ADDRESS, NFT_MINT.ABI, signer);
    const fn = contract[NFT_MINT.FUNCTION_NAME];
    if (typeof fn !== 'function') {
      alert('Mint function not found in ABI config.');
      return;
    }

    const tx = await fn(userAddress, tokenURI);
    setDisabled('mintBtn', true);
    setText('mintBtn', '⏳ Minting...');
    await tx.wait();
    setText('mintBtn', '✅ Minted');
  } catch (e) {
    console.error('Mint error', e);
    alert('Mint failed or cancelled.');
    setDisabled('mintBtn', false);
    setText('mintBtn', '🪙 Mint My Reputation NFT');
  }
}

// ====== Handlers & utils ======
function handleAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    resetApp();
  } else {
    userAddress = accounts[0];
  }
}
function handleChainChanged(_chainId) {
  try { chainId = Number(_chainId); } catch { chainId = parseInt(_chainId, 16); }
  setDisabled('mintBtn', true);
}

function resetApp() {
  web3Modal.clearCachedProvider && web3Modal.clearCachedProvider();
  externalProvider = null;
  ethersProvider = null;
  signer = null;
  userAddress = null;
  chainId = null;

  setText('walletInfo', 'Not connected');
  setHTML('signInfo', '');
  setText('signedMessage', '');
  setText('signature', '');
  setBadge('verified', 'No', 'bg-secondary');

  hide('summarySection');
  hide('breakdownSection');
  setDisabled('fetchBtn', true);
  setDisabled('mintBtn', true);
  setText('mintBtn', '🪙 Mint My Reputation NFT');
}

function getChainName(id) { return CHAIN_MAP[id]?.name || `Chain ${id}`; }
function shorten(addr) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// DOM helpers (works after widget is injected)
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function setDisabled(id, state) { const el = document.getElementById(id); if (el) el.disabled = state; }
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('d-none'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('d-none'); }
function setBadge(id, text, klass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `badge ${klass}`;
}
