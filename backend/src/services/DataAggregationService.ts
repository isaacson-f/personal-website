import { query } from '../config/database';
import { CachingService } from './CachingService';
import { FilterOptions } from '../types';

/**
 * Data aggregation service for analytics summaries
 */
export class DataAggregationService {
  
  /**
   * Generate hourly aggregation for a specific hour
   */
  static async generateHourlyAggregation(timestamp: Date): Promise<{
    timestamp: Date;
    total_events: number;
    unique_sessions: number;
    page_views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
    popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
  }> {
    const startTime = new Date(timestamp);
    startTime.setMinutes(0, 0, 0); // Start of hour
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // End of hour
    
    console.log(`Generating hourly aggregation for ${startTime.toISOString()}`);

    // Get total events
    const eventsQuery = `
      SELECT COUNT(*) as total_events
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
    `;
    const eventsResult = await query(eventsQuery, [startTime, endTime]);
    const totalEvents = parseInt(eventsResult.rows[0]?.total_events || '0');

    // Get unique sessions and page views
    const sessionsQuery = `
      SELECT 
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as page_views
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
    `;
    const sessionsResult = await query(sessionsQuery, [startTime, endTime]);
    const uniqueSessions = parseInt(sessionsResult.rows[0]?.unique_sessions || '0');
    const pageViews = parseInt(sessionsResult.rows[0]?.page_views || '0');

    // Get unique visitors (based on sessions in this hour)
    const visitorsQuery = `
      SELECT COUNT(DISTINCT s.visitor_id) as unique_visitors
      FROM analytics_sessions s
      WHERE s.start_time >= $1 AND s.start_time < $2
        AND s.visitor_id IS NOT NULL
    `;
    const visitorsResult = await query(visitorsQuery, [startTime, endTime]);
    const uniqueVisitors = parseInt(visitorsResult.rows[0]?.unique_visitors || '0');

    // Get average session duration
    const durationQuery = `
      SELECT AVG(duration_seconds) as avg_duration
      FROM analytics_sessions 
      WHERE start_time >= $1 AND start_time < $2
        AND duration_seconds IS NOT NULL
    `;
    const durationResult = await query(durationQuery, [startTime, endTime]);
    const avgSessionDuration = parseFloat(durationResult.rows[0]?.avg_duration || '0');

    // Calculate bounce rate (sessions with only 1 page view)
    const bounceQuery = `
      SELECT 
        COUNT(CASE WHEN page_views = 1 THEN 1 END) as bounced_sessions,
        COUNT(*) as total_sessions
      FROM analytics_sessions 
      WHERE start_time >= $1 AND start_time < $2
    `;
    const bounceResult = await query(bounceQuery, [startTime, endTime]);
    const bouncedSessions = parseInt(bounceResult.rows[0]?.bounced_sessions || '0');
    const totalSessions = parseInt(bounceResult.rows[0]?.total_sessions || '0');
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Get popular pages
    const popularPagesQuery = `
      SELECT 
        url,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
        AND event_type = 'page_view'
      GROUP BY url
      ORDER BY views DESC
      LIMIT 10
    `;
    const popularPagesResult = await query(popularPagesQuery, [startTime, endTime]);
    const popularPages = popularPagesResult.rows.map((row: any) => ({
      url: row.url,
      views: parseInt(row.views),
      unique_sessions: parseInt(row.unique_sessions)
    }));

    const aggregation = {
      timestamp: startTime,
      total_events: totalEvents,
      unique_sessions: uniqueSessions,
      page_views: pageViews,
      unique_visitors: uniqueVisitors,
      avg_session_duration: Math.round(avgSessionDuration),
      bounce_rate: Math.round(bounceRate * 100) / 100,
      popular_pages: popularPages
    };

    // Cache the aggregation
    const timestampKey = startTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    await CachingService.cacheAggregatedMetrics('hourly', timestampKey, aggregation);

    return aggregation;
  }

