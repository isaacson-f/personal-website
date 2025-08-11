import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Redis configuration
const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  password: process.env['REDIS_PASSWORD'] || undefined,
  database: parseInt(process.env['REDIS_DB'] || '0', 10),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

// Create Redis client
const client: RedisClientType = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Too many retries');
      }
      return Math.min(retries * 50, 500);
    }
  },
  password: redisConfig.password,
  database: redisConfig.database
});

// Event handlers
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('ready', () => {
  console.log('Redis client ready');
});

client.on('end', () => {
  console.log('Redis connection ended');
});

// Connection management
let isConnected = false;

export async function connectRedis(): Promise<void> {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log(`Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
}

export async function disconnectRedis(): Promise<void> {
  if (isConnected) {
    try {
      await client.disconnect();
      isConnected = false;
      console.log('Disconnected from Redis');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }
}

// Health check function
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  memory?: string;
  error?: string;
}> {
  try {
    if (!isConnected) {
      await connectRedis();
    }
    
    const pong = await client.ping();
    const info = await client.info('server');
    const memory = await client.info('memory');
    
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    // Parse version from info
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: versionMatch ? versionMatch[1] : undefined,
      memory: memoryMatch ? memoryMatch[1] : undefined
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

export { client as redisClient };
export default client;