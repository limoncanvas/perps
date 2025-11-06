import { HyperliquidClient } from './HyperliquidClient';
import { BotConfig, RiskMetrics, TradeSignal, Position } from '../types';
import logger from '../utils/logger';

export class RiskManager {
  private dailyStartEquity: number = 0;
  private dailyPnl: number = 0;
  private maxEquitySeen: number = 0;
  private lastResetDate: Date = new Date();

  constructor(
    private client: HyperliquidClient,
    private config: BotConfig
  ) {}

  async initialize(): Promise<void> {
    const metrics = await this.calculateRiskMetrics();
    this.dailyStartEquity = metrics.totalEquity;
    this.maxEquitySeen = metrics.totalEquity;
    this.lastResetDate = new Date();

    logger.info('Risk manager initialized', {
      startingEquity: this.dailyStartEquity,
    });
  }

  async calculateRiskMetrics(): Promise<RiskMetrics> {
    try {
      const accountState = await this.client.getAccountState();

      logger.debug('Account state received', {
        hasCrossMarginSummary: !!accountState.crossMarginSummary,
        crossMarginSummary: accountState.crossMarginSummary,
      });

      const totalEquity = parseFloat(accountState.crossMarginSummary?.accountValue || '0');
      const usedMargin = parseFloat(accountState.crossMarginSummary?.totalMarginUsed || '0');
      const totalUnrealizedPnl = parseFloat(accountState.crossMarginSummary?.totalNtlPos || '0');

      if (totalEquity === 0) {
        logger.warn('Account equity is 0 - check if funds are deposited on Hyperliquid', {
          accountValue: accountState.crossMarginSummary?.accountValue,
          fullState: JSON.stringify(accountState, null, 2),
        });
      }

      // Update max equity
      if (totalEquity > this.maxEquitySeen) {
        this.maxEquitySeen = totalEquity;
      }

      // Calculate daily P&L
      this.dailyPnl = totalEquity - this.dailyStartEquity;

      // Calculate current drawdown
      const currentDrawdown = this.maxEquitySeen > 0 
        ? (this.maxEquitySeen - totalEquity) / this.maxEquitySeen 
        : 0;

      return {
        totalEquity,
        usedMargin,
        availableMargin: totalEquity - usedMargin,
        totalUnrealizedPnl,
        dailyPnl: this.dailyPnl,
        maxDrawdown: currentDrawdown,
      };
    } catch (error) {
      logger.error('Error calculating risk metrics', { error });
      throw error;
    }
  }

  async checkRiskLimits(): Promise<boolean> {
    try {
      const metrics = await this.calculateRiskMetrics();

      // Check max drawdown
      if (metrics.maxDrawdown > this.config.risk.maxDrawdown) {
        logger.error('Max drawdown exceeded', {
          currentDrawdown: metrics.maxDrawdown,
          maxDrawdown: this.config.risk.maxDrawdown,
        });
        return false;
      }

      // Check max daily loss
      if (this.dailyPnl < -this.config.risk.maxDailyLoss) {
        logger.error('Max daily loss exceeded', {
          dailyPnl: this.dailyPnl,
          maxDailyLoss: this.config.risk.maxDailyLoss,
        });
        return false;
      }

      // Check if sufficient margin is available
      if (metrics.availableMargin < metrics.totalEquity * 0.1) {
        logger.warn('Low available margin', {
          availableMargin: metrics.availableMargin,
          totalEquity: metrics.totalEquity,
        });
      }

      return true;
    } catch (error) {
      logger.error('Error checking risk limits', { error });
      return false;
    }
  }

  async validateSignal(
    signal: TradeSignal,
    currentPositions: Position[]
  ): Promise<boolean> {
    try {
      // Check if risk limits are within acceptable range
      const riskOk = await this.checkRiskLimits();
      if (!riskOk) {
        logger.warn('Signal rejected due to risk limits', { signal });
        return false;
      }

      const metrics = await this.calculateRiskMetrics();

      // Calculate position size limits
      const maxPositionValue =
        (metrics.totalEquity * this.config.trading.maxLeverage) /
        currentPositions.length || 1;

      const marketData = await this.client.getMarketData(signal.coin);
      const positionValue = signal.size * marketData.price;

      if (positionValue > this.config.trading.maxPositionSize) {
        logger.warn('Signal rejected: position size too large', {
          signal,
          positionValue,
          maxPositionSize: this.config.trading.maxPositionSize,
        });
        return false;
      }

      // Check leverage limits
      const requiredMargin = positionValue / this.config.trading.defaultLeverage;
      if (requiredMargin > metrics.availableMargin) {
        logger.warn('Signal rejected: insufficient margin', {
          signal,
          requiredMargin,
          availableMargin: metrics.availableMargin,
        });
        return false;
      }

      // Validate stop loss and take profit if provided
      if (signal.stopLoss || signal.takeProfit) {
        const entryPrice = signal.price || marketData.price;

        if (signal.stopLoss) {
          const slDistance = Math.abs(entryPrice - signal.stopLoss) / entryPrice;
          if (slDistance > 0.1) {
            logger.warn('Stop loss too far from entry', {
              signal,
              slDistance,
            });
          }
        }

        if (signal.takeProfit) {
          const tpDistance = Math.abs(signal.takeProfit - entryPrice) / entryPrice;
          if (tpDistance < 0.01) {
            logger.warn('Take profit too close to entry', {
              signal,
              tpDistance,
            });
          }
        }
      }

      logger.info('Signal validated successfully', { signal });
      return true;
    } catch (error) {
      logger.error('Error validating signal', { signal, error });
      return false;
    }
  }

  resetDailyMetrics(): void {
    const now = new Date();
    if (now.getDate() !== this.lastResetDate.getDate()) {
      logger.info('Resetting daily metrics', {
        previousDailyPnl: this.dailyPnl,
      });

      this.lastResetDate = now;
      this.dailyStartEquity = this.dailyStartEquity + this.dailyPnl;
      this.dailyPnl = 0;
    }
  }

  async logRiskReport(): Promise<void> {
    try {
      const metrics = await this.calculateRiskMetrics();

      logger.info('=== Risk Report ===', {
        totalEquity: metrics.totalEquity.toFixed(2),
        usedMargin: metrics.usedMargin.toFixed(2),
        availableMargin: metrics.availableMargin.toFixed(2),
        dailyPnl: metrics.dailyPnl.toFixed(2),
        maxDrawdown: (metrics.maxDrawdown * 100).toFixed(2) + '%',
        totalUnrealizedPnl: metrics.totalUnrealizedPnl.toFixed(2),
      });
    } catch (error) {
      logger.error('Error generating risk report', { error });
    }
  }
}
