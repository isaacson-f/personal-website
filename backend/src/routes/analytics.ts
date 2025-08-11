import { Router, Request, Response } from 'express';
import { DataAggregationService } from '../services/DataAggregationService';
import { CachingService } from '../services/CachingService';
import { BackgroundJobService } from '../services/BackgroundJobService';
import { Event } from '../models/Event';
import { Session } from '../models/Session';
import { PageView } from '../models/PageView';
import { FilterOptions } from '../types';

const router = Router();

/**
 * Get real-time analytics metrics
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const metrics = await DataAggregationService.getRealtimeMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve real-time metrics'
    });
  }
});

/**
 * Get summary analytics for a date range
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, eventType, url } = req.query;

    // Validate required parameters
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo parameters are required'
      });
    }

    const filters: FilterOptions & { dateFrom: Date; dateTo: Date } = {
      dateFrom: new Date(dateFrom as string),
      dateTo: new Date(dateTo as string),
      ...(eventType && { eventType: eventType as any }),
      ...(url && { url: url as string })
    };

    // Validate dates
    if (isNaN(filters.dateFrom.getTime()) || isNaN(filters.dateTo.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
      });
    }

    if (filters.dateFrom > filters.dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom must be before dateTo'
      });
    }

    const summary = await DataAggregationService.generateSummaryStats(filters);
    
    res.json({
      success: true,
      data: summary,
      filters: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        eventType: filters.eventType,
        url: filters.url
      }
    });
  } catch (error) {
    console.error('Error getting summary analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary analytics'
    });
  }
});

/**
 * Get hourly aggregation for a specific hour
 */
router.get('/hourly/:timestamp', async (req: Request, res: Response) => {
  try {
    const { timestamp } = req.params;
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timestamp format. Use ISO 8601 format'
      });
    }

    const aggregation = await DataAggregationService.getHourlyAggregation(date);
    
    res.json({
      success: true,
      data: aggregation
    });
  } catch (error) {
    console.error('Error getting hourly aggregation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hourly aggregation'
    });
  }
});

/**
 * Get daily aggregation for a specific date
 */
router.get('/daily/:date', async (req: Request, res: Response) => {
  try {
    const { date: dateParam } = req.params;
    const date = new Date(dateParam);

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }

    const aggregation = await DataAggregationService.getDailyAggregation(date);
    
    res.json({
      success: true,
      data: aggregation
    });
  } catch (error) {
    console.error('Error getting daily aggregation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily aggregation'
    });
  }
});

/**
 * Get events with filtering and pagination
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { 
      eventType, 
      url, 
      dateFrom, 
      dateTo, 
      sessionId, 
      limit = '50', 
      offset = '0' 
    } = req.query;

    const filters: FilterOptions & { limit?: number; offset?: number } = {
      ...(eventType && { eventType: eventType as any }),
      ...(url && { url: url as string }),
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      ...(sessionId && { sessionId: sessionId as string }),
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    };

    // Validate dates if provided
    if (filters.dateFrom && isNaN(filters.dateFrom.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateFrom format'
      });
    }

    if (filters.dateTo && isNaN(filters.dateTo.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateTo format'
      });
    }

    const events = await Event.findByFilters(filters);
    const statistics = await Event.getStatistics(filters);
    
    res.json({
      success: true,
      data: {
        events,
        statistics,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: statistics.total_events
        }
      }
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve events'
    });
  }
});

/**
 * Get sessions with filtering and pagination
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const filters: FilterOptions = {
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) })
    };

    // Validate dates if provided
    if (filters.dateFrom && isNaN(filters.dateFrom.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateFrom format'
      });
    }

    if (filters.dateTo && isNaN(filters.dateTo.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateTo format'
      });
    }

    const statistics = await Session.getStatistics(filters);
    const activeSessionsCount = await CachingService.getActiveSessionsCount();
    
    res.json({
      success: true,
      data: {
        statistics: {
          ...statistics,
          active_sessions: activeSessionsCount
        }
      }
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions'
    });
  }
});

/**
 * Get popular pages
 */
router.get('/pages/popular', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, limit = '20' } = req.query;

    const filters: FilterOptions & { limit?: number } = {
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      limit: parseInt(limit as string, 10)
    };

    // Validate dates if provided
    if (filters.dateFrom && isNaN(filters.dateFrom.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateFrom format'
      });
    }

    if (filters.dateTo && isNaN(filters.dateTo.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateTo format'
      });
    }

    const popularPages = await PageView.getPopularPages(filters);
    
    res.json({
      success: true,
      data: popularPages
    });
  } catch (error) {
    console.error('Error getting popular pages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve popular pages'
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = await CachingService.getCacheStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics'
    });
  }
});

/**
 * Clear cache (admin endpoint)
 */
router.delete('/cache', async (req: Request, res: Response) => {
  try {
    await CachingService.clearAllCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Manually trigger aggregation jobs (admin endpoints)
 */
router.post('/jobs/hourly/:timestamp', async (req: Request, res: Response) => {
  try {
    const { timestamp } = req.params;
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timestamp format'
      });
    }

    await BackgroundJobService.triggerHourlyAggregation(date);
    
    res.json({
      success: true,
      message: `Hourly aggregation triggered for ${date.toISOString()}`
    });
  } catch (error) {
    console.error('Error triggering hourly aggregation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger hourly aggregation'
    });
  }
});

router.post('/jobs/daily/:date', async (req: Request, res: Response) => {
  try {
    const { date: dateParam } = req.params;
    const date = new Date(dateParam);

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    await BackgroundJobService.triggerDailyAggregation(date);
    
    res.json({
      success: true,
      message: `Daily aggregation triggered for ${date.toISOString().substring(0, 10)}`
    });
  } catch (error) {
    console.error('Error triggering daily aggregation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger daily aggregation'
    });
  }
});

/**
 * Backfill aggregations for a date range (admin endpoint)
 */
router.post('/jobs/backfill', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type = 'daily' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before endDate'
      });
    }

    if (type !== 'hourly' && type !== 'daily') {
      return res.status(400).json({
        success: false,
        error: 'type must be either "hourly" or "daily"'
      });
    }

    // Run backfill asynchronously
    BackgroundJobService.backfillAggregations(start, end, type as 'hourly' | 'daily')
      .catch(error => console.error('Backfill error:', error));
    
    res.json({
      success: true,
      message: `${type} backfill started for ${start.toISOString()} to ${end.toISOString()}`
    });
  } catch (error) {
    console.error('Error starting backfill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start backfill'
    });
  }
});

/**
 * Get background job status
 */
router.get('/jobs/status', (req: Request, res: Response) => {
  try {
    const status = BackgroundJobService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve job status'
    });
  }
});

export default router;