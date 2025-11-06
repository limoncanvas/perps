# Performance Tracking Guide

## Why No Trades Yet?

The bot needs time and proper configuration before it can trade:

### 1. **Warm-up Period Required**
The momentum strategy needs **20 data points** before it can generate signals. With a 60-second update interval, that's **20 minutes** of runtime.

You'll see logs like:
```
Waiting for more price history: 5/20
```

### 2. **Strategy Parameters**
The default momentum threshold is **2%**, which means prices need to move 2% in the lookback period to trigger a trade. This might be too conservative.

### 3. **Position Size**
The default position size is `0.1` base units, which might be too small for BTC/ETH.

## Quick Fixes

### Option 1: More Aggressive Strategy (Recommended for Testing)

Update your `.env` file:
```bash
# Lower threshold and shorter lookback for faster signals
STRATEGY_PARAMS={"lookbackPeriod":5,"momentumThreshold":0.005,"positionSize":0.01}
```

This will:
- Only need 5 minutes of data (5 cycles)
- Trigger on 0.5% price movements (more frequent)
- Use smaller position sizes suitable for testnet

### Option 2: Check Current Status

Set log level to debug to see what's happening:
```bash
LOG_LEVEL=debug npm run dev
```

You'll see:
- Market data being fetched
- Momentum calculations
- Why signals aren't being generated
- Risk validation results

### Option 3: View Performance & Debug

```bash
# View current performance
npm run performance

# Check logs for strategy activity
tail -f combined.log | grep -i "momentum\|signal\|waiting"
```

## Monitoring Trades

### Real-time Logs
Watch for these log messages:
- `"Generating LONG signal"` - Strategy found an entry
- `"Signal validated successfully"` - Risk manager approved
- `"Trade signal executed successfully"` - Order placed
- `"Signal rejected by risk manager"` - Check why (insufficient margin, position size too large, etc.)

### Check Logs
```bash
# View all activity
tail -f combined.log

# View only errors
tail -f error.log

# View strategy activity
tail -f combined.log | grep -E "signal|momentum|strategy"
```

### Hyperliquid Testnet Dashboard
- Visit: https://app.hyperliquid-testnet.xyz/
- Connect your wallet
- View positions, P&L, and order history

## Expected Behavior

1. **First 5-20 minutes**: Bot is collecting price data
   - You'll see: "Waiting for more price history: X/20"

2. **After warm-up**: Bot will analyze and generate signals
   - You'll see: "Momentum analysis" logs with percentages
   - Signals will appear when momentum exceeds threshold

3. **Signal Execution**: Signals are validated and executed
   - Check logs for validation results
   - Check Hyperliquid dashboard for actual orders

## Troubleshooting

### No signals after 20 minutes?
- Check if momentum threshold is too high (try 0.005 = 0.5%)
- Check market data logs to see if prices are being fetched
- Set `LOG_LEVEL=debug` to see detailed analysis

### Signals generated but no trades?
- Check "Signal rejected by risk manager" logs
- Verify you have sufficient margin (need margin for leverage)
- Check position size - might be too large for available margin

### Want to see more activity?
- Lower `momentumThreshold` (e.g., 0.005 for 0.5%)
- Reduce `lookbackPeriod` (e.g., 5 for faster signals)
- Adjust `positionSize` based on your capital

