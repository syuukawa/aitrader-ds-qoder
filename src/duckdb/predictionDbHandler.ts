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
        
        try {
            await this.duckDB.initialize();
            this.initialized = true; // 先设置为true避免循环依赖
            await this.createPredictionsTable();
            console.log('Prediction DB Handler initialized');
        } catch (error) {
            console.error('Failed to initialize Prediction DB Handler:', error);
            this.initialized = false; // Reset on failure
            throw error;
        }
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
            console.log(`Starting to insert ${predictions.length} predictions into ${this.config.tableName}`);
            
            // Validate and sanitize data first
            const sanitizedPredictions = predictions.map(prediction => ({
                ...prediction,
                symbol: prediction.symbol || '',
                currentPrice: prediction.currentPrice || 0,
                volume24h: prediction.volume24h || 0,
                sumOpenInterestValue: prediction.sumOpenInterestValue || 0,
                priceChangePercent24h: prediction.priceChangePercent24h || 0,
                prediction: prediction.prediction || 'HOLD',
                confidence: prediction.confidence || 0,
                timestamp: prediction.timestamp || Date.now()
            })).filter(pred => pred.symbol); // Filter out predictions without symbols

            if (sanitizedPredictions.length === 0) {
                console.log('No valid predictions to insert after sanitization');
                return;
            }

            // 为每个预测生成唯一的ID（基于时间戳和符号）
            const timestamp = Date.now();
            
            // Process predictions in smaller batches to avoid memory issues
            const batchSize = 25; // Reduced batch size for better stability
            let insertedCount = 0;
            
            for (let i = 0; i < sanitizedPredictions.length; i += batchSize) {
                const batch = sanitizedPredictions.slice(i, i + batchSize);
                console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sanitizedPredictions.length/batchSize)} (${batch.length} items)`);
                
                try {
                    // Begin transaction for better performance and atomicity
                    await this.duckDB.executeQuery('BEGIN TRANSACTION');
                    
                    for (let j = 0; j < batch.length; j++) {
                        const prediction = batch[j];
                        const indicators = prediction.technicalIndicators || {};
                        
                        // 获取最新的OI数据
                        let latestOiValue = 'N/A';
                        let latestOiTime = 'N/A';
                        let oiGrowthRate = 0;
                        
                        if (prediction.openInterestData && prediction.openInterestData.length > 0) {
                            const latestOi = prediction.openInterestData[prediction.openInterestData.length - 1];
                            latestOiValue = (latestOi.sumOpenInterestValue !== undefined) ? latestOi.sumOpenInterestValue.toString() : 'N/A';
                            latestOiTime = (latestOi.timestamp !== undefined) ? latestOi.timestamp.toString() : 'N/A';
                            
                            if (indicators.openInterestTrend) {
                                oiGrowthRate = indicators.openInterestTrend.growthRate || 0;
                            }
                        }

                        // 生成唯一ID
                        const id = BigInt(timestamp) * 1000n + BigInt(i) + BigInt(j);
                        
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
                            prediction.symbol || '',
                            prediction.currentPrice || 0,
                            prediction.volume24h || 0,
                            prediction.sumOpenInterestValue || 0,
                            prediction.priceChangePercent24h || 0,
                            (indicators.macd && indicators.macd.macd !== undefined) ? indicators.macd.macd : null,
                            (indicators.macd && indicators.macd.signal !== undefined) ? indicators.macd.signal : null,
                            (indicators.macd && indicators.macd.histogram !== undefined) ? indicators.macd.histogram : null,
                            (indicators.rsi !== undefined) ? indicators.rsi : null,
                            (indicators.ma && indicators.ma.ma5 !== undefined) ? indicators.ma.ma5 : null,
                            (indicators.ma && indicators.ma.ma10 !== undefined) ? indicators.ma.ma10 : null,
                            (indicators.ma && indicators.ma.ma20 !== undefined) ? indicators.ma.ma20 : null,
                            (indicators.ma && indicators.ma.ma50 !== undefined) ? indicators.ma.ma50 : null,
                            (indicators.bollingerBands && indicators.bollingerBands.upper !== undefined) ? indicators.bollingerBands.upper : null,
                            (indicators.bollingerBands && indicators.bollingerBands.middle !== undefined) ? indicators.bollingerBands.middle : null,
                            (indicators.bollingerBands && indicators.bollingerBands.lower !== undefined) ? indicators.bollingerBands.lower : null,
                            (indicators.bollingerBands && indicators.bollingerBands.position) ? indicators.bollingerBands.position : null,
                            (indicators.volume && indicators.volume.volumeRatio !== undefined) ? indicators.volume.volumeRatio : null,
                            (indicators.volume && indicators.volume.volumeTrend !== undefined) ? indicators.volume.volumeTrend : null,
                            prediction.prediction || 'HOLD',
                            prediction.confidence || 0,
                            latestOiValue,
                            latestOiTime,
                            oiGrowthRate,
                            prediction.timestamp ? new Date(prediction.timestamp).toISOString() : new Date().toISOString()
                        ];

                        // Validate values before insertion
                        const validValues = values.map(val => {
                            if (val === null || val === undefined) return null;
                            if (typeof val === 'number' && !isFinite(val)) return null;
                            return val;
                        });

                        await this.duckDB.executeQuery(insertQuery, validValues);
                        insertedCount++;
                    }
                    
                    // Commit transaction
                    await this.duckDB.executeQuery('COMMIT');
                    console.log(`Successfully committed batch ${Math.floor(i/batchSize) + 1}`);
                    
                } catch (batchError) {
                    // Rollback transaction on error
                    try {
                        await this.duckDB.executeQuery('ROLLBACK');
                        console.warn(`Rolled back batch ${Math.floor(i/batchSize) + 1} due to error:`, batchError);
                    } catch (rollbackError) {
                        console.error('Failed to rollback transaction:', rollbackError);
                    }
                    throw batchError;
                }
                
                // Small delay between batches to reduce memory pressure
                if (i + batchSize < sanitizedPredictions.length) {
                    await new Promise(resolve => setTimeout(resolve, 5)); // Reduced delay
                }
            }
            
            console.log(`Successfully inserted ${insertedCount} predictions into ${this.config.tableName}`);
        } catch (error) {
            console.error('Error inserting predictions:', error);
            throw error;
        }
    }

    async queryPredictions(query: string, params: any[] = []): Promise<any[]> {
        if (!this.initialized) {
            throw new Error('Handler not initialized');
        }
        
        try {
            return await this.duckDB.executeQuery(query, params);
        } catch (error) {
            console.error('Error querying predictions:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        try {
            if (this.initialized) {
                await this.duckDB.close();
                this.initialized = false;
                console.log('Prediction DB Handler closed');
            }
        } catch (error) {
            console.error('Error closing Prediction DB Handler:', error);
            throw error;
        }
    }

    getIsInitialized(): boolean {
        return this.initialized;
    }
}