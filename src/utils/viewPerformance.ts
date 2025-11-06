import { HyperliquidClient } from '../services/HyperliquidClient';
import { PerformanceTracker } from '../services/PerformanceTracker';
import { config } from '../config';

async function viewPerformance() {
  try {
    console.log('Loading performance data...\n');

    const client = new HyperliquidClient(config);
    const tracker = new PerformanceTracker(client);
    
    await tracker.initialize();
    await tracker.logPerformanceSummary();

    // Optionally export to JSON
    const args = process.argv.slice(2);
    if (args.includes('--export')) {
      const exportPath = args[args.indexOf('--export') + 1] || undefined;
      tracker.exportToJSON(exportPath);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error viewing performance:', error);
    process.exit(1);
  }
}

viewPerformance();

