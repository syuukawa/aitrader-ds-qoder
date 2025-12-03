"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicIndicators = void 0;
class BasicIndicators {
    static calculateMovingAverages(prices) {
        if (!prices || prices.length === 0) {
            return { ma5: 0, ma10: 0, ma20: 0, ma50: 0 };
        }
        const currentPrice = prices[prices.length - 1];
        let ma5 = currentPrice;
        if (prices.length >= 5) {
            const sum5 = prices.slice(-5).reduce((sum, price) => sum + price, 0);
            ma5 = sum5 / 5;
        }
        else {
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma5 = sum / prices.length;
        }
        let ma10 = currentPrice;
        if (prices.length >= 10) {
            const sum10 = prices.slice(-10).reduce((sum, price) => sum + price, 0);
            ma10 = sum10 / 10;
        }
        else if (prices.length > 5) {
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma10 = sum / prices.length;
        }
        else {
            ma10 = ma5;
        }
        let ma20 = currentPrice;
        if (prices.length >= 20) {
            const sum20 = prices.slice(-20).reduce((sum, price) => sum + price, 0);
            ma20 = sum20 / 20;
        }
        else if (prices.length > 10) {
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma20 = sum / prices.length;
        }
        else {
            ma20 = ma10;
        }
        let ma50 = currentPrice;
        if (prices.length >= 50) {
            const sum50 = prices.slice(-50).reduce((sum, price) => sum + price, 0);
            ma50 = sum50 / 50;
        }
        const result = {
            ma5: Number(ma5.toFixed(8)),
            ma10: Number(ma10.toFixed(8)),
            ma20: Number(ma20.toFixed(8))
        };
        if (prices.length >= 50) {
            result.ma50 = Number(ma50.toFixed(8));
        }
        return result;
    }
    static calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) {
            return 50;
        }
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            }
            else {
                losses -= difference;
            }
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        if (avgLoss === 0) {
            return 100;
        }
        let rs = avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));
        if (prices.length > period + 1) {
            for (let i = period + 1; i < prices.length; i++) {
                const currentGain = Math.max(prices[i] - prices[i - 1], 0);
                const currentLoss = Math.max(prices[i - 1] - prices[i], 0);
                avgGain = (avgGain * (period - 1) + currentGain) / period;
                avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
                if (avgLoss === 0) {
                    rsi = 100;
                }
                else {
                    rs = avgGain / avgLoss;
                    rsi = 100 - (100 / (1 + rs));
                }
            }
        }
        return Number(rsi.toFixed(2));
    }
    static calculateBollingerBands(prices, period = 20, multiplier = 2) {
        if (prices.length < period) {
            const currentPrice = prices[prices.length - 1];
            return {
                upper: currentPrice,
                middle: currentPrice,
                lower: currentPrice,
                bandwidth: 0,
                position: 'NORMAL'
            };
        }
        const recentPrices = prices.slice(-period);
        const middle = recentPrices.reduce((sum, price) => sum + price, 0) / period;
        const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upper = middle + (multiplier * stdDev);
        const lower = middle - (multiplier * stdDev);
        const bandwidth = ((upper - lower) / middle) * 100;
        const currentPrice = prices[prices.length - 1];
        let position = 'NORMAL';
        if (currentPrice > upper) {
            position = 'OVERBOUGHT';
        }
        else if (currentPrice < lower) {
            position = 'OVERSOLD';
        }
        return {
            upper: Number(upper.toFixed(8)),
            middle: Number(middle.toFixed(8)),
            lower: Number(lower.toFixed(8)),
            bandwidth: Number(bandwidth.toFixed(4)),
            position
        };
    }
    static calculatePriceTrend(prices) {
        if (prices.length < 5)
            return 0;
        const recentPrices = prices.slice(-5);
        const sumX = recentPrices.reduce((sum, _, i) => sum + i, 0);
        const sumY = recentPrices.reduce((sum, price) => sum + price, 0);
        const sumXY = recentPrices.reduce((sum, price, i) => sum + price * i, 0);
        const sumXX = recentPrices.reduce((sum, _, i) => sum + i * i, 0);
        const n = recentPrices.length;
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }
}
exports.BasicIndicators = BasicIndicators;
//# sourceMappingURL=basicIndicators.js.map