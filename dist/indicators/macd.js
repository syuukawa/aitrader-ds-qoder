"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MACDCalculator = void 0;
class MACDCalculator {
    static calculate(closePrices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(closePrices, fastPeriod);
        const slowEMA = this.calculateEMA(closePrices, slowPeriod);
        const dif = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const dea = this.calculateEMA(dif, signalPeriod);
        return dif.map((d, i) => ({
            macd: d,
            signal: dea[i],
            histogram: 2 * (d - dea[i])
        }));
    }
    static calculateEMA(data, period) {
        const k = 2 / (period + 1);
        const ema = [data[0]];
        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }
        return ema;
    }
}
exports.MACDCalculator = MACDCalculator;
//# sourceMappingURL=macd.js.map