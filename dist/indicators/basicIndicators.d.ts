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
export declare class BasicIndicators {
    static calculateMovingAverages(prices: number[]): MovingAverages;
    static calculateRSI(prices: number[], period?: number): number;
    static calculateBollingerBands(prices: number[], period?: number, multiplier?: number): BollingerBands;
    static calculatePriceTrend(prices: number[]): number;
}
//# sourceMappingURL=basicIndicators.d.ts.map