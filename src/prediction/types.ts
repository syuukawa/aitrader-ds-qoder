// src/prediction/types.ts
import { AllIndicators } from '../indicators/indicatorCalculator';

export interface PredictionConfig {
    // Volume filter settings
    minVolumeThreshold: number;          // Minimum 24h volume in USDT (e.g., 50,000,000 = 50M)
    minPriceChangePercent: number;       // Minimum 24h price change percentage (e.g., 5 for 5%)
    
    // K-line settings
    klineInterval: string;               // Interval for K-line data (e.g., '15m')
    klineLimit: number;                  // Number of K-line periods to fetch
    
    // Technical indicators settings
    rsiPeriod: number;                   // RSI calculation period
    macdFastPeriod: number;              // MACD fast period
    macdSlowPeriod: number;              // MACD slow period
    macdSignalPeriod: number;             // MACD signal period
    bbPeriod: number;                    // Bollinger Bands period
    bbMultiplier: number;                // Bollinger Bands multiplier
    
    // Analysis settings
    deepSeekEnabled: boolean;            // Whether to use DeepSeek for analysis
}

export interface PredictedSymbol {
    symbol: string;
    currentPrice: number;
    volume24h: number;
    priceChangePercent24h: number;
    sumOpenInterestValue?: number;       // 24h open interest value in USDT
    technicalIndicators: AllIndicators;
    prediction?: string;                 // Prediction from DeepSeek analysis
    confidence?: number;                 // Confidence level of prediction
    timestamp: number;
}