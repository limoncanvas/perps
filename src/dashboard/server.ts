import express from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { HyperliquidClient } from '../services/HyperliquidClient';
import { PerformanceTracker } from '../services/PerformanceTracker';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for bot status
app.get('/api/status', async (req, res) => {
  try {
    const client = new HyperliquidClient(config);
    const tracker = new PerformanceTracker(client);
    
    await tracker.initialize();
    
    const accountState = await client.getAccountState();
    const positions = await client.getPositions();
    const metrics = await tracker.getPerformanceMetrics();
    
    res.json({
      status: 'running',
      timestamp: Date.now(),
      account: {
        equity: parseFloat(accountState.crossMarginSummary?.accountValue || '0'),
        availableMargin: parseFloat(accountState.crossMarginSummary?.accountValue || '0') - 
                         parseFloat(accountState.crossMarginSummary?.totalMarginUsed || '0'),
        usedMargin: parseFloat(accountState.crossMarginSummary?.totalMarginUsed || '0'),
        unrealizedPnl: parseFloat(accountState.crossMarginSummary?.totalNtlPos || '0'),
      },
      positions: positions.map(p => ({
        coin: p.coin,
        size: p.szi,
        entryPrice: p.entryPx,
        currentValue: p.positionValue,
        unrealizedPnl: p.unrealizedPnl,
        leverage: p.leverage,
      })),
      performance: {
        totalPnl: metrics.totalPnl,
        totalPnlPercent: metrics.totalPnlPercent,
        dailyPnl: metrics.dailyPnl,
        winRate: metrics.winRate,
        totalTrades: metrics.totalTrades,
        profitFactor: metrics.profitFactor,
        maxDrawdown: metrics.maxDrawdownPercent,
      },
      config: {
        strategy: config.strategy.name,
        symbols: config.trading.symbols,
        leverage: config.trading.defaultLeverage,
        maxPositionSize: config.trading.maxPositionSize,
        testnet: config.hyperliquid.testnet,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status', message: (error as Error).message });
  }
});

// API endpoint for recent logs
app.get('/api/logs', (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../combined.log');
    const logs = fs.readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .slice(-100)
      .reverse()
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line };
        }
      });
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read logs', message: (error as Error).message });
  }
});

// API endpoint for recent trades
app.get('/api/trades', (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../combined.log');
    const logs = fs.readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter(line => line.includes('Trade signal executed') || line.includes('Position closed'))
      .slice(-50)
      .reverse()
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(log => log !== null);
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read trades', message: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard running at http://localhost:${PORT}`);
  console.log(`Bot status: http://localhost:${PORT}/api/status`);
});

