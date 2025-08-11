"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.checkDatabaseHealth = checkDatabaseHealth;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabaseConnection = closeDatabaseConnection;
exports.query = query;
exports.transaction = transaction;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Database configuration with connection pooling
const dbConfig = {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'analytics_db',
    user: process.env['DB_USER'] || 'analytics_user',
    password: process.env['DB_PASSWORD'] || '',
    max: parseInt(process.env['DB_POOL_MAX'] || '20', 10),
    idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '2000', 10)
};
// Create connection pool
const pool = new pg_1.Pool(dbConfig);
exports.pool = pool;
// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
pool.on('connect', () => {
    console.log('New client connected to database');
});
pool.on('acquire', () => {
    console.log('Client acquired from pool');
});
pool.on('remove', () => {
    console.log('Client removed from pool');
});
// Database health check function
async function checkDatabaseHealth() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();
        return {
            status: 'healthy',
            timestamp: result.rows[0].current_time,
            version: result.rows[0].version,
            poolSize: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
// Database initialization function
async function initializeDatabase() {
    try {
        console.log('Initializing database connection...');
        // Test connection
        const healthCheck = await checkDatabaseHealth();
        if (healthCheck.status === 'unhealthy') {
            throw new Error(`Database health check failed: ${healthCheck.error}`);
        }
        console.log('Database connection initialized successfully');
        console.log(`Connected to: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
        console.log(`Pool configuration: max=${dbConfig.max}`);
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to initialize database:', message);
        throw error;
    }
}
// Graceful shutdown function
async function closeDatabaseConnection() {
    try {
        console.log('Closing database connections...');
        await pool.end();
        console.log('Database connections closed successfully');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error closing database connections:', message);
        throw error;
    }
}
// Query helper with error handling and logging
async function query(text, params = []) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env['NODE_ENV'] === 'development') {
            console.log('Executed query', {
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                rows: result.rowCount
            });
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - start;
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Query error', {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: `${duration}ms`,
            error: message
        });
        throw error;
    }
}
// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=database.js.map