import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export function loadConfig(): BotConfig {
  const requiredEnvVars = ['HYPERLIQUID_PRIVATE_KEY'];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    hyperliquid: {
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY!,
      testnet: process.env.HYPERLIQUID_TESTNET === 'true',
      rpcUrl: process.env.HYPERLIQUID_RPC_URL,
    },
    trading: {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000'),
      maxLeverage: parseFloat(process.env.MAX_LEVERAGE || '10'),
      defaultLeverage: parseFloat(process.env.DEFAULT_LEVERAGE || '3'),
      symbols: (process.env.TRADING_SYMBOLS || 'BTC,ETH').split(','),
    },
    risk: {
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.2'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '0.02'),
      takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '0.05'),
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '500'),
    },
    strategy: {
      name: process.env.STRATEGY_NAME || 'momentum',
      params: JSON.parse(process.env.STRATEGY_PARAMS || '{}'),
    },
  };
}

export const config = loadConfig();
