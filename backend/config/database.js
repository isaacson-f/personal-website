const { Pool } = require('pg');
require('dotenv').config();

// Database configuration with connection pooling
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'analytics_db',
  user: process.env.DB_USER || 'analytics_user',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
  createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 8000,
  destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,
  reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL) || 1000,
  createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL) || 200,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', (client) => {
  console.log('New client connected to database');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
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
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
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
    console.log(`Pool configuration: max=${dbConfig.max}, min=${dbConfig.min}`);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    throw error;
  }
}

// Graceful shutdown function
async function closeDatabaseConnection() {
  try {
    console.log('Closing database connections...');
    await pool.end();
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error.message);
    throw error;
  }
}

// Query helper with error handling and logging
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Query error', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error.message
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
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  transaction,
  checkDatabaseHealth,
  initializeDatabase,
  closeDatabaseConnection
};