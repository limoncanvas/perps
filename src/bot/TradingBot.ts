import { HyperliquidClient } from '../services/HyperliquidClient';
import { PositionManager } from '../services/PositionManager';
import { RiskManager } from '../services/RiskManager';
import { Strategy, BotConfig, MarketData } from '../types';
import logger from '../utils/logger';

export class TradingBot {
  private client: HyperliquidClient;
  private positionManager: PositionManager;
  private riskManager: RiskManager;
  private strategy: Strategy;
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    config: BotConfig,
    strategy: Strategy
  ) {
    this.client = new HyperliquidClient(config);
    this.positionManager = new PositionManager(this.client, config);
    this.riskManager = new RiskManager(this.client, config);
    this.strategy = strategy;

    logger.info('Trading bot initialized', {
      strategy: strategy.name,
      symbols: config.trading.symbols,
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing trading bot...');

      // Initialize risk manager
      await this.riskManager.initialize();

      // Update initial positions
      await this.positionManager.updatePositions();

      // Log initial state
      const summary = this.positionManager.getPositionSummary();
      logger.info('Initial position summary', summary);

      await this.riskManager.logRiskReport();

      logger.info('Trading bot initialization complete');
    } catch (error) {
      logger.error('Error initializing trading bot', { error });
      throw error;
    }
  }

  async start(updateIntervalMs: number = 60000): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading bot is already running');
      return;
    }

    logger.info('Starting trading bot', {
      updateInterval: updateIntervalMs,
    });

    this.isRunning = true;

    // Initial run
    await this.runTradingCycle();

    // Set up periodic updates
    this.updateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runTradingCycle();
      }
    }, updateIntervalMs);

    logger.info('Trading bot started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading bot is not running');
      return;
    }

    logger.info('Stopping trading bot...');

    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.info('Trading bot stopped');
  }

  private async runTradingCycle(): Promise<void> {
    try {
      logger.info('=== Starting trading cycle ===');

      // Reset daily metrics if needed
      this.riskManager.resetDailyMetrics();

      // Check risk limits
      const riskOk = await this.riskManager.checkRiskLimits();
      if (!riskOk) {
        logger.error('Risk limits exceeded - halting trading');
        await this.positionManager.closeAllPositions();
        await this.stop();
        return;
      }

      // Update positions
      await this.positionManager.updatePositions();

      // Monitor stop loss and take profit
      await this.positionManager.monitorStopLossTakeProfit();

      // Get market data for all symbols
      const marketDataPromises = this.getConfig().trading.symbols.map(
        symbol => this.client.getMarketData(symbol)
      );
      const marketData = await Promise.all(marketDataPromises);

      // Run strategy analysis
      const currentPositions = this.positionManager.getAllPositions();
      const signals = await this.strategy.analyze(marketData, currentPositions);

      logger.info('Strategy analysis complete', {
        signalsGenerated: signals.length,
      });

      // Execute valid signals
      for (const signal of signals) {
        try {
          // Validate signal with risk manager
          const isValid = await this.riskManager.validateSignal(
            signal,
            currentPositions
          );

          if (isValid) {
            await this.positionManager.executeSignal(signal);
          } else {
            logger.warn('Signal rejected by risk manager', { signal });
          }
        } catch (error) {
          logger.error('Error executing signal', { signal, error });
        }
      }

      // Log summary
      const summary = this.positionManager.getPositionSummary();
      logger.info('Position summary', summary);

      await this.riskManager.logRiskReport();

      logger.info('=== Trading cycle complete ===');
    } catch (error) {
      logger.error('Error in trading cycle', { error });
    }
  }

  async emergencyShutdown(): Promise<void> {
    try {
      logger.warn('!!! EMERGENCY SHUTDOWN INITIATED !!!');

      // Cancel all open orders
      await this.client.cancelAllOrders();

      // Close all positions
      await this.positionManager.closeAllPositions();

      // Stop the bot
      await this.stop();

      logger.warn('Emergency shutdown complete');
    } catch (error) {
      logger.error('Error during emergency shutdown', { error });
      throw error;
    }
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      strategy: this.strategy.name,
      positions: this.positionManager.getPositionSummary(),
    };
  }

  private getConfig(): BotConfig {
    return (this.client as any).config;
  }
}
