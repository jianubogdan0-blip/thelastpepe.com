// frontend/sale.js
// Cross-chain presale: Ethereum (ETH, USDT, USDC) + Solana (SOL)
// Clients send minimum $10 worth of tokens to receiver address
// Owner handles LASTPEPE token distribution manually

const CONFIG = {
  // Ethereum mainnet receiver address
  RECEIVER_ETH: "0x8E44a6Ab51025569E5a784576508eE38e881a72b",
  
  // Solana receiver address (Solana mainnet)
  RECEIVER_SOL: "4TvNJbBSfgZopxS6QkJRg75exFL4DLt7z4p3rdEf8UCF",
  
  // Ethereum token addresses (mainnet)
  USDT_ADDRESS: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC_ADDRESS: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  
  // Minimum purchase: $10 USD
  MIN_USD: 10,
  
  // Price per token: 1 LASTPEPE = $0.003
  PRICE_PER_TOKEN: 0.003,
  
  // At $10 minimum: 3350 LASTPEPE tokens
  TOKENS_AT_MIN: 3350,
};

// ETH, USDT, USDC prices (update these periodically or use an oracle)
const PRICES = {
  ETH: 2500,      // 1 ETH = $2500 (adjust as needed)
  USDT: 1,        // 1 USDT = $1
  USDC: 1,        // 1 USDC = $1
  SOL: 150,       // 1 SOL = $150 (adjust as needed)
};

// Minimal ABI for ERC20 tokens
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

let provider, signer, userAddress;

const $ = id => document.getElementById(id);
const toastEl = $("toast");

function showToast(msg, type = 'info', timeout = 5000) {
  if (toastEl) {
    toastEl.innerText = msg;
    toastEl.className = `toast-message ${type}`;
    toastEl.style.display = 'block';
    setTimeout(() => toastEl.style.display = 'none', timeout);
  } else {
    console.log(`[${type.toUpperCase()}]`, msg);
  }
}

// ===== ETHEREUM (ETH, USDT, USDC) =====

async function connectEthereum() {
  if (!window.ethereum) {
    showToast('MetaMask not found. Please install MetaMask.', 'error');
    throw new Error('MetaMask not found');
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    userAddress = accounts[0];
    signer = provider.getSigner();
    showToast(`Connected: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`, 'success');
    return userAddress;
  } catch (e) {
    showToast('MetaMask connection failed: ' + e.message, 'error');
    throw e;
  }
}

async function buyWithETH(amountETH) {
  if (!signer) await connectEthereum();
  
  const usdValue = amountETH * PRICES.ETH;
  if (usdValue < CONFIG.MIN_USD) {
    showToast(`Minimum purchase is $${CONFIG.MIN_USD} (${(CONFIG.MIN_USD / PRICES.ETH).toFixed(6)} ETH)`, 'warning');
    return;
  }

  const tokensReceived = Math.floor(usdValue / CONFIG.PRICE_PER_TOKEN);

  try {
    showToast('Sending ETH transaction...', 'info');
    const tx = await signer.sendTransaction({
      to: CONFIG.RECEIVER_ETH,
      value: ethers.utils.parseEther(amountETH.toString()),
    });
    showToast('Transaction sent, waiting for confirmation...', 'info');
    await provider.waitForTransaction(tx.hash);
    showToast(`✓ Purchase complete! You will receive ${tokensReceived} LASTPEPE tokens.`, 'success');
    $('pepe-amount').value = '';
  } catch (e) {
    showToast('ETH transaction failed: ' + e.message, 'error');
  }
}

async function buyWithERC20(tokenSymbol) {
  if (!signer) await connectEthereum();

  const amountUSD = parseFloat($('pepe-amount').value);
  if (!amountUSD || amountUSD < CONFIG.MIN_USD) {
    showToast(`Minimum purchase is $${CONFIG.MIN_USD}`, 'warning');
    return;
  }

  const tokenAddress = tokenSymbol === 'USDT' ? CONFIG.USDT_ADDRESS : CONFIG.USDC_ADDRESS;
  const decimals = tokenSymbol === 'USDT' ? 6 : 6; // Both USDT and USDC use 6 decimals on mainnet
  const amountTokens = ethers.utils.parseUnits(amountUSD.toString(), decimals);
  const tokensReceived = Math.floor(amountUSD / CONFIG.PRICE_PER_TOKEN);

  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await erc20.allowance(userAddress, CONFIG.RECEIVER_ETH);

    if (allowance.lt(amountTokens)) {
      showToast(`Approving ${tokenSymbol}...`, 'info');
      const approveTx = await erc20.approve(CONFIG.RECEIVER_ETH, amountTokens);
      await provider.waitForTransaction(approveTx.hash);
      showToast(`${tokenSymbol} approved!`, 'success');
    }

    showToast(`Sending ${amountUSD} ${tokenSymbol} to receiver...`, 'info');
    const transferTx = await erc20.transfer(CONFIG.RECEIVER_ETH, amountTokens);
    await provider.waitForTransaction(transferTx.hash);
    showToast(`✓ Purchase complete! You will receive ${tokensReceived} LASTPEPE tokens.`, 'success');
    $('pepe-amount').value = '';
  } catch (e) {
    showToast(`${tokenSymbol} transaction failed: ` + e.message, 'error');
  }
}

