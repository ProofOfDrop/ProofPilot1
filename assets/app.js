let web3Modal, externalProvider, ethersProvider, signer, userAddress, chainId;

function initWeb3Modal() {
  web3Modal = new window.Web3Modal.default({
    cacheProvider: false,
    theme: 'dark',
    providerOptions: WEB3MODAL_PROVIDER_OPTIONS
  });
  console.log('Web3Modal initialised');
}

window.onConnect = async function onConnect() {
  try {
    externalProvider = await web3Modal.connect();
    ethersProvider = new ethers.providers.Web3Provider(externalProvider, 'any');
    try { await ethersProvider.send('eth_requestAccounts', []); } catch (_) {}

    signer = ethersProvider.getSigner();
    userAddress = await signer.getAddress();
    chainId = await safeGetChainId(externalProvider);

    setText('walletInfo', `Wallet: ${shorten(userAddress)} · Network: ${getChainName(chainId)} (${chainId})`);
    await autoSignMessage();
    setDisabled('fetchBtn', false);

    if (externalProvider.on) {
      externalProvider.on('accountsChanged', handleAccountsChanged);
      externalProvider.on('chainChanged', (_id) => {
        chainId = typeof _id === 'string' && _id.startsWith('0x') ? parseInt(_id, 16) : Number(_id);
        setDisabled('mintBtn', true);
      });
      externalProvider.on('disconnect', resetApp);
    }
  } catch (e) {
    console.error('Connect error', e);
    setHTML('walletInfo', `<span class="text-danger">Connection failed.</span>`);
  }
};

window.onFetch = async function onFetch() {
  if (!userAddress) return;
  ethersProvider = new ethers.providers.Web3Provider(externalProvider, 'any');
  signer = ethersProvider.getSigner();
  chainId = await safeGetChainId(externalProvider);

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

  setText('totalScore', total);
  setText('tierLabel', `Tier: ${tier}`);
  setHTML('summaryText', `
    <div><strong>Address:</strong> ${shorten(userAddress)}</div>
    <div><strong>Chain:</strong> ${getChainName(chainId)} (${chainId})</div>
    <div><strong>Method:</strong> Live data via The Graph, Moralis, Covalent</div>
  `);
  show('summarySection');

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
  setDisabled('mintBtn', false);

  window._proofdropLastScore = { metrics, points, total, chainId, address: userAddress, chainName: getChainName(chainId) };
};

window.onMint = async function onMint() {
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
};

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

async function safeGetChainId(p) {
  try {
    const hex = await p.request({ method: 'eth_chainId' });
    if (typeof hex === 'string' && hex.startsWith('0x')) return parseInt(hex, 16);
    const n = Number(hex);
    if (!Number.isNaN(n) && n > 0) return n;
  } catch (_) {}
  if (p.chainId) {
    if (typeof p.chainId === 'string' && p.chainId.startsWith('0x')) return parseInt(p.chainId, 16);
    const n = Number(p.chainId); if (!Number.isNaN(n)) return n;
  }
  if (p.networkVersion) return Number(p.networkVersion);
  const net = await new ethers.providers.Web3Provider(p, 'any').getNetwork();
  return net.chainId;
}

// --- Utility functions ---
function getChainName(id) { return CHAIN_MAP[id]?.name || `Chain ${id}`; }
function shorten(addr) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function setDisabled(id, state) { const el = document.getElementById(id); if (el) el.disabled = state; }
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('d-none'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('d-none'); }
function setBadge(id, text, klass) { const el = document.getElementById(id);
