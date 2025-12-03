import { OpenInterestStatisticsParams, OpenInterestData, PriceData, Kline } from './types';
export declare class BinanceClient {
    private readonly maxRetries;
    private readonly baseRetryDelay;
    private readonly rateLimitRetryDelay;
    private baseURL;
    fetchWithRetry(url: string, retries?: number, delay?: number): Promise<Response>;
    private delay;
    getOpenInterestStatistics(params: OpenInterestStatisticsParams): Promise<OpenInterestData[]>;
    get24hrTicker(symbol: string): Promise<PriceData>;
    getAll24hrTickers(): Promise<PriceData[]>;
    getKlines(symbol: string, interval?: string, limit?: number): Promise<Kline[]>;
}
//# sourceMappingURL=client.d.ts.map