import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database and Redis connections
import { initializeDatabase, checkDatabaseHealth, closeDatabaseConnection } from './config/database';
import { connectRedis, disconnectRedis, checkRedisHealth } from './config/redis';
import { BackgroundJobService } from './services/BackgroundJobService';

const app = express();
const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = await checkRedisHealth();
    const jobStatus = BackgroundJobService.getStatus();

    const overallStatus = dbHealth.status === 'healthy' && redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        database: dbHealth,
        redis: redisHealth,
        backgroundJobs: jobStatus
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Import routes
import sessionRoutes from './routes/session';
import trackingRoutes from './routes/tracking';
import analyticsRoutes from './routes/analytics';

// API routes
app.use('/api/session', sessionRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Catch-all for unimplemented API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Initialize Redis connection
    await connectRedis();
    console.log('Redis initialized successfully');

    // Start background jobs
    BackgroundJobService.start();
    console.log('Background jobs started successfully');

    // Start the server
    app.listen(PORT, () => {
      console.log(`Analytics API server running on port ${PORT}`);
      console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  
  try {
    // Stop background jobs
    BackgroundJobService.stop();
    console.log('Background jobs stopped');

    // Close database connections
    await closeDatabaseConnection();
    console.log('Database connections closed');

    // Close Redis connection
    await disconnectRedis();
    console.log('Redis connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Only start the server if not in test mode
if (process.env['NODE_ENV'] !== 'test') {
  startServer();
}

export default app;