// src/indicators/basicIndicators.ts

export interface MovingAverages {
    ma5: number;
    ma10: number;
    ma20: number;
    ma50?: number;
}

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    position: 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL';
}

export class BasicIndicators {
    /**
     * Calculate moving averages
     */
    static calculateMovingAverages(prices: number[]): MovingAverages {
        if (!prices || prices.length === 0) {
            return { ma5: 0, ma10: 0, ma20: 0, ma50: 0 };
        }

        const currentPrice = prices[prices.length - 1];

        // Calculate MA5 (5-period moving average)
        let ma5 = currentPrice;
        if (prices.length >= 5) {
            const sum5 = prices.slice(-5).reduce((sum, price) => sum + price, 0);
            ma5 = sum5 / 5;
        } else {
            // Use available data average when insufficient data
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma5 = sum / prices.length;
        }

        // Calculate MA10 (10-period moving average)
        let ma10 = currentPrice;
        if (prices.length >= 10) {
            const sum10 = prices.slice(-10).reduce((sum, price) => sum + price, 0);
            ma10 = sum10 / 10;
        } else if (prices.length > 5) {
            // Use all data when 10+ but >5
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma10 = sum / prices.length;
        } else {
            ma10 = ma5;
        }

        // Calculate MA20 (20-period moving average)
        let ma20 = currentPrice;
        if (prices.length >= 20) {
            const sum20 = prices.slice(-20).reduce((sum, price) => sum + price, 0);
            ma20 = sum20 / 20;
        } else if (prices.length > 10) {
            // Use all data when 20+ but >10
            const sum = prices.reduce((sum, price) => sum + price, 0);
            ma20 = sum / prices.length;
        } else {
            ma20 = ma10;
        }

        // Optional: Calculate MA50 (50-period moving average)
        let ma50 = currentPrice;
        if (prices.length >= 50) {
            const sum50 = prices.slice(-50).reduce((sum, price) => sum + price, 0);
            ma50 = sum50 / 50;
        }

        const result: any = {
            ma5: Number(ma5.toFixed(8)),
            ma10: Number(ma10.toFixed(8)),
            ma20: Number(ma20.toFixed(8))
        };

        if (prices.length >= 50) {
            result.ma50 = Number(ma50.toFixed(8));
        }

        return result;
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    static calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) {
            return 50; // Return neutral value when insufficient data
        }

        let gains = 0;
        let losses = 0;

        // Calculate initial period gains/losses
        for (let i = 1; i <= period; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference; // Use absolute value
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        // If average loss is 0, RSI is 100
        if (avgLoss === 0) {
            return 100;
        }

        // Calculate initial RS
        let rs = avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));

        // Use smoothing method for subsequent RSI calculations (if data is sufficient)
        if (prices.length > period + 1) {
            for (let i = period + 1; i < prices.length; i++) {
                const currentGain = Math.max(prices[i] - prices[i - 1], 0);
                const currentLoss = Math.max(prices[i - 1] - prices[i], 0);

                // Smooth calculation
                avgGain = (avgGain * (period - 1) + currentGain) / period;
                avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

                if (avgLoss === 0) {
                    rsi = 100;
                } else {
                    rs = avgGain / avgLoss;
                    rsi = 100 - (100 / (1 + rs));
                }
            }
        }

        return Number(rsi.toFixed(2));
    }

    /**
     * Calculate Bollinger Bands
     */
    static calculateBollingerBands(
        prices: number[],
        period: number = 20,
        multiplier: number = 2
    ): BollingerBands {

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

        // Calculate standard deviation
        const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upper = middle + (multiplier * stdDev);
        const lower = middle - (multiplier * stdDev);
        const bandwidth = ((upper - lower) / middle) * 100;

        const currentPrice = prices[prices.length - 1];
        let position: BollingerBands['position'] = 'NORMAL';
        if (currentPrice > upper) {
            position = 'OVERBOUGHT';
        } else if (currentPrice < lower) {
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

    /**
     * Calculate price trend slope
     */
    static calculatePriceTrend(prices: number[]): number {
        if (prices.length < 5) return 0;

        const recentPrices = prices.slice(-5);
        const sumX = recentPrices.reduce((sum, _, i) => sum + i, 0);
        const sumY = recentPrices.reduce((sum, price) => sum + price, 0);
        const sumXY = recentPrices.reduce((sum, price, i) => sum + price * i, 0);
        const sumXX = recentPrices.reduce((sum, _, i) => sum + i * i, 0);

        const n = recentPrices.length;
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }
}