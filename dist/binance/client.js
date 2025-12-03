"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceClient = void 0;
const undici_1 = require("undici");
const dispatcher = new undici_1.ProxyAgent("http://127.0.0.1:7890");
(0, undici_1.setGlobalDispatcher)(dispatcher);
class BinanceClient {
    constructor() {
        this.maxRetries = 5;
        this.baseRetryDelay = 1000;
        this.rateLimitRetryDelay = 60000;
        this.baseURL = 'https://fapi.binance.com';
    }
    async fetchWithRetry(url, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (response.ok)
                    return response;
                if (response.status === 429) {
                    await this.delay(delay * (i + 1));
                    continue;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            catch (error) {
                if (i === retries - 1)
                    throw error;
                await this.delay(delay * (i + 1));
            }
        }
        throw new Error('Max retries exceeded');
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async getOpenInterestStatistics(params) {
        const queryParams = new URLSearchParams();
        queryParams.append('symbol', params.symbol);
        queryParams.append('period', params.period);
        if (params.startTime)
            queryParams.append('startTime', params.startTime.toString());
        if (params.endTime)
            queryParams.append('endTime', params.endTime.toString());
        if (params.limit)
            queryParams.append('limit', params.limit.toString());
        const url = `${this.baseURL}/futures/data/openInterestHist?${queryParams}`;
        try {
            const response = await this.fetchWithRetry(url);
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error('Failed to fetch open interest statistics:', error);
            throw error;
        }
    }
    async get24hrTicker(symbol) {
        const url = `${this.baseURL}/fapi/v1/ticker/24hr?symbol=${symbol}`;
        try {
            const response = await this.fetchWithRetry(url);
            const data = await response.json();
            return {
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChangePercent: parseFloat(data.priceChangePercent),
                quoteVolume: parseFloat(data.quoteVolume),
                timestamp: data.closeTime
            };
        }
        catch (error) {
            console.error('Failed to fetch 24hr ticker data:', error);
            throw error;
        }
    }
    async getAll24hrTickers() {
        const url = `${this.baseURL}/fapi/v1/ticker/24hr`;
        try {
            const response = await this.fetchWithRetry(url);
            const rawData = await response.json();
            return rawData.map(data => ({
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChangePercent: parseFloat(data.priceChangePercent),
                volume: parseFloat(data.volume),
                quoteVolume: parseFloat(data.quoteVolume),
                timestamp: data.closeTime
            }));
        }
        catch (error) {
            console.error('Failed to fetch all 24hr ticker data:', error);
            throw error;
        }
    }
    async getKlines(symbol, interval = '15m', limit = 200) {
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
            const klines = [];
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
        }
        catch (error) {
            console.error('Failed to fetch Klines data:', error);
            throw error;
        }
    }
}
exports.BinanceClient = BinanceClient;
//# sourceMappingURL=client.js.map