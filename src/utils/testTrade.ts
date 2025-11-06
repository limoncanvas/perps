import { config } from '../config';
import { HyperliquidClient } from '../services/HyperliquidClient';
import logger from './logger';

async function testTrade() {
  try {
    console.log('🧪 Testing manual trade execution...\n');

    const client = new HyperliquidClient(config);
    
    // Wait for SDK initialization
    console.log('⏳ Waiting for SDK to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check available assets
    const sdk = (client as any).sdk;
    const allAssets = await sdk.info.getAllAssets();
    console.log('📋 Available assets:', allAssets);
    
    // Get account state
    const state = await client.getAccountState();
    console.log(`💰 Account Balance: $${state.crossMarginSummary.accountValue}`);
    
    // Get market data
    const marketData = await client.getMarketData('SOL');
    console.log(`📊 SOL Price: $${marketData.price}\n`);
    
    // Skip leverage setting for now - will use account default
    console.log('⚙️  Using account default leverage\n');
    
    // Place a small test order (minimum $10)
    const testSize = 0.1; // ~$16 worth of SOL
    const positionValue = testSize * marketData.price;
    console.log(`📝 Placing test order:`);
    console.log(`   - Coin: SOL`);
    console.log(`   - Side: LONG`);
    console.log(`   - Size: ${testSize} SOL`);
    console.log(`   - Value: $${positionValue.toFixed(2)}`);
    console.log(`   - Price: $${marketData.price}\n`);
    
    const result = await client.placeOrder({
      coin: 'SOL',
      isBuy: true,
      sz: testSize,
      limitPx: marketData.price * 1.001, // 0.1% slippage
      reduceOnly: false,
      orderType: 'Limit',
    });
    
    console.log('✅ Order placed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\n🎉 Test trade executed! Check your Hyperliquid dashboard.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error executing test trade:', error);
    process.exit(1);
  }
}

testTrade();

