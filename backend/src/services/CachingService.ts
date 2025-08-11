import { redisClient, connectRedis } from '../config/redis';
import { SessionData } from '../types';

/**
 * Caching service for session data and real-time metrics
 */
export class CachingService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly METRICS_PREFIX = 'metrics:';
  private static readonly REALTIME_PREFIX = 'realtime:';
  private static readonly VISITOR_PREFIX = 'visitor:';
  
  // Cache TTL values (in seconds)
  private static readonly SESSION_TTL = 3600; // 1 hour

  private static readonly REALTIME_TTL = 60; // 1 minute
  private static readonly VISITOR_TTL = 86400; // 24 hours

  /**
   * Initialize Redis connection if not already connected
   */
  private static async ensureConnection(): Promise<void> {
    try {
      await connectRedis();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Cache session data
   */
  static async cacheSession(sessionId: string, sessionData: SessionData): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const value = JSON.stringify(sessionData);
      
      await redisClient.setEx(key, this.SESSION_TTL, value);
      console.log(`Cached session: ${sessionId}`);
    } catch (error) {
      console.error('Error caching session:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get cached session data
   */
  static async getCachedSession(sessionId: string): Promise<SessionData | null> {
    try {
      await this.ensureConnection();
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const value = await redisClient.get(key);
      
      if (value) {
        return JSON.parse(value) as SessionData;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached session:', error);
      return null;
    }
  }

  /**
   * Update cached session data
   */
  static async updateCachedSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const existingData = await this.getCachedSession(sessionId);
      
      if (existingData) {
        const updatedData = { ...existingData, ...updates };
        const value = JSON.stringify(updatedData);
        await redisClient.setEx(key, this.SESSION_TTL, value);
        console.log(`Updated cached session: ${sessionId}`);
      }
    } catch (error) {
      console.error('Error updating cached session:', error);
    }
  }

  /**
   * Remove session from cache
   */
  static async removeCachedSession(sessionId: string): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await redisClient.del(key);
      console.log(`Removed cached session: ${sessionId}`);
    } catch (error) {
      console.error('Error removing cached session:', error);
    }
  }

  /**
   * Cache real-time metrics
   */
  static async cacheRealtimeMetrics(metrics: {
    active_sessions: number;
    page_views_last_hour: number;
    unique_visitors_today: number;
    popular_pages: Array<{ url: string; views: number }>;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.REALTIME_PREFIX}current`;
      const value = JSON.stringify(metrics);
      
      await redisClient.setEx(key, this.REALTIME_TTL, value);
      console.log('Cached realtime metrics');
    } catch (error) {
      console.error('Error caching realtime metrics:', error);
    }
  }

  /**
   * Get cached real-time metrics
   */
  static async getCachedRealtimeMetrics(): Promise<{
    active_sessions: number;
    page_views_last_hour: number;
    unique_visitors_today: number;
    popular_pages: Array<{ url: string; views: number }>;
    timestamp: Date;
  } | null> {
    try {
      await this.ensureConnection();
      const key = `${this.REALTIME_PREFIX}current`;
      const value = await redisClient.get(key);
      
      if (value) {
        const metrics = JSON.parse(value);
        metrics.timestamp = new Date(metrics.timestamp);
        return metrics;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached realtime metrics:', error);
      return null;
    }
  }

  /**
   * Increment page view counter for real-time tracking
   */
  static async incrementPageView(url: string): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.REALTIME_PREFIX}pageviews:${url}`;
      const hourKey = `${this.REALTIME_PREFIX}pageviews:hour:${new Date().getHours()}`;
      
      // Increment URL-specific counter
      await redisClient.incr(key);
      await redisClient.expire(key, this.REALTIME_TTL * 60); // 1 hour
      
      // Increment hourly counter
      await redisClient.incr(hourKey);
      await redisClient.expire(hourKey, 3600); // 1 hour
      
    } catch (error) {
      console.error('Error incrementing page view:', error);
    }
  }

  /**
   * Track active session
   */
  static async trackActiveSession(sessionId: string): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.REALTIME_PREFIX}active_sessions`;
      
      // Add session to active set with TTL
      await redisClient.setEx(`${this.REALTIME_PREFIX}session:${sessionId}`, 300, '1'); // 5 minutes
      await redisClient.sAdd(key, sessionId);
      
      // Clean up expired sessions from set
      const members = await redisClient.sMembers(key);
      for (const member of members) {
        const exists = await redisClient.exists(`${this.REALTIME_PREFIX}session:${member}`);
        if (!exists) {
          await redisClient.sRem(key, member);
        }
      }
    } catch (error) {
      console.error('Error tracking active session:', error);
    }
  }

  /**
   * Get active sessions count
   */
  static async getActiveSessionsCount(): Promise<number> {
    try {
      await this.ensureConnection();
      const key = `${this.REALTIME_PREFIX}active_sessions`;
      return await redisClient.sCard(key);
    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  /**
   * Cache visitor identification data
   */
  static async cacheVisitorData(visitorId: string, data: {
    cookie_id?: string;
    browser_fingerprint?: string;
    is_returning: boolean;
    last_seen: Date;
  }): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.VISITOR_PREFIX}${visitorId}`;
      const value = JSON.stringify(data);
      
      await redisClient.setEx(key, this.VISITOR_TTL, value);
    } catch (error) {
      console.error('Error caching visitor data:', error);
    }
  }

  /**
   * Get cached visitor data
   */
  static async getCachedVisitorData(visitorId: string): Promise<{
    cookie_id?: string;
    browser_fingerprint?: string;
    is_returning: boolean;
    last_seen: Date;
  } | null> {
    try {
      await this.ensureConnection();
      const key = `${this.VISITOR_PREFIX}${visitorId}`;
      const value = await redisClient.get(key);
      
      if (value) {
        const data = JSON.parse(value);
        data.last_seen = new Date(data.last_seen);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached visitor data:', error);
      return null;
    }
  }

  /**
   * Cache aggregated metrics
   */
  static async cacheAggregatedMetrics(
    period: 'hourly' | 'daily',
    timestamp: string,
    metrics: {
      total_events: number;
      unique_sessions: number;
      page_views: number;
      unique_visitors: number;
      avg_session_duration: number;
      bounce_rate: number;
      popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
    }
  ): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `${this.METRICS_PREFIX}${period}:${timestamp}`;
      const value = JSON.stringify(metrics);
      
      // Cache for longer periods based on aggregation type
      const ttl = period === 'hourly' ? 3600 * 24 : 3600 * 24 * 7; // 1 day for hourly, 1 week for daily
      await redisClient.setEx(key, ttl, value);
      
      console.log(`Cached ${period} metrics for ${timestamp}`);
    } catch (error) {
      console.error(`Error caching ${period} metrics:`, error);
    }
  }

  /**
   * Get cached aggregated metrics
   */
  static async getCachedAggregatedMetrics(
    period: 'hourly' | 'daily',
    timestamp: string
  ): Promise<{
    total_events: number;
    unique_sessions: number;
    page_views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
    popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
  } | null> {
    try {
      await this.ensureConnection();
      const key = `${this.METRICS_PREFIX}${period}:${timestamp}`;
      const value = await redisClient.get(key);
      
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error(`Error getting cached ${period} metrics:`, error);
      return null;
    }
  }

  /**
   * Clear all cached data (useful for testing)
   */
  static async clearAllCache(): Promise<void> {
    try {
      await this.ensureConnection();
      
      // Get all keys with our prefixes
      const sessionKeys = await redisClient.keys(`${this.SESSION_PREFIX}*`);
      const metricsKeys = await redisClient.keys(`${this.METRICS_PREFIX}*`);
      const realtimeKeys = await redisClient.keys(`${this.REALTIME_PREFIX}*`);
      const visitorKeys = await redisClient.keys(`${this.VISITOR_PREFIX}*`);
      
      const allKeys = [...sessionKeys, ...metricsKeys, ...realtimeKeys, ...visitorKeys];
      
      if (allKeys.length > 0) {
        await redisClient.del(allKeys);
        console.log(`Cleared ${allKeys.length} cached items`);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    sessions: number;
    metrics: number;
    realtime: number;
    visitors: number;
    total: number;
  }> {
    try {
      await this.ensureConnection();
      
      const sessionKeys = await redisClient.keys(`${this.SESSION_PREFIX}*`);
      const metricsKeys = await redisClient.keys(`${this.METRICS_PREFIX}*`);
      const realtimeKeys = await redisClient.keys(`${this.REALTIME_PREFIX}*`);
      const visitorKeys = await redisClient.keys(`${this.VISITOR_PREFIX}*`);
      
      return {
        sessions: sessionKeys.length,
        metrics: metricsKeys.length,
        realtime: realtimeKeys.length,
        visitors: visitorKeys.length,
        total: sessionKeys.length + metricsKeys.length + realtimeKeys.length + visitorKeys.length
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { sessions: 0, metrics: 0, realtime: 0, visitors: 0, total: 0 };
    }
  }
}