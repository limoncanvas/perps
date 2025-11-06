import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';
import { BotConfig, Position, OrderRequest, MarketData } from '../types';
import logger from '../utils/logger';

export class HyperliquidClient {
  private sdk: any;
  private wallet: ethers.Wallet;
  private address: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 200; // Minimum 200ms between requests

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

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  async getAccountState(): Promise<any> {
    try {
      await this.rateLimit();
      const state = await this.sdk.info.perpetuals.getClearinghouseState(this.address);
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
      await this.rateLimit();
      // Convert symbol to internal format if needed
      const internalCoin = await this.sdk.info.getInternalName(coin) || coin;
      
      const [metaAndAssetCtxs, l2Book] = await Promise.all([
        this.sdk.info.perpetuals.getMetaAndAssetCtxs(),
        this.sdk.info.getL2Book(internalCoin),
      ]);

      const [meta, assetCtxs] = metaAndAssetCtxs;
      const coinIndex = meta.universe.findIndex((u: any) => u.name === internalCoin);

      if (coinIndex === -1) {
        throw new Error(`Coin ${coin} (internal: ${internalCoin}) not found in universe`);
      }

      const assetCtx = assetCtxs[coinIndex];
      
      // Calculate mid price from L2 book or use midPx from asset context
      let midPrice = 0;
      if (l2Book.levels[0]?.length > 0 && l2Book.levels[1]?.length > 0) {
        midPrice = (parseFloat(l2Book.levels[0][0].px) + parseFloat(l2Book.levels[1][0].px)) / 2;
      } else if (assetCtx.midPx) {
        midPrice = parseFloat(assetCtx.midPx);
      }

      return {
        coin,
        price: midPrice,
        volume24h: 0, // Would need to calculate from trades
        funding: parseFloat(assetCtx.funding || '0'),
        openInterest: parseFloat(assetCtx.openInterest || '0'),
        markPrice: parseFloat(assetCtx.markPx || '0'),
        indexPrice: parseFloat(assetCtx.oraclePx || '0'),
      };
    } catch (error) {
      logger.error('Error fetching market data', { coin, error });
      throw error;
    }
  }

  async placeOrder(order: OrderRequest): Promise<any> {
    try {
      await this.rateLimit();
      logger.info('Placing order', { order });

      // Format coin name with -PERP suffix if not already present
      const coin = order.coin.includes('-') ? order.coin : `${order.coin}-PERP`;

      // Round price to 5 significant figures to match exchange requirements
      const limitPx = parseFloat(order.limitPx.toPrecision(5));

      const orderPayload = {
        coin,
        is_buy: order.isBuy,
        sz: order.sz,
        limit_px: limitPx,
        order_type: { limit: { tif: 'Gtc' } },
        reduce_only: order.reduceOnly,
      };

      const result = await this.sdk.exchange.placeOrder(orderPayload);

      logger.info('Order placed successfully', { coin: order.coin, result });
      return result;
    } catch (error) {
      logger.error('Error placing order', { order, error });
      throw error;
    }
  }

  async cancelOrder(coin: string, orderId: number): Promise<any> {
    try {
      await this.rateLimit();
      logger.info('Cancelling order', { coin, orderId });

      // Get internal coin name and asset index
      const internalCoin = await this.sdk.info.getInternalName(coin) || coin;
      const assetIndex = await this.sdk.info.getAssetIndex(internalCoin);
      
      if (assetIndex === undefined) {
        throw new Error(`Cannot find asset index for ${coin} (internal: ${internalCoin})`);
      }

      const result = await this.sdk.exchange.cancelOrder({
        asset: assetIndex,
        o: orderId,
      });

      logger.info('Order cancelled successfully', { coin, result });
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
      await this.rateLimit();
      logger.info('Setting leverage', { coin, leverage });

      // Format coin name with -PERP suffix if not already present
      const coinName = coin.includes('-') ? coin : `${coin}-PERP`;

      const result = await this.sdk.exchange.updateLeverage(
        coinName,
        'cross',
        leverage
      );

      logger.info('Leverage updated successfully', { coin, leverage, result });
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
