import { HyperliquidClient } from './HyperliquidClient';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceSnapshot {
  timestamp: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  dailyPnl: number;
  drawdown: number;
  positions: number;
}

interface TradeRecord {
  timestamp: number;
  coin: string;
  action: 'LONG' | 'SHORT' | 'CLOSE';
  size: number;
  price: number;
  pnl?: number;
}

interface PerformanceMetrics {
  totalEquity: number;
  startingEquity: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
  currentDrawdownPercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  bestTrade: number;
  worstTrade: number;
  positions: number;
  uptime: number; // in seconds
}

export class PerformanceTracker {
  private snapshots: PerformanceSnapshot[] = [];
  private trades: TradeRecord[] = [];
  private startingEquity: number = 0;
  private startTime: number = Date.now();
  private lastSnapshotTime: number = 0;
  private dataFilePath: string;

  constructor(
    private client: HyperliquidClient,
    dataDir: string = './performance-data'
  ) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dataFilePath = path.join(dataDir, 'performance.json');
    this.loadHistoricalData();
  }

  async initialize(): Promise<void> {
    try {
      const accountState = await this.client.getAccountState();
      this.startingEquity = parseFloat(
        accountState.crossMarginSummary.accountValue || '0'
      );
      this.startTime = Date.now();
      logger.info('Performance tracker initialized', {
        startingEquity: this.startingEquity,
      });
    } catch (error) {
      logger.error('Error initializing performance tracker', { error });
    }
  }

  async recordSnapshot(equity: number, unrealizedPnl: number, dailyPnl: number, drawdown: number, positions: number): Promise<void> {
    const now = Date.now();
    
    // Only record snapshot every 5 minutes to avoid too much data
    if (now - this.lastSnapshotTime < 5 * 60 * 1000 && this.snapshots.length > 0) {
      return;
    }

    const realizedPnl = equity - this.startingEquity - unrealizedPnl;
    const totalPnl = equity - this.startingEquity;

    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      equity,
      unrealizedPnl,
      realizedPnl,
      totalPnl,
      dailyPnl,
      drawdown,
      positions,
    };

    this.snapshots.push(snapshot);
    this.lastSnapshotTime = now;

    // Keep only last 1000 snapshots to avoid memory issues
    if (this.snapshots.length > 1000) {
      this.snapshots.shift();
    }

    // Save to file periodically
    if (this.snapshots.length % 10 === 0) {
      this.saveData();
    }
  }

  recordTrade(coin: string, action: 'LONG' | 'SHORT' | 'CLOSE', size: number, price: number, pnl?: number): void {
    const trade: TradeRecord = {
      timestamp: Date.now(),
      coin,
      action,
      size,
      price,
      pnl,
    };

    this.trades.push(trade);

    // Keep only last 1000 trades
    if (this.trades.length > 1000) {
      this.trades.shift();
    }

    logger.info('Trade recorded', { trade });
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const latestSnapshot = this.snapshots[this.snapshots.length - 1];
    const currentEquity = latestSnapshot?.equity || this.startingEquity;
    const totalPnl = currentEquity - this.startingEquity;
    const totalPnlPercent = this.startingEquity > 0 
      ? (totalPnl / this.startingEquity) * 100 
      : 0;

    const dailyPnl = latestSnapshot?.dailyPnl || 0;
    const dailyPnlPercent = this.startingEquity > 0 
      ? (dailyPnl / this.startingEquity) * 100 
      : 0;

    // Calculate max drawdown
    let maxEquity = this.startingEquity;
    let maxDrawdown = 0;
    for (const snapshot of this.snapshots) {
      if (snapshot.equity > maxEquity) {
        maxEquity = snapshot.equity;
      }
      const drawdown = maxEquity - snapshot.equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const maxDrawdownPercent = maxEquity > 0 
      ? (maxDrawdown / maxEquity) * 100 
      : 0;

    const currentDrawdown = latestSnapshot?.drawdown || 0;
    const currentDrawdownPercent = maxEquity > 0 
      ? (currentDrawdown / maxEquity) * 100 
      : 0;

    // Calculate trade statistics
    const tradesWithPnl = this.trades.filter(t => t.pnl !== undefined);
    const winningTrades = tradesWithPnl.filter(t => (t.pnl || 0) > 0);
    const losingTrades = tradesWithPnl.filter(t => (t.pnl || 0) < 0);
    
    const winRate = tradesWithPnl.length > 0 
      ? (winningTrades.length / tradesWithPnl.length) * 100 
      : 0;

    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;

    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length
      : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Calculate Sharpe ratio (simplified - would need returns over time for proper calculation)
    const returns = this.snapshots.slice(1).map((s, i) => {
      const prev = this.snapshots[i];
      return prev.equity > 0 ? (s.equity - prev.equity) / prev.equity : 0;
    });
    const avgReturn = returns.length > 0 
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length 
      : 0;
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    const pnls = tradesWithPnl.map(t => t.pnl || 0);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

    const uptime = (Date.now() - this.startTime) / 1000; // in seconds

    return {
      totalEquity: currentEquity,
      startingEquity: this.startingEquity,
      totalPnl,
      totalPnlPercent,
      dailyPnl,
      dailyPnlPercent,
      maxDrawdown,
      maxDrawdownPercent,
      currentDrawdown,
      currentDrawdownPercent,
      winRate,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      profitFactor,
      sharpeRatio,
      bestTrade,
      worstTrade,
      positions: latestSnapshot?.positions || 0,
      uptime,
    };
  }

  async logPerformanceSummary(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();

      logger.info('═══════════════════════════════════════════════════════');
      logger.info('📊 PERFORMANCE SUMMARY');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`💰 Equity: $${metrics.totalEquity.toFixed(2)} (Started: $${metrics.startingEquity.toFixed(2)})`);
      logger.info(`📈 Total P&L: $${metrics.totalPnl.toFixed(2)} (${metrics.totalPnlPercent >= 0 ? '+' : ''}${metrics.totalPnlPercent.toFixed(2)}%)`);
      logger.info(`📅 Daily P&L: $${metrics.dailyPnl.toFixed(2)} (${metrics.dailyPnlPercent >= 0 ? '+' : ''}${metrics.dailyPnlPercent.toFixed(2)}%)`);
      logger.info(`📉 Max Drawdown: $${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
      logger.info(`📊 Current Drawdown: $${metrics.currentDrawdown.toFixed(2)} (${metrics.currentDrawdownPercent.toFixed(2)}%)`);
      logger.info(`🎯 Win Rate: ${metrics.winRate.toFixed(2)}% (${metrics.winningTrades}W / ${metrics.losingTrades}L)`);
      logger.info(`📊 Total Trades: ${metrics.totalTrades}`);
      logger.info(`✅ Avg Win: $${metrics.averageWin.toFixed(2)}`);
      logger.info(`❌ Avg Loss: $${metrics.averageLoss.toFixed(2)}`);
      logger.info(`⚖️  Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
      logger.info(`📐 Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      logger.info(`🏆 Best Trade: $${metrics.bestTrade.toFixed(2)}`);
      logger.info(`💔 Worst Trade: $${metrics.worstTrade.toFixed(2)}`);
      logger.info(`📦 Open Positions: ${metrics.positions}`);
      logger.info(`⏱️  Uptime: ${this.formatUptime(metrics.uptime)}`);
      logger.info('═══════════════════════════════════════════════════════');
    } catch (error) {
      logger.error('Error logging performance summary', { error });
    }
  }

  exportToJSON(filePath?: string): void {
    const data = {
      startTime: this.startTime,
      startingEquity: this.startingEquity,
      snapshots: this.snapshots,
      trades: this.trades,
      metrics: null as PerformanceMetrics | null,
    };

    // Get current metrics
    this.getPerformanceMetrics().then(metrics => {
      data.metrics = metrics;
      const exportPath = filePath || path.join('./performance-data', `performance-export-${Date.now()}.json`);
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      logger.info('Performance data exported', { filePath: exportPath });
    }).catch(error => {
      logger.error('Error exporting performance data', { error });
    });
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${secs}s`;
    }
  }

  private saveData(): void {
    try {
      const data = {
        startTime: this.startTime,
        startingEquity: this.startingEquity,
        snapshots: this.snapshots,
        trades: this.trades,
      };
      fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving performance data', { error });
    }
  }

  private loadHistoricalData(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf-8'));
        this.startTime = data.startTime || Date.now();
        this.startingEquity = data.startingEquity || 0;
        this.snapshots = data.snapshots || [];
        this.trades = data.trades || [];
        logger.info('Historical performance data loaded', {
          snapshots: this.snapshots.length,
          trades: this.trades.length,
        });
      }
    } catch (error) {
      logger.error('Error loading historical performance data', { error });
    }
  }
}

