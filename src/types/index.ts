export interface BotConfig {
  hyperliquid: {
    privateKey: string;
    testnet: boolean;
    rpcUrl?: string;
  };
  trading: {
    maxPositionSize: number;
    maxLeverage: number;
    defaultLeverage: number;
    symbols: string[];
  };
  risk: {
    maxDrawdown: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
  };
  strategy: {
    name: string;
    params: Record<string, any>;
  };
}

export interface Position {
  coin: string;
  szi: string;  // Position size (positive = long, negative = short)
  entryPx: string;  // Entry price
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  leverage: string;
  liquidationPx: string | null;
  marginUsed: string;
}

export interface OrderRequest {
  coin: string;
  isBuy: boolean;
  sz: number;
  limitPx: number;
  reduceOnly: boolean;
  orderType: 'Limit' | 'Market';
}

export interface MarketData {
  coin: string;
  price: number;
  volume24h: number;
  funding: number;
  openInterest: number;
  markPrice: number;
  indexPrice: number;
}

export interface TradeSignal {
  coin: string;
  action: 'LONG' | 'SHORT' | 'CLOSE';
  size: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
}

export interface Strategy {
  name: string;
  analyze(marketData: MarketData[], positions: Position[]): Promise<TradeSignal[]>;
}

export interface RiskMetrics {
  totalEquity: number;
  usedMargin: number;
  availableMargin: number;
  totalUnrealizedPnl: number;
  dailyPnl: number;
  maxDrawdown: number;
}
