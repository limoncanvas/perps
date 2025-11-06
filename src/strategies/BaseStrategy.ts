import { Strategy, MarketData, Position, TradeSignal } from '../types';

export abstract class BaseStrategy implements Strategy {
  constructor(public name: string, protected params: Record<string, any>) {}

  abstract analyze(
    marketData: MarketData[],
    positions: Position[]
  ): Promise<TradeSignal[]>;

  protected hasPosition(coin: string, positions: Position[]): boolean {
    return positions.some(p => p.coin === coin);
  }

  protected getPosition(coin: string, positions: Position[]): Position | undefined {
    return positions.find(p => p.coin === coin);
  }

  protected createSignal(
    coin: string,
    action: 'LONG' | 'SHORT' | 'CLOSE',
    size: number,
    reason: string,
    price?: number
  ): TradeSignal {
    return {
      coin,
      action,
      size,
      price,
      reason,
    };
  }
}
