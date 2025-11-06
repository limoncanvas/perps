# Hyperliquid Perp Trading Bot

A professional-grade perpetual futures trading bot for Hyperliquid, built with TypeScript. Features multiple trading strategies, comprehensive risk management, and real-time position monitoring.

## Features

- **Multiple Trading Strategies**
  - Momentum Strategy: Trades based on price momentum and trend following
  - Mean Reversion Strategy: Trades based on statistical price deviations
  - Extensible framework for custom strategies

- **Comprehensive Risk Management**
  - Maximum drawdown protection
  - Daily loss limits
  - Stop loss and take profit automation
  - Position size limits
  - Leverage controls

- **Position Management**
  - Real-time position tracking
  - Automatic stop loss/take profit execution
  - Multi-symbol support
  - Emergency shutdown capabilities

- **Robust Architecture**
  - TypeScript for type safety
  - Structured logging with Winston
  - Error handling and recovery
  - Modular and extensible design

## Project Structure

```
perps/
├── src/
│   ├── bot/
│   │   └── TradingBot.ts          # Main bot orchestrator
│   ├── services/
│   │   ├── HyperliquidClient.ts   # Hyperliquid API wrapper
│   │   ├── PositionManager.ts     # Position tracking and execution
│   │   └── RiskManager.ts         # Risk management logic
│   ├── strategies/
│   │   ├── BaseStrategy.ts        # Strategy base class
│   │   ├── MomentumStrategy.ts    # Momentum trading strategy
│   │   └── MeanReversionStrategy.ts # Mean reversion strategy
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   ├── config/
│   │   └── index.ts               # Configuration loader
│   ├── utils/
│   │   └── logger.ts              # Winston logger setup
│   └── index.ts                   # Application entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:

```bash
# Required: Your Hyperliquid private key
HYPERLIQUID_PRIVATE_KEY=your_private_key_here

# Set to true for testnet, false for mainnet
HYPERLIQUID_TESTNET=true

# Trading configuration
TRADING_SYMBOLS=BTC,ETH,SOL
DEFAULT_LEVERAGE=3
MAX_POSITION_SIZE=1000

# Risk management
STOP_LOSS_PERCENT=0.02
TAKE_PROFIT_PERCENT=0.05
MAX_DAILY_LOSS=500
MAX_DRAWDOWN=0.2

# Strategy selection
STRATEGY_NAME=momentum
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HYPERLIQUID_PRIVATE_KEY` | Your wallet private key (required) | - |
| `HYPERLIQUID_TESTNET` | Use testnet (true) or mainnet (false) | true |
| `TRADING_SYMBOLS` | Comma-separated list of symbols to trade | BTC,ETH |
| `DEFAULT_LEVERAGE` | Leverage to use for positions | 3 |
| `MAX_LEVERAGE` | Maximum allowed leverage | 10 |
| `MAX_POSITION_SIZE` | Maximum position size in USD | 1000 |
| `STOP_LOSS_PERCENT` | Stop loss as decimal (0.02 = 2%) | 0.02 |
| `TAKE_PROFIT_PERCENT` | Take profit as decimal (0.05 = 5%) | 0.05 |
| `MAX_DAILY_LOSS` | Maximum daily loss in USD | 500 |
| `MAX_DRAWDOWN` | Maximum drawdown as decimal (0.2 = 20%) | 0.2 |
| `STRATEGY_NAME` | Strategy to use (momentum, meanreversion) | momentum |
| `STRATEGY_PARAMS` | JSON object with strategy parameters | {} |
| `UPDATE_INTERVAL_MS` | Trading cycle interval in milliseconds | 60000 |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | info |

### Strategy Parameters

**Momentum Strategy:**
```bash
STRATEGY_NAME=momentum
STRATEGY_PARAMS={"lookbackPeriod":20,"momentumThreshold":0.02,"positionSize":0.1}
```

**Mean Reversion Strategy:**
```bash
STRATEGY_NAME=meanreversion
STRATEGY_PARAMS={"lookbackPeriod":50,"standardDeviations":2,"positionSize":0.1}
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# Build the project
npm run build

