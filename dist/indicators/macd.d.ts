export interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
}
export declare class MACDCalculator {
    static calculate(closePrices: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): MACDResult[];
    private static calculateEMA;
}
//# sourceMappingURL=macd.d.ts.map