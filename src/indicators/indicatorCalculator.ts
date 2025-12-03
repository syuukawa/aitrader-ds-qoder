// src/indicators/indicatorCalculator.ts
import { MACDCalculator, MACDResult } from './macd';
import { VolumeAnalyzer } from './volume';
import { BasicIndicators, MovingAverages, BollingerBands } from './basicIndicators';
import { Kline } from '../binance/types';

export interface AllIndicators {
    macd: MACDResult;
    volume: any; // VolumeProfile type
    currentPrice: number;
    rsi: number;
    ma: MovingAverages;
    bollingerBands: BollingerBands;
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
        const rsi = BasicIndicators.calculateRSI(closePrices);
        const movingAverages = BasicIndicators.calculateMovingAverages(closePrices);
        const bollingerBands = BasicIndicators.calculateBollingerBands(closePrices);

        return {
            macd: macdResults[macdResults.length - 1], // Return the latest MACD value
            volume: volumeProfile,
            currentPrice: closePrices[closePrices.length - 1],
            rsi,
            ma: movingAverages,
            bollingerBands,
            priceData: {
                highs,
                lows,
                closes: closePrices
            }
        };
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
            'macd', 'volume', 'currentPrice', 'rsi', 'ma', 'bollingerBands'
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

        return true;
    }
}