  /**
   * Generate daily aggregation for a specific date
   */
  static async generateDailyAggregation(date: Date): Promise<{
    date: Date;
    total_events: number;
    unique_sessions: number;
    page_views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
    popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
    hourly_breakdown: Array<{ hour: number; events: number; sessions: number }>;
  }> {
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0); // Start of day
    
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + 1); // End of day
    
    console.log(`Generating daily aggregation for ${startTime.toISOString().substring(0, 10)}`);

    // Get total events
    const eventsQuery = `
      SELECT COUNT(*) as total_events
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
    `;
    const eventsResult = await query(eventsQuery, [startTime, endTime]);
    const totalEvents = parseInt(eventsResult.rows[0]?.total_events || '0');

    // Get unique sessions and page views
    const sessionsQuery = `
      SELECT 
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as page_views
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
    `;
    const sessionsResult = await query(sessionsQuery, [startTime, endTime]);
    const uniqueSessions = parseInt(sessionsResult.rows[0]?.unique_sessions || '0');
    const pageViews = parseInt(sessionsResult.rows[0]?.page_views || '0');

    // Get unique visitors
    const visitorsQuery = `
      SELECT COUNT(DISTINCT s.visitor_id) as unique_visitors
      FROM analytics_sessions s
      WHERE s.start_time >= $1 AND s.start_time < $2
        AND s.visitor_id IS NOT NULL
    `;
    const visitorsResult = await query(visitorsQuery, [startTime, endTime]);
    const uniqueVisitors = parseInt(visitorsResult.rows[0]?.unique_visitors || '0');

    // Get average session duration
    const durationQuery = `
      SELECT AVG(duration_seconds) as avg_duration
      FROM analytics_sessions 
      WHERE start_time >= $1 AND start_time < $2
        AND duration_seconds IS NOT NULL
    `;
    const durationResult = await query(durationQuery, [startTime, endTime]);
    const avgSessionDuration = parseFloat(durationResult.rows[0]?.avg_duration || '0');

    // Calculate bounce rate
    const bounceQuery = `
      SELECT 
        COUNT(CASE WHEN page_views = 1 THEN 1 END) as bounced_sessions,
        COUNT(*) as total_sessions
      FROM analytics_sessions 
      WHERE start_time >= $1 AND start_time < $2
    `;
    const bounceResult = await query(bounceQuery, [startTime, endTime]);
    const bouncedSessions = parseInt(bounceResult.rows[0]?.bounced_sessions || '0');
    const totalSessions = parseInt(bounceResult.rows[0]?.total_sessions || '0');
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Get popular pages
    const popularPagesQuery = `
      SELECT 
        url,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
        AND event_type = 'page_view'
      GROUP BY url
      ORDER BY views DESC
      LIMIT 20
    `;
    const popularPagesResult = await query(popularPagesQuery, [startTime, endTime]);
    const popularPages = popularPagesResult.rows.map((row: any) => ({
      url: row.url,
      views: parseInt(row.views),
      unique_sessions: parseInt(row.unique_sessions)
    }));

    // Get hourly breakdown
    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as events,
        COUNT(DISTINCT session_id) as sessions
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `;
    const hourlyResult = await query(hourlyQuery, [startTime, endTime]);
    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => {
      const hourData = hourlyResult.rows.find((row: any) => parseInt(row.hour) === hour);
      return {
        hour,
        events: hourData ? parseInt(hourData.events) : 0,
        sessions: hourData ? parseInt(hourData.sessions) : 0
      };
    });

    const aggregation = {
      date: startTime,
      total_events: totalEvents,
      unique_sessions: uniqueSessions,
      page_views: pageViews,
      unique_visitors: uniqueVisitors,
      avg_session_duration: Math.round(avgSessionDuration),
      bounce_rate: Math.round(bounceRate * 100) / 100,
      popular_pages: popularPages,
      hourly_breakdown: hourlyBreakdown
    };

    // Cache the aggregation
    const dateKey = startTime.toISOString().substring(0, 10); // YYYY-MM-DD
    await CachingService.cacheAggregatedMetrics('daily', dateKey, aggregation);

    return aggregation;
  }

  /**
   * Get or generate hourly aggregation
   */
  static async getHourlyAggregation(timestamp: Date): Promise<{
    timestamp: Date;
    total_events: number;
    unique_sessions: number;
    page_views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
    popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
  }> {
    const startTime = new Date(timestamp);
    startTime.setMinutes(0, 0, 0); // Start of hour
    
    const timestampKey = startTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    
    // Try to get from cache first
    const cached = await CachingService.getCachedAggregatedMetrics('hourly', timestampKey);
    if (cached) {
      console.log(`Retrieved hourly aggregation from cache for ${timestampKey}`);
      return {
        ...cached,
        timestamp: startTime
      };
    }

    // Generate if not cached
    return await this.generateHourlyAggregation(startTime);
  }

  /**
   * Get or generate daily aggregation
   */
  static async getDailyAggregation(date: Date): Promise<{
    date: Date;
    total_events: number;
    unique_sessions: number;
    page_views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
    popular_pages: Array<{ url: string; views: number; unique_sessions: number }>;
    hourly_breakdown: Array<{ hour: number; events: number; sessions: number }>;
  }> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const dateKey = startDate.toISOString().substring(0, 10); // YYYY-MM-DD
    
    // Try to get from cache first
    const cached = await CachingService.getCachedAggregatedMetrics('daily', dateKey);
    if (cached) {
      console.log(`Retrieved daily aggregation from cache for ${dateKey}`);
      return {
        ...cached,
        date: startDate,
        hourly_breakdown: [] // Return empty array since hourly breakdown is not cached
      };
    }

    // Generate if not cached
    return await this.generateDailyAggregation(startDate);
  }

  /**
   * Generate real-time metrics summary
   */
  static async generateRealtimeMetrics(): Promise<{
    active_sessions: number;
    page_views_last_hour: number;
    unique_visitors_today: number;
    popular_pages: Array<{ url: string; views: number }>;
    timestamp: Date;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Get active sessions from cache
    const activeSessions = await CachingService.getActiveSessionsCount();

    // Get page views in last hour
    const pageViewsQuery = `
      SELECT COUNT(*) as count
      FROM analytics_events 
      WHERE timestamp >= $1 
        AND event_type = 'page_view'
    `;
    const pageViewsResult = await query(pageViewsQuery, [oneHourAgo]);
    const pageViewsLastHour = parseInt(pageViewsResult.rows[0]?.count || '0');

    // Get unique visitors today
    const visitorsQuery = `
      SELECT COUNT(DISTINCT s.visitor_id) as count
      FROM analytics_sessions s
      WHERE s.start_time >= $1
        AND s.visitor_id IS NOT NULL
    `;
    const visitorsResult = await query(visitorsQuery, [todayStart]);
    const uniqueVisitorsToday = parseInt(visitorsResult.rows[0]?.count || '0');

    // Get popular pages in last hour
    const popularPagesQuery = `
      SELECT 
        url,
        COUNT(*) as views
      FROM analytics_events 
      WHERE timestamp >= $1 
        AND event_type = 'page_view'
      GROUP BY url
      ORDER BY views DESC
      LIMIT 5
    `;
    const popularPagesResult = await query(popularPagesQuery, [oneHourAgo]);
    const popularPages = popularPagesResult.rows.map((row: any) => ({
      url: row.url,
      views: parseInt(row.views)
    }));

    const metrics = {
      active_sessions: activeSessions,
      page_views_last_hour: pageViewsLastHour,
      unique_visitors_today: uniqueVisitorsToday,
      popular_pages: popularPages,
      timestamp: now
    };

    // Cache the real-time metrics
    await CachingService.cacheRealtimeMetrics(metrics);

    return metrics;
  }

  /**
   * Get real-time metrics (cached or fresh)
   */
  static async getRealtimeMetrics(): Promise<{
    active_sessions: number;
    page_views_last_hour: number;
    unique_visitors_today: number;
    popular_pages: Array<{ url: string; views: number }>;
    timestamp: Date;
  }> {
    // Try to get from cache first
    const cached = await CachingService.getCachedRealtimeMetrics();
    if (cached) {
      console.log('Retrieved realtime metrics from cache');
      return cached;
    }

    // Generate if not cached
    return await this.generateRealtimeMetrics();
  }

  /**
   * Generate summary statistics for a date range
   */
  static async generateSummaryStats(filters: FilterOptions & { 
    dateFrom: Date; 
    dateTo: Date; 
  }): Promise<{
    total_events: number;
    unique_sessions: number;
    unique_visitors: number;
    page_views: number;
    avg_session_duration: number;
    bounce_rate: number;
    top_pages: Array<{ url: string; views: number; unique_sessions: number }>;
    top_referrers: Array<{ referrer: string; count: number }>;
    daily_breakdown: Array<{ date: string; events: number; sessions: number; visitors: number }>;
  }> {
    const { dateFrom, dateTo } = filters;

    // Get total events
    const eventsQuery = `
      SELECT COUNT(*) as total_events
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp <= $2
    `;
    const eventsResult = await query(eventsQuery, [dateFrom, dateTo]);
    const totalEvents = parseInt(eventsResult.rows[0]?.total_events || '0');

    // Get unique sessions and page views
    const sessionsQuery = `
      SELECT 
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as page_views
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp <= $2
    `;
    const sessionsResult = await query(sessionsQuery, [dateFrom, dateTo]);
    const uniqueSessions = parseInt(sessionsResult.rows[0]?.unique_sessions || '0');
    const pageViews = parseInt(sessionsResult.rows[0]?.page_views || '0');

    // Get unique visitors
    const visitorsQuery = `
      SELECT COUNT(DISTINCT s.visitor_id) as unique_visitors
      FROM analytics_sessions s
      WHERE s.start_time >= $1 AND s.start_time <= $2
        AND s.visitor_id IS NOT NULL
    `;
    const visitorsResult = await query(visitorsQuery, [dateFrom, dateTo]);
    const uniqueVisitors = parseInt(visitorsResult.rows[0]?.unique_visitors || '0');

    // Get average session duration and bounce rate
    const sessionStatsQuery = `
      SELECT 
        AVG(duration_seconds) as avg_duration,
        COUNT(CASE WHEN page_views = 1 THEN 1 END) as bounced_sessions,
        COUNT(*) as total_sessions
      FROM analytics_sessions 
      WHERE start_time >= $1 AND start_time <= $2
    `;
    const sessionStatsResult = await query(sessionStatsQuery, [dateFrom, dateTo]);
    const avgSessionDuration = parseFloat(sessionStatsResult.rows[0]?.avg_duration || '0');
    const bouncedSessions = parseInt(sessionStatsResult.rows[0]?.bounced_sessions || '0');
    const totalSessions = parseInt(sessionStatsResult.rows[0]?.total_sessions || '0');
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Get top pages
    const topPagesQuery = `
      SELECT 
        url,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp <= $2
        AND event_type = 'page_view'
      GROUP BY url
      ORDER BY views DESC
      LIMIT 10
    `;
    const topPagesResult = await query(topPagesQuery, [dateFrom, dateTo]);
    const topPages = topPagesResult.rows.map((row: any) => ({
      url: row.url,
      views: parseInt(row.views),
      unique_sessions: parseInt(row.unique_sessions)
    }));

    // Get top referrers
    const topReferrersQuery = `
      SELECT 
        referrer,
        COUNT(*) as count
      FROM analytics_events 
      WHERE timestamp >= $1 AND timestamp <= $2
        AND referrer IS NOT NULL
        AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10
    `;
    const topReferrersResult = await query(topReferrersQuery, [dateFrom, dateTo]);
    const topReferrers = topReferrersResult.rows.map((row: any) => ({
      referrer: row.referrer,
      count: parseInt(row.count)
    }));

    // Get daily breakdown
    const dailyQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as events,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT 
          CASE WHEN s.visitor_id IS NOT NULL THEN s.visitor_id END
        ) as visitors
      FROM analytics_events e
      LEFT JOIN analytics_sessions s ON e.session_id = s.id
      WHERE e.timestamp >= $1 AND e.timestamp <= $2
      GROUP BY DATE(timestamp)
      ORDER BY date
    `;
    const dailyResult = await query(dailyQuery, [dateFrom, dateTo]);
    const dailyBreakdown = dailyResult.rows.map((row: any) => ({
      date: row.date,
      events: parseInt(row.events),
      sessions: parseInt(row.sessions),
      visitors: parseInt(row.visitors || '0')
    }));

    return {
      total_events: totalEvents,
      unique_sessions: uniqueSessions,
      unique_visitors: uniqueVisitors,
      page_views: pageViews,
      avg_session_duration: Math.round(avgSessionDuration),
      bounce_rate: Math.round(bounceRate * 100) / 100,
      top_pages: topPages,
      top_referrers: topReferrers,
      daily_breakdown: dailyBreakdown
    };
  }
}