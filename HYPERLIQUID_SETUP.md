# Hyperliquid Testnet Setup Guide

## ⚠️ Important: Deposit Funds to Hyperliquid

Having ETH in your wallet **does not** mean you have funds on Hyperliquid. You need to **deposit** funds to Hyperliquid first.

## Steps to Deposit Funds

### 1. Go to Hyperliquid Testnet
Visit: **https://app.hyperliquid-testnet.xyz/**

### 2. Connect Your Wallet
- Click "Connect Wallet"
- Select your wallet (MetaMask, etc.)
- Approve the connection

### 3. Deposit Funds
- Navigate to the **"Deposit"** or **"Transfer"** section
- Select **USDC** (Hyperliquid uses USDC for trading)
- Enter the amount you want to deposit
- Approve the transaction

**Note:** If you have ETH, you may need to:
1. Bridge ETH to USDC on testnet, OR
2. Use a testnet faucet to get USDC directly

### 4. Verify Deposit
- Check your balance on Hyperliquid dashboard
- Should show your deposited amount in USDC

## After Depositing

1. **Restart the bot** (if it's running):
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

2. **Check the logs** - you should now see:
   ```
   totalEquity: "500.00" (or your deposited amount)
   ```

3. **Wait for warm-up** - Bot needs 10 minutes to collect price data

## Quick Testnet USDC Faucet

If you need testnet USDC:
1. Check Hyperliquid testnet documentation
2. Use testnet faucets that support USDC
3. Or bridge from testnet ETH using a bridge service

## Troubleshooting

### Equity Still Shows $0.00?
- ✅ Verify funds are deposited on Hyperliquid (not just in wallet)
- ✅ Check you're using the correct testnet
- ✅ Verify your wallet address matches the bot's address
- ✅ Restart the bot after depositing

### Check Account Address
The bot logs show your address:
```
"address":"0xE608926250446A80CB3cDaC40e66B730e6A71AcA"
```

Make sure this matches the address you're depositing to!

