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
            // Close any existing connections first
            if (this.isConnected) {
                console.log('Closing existing connection before reinitializing');
                try {
                    await this.close();
                } catch (closeError) {
                    console.warn('Warning: Failed to close existing connection:', closeError);
                }
            }
            
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

            // Validate database path
            if (!this.config.inMemory) {
                try {
                    const dirPath = path.dirname(dbPath);
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }
                } catch (dirError) {
                    console.warn('Warning: Could not create database directory:', dirError);
                }
            }

            // Create database with timeout protection
            const dbCreationPromise = new Promise<duckdb.Database>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Database creation timed out after 10 seconds'));
                }, 10000);
                
                try {
                    const db = new duckdb.Database(dbPath, readOnlyFlag);
                    clearTimeout(timeoutId);
                    resolve(db);
                } catch (creationError) {
                    clearTimeout(timeoutId);
                    reject(creationError);
                }
            });

            this.db = await dbCreationPromise;
            
            // Create connection with timeout protection
            const connectionPromise = new Promise<duckdb.Connection>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Connection creation timed out after 5 seconds'));
                }, 5000);
                
                try {
                    const connection = this.db!.connect();
                    clearTimeout(timeoutId);
                    resolve(connection);
                } catch (connectionError) {
                    clearTimeout(timeoutId);
                    reject(connectionError);
                }
            });

            this.connection = await connectionPromise;
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
        // Validate inputs
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid query: must be a non-empty string');
        }
        
        if (!Array.isArray(params)) {
            throw new Error('Invalid params: must be an array');
        }

        if (!this.isConnected || !this.connection) {
            console.warn('Database not connected, attempting to reconnect...');
            try {
                await this.initialize();
            } catch (initError) {
                console.error('Failed to reconnect to database:', initError);
                throw new Error('Database not connected and reconnection failed');
            }
        }

        try {
            // Validate connection before use
            if (!this.connection) {
                throw new Error('Connection lost');
            }
            
            const result = await new Promise<any[]>((resolve, reject) => {
                // Add timeout to prevent hanging
                const timeoutId = setTimeout(() => {
                    reject(new Error('Query execution timed out after 30 seconds'));
                }, 30000);
                
                try {
                    this.connection!.all(query, ...params, (err, rows) => {
                        clearTimeout(timeoutId);
                        if (err) {
                            reject(err);
                        } else {
                            // Sanitize rows to prevent memory issues
                            const sanitizedRows = Array.isArray(rows) ? rows.map(row => {
                                if (row && typeof row === 'object') {
                                    // Remove any circular references or problematic fields
                                    const cleanRow: any = {};
                                    for (const key in row) {
                                        if (row.hasOwnProperty(key)) {
                                            const value = row[key];
                                            // Skip functions, circular references, and other problematic types
                                            if (value === null || value === undefined || 
                                                typeof value === 'string' || typeof value === 'number' || 
                                                typeof value === 'boolean') {
                                                cleanRow[key] = value;
                                            } else if (Array.isArray(value)) {
                                                cleanRow[key] = value.length < 1000 ? value : `[Array(${value.length})]`;
                                            } else if (typeof value === 'object') {
                                                try {
                                                    // Try to serialize and deserialize to check for circular references
                                                    JSON.stringify(value);
                                                    cleanRow[key] = Object.keys(value).length < 100 ? value : `[Object(${Object.keys(value).length} keys)]`;
                                                } catch (e) {
                                                    cleanRow[key] = '[Circular]';
                                                }
                                            }
                                        }
                                    }
                                    return cleanRow;
                                }
                                return row;
                            }) : rows;
                            resolve(sanitizedRows);
                        }
                    });
                } catch (immediateError) {
                    clearTimeout(timeoutId);
                    reject(immediateError);
                }
            });
            
            return result;
        } catch (error: any) {
            console.error('Failed to execute custom query:', error);
            
            // Check if it's a connection error
            const errorMessage = error.message || '';
            if (errorMessage.includes('Connection') || errorMessage.includes('connection') || 
                errorMessage.includes('closed') || errorMessage.includes('disconnect')) {
                console.log('Attempting to reconnect to database...');
                try {
                    await this.close(); // Close any broken connections first
                    await this.initialize(); // Reinitialize
                } catch (reconnectError) {
                    console.error('Failed to reconnect:', reconnectError);
                    throw new Error(`Database connection error: ${errorMessage}`);
                }
            }
            throw error;
        }
    }

    async close(): Promise<void> {
        try {
            // Attempt to close connection gracefully
            if (this.connection) {
                try {
                    // End any pending transactions
                    await this.executeQuery('ROLLBACK');
                } catch (e) {
                    // Ignore rollback errors
                }
                
                try {
                    this.connection.close();
                } catch (connError) {
                    console.warn('Warning: Error closing connection:', connError);
                }
                this.connection = null;
            }
            
            // Close database
            if (this.db) {
                try {
                    this.db.close();
                } catch (dbError) {
                    console.warn('Warning: Error closing database:', dbError);
                }
                this.db = null;
            }
            
            this.isConnected = false;
            console.log('DuckDB connection closed');
        } catch (error: any) {
            console.error('Error closing DuckDB connection:', error);
            // Force cleanup
            this.connection = null;
            this.db = null;
            this.isConnected = false;
            // Don't throw error to prevent cascading failures
            console.log('DuckDB connection force closed');
        }
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }
}

// 导出默认实例
export const duckDBHandler = new DuckDBHandler();