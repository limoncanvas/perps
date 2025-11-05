import { HyperliquidClient } from './HyperliquidClient';
import { Position, TradeSignal, BotConfig } from '../types';
import logger from '../utils/logger';

export class PositionManager {
  private positions: Map<string, Position> = new Map();

  constructor(
    private client: HyperliquidClient,
    private config: BotConfig
  ) {}

  async updatePositions(): Promise<void> {
    try {
      const positions = await this.client.getPositions();
      this.positions.clear();

      for (const position of positions) {
        this.positions.set(position.coin, position);
      }

      logger.info('Positions updated', {
        count: this.positions.size,
        coins: Array.from(this.positions.keys()),
      });
    } catch (error) {
      logger.error('Error updating positions', { error });
      throw error;
    }
  }

  getPosition(coin: string): Position | undefined {
    return this.positions.get(coin);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  hasPosition(coin: string): boolean {
    return this.positions.has(coin);
  }

  async executeSignal(signal: TradeSignal): Promise<void> {
    try {
      logger.info('Executing trade signal', { signal });

      const currentPosition = this.getPosition(signal.coin);

      if (signal.action === 'CLOSE') {
        if (!currentPosition) {
          logger.warn('No position to close', { coin: signal.coin });
          return;
        }
        await this.client.closePosition(signal.coin);
        return;
      }

      // Calculate order details
      const isBuy = signal.action === 'LONG';
      const marketData = await this.client.getMarketData(signal.coin);

      // Set leverage if not already set
      await this.client.setLeverage(
        signal.coin,
        this.config.trading.defaultLeverage
      );

      // Calculate limit price with slippage
      const slippageFactor = isBuy ? 1.001 : 0.999; // 0.1% slippage
      const limitPrice = signal.price
        ? signal.price
        : marketData.price * slippageFactor;

      // Place the order
      await this.client.placeOrder({
        coin: signal.coin,
        isBuy,
        sz: signal.size,
        limitPx: limitPrice,
        reduceOnly: false,
        orderType: 'Limit',
      });

      logger.info('Trade signal executed successfully', {
        coin: signal.coin,
        action: signal.action,
        size: signal.size,
        price: limitPrice,
      });

      // Update positions after execution
      await this.updatePositions();
    } catch (error) {
      logger.error('Error executing trade signal', { signal, error });
      throw error;
    }
  }

  async closeAllPositions(): Promise<void> {
    try {
      logger.info('Closing all positions');

      const positions = this.getAllPositions();

      for (const position of positions) {
        try {
          await this.client.closePosition(position.coin);
          logger.info('Position closed', { coin: position.coin });
        } catch (error) {
          logger.error('Error closing position', {
            coin: position.coin,
            error,
          });
        }
      }

      await this.updatePositions();

      logger.info('All positions closed');
    } catch (error) {
      logger.error('Error closing all positions', { error });
      throw error;
    }
  }

  getPositionSummary(): any {
    const positions = this.getAllPositions();

    const summary = {
      totalPositions: positions.length,
      totalUnrealizedPnl: 0,
      totalMarginUsed: 0,
      positions: positions.map(p => ({
        coin: p.coin,
        size: p.szi,
        entryPrice: p.entryPx,
        unrealizedPnl: p.unrealizedPnl,
        leverage: p.leverage,
      })),
    };

    for (const position of positions) {
      summary.totalUnrealizedPnl += parseFloat(position.unrealizedPnl || '0');
      summary.totalMarginUsed += parseFloat(position.marginUsed || '0');
    }

    return summary;
  }

  async monitorStopLossTakeProfit(): Promise<void> {
    try {
      const positions = this.getAllPositions();

      for (const position of positions) {
        const entryPrice = parseFloat(position.entryPx);
        const currentMarketData = await this.client.getMarketData(position.coin);
        const currentPrice = currentMarketData.price;

        const isLong = parseFloat(position.szi) > 0;
        const priceChange = (currentPrice - entryPrice) / entryPrice;
        const pnlPercent = isLong ? priceChange : -priceChange;

        // Check stop loss
        if (pnlPercent <= -this.config.risk.stopLossPercent) {
          logger.warn('Stop loss triggered', {
            coin: position.coin,
            entryPrice,
            currentPrice,
            pnlPercent,
          });
          await this.client.closePosition(position.coin);
          continue;
        }

        // Check take profit
        if (pnlPercent >= this.config.risk.takeProfitPercent) {
          logger.info('Take profit triggered', {
            coin: position.coin,
            entryPrice,
            currentPrice,
            pnlPercent,
          });
          await this.client.closePosition(position.coin);
        }
      }
    } catch (error) {
      logger.error('Error monitoring stop loss/take profit', { error });
    }
  }
}
