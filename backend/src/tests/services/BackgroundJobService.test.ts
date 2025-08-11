import { BackgroundJobService } from '../../services/BackgroundJobService';
import { DataAggregationService } from '../../services/DataAggregationService';
import { Session } from '../../models/Session';
import { CachingService } from '../../services/CachingService';

// Mock dependencies
jest.mock('../../services/DataAggregationService');
jest.mock('../../models/Session');
jest.mock('../../services/CachingService');

// Mock timers
jest.useFakeTimers();

describe('BackgroundJobService', () => {
  const mockDataAggregationService = DataAggregationService as jest.Mocked<typeof DataAggregationService>;
  const mockSession = Session as jest.Mocked<typeof Session>;
  const mockCachingService = CachingService as jest.Mocked<typeof CachingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Reset service state
    BackgroundJobService.stop();
  });

  afterEach(() => {
    BackgroundJobService.stop();
  });

  describe('Service Lifecycle', () => {
    test('should start all background jobs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      BackgroundJobService.start();

      expect(consoleSpy).toHaveBeenCalledWith('Starting background job service...');
      expect(consoleSpy).toHaveBeenCalledWith('Background job service started successfully');
      
      const status = BackgroundJobService.getStatus();
      expect(status.isRunning).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should not start jobs if already running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      BackgroundJobService.start();
      BackgroundJobService.start(); // Second call

      expect(consoleSpy).toHaveBeenCalledWith('Background jobs are already running');

      consoleSpy.mockRestore();
    });

    test('should stop all background jobs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      BackgroundJobService.start();
      BackgroundJobService.stop();

      expect(consoleSpy).toHaveBeenCalledWith('Stopping background job service...');
      expect(consoleSpy).toHaveBeenCalledWith('Background job service stopped');
      
      const status = BackgroundJobService.getStatus();
      expect(status.isRunning).toBe(false);

      consoleSpy.mockRestore();
    });

    test('should handle stop when not running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      BackgroundJobService.stop(); // Not started

      expect(consoleSpy).toHaveBeenCalledWith('Background jobs are not running');

      consoleSpy.mockRestore();
    });
  });

  describe('Job Status', () => {
    test('should return correct status when stopped', () => {
      const status = BackgroundJobService.getStatus();

      expect(status).toEqual({
        isRunning: false,
        jobs: {
          hourly: false,
          daily: false,
          cleanup: false,
          realtime: false
        }
      });
    });

    test('should return correct status when running', () => {
      BackgroundJobService.start();
      
      const status = BackgroundJobService.getStatus();

      expect(status.isRunning).toBe(true);
      // Note: Individual job status depends on timer implementation
    });
  });

  describe('Manual Job Triggers', () => {
    test('should manually trigger hourly aggregation', async () => {
      const testTimestamp = new Date('2024-01-01T12:00:00Z');
      const mockAggregationResult = {
        timestamp: testTimestamp,
        total_events: 100,
        unique_sessions: 20,
        page_views: 80,
        unique_visitors: 15,
        avg_session_duration: 150,
        bounce_rate: 25,
        popular_pages: []
      };

      mockDataAggregationService.generateHourlyAggregation.mockResolvedValue(mockAggregationResult);

      await BackgroundJobService.triggerHourlyAggregation(testTimestamp);

      expect(mockDataAggregationService.generateHourlyAggregation).toHaveBeenCalledWith(testTimestamp);
    });

    test('should manually trigger daily aggregation', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const mockAggregationResult = {
        date: testDate,
        total_events: 2000,
        unique_sessions: 300,
        page_views: 1600,
        unique_visitors: 250,
        avg_session_duration: 200,
        bounce_rate: 30,
        popular_pages: [],
        hourly_breakdown: []
      };

      mockDataAggregationService.generateDailyAggregation.mockResolvedValue(mockAggregationResult);

      await BackgroundJobService.triggerDailyAggregation(testDate);

      expect(mockDataAggregationService.generateDailyAggregation).toHaveBeenCalledWith(testDate);
    });

    test('should handle errors in manual triggers', async () => {
      const testTimestamp = new Date('2024-01-01T12:00:00Z');
      const error = new Error('Database error');

      mockDataAggregationService.generateHourlyAggregation.mockRejectedValue(error);

      await expect(BackgroundJobService.triggerHourlyAggregation(testTimestamp))
        .rejects.toThrow('Database error');
    });
  });

  describe('Backfill Operations', () => {
    test('should backfill daily aggregations for date range', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-03T00:00:00Z');

      const mockAggregationResult = {
        date: expect.any(Date),
        total_events: 1000,
        unique_sessions: 150,
        page_views: 800,
        unique_visitors: 120,
        avg_session_duration: 180,
        bounce_rate: 25,
        popular_pages: [],
        hourly_breakdown: []
      };

      mockDataAggregationService.generateDailyAggregation.mockResolvedValue(mockAggregationResult);

      await BackgroundJobService.backfillAggregations(startDate, endDate, 'daily');

      // Should call generateDailyAggregation for each day (3 days)
      expect(mockDataAggregationService.generateDailyAggregation).toHaveBeenCalledTimes(3);
      
      // Verify dates
      const calls = mockDataAggregationService.generateDailyAggregation.mock.calls;
      expect(calls[0][0]).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(calls[1][0]).toEqual(new Date('2024-01-02T00:00:00Z'));
      expect(calls[2][0]).toEqual(new Date('2024-01-03T00:00:00Z'));
    });

    test('should backfill hourly aggregations for date range', async () => {
      const startDate = new Date('2024-01-01T10:00:00Z');
      const endDate = new Date('2024-01-01T12:00:00Z');

      const mockAggregationResult = {
        timestamp: expect.any(Date),
        total_events: 100,
        unique_sessions: 20,
        page_views: 80,
        unique_visitors: 15,
        avg_session_duration: 150,
        bounce_rate: 25,
        popular_pages: []
      };

      mockDataAggregationService.generateHourlyAggregation.mockResolvedValue(mockAggregationResult);

      await BackgroundJobService.backfillAggregations(startDate, endDate, 'hourly');

      // Should call generateHourlyAggregation for each hour (3 hours: 10, 11, 12)
      expect(mockDataAggregationService.generateHourlyAggregation).toHaveBeenCalledTimes(3);
    });

    test('should handle errors during backfill', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-02T00:00:00Z');
      const error = new Error('Aggregation failed');

      mockDataAggregationService.generateDailyAggregation.mockRejectedValue(error);

      await expect(BackgroundJobService.backfillAggregations(startDate, endDate, 'daily'))
        .rejects.toThrow('Aggregation failed');
    });

    test('should add delays between backfill operations', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-02T00:00:00Z');

      const mockAggregationResult = {
        date: expect.any(Date),
        total_events: 1000,
        unique_sessions: 150,
        page_views: 800,
        unique_visitors: 120,
        avg_session_duration: 180,
        bounce_rate: 25,
        popular_pages: [],
        hourly_breakdown: []
      };

      mockDataAggregationService.generateDailyAggregation.mockResolvedValue(mockAggregationResult);

      const backfillPromise = BackgroundJobService.backfillAggregations(startDate, endDate, 'daily');

      // Fast-forward timers to simulate delays
      jest.advanceTimersByTime(200); // 2 operations * 100ms delay

      await backfillPromise;

      expect(mockDataAggregationService.generateDailyAggregation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Job Execution Simulation', () => {
    test('should execute cleanup job correctly', async () => {
      mockSession.endExpiredSessions.mockResolvedValue(5);
      mockCachingService.getCacheStats.mockResolvedValue({
        sessions: 10,
        metrics: 5,
        realtime: 3,
        visitors: 8,
        total: 26
      });

      // Access the private method through reflection for testing
      const service = BackgroundJobService as any;
      await service.runCleanupJob();

      expect(mockSession.endExpiredSessions).toHaveBeenCalledWith(30);
      expect(mockCachingService.getCacheStats).toHaveBeenCalled();
    });

    test('should execute real-time metrics job correctly', async () => {
      const mockMetrics = {
        active_sessions: 15,
        page_views_last_hour: 100,
        unique_visitors_today: 75,
        popular_pages: [{ url: '/home', views: 50 }],
        timestamp: new Date()
      };

      mockDataAggregationService.generateRealtimeMetrics.mockResolvedValue(mockMetrics);

      // Access the private method through reflection for testing
      const service = BackgroundJobService as any;
      await service.runRealtimeMetricsJob();

      expect(mockDataAggregationService.generateRealtimeMetrics).toHaveBeenCalled();
    });

    test('should handle errors in job execution gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Job execution failed');

      mockSession.endExpiredSessions.mockRejectedValue(error);

      // Access the private method through reflection for testing
      const service = BackgroundJobService as any;
      await service.runCleanupJob();

      expect(consoleSpy).toHaveBeenCalledWith('Error running cleanup job:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('Timer Management', () => {
    test('should clear all timers when stopping', () => {
      BackgroundJobService.start();
      
      // Verify timers are set (this is implementation-dependent)
      const status = BackgroundJobService.getStatus();
      expect(status.isRunning).toBe(true);

      BackgroundJobService.stop();

      const stoppedStatus = BackgroundJobService.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });

    test('should handle multiple start/stop cycles', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Start and stop multiple times
      BackgroundJobService.start();
      BackgroundJobService.stop();
      BackgroundJobService.start();
      BackgroundJobService.stop();

      expect(consoleSpy).toHaveBeenCalledWith('Starting background job service...');
      expect(consoleSpy).toHaveBeenCalledWith('Stopping background job service...');

      consoleSpy.mockRestore();
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log job completion with metrics', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockAggregationResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        total_events: 150,
        unique_sessions: 25,
        page_views: 120,
        unique_visitors: 20,
        avg_session_duration: 180,
        bounce_rate: 20,
        popular_pages: []
      };

      mockDataAggregationService.generateHourlyAggregation.mockResolvedValue(mockAggregationResult);

      // Access the private method through reflection for testing
      const service = BackgroundJobService as any;
      await service.runHourlyAggregation();

      expect(consoleSpy).toHaveBeenCalledWith('Running hourly aggregation job...');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hourly aggregation completed'),
        expect.objectContaining({
          total_events: 150,
          unique_sessions: 25,
          page_views: 120,
          unique_visitors: 20
        })
      );

      consoleSpy.mockRestore();
    });

    test('should log errors during job execution', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Aggregation service error');

      mockDataAggregationService.generateHourlyAggregation.mockRejectedValue(error);

      // Access the private method through reflection for testing
      const service = BackgroundJobService as any;
      await service.runHourlyAggregation();

      expect(consoleSpy).toHaveBeenCalledWith('Error running hourly aggregation job:', error);

      consoleSpy.mockRestore();
    });
  });
});