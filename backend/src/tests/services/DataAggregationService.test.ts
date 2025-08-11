import { DataAggregationService } from '../../services/DataAggregationService';
import { CachingService } from '../../services/CachingService';
import { query } from '../../config/database';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/CachingService');

describe('DataAggregationService', () => {
  const mockQuery = query as jest.MockedFunction<typeof query>;
  const mockCachingService = CachingService as jest.Mocked<typeof CachingService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHourlyAggregation', () => {
    const testTimestamp = new Date('2024-01-01T12:30:00Z');
    const expectedStartTime = new Date('2024-01-01T12:00:00Z');
    const expectedEndTime = new Date('2024-01-01T13:00:00Z');

    beforeEach(() => {
      // Mock database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '150' }] }) // Total events
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '25', page_views: '120' }] }) // Sessions and page views
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '20' }] }) // Unique visitors
        .mockResolvedValueOnce({ rows: [{ avg_duration: '180.5' }] }) // Average duration
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '5', total_sessions: '25' }] }) // Bounce rate
        .mockResolvedValueOnce({ // Popular pages
          rows: [
            { url: '/home', views: '50', unique_sessions: '15' },
            { url: '/about', views: '30', unique_sessions: '12' }
          ]
        });

      mockCachingService.cacheAggregatedMetrics.mockResolvedValue();
    });

    test('should generate hourly aggregation with correct time bounds', async () => {
      const result = await DataAggregationService.generateHourlyAggregation(testTimestamp);

      // Verify database queries were called with correct time bounds
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM analytics_events'),
        [expectedStartTime, expectedEndTime]
      );

      expect(result.timestamp).toEqual(expectedStartTime);
    });

    test('should return correct aggregation data', async () => {
      const result = await DataAggregationService.generateHourlyAggregation(testTimestamp);

      expect(result).toEqual({
        timestamp: expectedStartTime,
        total_events: 150,
        unique_sessions: 25,
        page_views: 120,
        unique_visitors: 20,
        avg_session_duration: 181, // Rounded
        bounce_rate: 20, // (5/25) * 100
        popular_pages: [
          { url: '/home', views: 50, unique_sessions: 15 },
          { url: '/about', views: 30, unique_sessions: 12 }
        ]
      });
    });

    test('should cache the aggregation result', async () => {
      await DataAggregationService.generateHourlyAggregation(testTimestamp);

      expect(mockCachingService.cacheAggregatedMetrics).toHaveBeenCalledWith(
        'hourly',
        '2024-01-01T12',
        expect.objectContaining({
          total_events: 150,
          unique_sessions: 25
        })
      );
    });

    test('should handle zero bounce rate correctly', async () => {
      // Mock zero bounced sessions
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '100' }] })
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '20', page_views: '80' }] })
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '15' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '200' }] })
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '0', total_sessions: '20' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await DataAggregationService.generateHourlyAggregation(testTimestamp);

      expect(result.bounce_rate).toBe(0);
    });

    test('should handle empty data gracefully', async () => {
      // Mock empty results
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '0' }] })
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '0', page_views: '0' }] })
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '0' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: null }] })
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '0', total_sessions: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await DataAggregationService.generateHourlyAggregation(testTimestamp);

      expect(result).toEqual({
        timestamp: expectedStartTime,
        total_events: 0,
        unique_sessions: 0,
        page_views: 0,
        unique_visitors: 0,
        avg_session_duration: 0,
        bounce_rate: 0,
        popular_pages: []
      });
    });
  });

  describe('generateDailyAggregation', () => {
    const testDate = new Date('2024-01-01T15:30:00Z');
    const expectedStartTime = new Date('2024-01-01T00:00:00Z');
    const expectedEndTime = new Date('2024-01-02T00:00:00Z');

    beforeEach(() => {
      // Mock database queries for daily aggregation
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '2400' }] }) // Total events
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '300', page_views: '2000' }] }) // Sessions and page views
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '250' }] }) // Unique visitors
        .mockResolvedValueOnce({ rows: [{ avg_duration: '240.8' }] }) // Average duration
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '60', total_sessions: '300' }] }) // Bounce rate
        .mockResolvedValueOnce({ // Popular pages
          rows: [
            { url: '/home', views: '800', unique_sessions: '200' },
            { url: '/about', views: '500', unique_sessions: '150' },
            { url: '/contact', views: '300', unique_sessions: '100' }
          ]
        })
        .mockResolvedValueOnce({ // Hourly breakdown
          rows: [
            { hour: '9', events: '100', sessions: '15' },
            { hour: '10', events: '150', sessions: '20' },
            { hour: '14', events: '200', sessions: '25' }
          ]
        });

      mockCachingService.cacheAggregatedMetrics.mockResolvedValue();
    });

    test('should generate daily aggregation with correct date bounds', async () => {
      const result = await DataAggregationService.generateDailyAggregation(testDate);

      // Verify database queries were called with correct date bounds
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM analytics_events'),
        [expectedStartTime, expectedEndTime]
      );

      expect(result.date).toEqual(expectedStartTime);
    });

    test('should return correct daily aggregation data', async () => {
      const result = await DataAggregationService.generateDailyAggregation(testDate);

      expect(result).toEqual({
        date: expectedStartTime,
        total_events: 2400,
        unique_sessions: 300,
        page_views: 2000,
        unique_visitors: 250,
        avg_session_duration: 241, // Rounded
        bounce_rate: 20, // (60/300) * 100
        popular_pages: [
          { url: '/home', views: 800, unique_sessions: 200 },
          { url: '/about', views: 500, unique_sessions: 150 },
          { url: '/contact', views: 300, unique_sessions: 100 }
        ],
        hourly_breakdown: expect.arrayContaining([
          { hour: 9, events: 100, sessions: 15 },
          { hour: 10, events: 150, sessions: 20 },
          { hour: 14, events: 200, sessions: 25 }
        ])
      });
    });

    test('should include all 24 hours in hourly breakdown', async () => {
      const result = await DataAggregationService.generateDailyAggregation(testDate);

      expect(result.hourly_breakdown).toHaveLength(24);
      
      // Check that hours without data are included with 0 values
      const hour0 = result.hourly_breakdown.find(h => h.hour === 0);
      expect(hour0).toEqual({ hour: 0, events: 0, sessions: 0 });
    });

    test('should cache the daily aggregation result', async () => {
      await DataAggregationService.generateDailyAggregation(testDate);

      expect(mockCachingService.cacheAggregatedMetrics).toHaveBeenCalledWith(
        'daily',
        '2024-01-01',
        expect.objectContaining({
          total_events: 2400,
          unique_sessions: 300
        })
      );
    });
  });

  describe('getHourlyAggregation', () => {
    const testTimestamp = new Date('2024-01-01T12:30:00Z');
    const expectedTimestampKey = '2024-01-01T12';

    test('should return cached data when available', async () => {
      const cachedData = {
        total_events: 100,
        unique_sessions: 20,
        page_views: 80,
        unique_visitors: 15,
        avg_session_duration: 150,
        bounce_rate: 25,
        popular_pages: []
      };

      mockCachingService.getCachedAggregatedMetrics.mockResolvedValue(cachedData);

      const result = await DataAggregationService.getHourlyAggregation(testTimestamp);

      expect(mockCachingService.getCachedAggregatedMetrics).toHaveBeenCalledWith('hourly', expectedTimestampKey);
      expect(result).toEqual({
        ...cachedData,
        timestamp: new Date('2024-01-01T12:00:00Z')
      });
    });

    test('should generate new data when not cached', async () => {
      mockCachingService.getCachedAggregatedMetrics.mockResolvedValue(null);
      
      // Mock the database queries for generation
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '50' }] })
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '10', page_views: '40' }] })
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '8' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '120' }] })
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '2', total_sessions: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockCachingService.cacheAggregatedMetrics.mockResolvedValue();

      const result = await DataAggregationService.getHourlyAggregation(testTimestamp);

      expect(mockCachingService.getCachedAggregatedMetrics).toHaveBeenCalledWith('hourly', expectedTimestampKey);
      expect(result.total_events).toBe(50);
      expect(result.unique_sessions).toBe(10);
    });
  });

  describe('generateRealtimeMetrics', () => {
    beforeEach(() => {
      // Mock active sessions from cache
      mockCachingService.getActiveSessionsCount.mockResolvedValue(15);
      mockCachingService.cacheRealtimeMetrics.mockResolvedValue();

      // Mock database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '75' }] }) // Page views last hour
        .mockResolvedValueOnce({ rows: [{ count: '45' }] }) // Unique visitors today
        .mockResolvedValueOnce({ // Popular pages last hour
          rows: [
            { url: '/home', views: '25' },
            { url: '/about', views: '15' },
            { url: '/contact', views: '10' }
          ]
        });
    });

    test('should generate real-time metrics correctly', async () => {
      const result = await DataAggregationService.generateRealtimeMetrics();

      expect(result).toEqual({
        active_sessions: 15,
        page_views_last_hour: 75,
        unique_visitors_today: 45,
        popular_pages: [
          { url: '/home', views: 25 },
          { url: '/about', views: 15 },
          { url: '/contact', views: 10 }
        ],
        timestamp: expect.any(Date)
      });
    });

    test('should cache the real-time metrics', async () => {
      const result = await DataAggregationService.generateRealtimeMetrics();

      expect(mockCachingService.cacheRealtimeMetrics).toHaveBeenCalledWith(result);
    });

    test('should query with correct time bounds', async () => {
      const beforeCall = Date.now();
      await DataAggregationService.generateRealtimeMetrics();
      const afterCall = Date.now();

      // Check that the first query (page views last hour) used a timestamp from about 1 hour ago
      const firstQueryCall = mockQuery.mock.calls[0];
      const oneHourAgoParam = firstQueryCall?.[1]?.[0] as Date;
      const expectedTime = beforeCall - (60 * 60 * 1000); // 1 hour ago
      
      expect(oneHourAgoParam.getTime()).toBeGreaterThan(expectedTime - 1000); // Allow 1 second tolerance
      expect(oneHourAgoParam.getTime()).toBeLessThan(afterCall - (60 * 60 * 1000) + 1000);
    });
  });

  describe('getRealtimeMetrics', () => {
    test('should return cached metrics when available', async () => {
      const cachedMetrics = {
        active_sessions: 20,
        page_views_last_hour: 100,
        unique_visitors_today: 60,
        popular_pages: [{ url: '/test', views: 50 }],
        timestamp: new Date()
      };

      mockCachingService.getCachedRealtimeMetrics.mockResolvedValue(cachedMetrics);

      const result = await DataAggregationService.getRealtimeMetrics();

      expect(result).toEqual(cachedMetrics);
      expect(mockCachingService.getCachedRealtimeMetrics).toHaveBeenCalled();
    });

    test('should generate new metrics when not cached', async () => {
      mockCachingService.getCachedRealtimeMetrics.mockResolvedValue(null);
      mockCachingService.getActiveSessionsCount.mockResolvedValue(10);
      mockCachingService.cacheRealtimeMetrics.mockResolvedValue();

      // Mock database queries for generation
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ count: '30' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await DataAggregationService.getRealtimeMetrics();

      expect(result.active_sessions).toBe(10);
      expect(result.page_views_last_hour).toBe(50);
      expect(result.unique_visitors_today).toBe(30);
    });
  });

  describe('generateSummaryStats', () => {
    const filters = {
      dateFrom: new Date('2024-01-01T00:00:00Z'),
      dateTo: new Date('2024-01-07T23:59:59Z')
    };

    beforeEach(() => {
      // Mock all database queries for summary stats
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '5000' }] }) // Total events
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '800', page_views: '4000' }] }) // Sessions and page views
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '600' }] }) // Unique visitors
        .mockResolvedValueOnce({ // Session stats
          rows: [{
            avg_duration: '210.5',
            bounced_sessions: '160',
            total_sessions: '800'
          }]
        })
        .mockResolvedValueOnce({ // Top pages
          rows: [
            { url: '/home', views: '1500', unique_sessions: '400' },
            { url: '/about', views: '800', unique_sessions: '300' }
          ]
        })
        .mockResolvedValueOnce({ // Top referrers
          rows: [
            { referrer: 'https://google.com', count: '200' },
            { referrer: 'https://facebook.com', count: '100' }
          ]
        })
        .mockResolvedValueOnce({ // Daily breakdown
          rows: [
            { date: '2024-01-01', events: '800', sessions: '120', visitors: '100' },
            { date: '2024-01-02', events: '900', sessions: '140', visitors: '110' }
          ]
        });
    });

    test('should generate comprehensive summary statistics', async () => {
      const result = await DataAggregationService.generateSummaryStats(filters);

      expect(result).toEqual({
        total_events: 5000,
        unique_sessions: 800,
        unique_visitors: 600,
        page_views: 4000,
        avg_session_duration: 211, // Rounded
        bounce_rate: 20, // (160/800) * 100
        top_pages: [
          { url: '/home', views: 1500, unique_sessions: 400 },
          { url: '/about', views: 800, unique_sessions: 300 }
        ],
        top_referrers: [
          { referrer: 'https://google.com', count: 200 },
          { referrer: 'https://facebook.com', count: 100 }
        ],
        daily_breakdown: [
          { date: '2024-01-01', events: 800, sessions: 120, visitors: 100 },
          { date: '2024-01-02', events: 900, sessions: 140, visitors: 110 }
        ]
      });
    });

    test('should use correct date filters in queries', async () => {
      await DataAggregationService.generateSummaryStats(filters);

      // Verify all queries used the correct date filters
      mockQuery.mock.calls.forEach(call => {
        expect(call[1]).toContain(filters.dateFrom);
        expect(call[1]).toContain(filters.dateTo);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(DataAggregationService.generateHourlyAggregation(new Date()))
        .rejects.toThrow('Database connection failed');
    });

    test('should handle caching errors gracefully', async () => {
      mockCachingService.cacheAggregatedMetrics.mockRejectedValue(new Error('Redis error'));
      
      // Mock successful database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_events: '100' }] })
        .mockResolvedValueOnce({ rows: [{ unique_sessions: '20', page_views: '80' }] })
        .mockResolvedValueOnce({ rows: [{ unique_visitors: '15' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '150' }] })
        .mockResolvedValueOnce({ rows: [{ bounced_sessions: '5', total_sessions: '20' }] })
        .mockResolvedValueOnce({ rows: [] });

      // Should still complete successfully even if caching fails
      const result = await DataAggregationService.generateHourlyAggregation(new Date());
      expect(result.total_events).toBe(100);
    });
  });
});