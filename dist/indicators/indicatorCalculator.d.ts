import { MACDResult } from './macd';
import { MovingAverages, BollingerBands } from './basicIndicators';
import { Kline } from '../binance/types';
export interface AllIndicators {
    macd: MACDResult;
    volume: any;
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
export declare class IndicatorCalculator {
    static calculateAllIndicators(klines: Kline[]): AllIndicators;
    static calculateMultipleSymbols(symbolsData: Map<string, Kline[]>): Map<string, AllIndicators>;
    static validateIndicators(indicators: AllIndicators): boolean;
}
//# sourceMappingURL=indicatorCalculator.d.ts.map