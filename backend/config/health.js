const { checkDatabaseHealth } = require('./database');
const redis = require('./redis');

/**
 * Comprehensive health check for all system components
 */
async function performHealthCheck() {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // Check database health
    console.log('Checking database health...');
    const dbHealth = await checkDatabaseHealth();
    healthStatus.services.database = dbHealth;
    
    if (dbHealth.status === 'unhealthy') {
      healthStatus.status = 'unhealthy';
    }

    // Check Redis health
    console.log('Checking Redis health...');
    try {
      const redisHealth = await checkRedisHealth();
      healthStatus.services.redis = redisHealth;
      
      if (redisHealth.status === 'unhealthy') {
        healthStatus.status = 'unhealthy';
      }
    } catch (error) {
      healthStatus.services.redis = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      healthStatus.status = 'unhealthy';
    }

    // Add system information
    healthStatus.system = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      pid: process.pid
    };

    return healthStatus;
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: healthStatus.services
    };
  }
}

/**
 * Check Redis connection health
 */
async function checkRedisHealth() {
  try {
    const start = Date.now();
    await redis.ping();
    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Initialize all system components
 */
async function initializeSystem() {
  try {
    console.log('Initializing system components...');
    
    // Initialize database
    const { initializeDatabase } = require('./database');
    await initializeDatabase();
    
    // Test Redis connection
    console.log('Testing Redis connection...');
    const redisHealth = await checkRedisHealth();
    if (redisHealth.status === 'unhealthy') {
      console.warn('Redis connection failed:', redisHealth.error);
      console.warn('Some features may be limited without Redis');
    } else {
      console.log('Redis connection successful');
    }
    
    console.log('System initialization completed');
    return true;
  } catch (error) {
    console.error('System initialization failed:', error.message);
    throw error;
  }
}

module.exports = {
  performHealthCheck,
  checkRedisHealth,
  initializeSystem
};