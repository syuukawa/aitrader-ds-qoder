// src/indicators/indicatorCalculator.ts
import { MACDCalculator, MACDResult } from './macd';
import { VolumeAnalyzer } from './volume';
import { BasicIndicators, MovingAverages, BollingerBands } from './basicIndicators';
import { MomentumIndicators, KDJResult, WilliamsResult } from './momentum';
import { PatternDetector, PatternDetectionResult } from './patterns';
import { OpenInterestTrendResult, OpenInterestTrendAnalyzer } from './openInterestTrend';
import { Kline } from '../binance/types';

export interface AllIndicators {
    macd: MACDResult;
    macdHistory: MACDResult[];  // 历史MACD值，用于动能检测
    volume: any; // VolumeProfile type
    currentPrice: number;
    rsi: number;
    rsiHistory: number[];  // 历史RSI值，用于背离检测
    ma: MovingAverages;
    bollingerBands: BollingerBands;
    kdj?: KDJResult;  // KDJ随机指标
    williamsR?: WilliamsResult;  // 威廉指标
    patterns?: PatternDetectionResult[];  // K线形态识别结果
    openInterestTrend?: OpenInterestTrendResult;  // OI趋势分析结果
    priceData?: {
        highs: number[];
        lows: number[];
        closes: number[];
    };
}

export class IndicatorCalculator {
    /**
     * Calculate all technical indicators
     */
    static calculateAllIndicators(klines: Kline[]): AllIndicators {
        if (!klines || klines.length === 0) {
            throw new Error('Kline data is empty, cannot calculate indicators');
        }

        // Extract price and volume data
        const closePrices = klines.map(k => k.close);
        const volumes = klines.map(k => k.volume);
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);

        // Calculate various indicators
        const macdResults = MACDCalculator.calculate(closePrices);
        const volumeProfile = VolumeAnalyzer.calculateVolumeProfile(volumes, closePrices);
        const rsiHistory = this.calculateRSIHistory(closePrices);  // 获取RSI历史数组
        const rsi = rsiHistory[rsiHistory.length - 1];  // 获取最新RSI
        const movingAverages = BasicIndicators.calculateMovingAverages(closePrices);
        const bollingerBands = BasicIndicators.calculateBollingerBands(closePrices);
        
        // 计算KDJ和威廉指标
        const kdjResults = MomentumIndicators.calculateKDJ(highs, lows, closePrices);
        const kdj = kdjResults.length > 0 ? kdjResults[kdjResults.length - 1] : undefined;
        
        const williamsResults = MomentumIndicators.calculateWilliamsR(highs, lows, closePrices);
        const williamsR = williamsResults.length > 0 ? williamsResults[williamsResults.length - 1] : undefined;
        
        // 检测K线形态
        const patterns = PatternDetector.detectPatterns(klines);

        return {
            macd: macdResults[macdResults.length - 1], // Return the latest MACD value
            macdHistory: macdResults,  // 保存完整MACD历史
            volume: volumeProfile,
            currentPrice: closePrices[closePrices.length - 1],
            rsi,
            rsiHistory,  // 保存完整RSI历史
            ma: movingAverages,
            bollingerBands,
            kdj,  // KDJ随机指标
            williamsR,  // 威廉指标
            patterns,  // K线形态识别结果
            priceData: {
                highs,
                lows,
                closes: closePrices
            }
        };
    }

    /**
     * 计算RSI历史数组（而不仅仅是最后一个值）
     */
    private static calculateRSIHistory(closePrices: number[]): number[] {
        const period = 14;
        const rsiValues: number[] = [];

        for (let i = 0; i < closePrices.length; i++) {
            if (i < period) {
                rsiValues.push(50);  // 前期数据不足，使用中性值
            } else {
                const gains: number[] = [];
                const losses: number[] = [];

                for (let j = i - period + 1; j <= i; j++) {
                    const change = closePrices[j] - closePrices[j - 1];
                    if (change > 0) {
                        gains.push(change);
                        losses.push(0);
                    } else {
                        gains.push(0);
                        losses.push(Math.abs(change));
                    }
                }

                const avgGain = gains.reduce((a, b) => a + b) / period;
                const avgLoss = losses.reduce((a, b) => a + b) / period;

                let rsi = 100;
                if (avgLoss !== 0) {
                    const rs = avgGain / avgLoss;
                    rsi = 100 - 100 / (1 + rs);
                }
                rsiValues.push(rsi);
            }
        }

        return rsiValues;
    }

    /**
     * Calculate indicators for multiple symbols
     */
    static calculateMultipleSymbols(symbolsData: Map<string, Kline[]>): Map<string, AllIndicators> {
        const results = new Map<string, AllIndicators>();

        const symbolsArray = Array.from(symbolsData);

        for (const [symbol, klines] of symbolsArray) {
            try {
                const indicators = this.calculateAllIndicators(klines);
                results.set(symbol, indicators);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error calculating indicators for ${symbol}:`, errorMessage);
                // Can choose to skip errors or set default values
            }
        }

        return results;
    }

    /**
     * Validate indicator data completeness
     */
    static validateIndicators(indicators: AllIndicators): boolean {
        const requiredFields: (keyof AllIndicators)[] = [
            'macd', 'macdHistory', 'volume', 'currentPrice', 'rsi', 'rsiHistory', 'ma', 'bollingerBands'
        ];

        for (const field of requiredFields) {
            if (!indicators[field]) {
                console.warn(`Indicator data is incomplete, missing field: ${field}`);
                return false;
            }
        }

        // Check key value validity
        if (indicators.currentPrice <= 0) {
            console.warn('Invalid current price:', indicators.currentPrice);
            return false;
        }

        if (indicators.rsi < 0 || indicators.rsi > 100) {
            console.warn('Abnormal RSI value:', indicators.rsi);
            return false;
        }

        // Check history arrays
        if (!Array.isArray(indicators.macdHistory) || indicators.macdHistory.length === 0) {
            console.warn('Invalid MACD history data');
            return false;
        }

        if (!Array.isArray(indicators.rsiHistory) || indicators.rsiHistory.length === 0) {
            console.warn('Invalid RSI history data');
            return false;
        }

        return true;
    }
}