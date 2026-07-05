# Presale deployment & integration

This repo now contains:

- contracts/PepeSale.sol — Solidity sale contract that forwards payments to the owner and transfers LASTPEPE tokens to buyers.
- frontend/sale.js — frontend integration for MetaMask (ETH, USDT, USDC) and Phantom (SOL) payments. You must configure addresses in CONFIG inside this file.
- index.html — updated page that includes the presale UI and calls frontend/sale.js.

What you still need to do before the site is fully functional:

1. Deploy the PepeSale contract to your target EVM chain (testnet first). Example using Hardhat/ethers.

2. Transfer LASTPEPE tokens to the sale contract, or allow the sale contract to transfer from a minting address. The contract assumes it holds the Pepe tokens to send to buyers.

3. Call setPrice(paymentToken, pricePer1e18) on the deployed contract for each payment token you want to accept.
   - pricePer1e18 means: how many smallest-units of paymentToken equal 1e18 units of Pepe.
   - Example: Pepe has 18 decimals and 1 Pepe costs 2 USDC (USDC has 6 decimals). Set pricePer1e18[USDC] = 2 * 10^6 = 2000000.

4. Edit frontend/sale.js and replace the placeholder addresses with:
   - SALE_CONTRACT_ADDRESS
   - PEPE_TOKEN_ADDRESS
   - USDT_ADDRESS, USDC_ADDRESS
   - RECEIVER_EVM_ADDRESS (your EVM receiving wallet — often same as contract owner)
   - RECEIVER_SOL_ADDRESS (your Solana receiving wallet for SOL payments)

5. Host the updated site (this repo) and test flows on testnets:
   - For ETH/ERC20: use a testnet (Goerli/Sepolia, or Polygon Mumbai) with test tokens.
   - For SOL: use Phantom on devnet and change the solanaWeb3.clusterApiUrl in frontend/sale.js to 'devnet' for testing.

Security & notes:
- USDT may be non-standard; test transferFrom behavior.
- Cross-chain SOL -> ERC20 token delivery cannot be atomic with this setup. SOL payments only forward SOL to your Solana address. If you want to issue LASTPEPE automatically after SOL payment, you need a custodial backend or cross-chain relayer.
- Always test on testnets and audit the contract before mainnet use.

If you want, I can:
- add a Hardhat project + deploy script and deploy the contract to a testnet for you (I will need wallet/private key or CI secret setup),
- open a PR with these changes (already pushed),
- or update frontend to display computed costs in chosen payment currency based on on-chain price.
