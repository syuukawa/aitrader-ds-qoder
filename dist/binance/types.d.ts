export interface OpenInterestStatisticsParams {
    symbol: string;
    period: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
}
export interface OpenInterestData {
    symbol: string;
    sumOpenInterest: string;
    sumOpenInterestValue: string;
    timestamp: number;
}
export interface PriceData {
    symbol: string;
    price: number;
    priceChangePercent: number;
    quoteVolume: number;
    timestamp: number;
}
export interface Kline {
    date: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
//# sourceMappingURL=types.d.ts.map