// ===== SOLANA (SOL) =====

async function connectSolana() {
  if (!window.solana) {
    showToast('Phantom wallet not found. Please install Phantom.', 'error');
    throw new Error('Phantom wallet not found');
  }
  try {
    const response = await window.solana.connect();
    userAddress = response.publicKey.toString();
    showToast(`Connected to Solana: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`, 'success');
    return userAddress;
  } catch (e) {
    showToast('Phantom connection failed: ' + e.message, 'error');
    throw e;
  }
}

async function buyWithSOL(amountSOL) {
  if (!window.solana) {
    showToast('Phantom wallet not found. Please install Phantom.', 'error');
    return;
  }

  if (!userAddress) await connectSolana();

  const usdValue = amountSOL * PRICES.SOL;
  if (usdValue < CONFIG.MIN_USD) {
    showToast(`Minimum purchase is $${CONFIG.MIN_USD} (${(CONFIG.MIN_USD / PRICES.SOL).toFixed(4)} SOL)`, 'warning');
    return;
  }

  const tokensReceived = Math.floor(usdValue / CONFIG.PRICE_PER_TOKEN);

  try {
    // For Solana, we use a simple transfer (requires Solana SDK for full implementation)
    // For now, show a manual transfer instruction
    showToast(`Send ${amountSOL} SOL to: ${CONFIG.RECEIVER_SOL}`, 'info');
    alert(`Send ${amountSOL} SOL to:\n\n${CONFIG.RECEIVER_SOL}\n\nYou will receive ${tokensReceived} LASTPEPE tokens.\n\nPlease confirm after sending.`);
    showToast(`✓ Transfer instruction shown. You will receive ${tokensReceived} LASTPEPE tokens.`, 'success');
    $('pepe-amount').value = '';
  } catch (e) {
    showToast('SOL transaction failed: ' + e.message, 'error');
  }
}

// ===== UI HANDLERS =====

async function handleBuyClick() {
  const method = $('payment-method').value;
  const amountStr = $('pepe-amount').value.trim();

  if (!amountStr || isNaN(amountStr) || parseFloat(amountStr) <= 0) {
    showToast('Please enter a valid amount', 'warning');
    return;
  }

  const amount = parseFloat(amountStr);

  try {
    if (method === 'eth') {
      await buyWithETH(amount);
    } else if (method === 'usdt') {
      await buyWithERC20('USDT');
    } else if (method === 'usdc') {
      await buyWithERC20('USDC');
    } else if (method === 'sol') {
      await buyWithSOL(amount);
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== PAGE INIT =====

window.addEventListener('load', () => {
  // Connect button
  const connectBtn = $('connect-evm');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const method = $('payment-method').value;
      try {
        if (method === 'sol') {
          await connectSolana();
        } else {
          await connectEthereum();
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Buy button
  const buyBtn = $('buy-btn');
  if (buyBtn) {
    buyBtn.addEventListener('click', handleBuyClick);
  }

  // Update connect button label based on selected payment method
  const paymentSelect = $('payment-method');
  if (paymentSelect) {
    paymentSelect.addEventListener('change', () => {
      const method = paymentSelect.value;
      if (connectBtn) {
        connectBtn.innerText = method === 'sol' ? 'Connect Phantom' : 'Connect MetaMask';
      }
    });
  }

  // Header wallet button
  const walletBtn = document.getElementById('wallet-btn');
  if (walletBtn) {
    walletBtn.addEventListener('click', async () => {
      try {
        await connectEthereum();
      } catch (e) {
        console.error(e);
      }
    });
  }
});
