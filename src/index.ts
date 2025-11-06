import { config } from './config';
import { TradingBot } from './bot/TradingBot';
import { MomentumStrategy, MeanReversionStrategy } from './strategies';
import logger from './utils/logger';

async function main() {
  try {
    logger.info('=== Hyperliquid Perp Trading Bot ===');
    logger.info('Loading configuration...');

    // Select strategy based on config
    let strategy;
    switch (config.strategy.name.toLowerCase()) {
      case 'momentum':
        strategy = new MomentumStrategy(config.strategy.params);
        break;
      case 'meanreversion':
        strategy = new MeanReversionStrategy(config.strategy.params);
        break;
      default:
        logger.warn(`Unknown strategy: ${config.strategy.name}, using momentum`);
        strategy = new MomentumStrategy();
    }

    // Create and initialize bot
    const bot = new TradingBot(config, strategy);
    await bot.initialize();

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('Shutdown signal received');
      await bot.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Handle emergency shutdown
    process.on('SIGUSR1', async () => {
      logger.warn('Emergency shutdown signal received');
      await bot.emergencyShutdown();
      process.exit(1);
    });

    // Start the bot
    const updateInterval = parseInt(process.env.UPDATE_INTERVAL_MS || '60000');
    await bot.start(updateInterval);

    logger.info('Bot is now running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Fatal error in main', { error });
    process.exit(1);
  }
}

main();
