import { CachingService } from '../../services/CachingService';
import { redisClient, connectRedis } from '../../config/redis';
import { SessionData } from '../../types';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock Redis client for testing
jest.mock('../../config/redis', () => ({
  redisClient: {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sCard: jest.fn(),
    sMembers: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn(),
    info: jest.fn()
  },
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn()
}));

describe('CachingService', () => {
  const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
  const mockConnectRedis = connectRedis as jest.MockedFunction<typeof connectRedis>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectRedis.mockResolvedValue();
  });

  describe('Session Caching', () => {
    const mockSessionData: SessionData = {
      id: 'test-session-123',
      visitor_id: 'visitor-456',
      cookie_id: 'cookie-789',
      start_time: new Date('2024-01-01T10:00:00Z'),
      end_time: null,
      page_views: 3,
      duration_seconds: null,
      browser_fingerprint: 'fingerprint-abc',
      device_info: { browser: 'Chrome', os: 'Windows' },
      geographic_data: { country: 'US', city: 'New York' },
      is_returning_visitor: false,
      created_at: new Date('2024-01-01T10:00:00Z')
    };

    test('should cache session data successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await CachingService.cacheSession('test-session-123', mockSessionData);

      expect(mockConnectRedis).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:test-session-123',
        3600, // SESSION_TTL
        JSON.stringify(mockSessionData)
      );
    });

    test('should retrieve cached session data', async () => {
      const cachedData = JSON.stringify(mockSessionData);
      mockRedisClient.get.mockResolvedValue(cachedData);

      const result = await CachingService.getCachedSession('test-session-123');

      expect(mockConnectRedis).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:test-session-123');
      expect(result).toEqual({
        ...mockSessionData,
        start_time: mockSessionData.start_time.toISOString(),
        created_at: mockSessionData.created_at?.toISOString()
      });
    });

    test('should return null when session not found in cache', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await CachingService.getCachedSession('non-existent-session');

      expect(result).toBeNull();
    });

    test('should update cached session data', async () => {
      const existingData = JSON.stringify(mockSessionData);
      mockRedisClient.get.mockResolvedValue(existingData);
      mockRedisClient.setEx.mockResolvedValue('OK');

      const updates = { page_views: 5, end_time: new Date('2024-01-01T11:00:00Z') };
      await CachingService.updateCachedSession('test-session-123', updates);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:test-session-123',
        3600,
        JSON.stringify({ ...mockSessionData, ...updates })
      );
    });

    test('should remove session from cache', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await CachingService.removeCachedSession('test-session-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith('session:test-session-123');
    });

    test('should handle Redis errors gracefully', async () => {
      mockConnectRedis.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error
      await expect(CachingService.cacheSession('test-session', mockSessionData)).resolves.toBeUndefined();
    });
  });

  describe('Real-time Metrics Caching', () => {
    const mockMetrics = {
      active_sessions: 25,
      page_views_last_hour: 150,
      unique_visitors_today: 75,
      popular_pages: [
        { url: '/home', views: 50 },
        { url: '/about', views: 30 }
      ],
      timestamp: new Date('2024-01-01T12:00:00Z')
    };

    test('should cache real-time metrics', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await CachingService.cacheRealtimeMetrics(mockMetrics);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'realtime:current',
        60, // REALTIME_TTL
        JSON.stringify(mockMetrics)
      );
    });

    test('should retrieve cached real-time metrics', async () => {
      const cachedData = JSON.stringify(mockMetrics);
      mockRedisClient.get.mockResolvedValue(cachedData);

      const result = await CachingService.getCachedRealtimeMetrics();

      expect(result).toEqual(mockMetrics);
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    test('should increment page view counter', async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(true);

      await CachingService.incrementPageView('/test-page');

      expect(mockRedisClient.incr).toHaveBeenCalledWith('realtime:pageviews:/test-page');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('realtime:pageviews:/test-page', 3600);
    });
  });

  describe('Active Session Tracking', () => {
    test('should track active session', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.sAdd.mockResolvedValue(1);
      mockRedisClient.sMembers.mockResolvedValue(['session-1', 'session-2']);
      mockRedisClient.exists.mockResolvedValue(1);

      await CachingService.trackActiveSession('test-session-123');

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('realtime:session:test-session-123', 300, '1');
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('realtime:active_sessions', 'test-session-123');
    });

    test('should get active sessions count', async () => {
      mockRedisClient.sCard.mockResolvedValue(5);

      const count = await CachingService.getActiveSessionsCount();

      expect(count).toBe(5);
      expect(mockRedisClient.sCard).toHaveBeenCalledWith('realtime:active_sessions');
    });

    test('should return 0 when Redis error occurs', async () => {
      mockConnectRedis.mockRejectedValue(new Error('Redis error'));

      const count = await CachingService.getActiveSessionsCount();

      expect(count).toBe(0);
    });
  });

  describe('Visitor Data Caching', () => {
    const mockVisitorData = {
      cookie_id: 'cookie-123',
      browser_fingerprint: 'fingerprint-abc',
      is_returning: true,
      last_seen: new Date('2024-01-01T12:00:00Z')
    };

    test('should cache visitor data', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await CachingService.cacheVisitorData('visitor-123', mockVisitorData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'visitor:visitor-123',
        86400, // VISITOR_TTL
        JSON.stringify(mockVisitorData)
      );
    });

    test('should retrieve cached visitor data', async () => {
      const cachedData = JSON.stringify(mockVisitorData);
      mockRedisClient.get.mockResolvedValue(cachedData);

      const result = await CachingService.getCachedVisitorData('visitor-123');

      expect(result).toEqual(mockVisitorData);
      expect(result?.last_seen).toBeInstanceOf(Date);
    });
  });

  describe('Aggregated Metrics Caching', () => {
    const mockAggregatedMetrics = {
      total_events: 1000,
      unique_sessions: 200,
      page_views: 800,
      unique_visitors: 150,
      avg_session_duration: 180,
      bounce_rate: 45.5,
      popular_pages: [
        { url: '/home', views: 300, unique_sessions: 100 },
        { url: '/about', views: 200, unique_sessions: 80 }
      ]
    };

    test('should cache hourly aggregated metrics', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await CachingService.cacheAggregatedMetrics('hourly', '2024-01-01T12', mockAggregatedMetrics);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'metrics:hourly:2024-01-01T12',
        86400, // 1 day for hourly
        JSON.stringify(mockAggregatedMetrics)
      );
    });

    test('should cache daily aggregated metrics', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await CachingService.cacheAggregatedMetrics('daily', '2024-01-01', mockAggregatedMetrics);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'metrics:daily:2024-01-01',
        604800, // 1 week for daily
        JSON.stringify(mockAggregatedMetrics)
      );
    });

    test('should retrieve cached aggregated metrics', async () => {
      const cachedData = JSON.stringify(mockAggregatedMetrics);
      mockRedisClient.get.mockResolvedValue(cachedData);

      const result = await CachingService.getCachedAggregatedMetrics('hourly', '2024-01-01T12');

      expect(result).toEqual(mockAggregatedMetrics);
    });
  });

  describe('Cache Management', () => {
    test('should clear all cache', async () => {
      mockRedisClient.keys.mockImplementation((...args: any[]) => {
        const pattern = args[0];
        if (pattern === 'session:*') return Promise.resolve(['session:1', 'session:2']);
        if (pattern === 'metrics:*') return Promise.resolve(['metrics:1']);
        if (pattern === 'realtime:*') return Promise.resolve(['realtime:1']);
        if (pattern === 'visitor:*') return Promise.resolve(['visitor:1']);
        return Promise.resolve([]);
      });
      mockRedisClient.del.mockResolvedValue(5);

      await CachingService.clearAllCache();

      expect(mockRedisClient.del).toHaveBeenCalledWith([
        'session:1', 'session:2', 'metrics:1', 'realtime:1', 'visitor:1'
      ]);
    });

    test('should get cache statistics', async () => {
      mockRedisClient.keys.mockImplementation((...args: any[]) => {
        const pattern = args[0];
        if (pattern === 'session:*') return Promise.resolve(['session:1', 'session:2']);
        if (pattern === 'metrics:*') return Promise.resolve(['metrics:1']);
        if (pattern === 'realtime:*') return Promise.resolve(['realtime:1', 'realtime:2']);
        if (pattern === 'visitor:*') return Promise.resolve(['visitor:1']);
        return Promise.resolve([]);
      });

      const stats = await CachingService.getCacheStats();

      expect(stats).toEqual({
        sessions: 2,
        metrics: 1,
        realtime: 2,
        visitors: 1,
        total: 6
      });
    });

    test('should handle errors in cache stats gracefully', async () => {
      mockConnectRedis.mockRejectedValue(new Error('Redis error'));

      const stats = await CachingService.getCacheStats();

      expect(stats).toEqual({
        sessions: 0,
        metrics: 0,
        realtime: 0,
        visitors: 0,
        total: 0
      });
    });
  });
});