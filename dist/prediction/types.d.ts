import { AllIndicators } from '../indicators/indicatorCalculator';
export interface PredictionConfig {
    minVolumeThreshold: number;
    minPriceChangePercent: number;
    klineInterval: string;
    klineLimit: number;
    rsiPeriod: number;
    macdFastPeriod: number;
    macdSlowPeriod: number;
    macdSignalPeriod: number;
    bbPeriod: number;
    bbMultiplier: number;
    deepSeekEnabled: boolean;
}
export interface PredictedSymbol {
    symbol: string;
    currentPrice: number;
    volume24h: number;
    priceChangePercent24h: number;
    sumOpenInterestValue?: number;
    technicalIndicators: AllIndicators;
    prediction?: string;
    confidence?: number;
    timestamp: number;
}
//# sourceMappingURL=types.d.ts.map