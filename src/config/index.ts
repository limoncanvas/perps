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

  // Validate private key format
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY!;
  if (privateKey.includes('your_private_key') || privateKey === 'your_private_key_here') {
    throw new Error(
      'Invalid private key: Please replace "your_private_key_here" in your .env file with your actual Hyperliquid private key.\n' +
      'The private key should be a valid Ethereum private key (64 hex characters, with or without 0x prefix).\n' +
      'For testnet, you can generate a new wallet or use an existing one.'
    );
  }

  // Basic format validation (should be hex string, ~64-66 characters)
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new Error(
      'Invalid private key format: The private key must be a valid Ethereum private key (64 hex characters).\n' +
      'It can optionally start with "0x". Example: "0x1234567890abcdef..." or "1234567890abcdef..."'
    );
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
