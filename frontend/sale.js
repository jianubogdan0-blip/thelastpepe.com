// frontend/sale.js
// Frontend logic for presale: handles MetaMask (ETH, ERC20 USDT/USDC) payments.
// IMPORTANT: set the remaining configuration values below before using the site in production.

const CONFIG = {
  // EVM sale contract (PepeSale) must be deployed on the same EVM chain as user's MetaMask
  SALE_CONTRACT_ADDRESS: "0x8E44a6Ab51025569E5a784576508eE38e881a72b",
  // Pepe token contract address (ERC20) - used for display/decimals if needed
  PEPE_TOKEN_ADDRESS: "0xREPLACE_WITH_PEPE_TOKEN_ADDRESS",
  // ERC20 payment token addresses (on EVM chain)
  USDT_ADDRESS: "0xREPLACE_WITH_USDT_ADDRESS",
  USDC_ADDRESS: "0xREPLACE_WITH_USDC_ADDRESS",
  // Owner/receiver address (EVM)
  RECEIVER_EVM_ADDRESS: "0x8E44a6Ab51025569E5a784576508eE38e881a72b",
};

// Minimal ABI for the sale contract (must match the deployed contract)
const SALE_ABI = [
  "function pricePer1e18Pepe(address) view returns (uint256)",
  "function buyWithETH(uint256) payable",
  "function buyWithERC20(address,uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)",
];

let provider, signer, saleContract;

const $ = id => document.getElementById(id);
const toastEl = $("toast");
function showToast(msg, timeout=5000){ if (toastEl) { toastEl.innerText = msg; toastEl.style.display = 'block'; setTimeout(()=> toastEl.style.display='none', timeout); } else { console.log('TOAST:', msg); } }

async function connectEVM(){
  if (!window.ethereum) { showToast('MetaMask not found'); throw new Error('MetaMask not found'); }
  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  signer = provider.getSigner();
  saleContract = new ethers.Contract(CONFIG.SALE_CONTRACT_ADDRESS, SALE_ABI, signer);
  const addr = await signer.getAddress();
  showToast('MetaMask connected: ' + addr);
  return addr;
}

async function buyHandler(){
  const method = $('payment-method').value;
  const pepeAmountStr = $('pepe-amount').value.trim();
  if (!pepeAmountStr || isNaN(pepeAmountStr) || Number(pepeAmountStr) <= 0){ showToast('Enter a valid pepe amount'); return; }

  // We'll assume Pepe token has 18 decimals. Adjust if necessary.
  const pepeDecimals = 18;
  const pepeAmount = ethers.utils.parseUnits(pepeAmountStr, pepeDecimals);

  try{
    // EVM flows only
    if (!signer) await connectEVM();
    // get price per 1e18 pepe for the selected payment token
    let paymentTokenAddress = ethers.constants.AddressZero; // ETH
    if (method === 'usdt') paymentTokenAddress = CONFIG.USDT_ADDRESS;
    if (method === 'usdc') paymentTokenAddress = CONFIG.USDC_ADDRESS;

    const pricePer1e18 = await saleContract.pricePer1e18Pepe(paymentTokenAddress);
    if (!pricePer1e18 || pricePer1e18.eq(0)){
      showToast('Sale price not set for selected payment token on contract');
      return;
    }

    const cost = pepeAmount.mul(pricePer1e18).div(ethers.constants.WeiPerEther);

    if (paymentTokenAddress === ethers.constants.AddressZero){
      // buy with ETH
      const tx = await saleContract.buyWithETH(pepeAmount, { value: cost });
      showToast('Sent transaction, waiting for confirmation...');
      await tx.wait();
      showToast('Purchase complete (ETH).');
    } else {
      // buy with ERC20 (approve then call)
      const erc = new ethers.Contract(paymentTokenAddress, ERC20_ABI, signer);
      const ownerAddr = await signer.getAddress();
      const allowance = await erc.allowance(ownerAddr, CONFIG.SALE_CONTRACT_ADDRESS);
      if (allowance.lt(cost)){
        const txA = await erc.approve(CONFIG.SALE_CONTRACT_ADDRESS, cost);
        showToast('Approve tx sent, waiting...');
        await txA.wait();
      }
      const tx = await saleContract.buyWithERC20(paymentTokenAddress, pepeAmount);
      showToast('Purchase transaction sent, waiting for confirmation...');
      await tx.wait();
      showToast('Purchase complete (ERC20).');
    }

  } catch (e){
    console.error(e);
    showToast('Error: ' + (e && e.message ? e.message : e));
  }
}

// UI wiring
window.addEventListener('load', ()=>{
  const connectBtn = $('connect-evm');
  if (connectBtn) connectBtn.addEventListener('click', async ()=>{ try{ await connectEVM(); }catch(e){console.error(e);} });
  const buyBtn = $('buy-btn');
  if (buyBtn) buyBtn.addEventListener('click', buyHandler);
  // If wallet connect in header is used, keep it working
  const walletBtn = document.getElementById('wallet-btn');
  if (walletBtn) walletBtn.addEventListener('click', async ()=>{ try{ await connectEVM(); }catch(e){console.error(e);} });
});
