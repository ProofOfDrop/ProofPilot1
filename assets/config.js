// ====== THEME BRIDGE (set by JSON at runtime) ======
// render-json.js will set CSS variables from JSON theme
// You do not need to edit this section.

// ====== WEB3MODAL PROVIDERS ======
const WEB3MODAL_PROVIDER_OPTIONS = {
  walletconnect: {
    package: window.WalletConnectProvider.default,
    options: {
      rpc: {
        11155111: 'https://rpc.sepolia.org',                 // Sepolia
        80002: 'https://rpc-amoy.polygon.technology',        // Polygon Amoy
        421614: 'https://sepolia-rollup.arbitrum.io/rpc',    // Arbitrum Sepolia
        84532: 'https://sepolia.base.org'                    // Base Sepolia
      }
    }
  },
  coinbasewallet: {
    package: window.CoinbaseWalletSDK,
    options: {
      appName: 'ProofDrop',
      rpc: 'https://rpc.sepolia.org',
      darkMode: true
    }
  }
};

// ====== API KEYS (public in client — use free/dev keys) ======
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjQwMDhkMTc4LWQxNmItNDU4Yy05MTRkLWNlZjU1YzZmMjdiMyIsIm9yZ0lkIjoiNDY0MzAyIiwidXNlcklkIjoiNDc3NjY3IiwidHlwZUlkIjoiYTNhODc2MmUtYWRiNS00MDk1LWFmNmEtNDhmNGQ5ZTA4NDVkIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTQ4MTI3MjQsImV4cCI6NDkxMDU3MjcyNH0.ssV3d1p5s7iDcYT2rZtosJ8J_z1cuuNvF9bU5X8O2HY';
const COVALENT_API_KEY = 'cqt_rQYkGgFvK3CcfjKw9K4gGBQmxyRK';

// ====== CHAIN MAPS FOR APIS ======
const CHAIN_MAP = {
  11155111: { name: 'Ethereum Sepolia', moralis: 'sepolia', covalent: 11155111 },
  80002:    { name: 'Polygon Amoy',     moralis: 'amoy',    covalent: 80002 },
  421614:   { name: 'Arbitrum Sepolia', moralis: 'arbitrum-sepolia', covalent: 421614 },
  84532:    { name: 'Base Sepolia',     moralis: 'base-sepolia',     covalent: 84532 }
};

// ====== THE GRAPH ENDPOINTS (replace with real subgraphs you pick) ======
const GRAPH_ENDPOINTS = {
  governance: {
    11155111: 'YOUR_GRAPH_GOVERNANCE_SUBGRAPH_URL_FOR_SEPOLIA',
    80002:    'YOUR_GRAPH_GOVERNANCE_SUBGRAPH_URL_FOR_AMOY',
    421614:   'YOUR_GRAPH_GOVERNANCE_SUBGRAPH_URL_FOR_ARB_SEPOLIA',
    84532:    'YOUR_GRAPH_GOVERNANCE_SUBGRAPH_URL_FOR_BASE_SEPOLIA'
  },
  dex: {
    11155111: 'YOUR_GRAPH_DEX_SUBGRAPH_URL_FOR_SEPOLIA',
    80002:    'YOUR_GRAPH_DEX_SUBGRAPH_URL_FOR_AMOY',
    421614:   'YOUR_GRAPH_DEX_SUBGRAPH_URL_FOR_ARB_SEPOLIA',
    84532:    'YOUR_GRAPH_DEX_SUBGRAPH_URL_FOR_BASE_SEPOLIA'
  }
};

// ====== NFT MINT CONFIG ======
// Deploy a minimal ERC-721 on your chosen testnet and paste it here.
const NFT_MINT = {
  CONTRACT_ADDRESS: '0xYourNftContractAddressOnTestnet',
  // ABI must include a mint function accepting (address to, string uri)
  ABI: [
    {
      "inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"uri","type":"string"}],
      "name":"safeMint",
      "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
      "stateMutability":"nonpayable","type":"function"
    }
  ],
  FUNCTION_NAME: 'safeMint'
};