# Start the bot
npm start
```

### Stopping the Bot

- **Graceful shutdown:** Press `Ctrl+C` or send `SIGTERM`
- **Emergency shutdown:** Send `SIGUSR1` signal (closes all positions)

```bash
# Emergency shutdown
kill -USR1 <pid>
```

## Trading Strategies

### Momentum Strategy

Identifies and trades based on price momentum:
- Enters long when positive momentum exceeds threshold
- Enters short when negative momentum exceeds threshold
- Exits when momentum reverses

**Parameters:**
- `lookbackPeriod`: Number of data points to analyze (default: 20)
- `momentumThreshold`: Minimum momentum to trigger trade (default: 0.02)
- `positionSize`: Position size in base units (default: 0.1)

### Mean Reversion Strategy

Trades based on statistical price deviations:
- Enters long when price drops below lower Bollinger Band
- Enters short when price rises above upper Bollinger Band
- Exits when price returns to mean

**Parameters:**
- `lookbackPeriod`: Number of data points for statistics (default: 50)
- `standardDeviations`: Band width in standard deviations (default: 2)
- `positionSize`: Position size in base units (default: 0.1)

## Creating Custom Strategies

Extend the `BaseStrategy` class to create custom strategies:

```typescript
import { BaseStrategy } from './BaseStrategy';
import { MarketData, Position, TradeSignal } from '../types';

export class MyCustomStrategy extends BaseStrategy {
  constructor(params: any = {}) {
    super('MyCustomStrategy', params);
  }

  async analyze(
    marketData: MarketData[],
    positions: Position[]
  ): Promise<TradeSignal[]> {
    const signals: TradeSignal[] = [];

    // Your strategy logic here

    return signals;
  }
}
```

## Risk Management

The bot includes comprehensive risk management:

1. **Position Limits**: Maximum position size and leverage controls
2. **Stop Loss**: Automatic position closure at configured loss percentage
3. **Take Profit**: Automatic position closure at configured profit percentage
4. **Daily Loss Limit**: Bot stops trading if daily loss exceeds threshold
5. **Maximum Drawdown**: Bot stops trading if drawdown exceeds threshold
6. **Margin Monitoring**: Warns on low available margin

## Monitoring

The bot logs all activities to:
- Console (colored output)
- `combined.log` (all logs)
- `error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

## Safety Features

- **Testnet by default**: Always test on testnet first
- **Risk validation**: All trades validated by risk manager
- **Emergency shutdown**: Instant position closure capability
- **Graceful shutdown**: Proper cleanup on exit
- **Error recovery**: Continues operation on non-fatal errors

## API Reference

### HyperliquidClient

Core API wrapper for Hyperliquid exchange.

**Key Methods:**
- `getAccountState()`: Fetch account information
- `getPositions()`: Get open positions
- `getMarketData(coin)`: Fetch market data
- `placeOrder(order)`: Place an order
- `closePosition(coin)`: Close a position
- `setLeverage(coin, leverage)`: Set leverage

### PositionManager

Manages positions and trade execution.

**Key Methods:**
- `updatePositions()`: Refresh position data
- `executeSignal(signal)`: Execute a trade signal
- `closeAllPositions()`: Close all open positions
- `monitorStopLossTakeProfit()`: Check and execute SL/TP

### RiskManager

Handles risk validation and monitoring.

**Key Methods:**
- `checkRiskLimits()`: Validate risk thresholds
- `validateSignal(signal, positions)`: Validate trade signal
- `calculateRiskMetrics()`: Get current risk metrics
- `logRiskReport()`: Log risk summary

## Warning

**This bot trades real money. Use at your own risk.**

- Always test thoroughly on testnet first
- Start with small position sizes
- Monitor the bot closely
- Understand the strategies before deploying
- Never risk more than you can afford to lose

## Security

- Never commit your `.env` file
- Store private keys securely
- Use environment variables for sensitive data
- Run on secure, monitored infrastructure
- Regularly review logs for suspicious activity

## Troubleshooting

**Bot won't start:**
- Check your `.env` configuration
- Verify your private key is correct
- Ensure you have sufficient balance

**No trades executing:**
- Check if risk limits are exceeded
- Verify symbols are correct
- Review strategy parameters
- Check market data is being received

**Positions not closing:**
- Check liquidity for the symbol
- Verify close orders are being placed
- Review error logs for details

## License

MIT

## Disclaimer

This software is provided "as is", without warranty of any kind. The authors are not responsible for any losses incurred while using this bot. Trading cryptocurrencies carries significant risk.
