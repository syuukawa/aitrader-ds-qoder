#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { PredictionScheduler } from './scheduler/predictionScheduler';
import { BinanceClient } from './binance/client';

dotenv.config();

async function main() {
  console.log('🚀 Starting AI Trader with Market Prediction Scheduler');

  // Initialize Binance client
  const binanceClient = new BinanceClient();

  // Configuration for the market predictor
  const config = {
    // Volume filter settings
    minVolumeThreshold: 100000000,        // 100M USDT
    minPriceChangePercent: 10,            // 5%
    
    // K-line settings
    klineInterval: '15m',
    klineLimit: 200,
    
    // Technical indicators settings
    rsiPeriod: 14,
    macdFastPeriod: 12,
    macdSlowPeriod: 26,
    macdSignalPeriod: 9,
    bbPeriod: 20,
    bbMultiplier: 2,
    
    // Analysis settings
    deepSeekEnabled: true
  };

  // Initialize scheduler
  const scheduler = new PredictionScheduler(
    binanceClient,
    config,
    process.env.DEEPSEEK_API_KEY
  );

  // ... existing code ...
  try {
    // Start the scheduler to run every 15 minutes
    scheduler.start();

    // Keep the application running
    console.log('\n📌 Press Ctrl+C to stop the scheduler\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down scheduler...');
      scheduler.stop();
      process.exit(0);
    });

    // ... existing code ...
  } catch (error) {
    console.error('❌ Error starting scheduler:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}