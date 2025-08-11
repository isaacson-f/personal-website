import { DataAggregationService } from './DataAggregationService';
import { CachingService } from './CachingService';
import { Session } from '../models/Session';

/**
 * Background job service for scheduled analytics tasks
 */
export class BackgroundJobService {
  private static hourlyJobInterval: NodeJS.Timeout | null = null;
  private static dailyJobInterval: NodeJS.Timeout | null = null;
  private static cleanupJobInterval: NodeJS.Timeout | null = null;
  private static realtimeJobInterval: NodeJS.Timeout | null = null;
  
  private static isRunning = false;

  /**
   * Start all background jobs
   */
  static start(): void {
    if (this.isRunning) {
      console.log('Background jobs are already running');
      return;
    }

    console.log('Starting background job service...');
    this.isRunning = true;

    // Start hourly aggregation job (runs every hour at minute 5)
    this.startHourlyAggregationJob();
    
    // Start daily aggregation job (runs daily at 1:00 AM)
    this.startDailyAggregationJob();
    
    // Start cleanup job (runs every 6 hours)
    this.startCleanupJob();
    
    // Start real-time metrics job (runs every minute)
    this.startRealtimeMetricsJob();

    console.log('Background job service started successfully');
  }

  /**
   * Stop all background jobs
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('Background jobs are not running');
      return;
    }

    console.log('Stopping background job service...');

    if (this.hourlyJobInterval) {
      clearInterval(this.hourlyJobInterval);
      this.hourlyJobInterval = null;
    }

    if (this.dailyJobInterval) {
      clearInterval(this.dailyJobInterval);
      this.dailyJobInterval = null;
    }

    if (this.cleanupJobInterval) {
      clearInterval(this.cleanupJobInterval);
      this.cleanupJobInterval = null;
    }

    if (this.realtimeJobInterval) {
      clearInterval(this.realtimeJobInterval);
      this.realtimeJobInterval = null;
    }

    this.isRunning = false;
    console.log('Background job service stopped');
  }

  /**
   * Start hourly aggregation job
   */
  private static startHourlyAggregationJob(): void {
    // Calculate time until next hour + 5 minutes
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(nextRun.getHours() + 1, 5, 0, 0); // Next hour at minute 5
    
    const initialDelay = nextRun.getTime() - now.getTime();
    
    console.log(`Hourly aggregation job will start in ${Math.round(initialDelay / 1000 / 60)} minutes`);

    // Set initial timeout, then start interval
    setTimeout(() => {
      this.runHourlyAggregation();
      
      // Run every hour after the initial run
      this.hourlyJobInterval = setInterval(() => {
        this.runHourlyAggregation();
      }, 60 * 60 * 1000); // 1 hour
      
    }, initialDelay);
  }

