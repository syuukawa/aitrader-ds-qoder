// src/duckdb/duckdbHandler.ts
import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

export interface DatabaseConfig {
    databasePath?: string;
    readOnly?: boolean;
    inMemory?: boolean;
}

export class DuckDBHandler {
    private config: DatabaseConfig;
    private db: duckdb.Database | null = null;
    private connection: duckdb.Connection | null = null;
    private isConnected: boolean = false;

    constructor(config: DatabaseConfig = {}) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            let dbPath: string;
            
            if (this.config.inMemory) {
                dbPath = ':memory:';
            } else if (this.config.databasePath) {
                dbPath = this.config.databasePath;
            } else {
                // 默认数据库路径
                const dbDir = path.join(__dirname, '../../duckdb-data');
                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }
                dbPath = path.join(dbDir, 'aitrader.duckdb');
            }

            const readOnlyFlag = this.config.readOnly ? 
                duckdb.OPEN_READONLY : 
                duckdb.OPEN_READWRITE | duckdb.OPEN_CREATE;

            // Close any existing connections first
            if (this.db) {
                try {
                    await this.close();
                } catch (error) {
                    console.warn('Warning: Failed to close existing connection:', error);
                }
            }

            this.db = new duckdb.Database(dbPath, readOnlyFlag);
            this.connection = this.db.connect();
            this.isConnected = true;
            
            console.log(`DuckDB connected successfully to: ${dbPath}`);
        } catch (error) {
            console.error('Failed to initialize DuckDB:', error);
            // Clean up on failure
            try {
                await this.close();
            } catch (closeError) {
                console.warn('Warning: Failed to clean up after initialization failure:', closeError);
            }
            throw error;
        }
    }

    async executeQuery(query: string, params: any[] = []): Promise<any[]> {
        if (!this.isConnected || !this.connection) {
            throw new Error('Database not connected');
        }

        try {
            // 如果连接已关闭，重新连接
            if (!this.connection) {
                await this.initialize();
            }

            const result = await new Promise<any[]>((resolve, reject) => {
                if (!this.connection) {
                    reject(new Error('Connection lost'));
                    return;
                }
                
                this.connection.all(query, ...params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            return result;
        } catch (error: any) {
            console.error('Failed to execute custom query:', error);
            // If the connection is broken, try to reconnect
            if (error.message && (error.message.includes('Connection') || error.message.includes('connection'))) {
                console.log('Attempting to reconnect to database...');
                try {
                    await this.initialize();
                } catch (reconnectError) {
                    console.error('Failed to reconnect:', reconnectError);
                }
            }
            throw error;
        }
    }

    async close(): Promise<void> {
        try {
            if (this.connection) {
                this.connection.close();
                this.connection = null;
            }
            
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            
            this.isConnected = false;
            console.log('DuckDB connection closed');
        } catch (error: any) {
            console.error('Error closing DuckDB connection:', error);
            // Still mark as disconnected to prevent further attempts
            this.connection = null;
            this.db = null;
            this.isConnected = false;
            throw error;
        }
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }
}

// 导出默认实例
export const duckDBHandler = new DuckDBHandler();