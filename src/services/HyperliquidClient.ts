import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';
import { BotConfig, Position, OrderRequest, MarketData } from '../types';
import logger from '../utils/logger';

export class HyperliquidClient {
  private sdk: any;
  private wallet: ethers.Wallet;
  private address: string;

  constructor(private config: BotConfig) {
    this.wallet = new ethers.Wallet(config.hyperliquid.privateKey);
    this.address = this.wallet.address;

    this.sdk = new Hyperliquid({
      privateKey: config.hyperliquid.privateKey,
      testnet: config.hyperliquid.testnet,
    });

    logger.info('Hyperliquid client initialized', {
      address: this.address,
      testnet: config.hyperliquid.testnet,
    });
  }

  async getAccountState(): Promise<any> {
    try {
      const state = await this.sdk.info.perpetuals.getUserState(this.address);
      logger.debug('Account state retrieved', { state });
      return state;
    } catch (error) {
      logger.error('Error fetching account state', { error });
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const state = await this.getAccountState();
      const positions: Position[] = state.assetPositions
        .filter((pos: any) => parseFloat(pos.position.szi) !== 0)
        .map((pos: any) => ({
          coin: pos.position.coin,
          szi: pos.position.szi,
          entryPx: pos.position.entryPx,
          positionValue: pos.position.positionValue,
          unrealizedPnl: pos.position.unrealizedPnl,
          returnOnEquity: pos.position.returnOnEquity,
          leverage: pos.position.leverage.value,
          liquidationPx: pos.position.liquidationPx,
          marginUsed: pos.position.marginUsed,
        }));

      logger.info('Positions retrieved', { count: positions.length });
      return positions;
    } catch (error) {
      logger.error('Error fetching positions', { error });
      throw error;
    }
  }

  async getMarketData(coin: string): Promise<MarketData> {
    try {
      const [meta, l2Book] = await Promise.all([
        this.sdk.info.perpetuals.getMeta(),
        this.sdk.info.perpetuals.getL2Book(coin),
      ]);

      const coinMeta = meta.universe.find((u: any) => u.name === coin);

      if (!coinMeta) {
        throw new Error(`Coin ${coin} not found`);
      }

      const midPrice = l2Book.levels[0]?.length > 0 && l2Book.levels[1]?.length > 0
        ? (parseFloat(l2Book.levels[0][0].px) + parseFloat(l2Book.levels[1][0].px)) / 2
        : 0;

      return {
        coin,
        price: midPrice,
        volume24h: 0, // Would need to calculate from trades
        funding: parseFloat(coinMeta.funding || '0'),
        openInterest: parseFloat(coinMeta.openInterest || '0'),
        markPrice: parseFloat(coinMeta.markPx || '0'),
        indexPrice: parseFloat(coinMeta.indexPx || '0'),
      };
    } catch (error) {
      logger.error('Error fetching market data', { coin, error });
      throw error;
    }
  }

  async placeOrder(order: OrderRequest): Promise<any> {
    try {
      logger.info('Placing order', { order });

      const orderPayload = {
        coin: order.coin,
        is_buy: order.isBuy,
        sz: order.sz,
        limit_px: order.limitPx,
        order_type: { limit: { tif: 'Gtc' } },
        reduce_only: order.reduceOnly,
      };

      const result = await this.sdk.exchange.placeOrder(orderPayload);

      logger.info('Order placed successfully', { result });
      return result;
    } catch (error) {
      logger.error('Error placing order', { order, error });
      throw error;
    }
  }

  async cancelOrder(coin: string, orderId: number): Promise<any> {
    try {
      logger.info('Cancelling order', { coin, orderId });

      const result = await this.sdk.exchange.cancelOrder({
        coin,
        o: orderId,
      });

      logger.info('Order cancelled successfully', { result });
      return result;
    } catch (error) {
      logger.error('Error cancelling order', { coin, orderId, error });
      throw error;
    }
  }

  async cancelAllOrders(coin?: string): Promise<any> {
    try {
      logger.info('Cancelling all orders', { coin });

      const result = await this.sdk.exchange.cancelAllOrders(coin);

      logger.info('All orders cancelled successfully', { result });
      return result;
    } catch (error) {
      logger.error('Error cancelling all orders', { coin, error });
      throw error;
    }
  }

  async closePosition(coin: string): Promise<any> {
    try {
      const positions = await this.getPositions();
      const position = positions.find(p => p.coin === coin);

      if (!position) {
        logger.warn('No position to close', { coin });
        return null;
      }

      const szi = parseFloat(position.szi);
      const isBuy = szi < 0; // If short, buy to close
      const size = Math.abs(szi);

      logger.info('Closing position', { coin, size, isBuy });

      const marketData = await this.getMarketData(coin);
      const slippageFactor = isBuy ? 1.001 : 0.999; // 0.1% slippage tolerance
      const limitPrice = marketData.price * slippageFactor;

      return await this.placeOrder({
        coin,
        isBuy,
        sz: size,
        limitPx: limitPrice,
        reduceOnly: true,
        orderType: 'Limit',
      });
    } catch (error) {
      logger.error('Error closing position', { coin, error });
      throw error;
    }
  }

  async setLeverage(coin: string, leverage: number): Promise<any> {
    try {
      logger.info('Setting leverage', { coin, leverage });

      const result = await this.sdk.exchange.updateLeverage({
        coin,
        is_cross: true,
        leverage,
      });

      logger.info('Leverage updated successfully', { result });
      return result;
    } catch (error) {
      logger.error('Error setting leverage', { coin, leverage, error });
      throw error;
    }
  }

  getAddress(): string {
    return this.address;
  }
}
