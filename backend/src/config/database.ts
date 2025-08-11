import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { DatabaseConfig } from '../types';

// Load environment variables
dotenv.config();

// Database configuration with connection pooling
const dbConfig: DatabaseConfig = {
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
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err: Error) => {
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
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  poolSize?: number;
  idleCount?: number;
  waitingCount?: number;
  error?: string;
}> {
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
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

// Database initialization function
export async function initializeDatabase(): Promise<boolean> {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to initialize database:', message);
    throw error;
  }
}

// Graceful shutdown function
export async function closeDatabaseConnection(): Promise<void> {
  try {
    console.log('Closing database connections...');
    await pool.end();
    console.log('Database connections closed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error closing database connections:', message);
    throw error;
  }
}

// Query helper with error handling and logging
export async function query(text: string, params: any[] = []): Promise<any> {
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
  } catch (error) {
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
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { pool };