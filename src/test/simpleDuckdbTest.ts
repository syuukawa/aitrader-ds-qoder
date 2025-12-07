// src/test/simpleDuckdbTest.ts
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';

async function testBasicDuckDB() {
    console.log('🧪 Testing Basic DuckDB Functionality...\n');
    
    try {
        // 创建数据库目录
        const dbDir = path.join(__dirname, '../../duckdb-data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        const dbPath = path.join(dbDir, 'test_basic.duckdb');
        console.log(`Creating database at: ${dbPath}`);
        
        // 初始化数据库
        const db = new duckdb.Database(dbPath);
        const connection = db.connect();
        
        // 创建表
        connection.exec(`
            CREATE TABLE IF NOT EXISTS test_table (
                id INTEGER,
                name VARCHAR,
                value DOUBLE
            )
        `);
        console.log('✅ Table created');
        
        // 插入数据
        connection.exec(`
            INSERT INTO test_table VALUES 
            (1, 'BTCUSDT', 87231.7),
            (2, 'ETHUSDT', 3245.89)
        `);
        console.log('✅ Data inserted');
        
        // 查询数据
        connection.all('SELECT * FROM test_table', (err, rows) => {
            if (err) {
                console.error('❌ Query error:', err);
                return;
            }
            
            console.log('🔍 Query Result:');
            console.log(rows);
            
            // 关闭连接
            connection.close();
            db.close();
            
            console.log('\n🎉 Basic DuckDB test passed!');
        });
    } catch (error) {
        console.error('❌ Error during basic DuckDB test:', error);
    }
}

if (require.main === module) {
    testBasicDuckDB();
}