#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const predictionScheduler_1 = require("./scheduler/predictionScheduler");
const client_1 = require("./binance/client");
dotenv.config();
async function main() {
    console.log('🚀 Starting AI Trader with Market Prediction Scheduler');
    const binanceClient = new client_1.BinanceClient();
    const config = {
        minVolumeThreshold: 80 * 1000000,
        minPriceChangePercent: 9,
        klineInterval: '15m',
        klineLimit: 200,
        rsiPeriod: 14,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        bbPeriod: 20,
        bbMultiplier: 2,
        deepSeekEnabled: true
    };
    const scheduler = new predictionScheduler_1.PredictionScheduler(binanceClient, config, process.env.DEEPSEEK_API_KEY);
    try {
        scheduler.start();
        console.log('\n📌 Press Ctrl+C to stop the scheduler\n');
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutting down scheduler...');
            scheduler.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Error starting scheduler:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map