import { BaseStrategy } from './BaseStrategy';
import { MarketData, Position, TradeSignal } from '../types';
import logger from '../utils/logger';

interface MomentumParams {
  lookbackPeriod: number;
  momentumThreshold: number;
  positionSize: number;
}

export class MomentumStrategy extends BaseStrategy {
  private priceHistory: Map<string, number[]> = new Map();
  private isInitialized: boolean = false;

  constructor(params: Partial<MomentumParams> = {}) {
    const defaultParams: MomentumParams = {
      lookbackPeriod: 20,
      momentumThreshold: 0.02, // 2% price change
      positionSize: 0.1,
      ...params,
    };
    super('Momentum', defaultParams);
  }

  async initializeWithHistoricalData(marketData: MarketData[]): Promise<void> {
    logger.info('Initializing strategy with historical candle data...');
    
    // Pre-populate price history with current prices
    // This allows the strategy to start trading immediately
    for (const market of marketData) {
      if (!this.priceHistory.has(market.coin)) {
        // Initialize with current price repeated for lookback period
        // This is a simple approach - could fetch actual candles for better accuracy
        const initialHistory = new Array(this.params.lookbackPeriod).fill(market.price);
        this.priceHistory.set(market.coin, initialHistory);
        logger.info(`Pre-populated price history for ${market.coin}`, {
          price: market.price,
          dataPoints: initialHistory.length,
        });
      }
    }
    
    this.isInitialized = true;
    logger.info('Strategy initialized and ready to trade');
  }

  async analyze(
    marketData: MarketData[],
    positions: Position[]
  ): Promise<TradeSignal[]> {
    const signals: TradeSignal[] = [];

    // Initialize on first run
    if (!this.isInitialized) {
      await this.initializeWithHistoricalData(marketData);
    }

    for (const market of marketData) {
      try {
        // Update price history
        if (!this.priceHistory.has(market.coin)) {
          this.priceHistory.set(market.coin, []);
        }

        const history = this.priceHistory.get(market.coin)!;
        history.push(market.price);

        // Keep only lookback period
        if (history.length > this.params.lookbackPeriod) {
          history.shift();
        }

        // Need sufficient history (should always be true after initialization)
        if (history.length < this.params.lookbackPeriod) {
          logger.debug(`Waiting for more price history: ${history.length}/${this.params.lookbackPeriod}`, {
            coin: market.coin,
            currentPrice: market.price,
          });
          continue;
        }

        // Calculate momentum
        const oldPrice = history[0];
        const currentPrice = market.price;
        const momentum = (currentPrice - oldPrice) / oldPrice;

        logger.debug(`Momentum analysis`, {
          coin: market.coin,
          oldPrice,
          currentPrice,
          momentum: (momentum * 100).toFixed(2) + '%',
          threshold: (this.params.momentumThreshold * 100).toFixed(2) + '%',
        });

        const hasPosition = this.hasPosition(market.coin, positions);
        const position = this.getPosition(market.coin, positions);

        // Check for exit conditions first
        if (hasPosition && position) {
          const isLong = parseFloat(position.szi) > 0;
          const shouldExit = isLong ? momentum < 0 : momentum > 0;

          if (shouldExit) {
            signals.push(
              this.createSignal(
                market.coin,
                'CLOSE',
                Math.abs(parseFloat(position.szi)),
                `Momentum reversal: ${(momentum * 100).toFixed(2)}%`
              )
            );
            continue;
          }
        }

        // Check for entry conditions
        if (!hasPosition) {
          if (momentum > this.params.momentumThreshold) {
            logger.info(`Generating LONG signal`, {
              coin: market.coin,
              momentum: (momentum * 100).toFixed(2) + '%',
              threshold: (this.params.momentumThreshold * 100).toFixed(2) + '%',
            });
            signals.push(
              this.createSignal(
                market.coin,
                'LONG',
                this.params.positionSize,
                `Positive momentum: ${(momentum * 100).toFixed(2)}%`,
                currentPrice
              )
            );
          } else if (momentum < -this.params.momentumThreshold) {
            logger.info(`Generating SHORT signal`, {
              coin: market.coin,
              momentum: (momentum * 100).toFixed(2) + '%',
              threshold: (this.params.momentumThreshold * 100).toFixed(2) + '%',
            });
            signals.push(
              this.createSignal(
                market.coin,
                'SHORT',
                this.params.positionSize,
                `Negative momentum: ${(momentum * 100).toFixed(2)}%`,
                currentPrice
              )
            );
          }
        }
      } catch (error) {
        logger.error('Error analyzing momentum for coin', {
          coin: market.coin,
          error,
        });
      }
    }

    return signals;
  }
}
