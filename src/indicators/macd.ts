// src/indicators/macd.ts
export interface MACDResult {
    macd: number;  // DIF线
    signal: number;  // DEA线
    histogram: number;  // MACD柱状图 (2 * (DIF - DEA))
    momentumStrength?: number;  // 动量强度: 柱状图增速
    trendStrength?: number;  // 趋势强度: MACD绝对值大小
}

export class MACDCalculator {
    static calculate(closePrices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult[] {
        const fastEMA = this.calculateEMA(closePrices, fastPeriod);
        const slowEMA = this.calculateEMA(closePrices, slowPeriod);

        const dif = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const dea = this.calculateEMA(dif, signalPeriod);

        return dif.map((d, i) => {
            const histogram = 2 * (d - dea[i]);  // 标准MACD柱状图计算
            const prevHistogram = i > 0 ? 2 * (dif[i - 1] - dea[i - 1]) : histogram;
            
            return {
                macd: d,
                signal: dea[i],
                histogram: histogram,
                // 动量强度: 柱状图变化速度，用于检测加速度
                momentumStrength: histogram - prevHistogram,
                // 趋势强度: MACD绝对值，越大说明趋势越强
                trendStrength: Math.abs(d)
            };
        });
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