  /**
   * Start daily aggregation job
   */
  private static startDailyAggregationJob(): void {
    // Calculate time until next 1:00 AM
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(1, 0, 0, 0); // 1:00 AM
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1); // Next day if already past 1 AM
    }
    
    const initialDelay = nextRun.getTime() - now.getTime();
    
    console.log(`Daily aggregation job will start in ${Math.round(initialDelay / 1000 / 60 / 60)} hours`);

    // Set initial timeout, then start interval
    setTimeout(() => {
      this.runDailyAggregation();
      
      // Run every 24 hours after the initial run
      this.dailyJobInterval = setInterval(() => {
        this.runDailyAggregation();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, initialDelay);
  }

  /**
   * Start cleanup job
   */
  private static startCleanupJob(): void {
    // Run cleanup job every 6 hours
    this.cleanupJobInterval = setInterval(() => {
      this.runCleanupJob();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.runCleanupJob();
    }, 5 * 60 * 1000);

    console.log('Cleanup job scheduled to run every 6 hours');
  }

  /**
   * Start real-time metrics job
   */
  private static startRealtimeMetricsJob(): void {
    // Run real-time metrics job every minute
    this.realtimeJobInterval = setInterval(() => {
      this.runRealtimeMetricsJob();
    }, 60 * 1000); // 1 minute

    // Run initial job after 10 seconds
    setTimeout(() => {
      this.runRealtimeMetricsJob();
    }, 10 * 1000);

    console.log('Real-time metrics job scheduled to run every minute');
  }

  /**
   * Run hourly aggregation
   */
  private static async runHourlyAggregation(): Promise<void> {
    try {
      console.log('Running hourly aggregation job...');
      
      // Aggregate data for the previous hour
      const previousHour = new Date();
      previousHour.setHours(previousHour.getHours() - 1, 0, 0, 0);
      
      const result = await DataAggregationService.generateHourlyAggregation(previousHour);
      
      console.log(`Hourly aggregation completed for ${previousHour.toISOString()}:`, {
        total_events: result.total_events,
        unique_sessions: result.unique_sessions,
        page_views: result.page_views,
        unique_visitors: result.unique_visitors
      });
      
    } catch (error) {
      console.error('Error running hourly aggregation job:', error);
    }
  }

  /**
   * Run daily aggregation
   */
  private static async runDailyAggregation(): Promise<void> {
    try {
      console.log('Running daily aggregation job...');
      
      // Aggregate data for the previous day
      const previousDay = new Date();
      previousDay.setDate(previousDay.getDate() - 1);
      previousDay.setHours(0, 0, 0, 0);
      
      const result = await DataAggregationService.generateDailyAggregation(previousDay);
      
      console.log(`Daily aggregation completed for ${previousDay.toISOString().substring(0, 10)}:`, {
        total_events: result.total_events,
        unique_sessions: result.unique_sessions,
        page_views: result.page_views,
        unique_visitors: result.unique_visitors
      });
      
    } catch (error) {
      console.error('Error running daily aggregation job:', error);
    }
  }

  /**
   * Run cleanup job
   */
  private static async runCleanupJob(): Promise<void> {
    try {
      console.log('Running cleanup job...');
      
      // End expired sessions (sessions without activity for 30 minutes)
      const expiredSessions = await Session.endExpiredSessions(30);
      if (expiredSessions > 0) {
        console.log(`Ended ${expiredSessions} expired sessions`);
      }
      
      // Clean up old cache entries (this is handled by Redis TTL, but we can add manual cleanup here)
      const cacheStats = await CachingService.getCacheStats();
      console.log('Current cache stats:', cacheStats);
      
      console.log('Cleanup job completed');
      
    } catch (error) {
      console.error('Error running cleanup job:', error);
    }
  }

  /**
   * Run real-time metrics job
   */
  private static async runRealtimeMetricsJob(): Promise<void> {
    try {
      // Generate fresh real-time metrics
      const metrics = await DataAggregationService.generateRealtimeMetrics();
      
      // Log metrics periodically (every 10 minutes)
      const now = new Date();
      if (now.getMinutes() % 10 === 0) {
        console.log('Real-time metrics updated:', {
          active_sessions: metrics.active_sessions,
          page_views_last_hour: metrics.page_views_last_hour,
          unique_visitors_today: metrics.unique_visitors_today,
          popular_pages_count: metrics.popular_pages.length
        });
      }
      
    } catch (error) {
      console.error('Error running real-time metrics job:', error);
    }
  }

  /**
   * Manually trigger hourly aggregation for a specific hour
   */
  static async triggerHourlyAggregation(timestamp: Date): Promise<void> {
    try {
      console.log(`Manually triggering hourly aggregation for ${timestamp.toISOString()}`);
      await DataAggregationService.generateHourlyAggregation(timestamp);
      console.log('Manual hourly aggregation completed');
    } catch (error) {
      console.error('Error in manual hourly aggregation:', error);
      throw error;
    }
  }

  /**
   * Manually trigger daily aggregation for a specific date
   */
  static async triggerDailyAggregation(date: Date): Promise<void> {
    try {
      console.log(`Manually triggering daily aggregation for ${date.toISOString().substring(0, 10)}`);
      await DataAggregationService.generateDailyAggregation(date);
      console.log('Manual daily aggregation completed');
    } catch (error) {
      console.error('Error in manual daily aggregation:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  static getStatus(): {
    isRunning: boolean;
    jobs: {
      hourly: boolean;
      daily: boolean;
      cleanup: boolean;
      realtime: boolean;
    };
  } {
    return {
      isRunning: this.isRunning,
      jobs: {
        hourly: this.hourlyJobInterval !== null,
        daily: this.dailyJobInterval !== null,
        cleanup: this.cleanupJobInterval !== null,
        realtime: this.realtimeJobInterval !== null
      }
    };
  }

  /**
   * Backfill aggregations for a date range
   */
  static async backfillAggregations(
    startDate: Date, 
    endDate: Date, 
    type: 'hourly' | 'daily' = 'daily'
  ): Promise<void> {
    try {
      console.log(`Starting backfill for ${type} aggregations from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const current = new Date(startDate);
      let count = 0;
      
      while (current <= endDate) {
        if (type === 'hourly') {
          await DataAggregationService.generateHourlyAggregation(current);
          current.setHours(current.getHours() + 1);
        } else {
          await DataAggregationService.generateDailyAggregation(current);
          current.setDate(current.getDate() + 1);
        }
        count++;
        
        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Backfill completed: processed ${count} ${type} aggregations`);
      
    } catch (error) {
      console.error(`Error during ${type} backfill:`, error);
      throw error;
    }
  }
}