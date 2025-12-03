// src/indicators/macd.ts
export interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
}

export class MACDCalculator {
    static calculate(closePrices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult[] {
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

    private static calculateEMA(data: number[], period: number): number[] {
        const k = 2 / (period + 1);
        const ema: number[] = [data[0]];

        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }

        return ema;
    }
}