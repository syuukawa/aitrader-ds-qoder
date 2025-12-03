// src/binance/client.ts
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import {
    OpenInterestStatisticsParams,
    OpenInterestData,
    PriceData,
    Kline
} from './types';

// Set up proxy if needed
const dispatcher = new ProxyAgent("http://127.0.0.1:7890");
setGlobalDispatcher(dispatcher);

export class BinanceClient {
    private readonly maxRetries: number = 5;
    private readonly baseRetryDelay: number = 1000;
    private readonly rateLimitRetryDelay: number = 60000; // 1 minute for rate limiting
    private baseURL = 'https://fapi.binance.com';

    /**
     * Fetch data with retry mechanism
     */
    async fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (response.ok) return response;

                if (response.status === 429) { // Rate limited
                    await this.delay(delay * (i + 1));
                    continue;
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (error) {
                if (i === retries - 1) throw error;
                await this.delay(delay * (i + 1));
            }
        }
        throw new Error('Max retries exceeded');
    }

    /**
     * Delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get open interest statistics
     * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics#http%E8%AF%B7%E6%B1%82
     */
    async getOpenInterestStatistics(params: OpenInterestStatisticsParams): Promise<OpenInterestData[]> {
        const queryParams = new URLSearchParams();
        queryParams.append('symbol', params.symbol);
        queryParams.append('period', params.period);

        if (params.startTime) queryParams.append('startTime', params.startTime.toString());
        if (params.endTime) queryParams.append('endTime', params.endTime.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());

        const url = `${this.baseURL}/futures/data/openInterestHist?${queryParams}`;

        try {
            const response = await this.fetchWithRetry(url);
            const data = await response.json();
            return data as OpenInterestData[];
        } catch (error) {
            console.error('Failed to fetch open interest statistics:', error);
            throw error;
        }
    }

    /**
     * Get 24hr ticker data
     */
    async get24hrTicker(symbol: string): Promise<PriceData> {
        const url = `${this.baseURL}/fapi/v1/ticker/24hr?symbol=${symbol}`;

        try {
            const response = await this.fetchWithRetry(url);
            const data: any = await response.json();

            return {
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChangePercent: parseFloat(data.priceChangePercent),
                quoteVolume: parseFloat(data.quoteVolume),
                timestamp: data.closeTime
            };
        } catch (error) {
            console.error('Failed to fetch 24hr ticker data:', error);
            throw error;
        }
    }

    /**
     * Get all 24hr tickers
     */
    async getAll24hrTickers(): Promise<PriceData[]> {
        const url = `${this.baseURL}/fapi/v1/ticker/24hr`;

        try {
            const response = await this.fetchWithRetry(url);
            const rawData: any[] = await response.json();

            return rawData.map(data => ({
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChangePercent: parseFloat(data.priceChangePercent), ///24小时价格变动百分比
                volume: parseFloat(data.volume), 
                quoteVolume: parseFloat(data.quoteVolume), ///24小时成交金额
                timestamp: data.closeTime
            }));
        } catch (error) {
            console.error('Failed to fetch all 24hr ticker data:', error);
            throw error;
        }
    }

    /**
     * Get Klines data
     */
    async getKlines(symbol: string, interval: string = '15m', limit: number = 200): Promise<Kline[]> {
        const url = `${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

        try {
            const response = await this.fetchWithRetry(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const rawData = await response.json();
            if (!Array.isArray(rawData)) {
                throw new Error('Invalid kline data format received.');
            }

            const klines: Kline[] = [];
            for (const kline of rawData) {
                klines.push({
                    date: kline[0],
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5])
                });
            }

            return klines;
        } catch (error) {
            console.error('Failed to fetch Klines data:', error);
            throw error;
        }
    }
}