// src/duckdb/predictionDbHandler.ts
import { PredictedSymbol } from '../prediction/types';
import { DuckDBHandler } from './duckdbHandler';

export interface PredictionDbConfig {
    databasePath?: string;
    tableName?: string;
}

export class PredictionDbHandler {
    private initialized: boolean = false;
    private config: PredictionDbConfig;
    private duckDB: DuckDBHandler;

    constructor(config: PredictionDbConfig = {}) {
        this.config = {
            databasePath: config.databasePath || './duckdb-data/aitrader.duckdb',
            tableName: config.tableName || 'predictions'
        };
        
        this.duckDB = new DuckDBHandler({
            databasePath: this.config.databasePath
        });
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        await this.duckDB.initialize();
        this.initialized = true; // 先设置为true避免循环依赖
        await this.createPredictionsTable();
        console.log('Prediction DB Handler initialized');
    }

    private async createPredictionsTable(): Promise<void> {
        if (!this.initialized) {
            throw new Error('Handler not initialized');
        }

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS "${this.config.tableName}" (
                id BIGINT PRIMARY KEY,
                symbol VARCHAR,
                current_price DOUBLE,
                volume_24h DOUBLE,
                open_interest_value DOUBLE,
                price_change_percent_24h DOUBLE,
                macd DOUBLE,
                macd_signal DOUBLE,
                macd_histogram DOUBLE,
                rsi DOUBLE,
                ma5 DOUBLE,
                ma10 DOUBLE,
                ma20 DOUBLE,
                ma50 DOUBLE,
                bollinger_upper DOUBLE,
                bollinger_middle DOUBLE,
                bollinger_lower DOUBLE,
                bollinger_position VARCHAR,
                volume_ratio DOUBLE,
                volume_trend DOUBLE,
                prediction VARCHAR,
                confidence DOUBLE,
                latest_oi_value VARCHAR,
                latest_oi_time VARCHAR,
                oi_growth_rate DOUBLE,
                timestamp TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        try {
            await this.duckDB.executeQuery(createTableQuery);
            console.log(`Table ${this.config.tableName} created or already exists`);
        } catch (error) {
            console.error('Error creating predictions table:', error);
            throw error;
        }
    }

    async insertPredictions(predictions: PredictedSymbol[]): Promise<void> {
        if (!this.initialized) {
            throw new Error('Handler not initialized. Call initialize() first.');
        }

        if (predictions.length === 0) {
            console.log('No predictions to insert');
            return;
        }

        try {
            // 为每个预测生成唯一的ID（基于时间戳和符号）
            const timestamp = Date.now();
            
            for (let i = 0; i < predictions.length; i++) {
                const prediction = predictions[i];
                const indicators = prediction.technicalIndicators;
                
                // 获取最新的OI数据
                let latestOiValue = 'N/A';
                let latestOiTime = 'N/A';
                let oiGrowthRate = 0;
                
                if (prediction.openInterestData && prediction.openInterestData.length > 0) {
                    const latestOi = prediction.openInterestData[prediction.openInterestData.length - 1];
                    latestOiValue = latestOi.sumOpenInterestValue;
                    latestOiTime = latestOi.timestamp.toString();
                    
                    if (indicators.openInterestTrend) {
                        oiGrowthRate = indicators.openInterestTrend.growthRate;
                    }
                }

                // 生成唯一ID
                const id = timestamp * 1000 + i;
                
                const insertQuery = `
                    INSERT INTO "${this.config.tableName}" (
                        id, symbol, current_price, volume_24h, open_interest_value,
                        price_change_percent_24h, macd, macd_signal, macd_histogram,
                        rsi, ma5, ma10, ma20, ma50, bollinger_upper, bollinger_middle,
                        bollinger_lower, bollinger_position, volume_ratio, volume_trend,
                        prediction, confidence, latest_oi_value, latest_oi_time,
                        oi_growth_rate, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    id,
                    prediction.symbol,
                    prediction.currentPrice,
                    prediction.volume24h,
                    prediction.sumOpenInterestValue || 0,
                    prediction.priceChangePercent24h,
                    indicators.macd?.macd || null,
                    indicators.macd?.signal || null,
                    indicators.macd?.histogram || null,
                    indicators.rsi || null,
                    indicators.ma?.ma5 || null,
                    indicators.ma?.ma10 || null,
                    indicators.ma?.ma20 || null,
                    indicators.ma?.ma50 || null,
                    indicators.bollingerBands?.upper || null,
                    indicators.bollingerBands?.middle || null,
                    indicators.bollingerBands?.lower || null,
                    indicators.bollingerBands?.position || null,
                    indicators.volume?.volumeRatio || null,
                    indicators.volume?.volumeTrend || null,
                    prediction.prediction || 'HOLD',
                    prediction.confidence || 0,
                    latestOiValue,
                    latestOiTime,
                    oiGrowthRate,
                    new Date(prediction.timestamp).toISOString()
                ];

                await this.duckDB.executeQuery(insertQuery, values);
            }
            
            console.log(`Successfully inserted ${predictions.length} predictions into ${this.config.tableName}`);
        } catch (error) {
            console.error('Error inserting predictions:', error);
            throw error;
        }
    }

    async queryPredictions(query: string, params: any[] = []): Promise<any[]> {
        if (!this.initialized) {
            throw new Error('Handler not initialized');
        }
        
        return await this.duckDB.executeQuery(query, params);
    }

    async close(): Promise<void> {
        if (this.initialized) {
            await this.duckDB.close();
            this.initialized = false;
            console.log('Prediction DB Handler closed');
        }
    }

    getIsInitialized(): boolean {
        return this.initialized;
    }
}