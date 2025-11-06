#!/bin/bash

echo "🚀 Starting Hyperliquid Perp Trading Bot"
echo "========================================="
echo ""
echo "Trading Symbols: BTC, ETH, SOL"
echo "Strategy: Momentum"
echo "Mode: $(grep HYPERLIQUID_TESTNET .env | cut -d= -f2 | sed 's/true/TESTNET ✅/;s/false/MAINNET ⚠️/')"
echo ""
echo "Press Ctrl+C to stop the bot"
echo "========================================="
echo ""

npm run dev
