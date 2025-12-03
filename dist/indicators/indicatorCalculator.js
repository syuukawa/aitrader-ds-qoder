"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorCalculator = void 0;
const macd_1 = require("./macd");
const volume_1 = require("./volume");
const basicIndicators_1 = require("./basicIndicators");
class IndicatorCalculator {
    static calculateAllIndicators(klines) {
        if (!klines || klines.length === 0) {
            throw new Error('Kline data is empty, cannot calculate indicators');
        }
        const closePrices = klines.map(k => k.close);
        const volumes = klines.map(k => k.volume);
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);
        const macdResults = macd_1.MACDCalculator.calculate(closePrices);
        const volumeProfile = volume_1.VolumeAnalyzer.calculateVolumeProfile(volumes, closePrices);
        const rsi = basicIndicators_1.BasicIndicators.calculateRSI(closePrices);
        const movingAverages = basicIndicators_1.BasicIndicators.calculateMovingAverages(closePrices);
        const bollingerBands = basicIndicators_1.BasicIndicators.calculateBollingerBands(closePrices);
        return {
            macd: macdResults[macdResults.length - 1],
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
    static calculateMultipleSymbols(symbolsData) {
        const results = new Map();
        const symbolsArray = Array.from(symbolsData);
        for (const [symbol, klines] of symbolsArray) {
            try {
                const indicators = this.calculateAllIndicators(klines);
                results.set(symbol, indicators);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error calculating indicators for ${symbol}:`, errorMessage);
            }
        }
        return results;
    }
    static validateIndicators(indicators) {
        const requiredFields = [
            'macd', 'volume', 'currentPrice', 'rsi', 'ma', 'bollingerBands'
        ];
        for (const field of requiredFields) {
            if (!indicators[field]) {
                console.warn(`Indicator data is incomplete, missing field: ${field}`);
                return false;
            }
        }
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
exports.IndicatorCalculator = IndicatorCalculator;
//# sourceMappingURL=indicatorCalculator.js.map