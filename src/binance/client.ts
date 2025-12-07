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
    private readonly maxRetries: number = 5;  // More retries for reliability
    private readonly baseRetryDelay: number = 2000;  // Start with 2 seconds (user request)
    private readonly maxRetryDelay: number = 60000;  // Cap at 60 seconds for max safety
    private readonly apiKey?: string;
    private readonly apiSecret?: string;
    private baseURL = 'https://fapi.binance.com';
    private lastRequestTime: number = 0;
    private minRequestInterval: number = 500;  // 500ms between requests for safety
    private requestQueue: Array<() => Promise<any>> = [];
    private isProcessingQueue: boolean = false;

    constructor(apiKey?: string, apiSecret?: string) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    /**
     * Fetch data with retry mechanism and rate limiting
     */
    async fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
        for (let i = 0; i < retries; i++) {
            try {
                // Enforce rate limit delay before each request attempt
                await this.enforceRateLimit();
                
                // If this is the first attempt, add 2-second initial delay to ensure API readiness
                if (i === 0) {
                    // console.log(`⏳ [Pre-delay] Waiting 2000ms before first API call to ensure readiness...`);
                    await this.delay(2000);
                }

                // console.log(`🔗 [API Call ${i + 1}/${retries}] Fetching: ${url.substring(0, 80)}...`);
                const response = await fetch(url);
                
                // Update last request time
                this.lastRequestTime = Date.now();

                if (response.ok) {
                    // console.log(`✅ [API Success] Response OK`);
                    return response;
                }

                // Handle rate limiting (429) and teapot (418) errors
                if (response.status === 429 || response.status === 418) {
                    let waitTime: number;
                    
                    if (response.status === 418) {
                        // 418 I'm a teapot = severe rate limiting
                        // First attempt should already have 2s initial delay
                        // Retry 2: 2000ms, Retry 3: 4000ms, Retry 4: 8000ms, Retry 5: 16000ms, capped at 60s
                        waitTime = i === 0 ? 2000 : Math.min(2000 * Math.pow(2, i), this.maxRetryDelay);
                        console.warn(`🫖 [418 Rate Limit] IP banned temporarily. Attempt ${i + 1}/${retries}. Waiting ${waitTime}ms...`);
                    } else {
                        // 429 Too Many Requests - respects Retry-After header
                        waitTime = response.headers.get('Retry-After')
                            ? parseInt(response.headers.get('Retry-After')!) * 1000
                            : (i === 0 ? 2000 : Math.min(2000 * Math.pow(2, i), this.maxRetryDelay));
                        console.warn(`⏱️ [429 Rate Limit] Too many requests. Attempt ${i + 1}/${retries}. Waiting ${waitTime}ms...`);
                    }
                    
                    await this.delay(waitTime);
                    continue;
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (error) {
                if (i === retries - 1) {
                    console.error(`❌ [API Failed] Max retries exceeded: ${error}`);
                    throw error;
                }
                // Exponential backoff starting from 2000ms: 2s, 4s, 8s, 16s, 32s, capped at 60s
                const waitTime = Math.min(2000 * Math.pow(2, i), this.maxRetryDelay);
                console.warn(`⚠️ [Retry] Request failed. Attempt ${i + 1}/${retries}. Waiting ${waitTime}ms...`);
                await this.delay(waitTime);
            }
        }
        throw new Error('Max retries exceeded');
    }

    /**
     * Enforce minimum delay between requests
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await this.delay(waitTime);
        }
    }

    /**
     * Queue-based API calls to prevent concurrent requests
     */
    async queuedFetch(url: string): Promise<Response> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const response = await this.fetchWithRetry(url);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    /**
     * Process queued requests one at a time
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (request) {
                try {
                    await request();
                } catch (error) {
                    console.error('Queue processing error:', error);
                }
            }
            // Add delay between queued requests
            await this.delay(this.minRequestInterval);
        }

        this.isProcessingQueue = false;
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
     * Get all 24hr tickers - This is a large request, use more retries
     */
    async getAll24hrTickers(): Promise<PriceData[]> {
        const url = `${this.baseURL}/fapi/v1/ticker/24hr`;

        try {
            console.log('📊 Fetching all 24hr tickers (with 2s initial delay for reliability)...');
            // Use 5 retries for this critical/heavy request
            const response = await this.fetchWithRetry(url, 5, 2000);
            const rawData: any[] = await response.json();
            
            console.log(`✅ Successfully fetched ${rawData.length} tickers`);

            return rawData.map(data => ({
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                priceChangePercent: parseFloat(data.priceChangePercent),
                volume: parseFloat(data.volume), 
                quoteVolume: parseFloat(data.quoteVolume),
                timestamp: data.closeTime
            }));
        } catch (error) {
            console.error('Failed to fetch all 24hr ticker data:', error);
            throw error;
        }
    }

    /**
     * Get Klines data - Critical endpoint with initial 2-second delay for reliability
     */
    async getKlines(symbol: string, interval: string = '15m', limit: number = 200): Promise<Kline[]> {
        const url = `${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

        try {
            // console.log(`📋 [Klines] Fetching ${symbol} 15m candles (with 2s initial delay for reliability)...`);
            // Use 5 retries with 2000ms base delay for Klines endpoint
            const response = await this.fetchWithRetry(url, 5, 2000);
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

            // console.log(`✅ [Klines] Successfully fetched ${klines.length} candles for ${symbol}`);
            return klines;
        } catch (error) {
            console.error(`❌ [Klines] Failed to fetch data for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Send signed request (for trading endpoints)
     */
    async sendSignedRequest(method: string, endpoint: string, params: Record<string, any> = {}): Promise<any> {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('API key and secret are required for signed requests');
        }

        // Add timestamp
        params.timestamp = Date.now();

        // Create query string
        const queryString = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');

        // Sign the query string
        const signature = require('crypto')
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');

        // Build URL
        const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Failed to send signed ${method} request to ${endpoint}:`, error);
            throw error;
        }
    }
}