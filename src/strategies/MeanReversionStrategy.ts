import { BaseStrategy } from './BaseStrategy';
import { MarketData, Position, TradeSignal } from '../types';
import logger from '../utils/logger';

interface MeanReversionParams {
  lookbackPeriod: number;
  standardDeviations: number;
  positionSize: number;
}

export class MeanReversionStrategy extends BaseStrategy {
  private priceHistory: Map<string, number[]> = new Map();

  constructor(params: Partial<MeanReversionParams> = {}) {
    const defaultParams: MeanReversionParams = {
      lookbackPeriod: 50,
      standardDeviations: 2,
      positionSize: 0.1,
      ...params,
    };
    super('MeanReversion', defaultParams);
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = this.calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
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

        // Calculate statistics
        const mean = this.calculateMean(history);
        const stdDev = this.calculateStandardDeviation(history, mean);
        const currentPrice = market.price;

        const upperBand = mean + stdDev * this.params.standardDeviations;
        const lowerBand = mean - stdDev * this.params.standardDeviations;

        const hasPosition = this.hasPosition(market.coin, positions);
        const position = this.getPosition(market.coin, positions);

        // Check for exit conditions
        if (hasPosition && position) {
          const isLong = parseFloat(position.szi) > 0;

          // Exit long when price returns to mean
          if (isLong && currentPrice >= mean) {
            signals.push(
              this.createSignal(
                market.coin,
                'CLOSE',
                Math.abs(parseFloat(position.szi)),
                `Price returned to mean: ${currentPrice.toFixed(2)}`
              )
            );
            continue;
          }

          // Exit short when price returns to mean
          if (!isLong && currentPrice <= mean) {
            signals.push(
              this.createSignal(
                market.coin,
                'CLOSE',
                Math.abs(parseFloat(position.szi)),
                `Price returned to mean: ${currentPrice.toFixed(2)}`
              )
            );
            continue;
          }
        }

        // Check for entry conditions
        if (!hasPosition) {
          // Price is oversold (below lower band) - go long
          if (currentPrice < lowerBand) {
            signals.push(
              this.createSignal(
                market.coin,
                'LONG',
                this.params.positionSize,
                `Oversold: price ${currentPrice.toFixed(2)} < lower band ${lowerBand.toFixed(2)}`,
                currentPrice
              )
            );
          }

          // Price is overbought (above upper band) - go short
          if (currentPrice > upperBand) {
            signals.push(
              this.createSignal(
                market.coin,
                'SHORT',
                this.params.positionSize,
                `Overbought: price ${currentPrice.toFixed(2)} > upper band ${upperBand.toFixed(2)}`,
                currentPrice
              )
            );
          }
        }
      } catch (error) {
        logger.error('Error analyzing mean reversion for coin', {
          coin: market.coin,
          error,
        });
      }
    }

    return signals;
  }
}
