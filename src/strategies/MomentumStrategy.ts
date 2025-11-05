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

  constructor(params: Partial<MomentumParams> = {}) {
    const defaultParams: MomentumParams = {
      lookbackPeriod: 20,
      momentumThreshold: 0.02, // 2% price change
      positionSize: 0.1,
      ...params,
    };
    super('Momentum', defaultParams);
  }

  async analyze(
    marketData: MarketData[],
    positions: Position[]
  ): Promise<TradeSignal[]> {
    const signals: TradeSignal[] = [];

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

        // Need sufficient history
        if (history.length < this.params.lookbackPeriod) {
          continue;
        }

        // Calculate momentum
        const oldPrice = history[0];
        const currentPrice = market.price;
        const momentum = (currentPrice - oldPrice) / oldPrice;

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
