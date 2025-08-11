import express, { Request, Response } from 'express';
import { Event } from '../models/Event';
import { PageView } from '../models/PageView';
import { EventType, ApiResponse } from '../types';
import { CachingService } from '../services/CachingService';

const router = express.Router();

/**
 * Helper function to extract client information from request
 */
function extractClientInfo(req: Request) {
  return {
    user_agent: req.get('User-Agent') || null,
    ip_address: req.ip || req.connection.remoteAddress || null,
    referrer: req.get('Referer') || null
  };
}

/**
 * POST /api/track/event
 * Track custom events
 */
router.post('/event', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      session_id,
      event_type,
      url,
      url_hash,
      properties,
      timestamp
    } = req.body;

    // Validate required fields
    if (!session_id) {
      res.status(400).json({
        success: false,
        error: 'Session ID is required'
      } as ApiResponse);
      return;
    }

    if (!event_type) {
      res.status(400).json({
        success: false,
        error: 'Event type is required'
      } as ApiResponse);
      return;
    }

    if (!url) {
      res.status(400).json({
        success: false,
        error: 'URL is required'
      } as ApiResponse);
      return;
    }

    // Extract client information
    const clientInfo = extractClientInfo(req);

    // Prepare event data
    const eventData = {
      session_id,
      event_type,
      url,
      url_hash: url_hash || null,
      properties: properties || null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ...clientInfo
    };

    // Create the event
    const event = await Event.create(eventData);

    // Update real-time caching
    if (event_type === EventType.PAGE_VIEW) {
      await CachingService.incrementPageView(url);
    }
    
    // Track active session
    await CachingService.trackActiveSession(session_id);

    res.status(201).json({
      success: true,
      data: {
        event_id: event.id,
        session_id: event.session_id,
        event_type: event.event_type,
        timestamp: event.timestamp
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Event tracking error:', error);
    const message = error instanceof Error ? error.message : 'Failed to track event';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

/**
 * POST /api/track/page
 * Track page views
 */
router.post('/page', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      session_id,
      url,
      url_hash,
      title,
      load_time,
      scroll_depth,
      time_on_page,
      exit_page,
      timestamp
    } = req.body;

    // Validate required fields
    if (!session_id) {
      res.status(400).json({
        success: false,
        error: 'Session ID is required'
      } as ApiResponse);
      return;
    }

    if (!url) {
      res.status(400).json({
        success: false,
        error: 'URL is required'
      } as ApiResponse);
      return;
    }

    // Extract client information
    const clientInfo = extractClientInfo(req);

    // Prepare page view data
    const pageViewData = {
      session_id,
      url,
      url_hash: url_hash || null,
      title: title || null,
      load_time: load_time || null,
      scroll_depth: scroll_depth || null,
      time_on_page: time_on_page || null,
      exit_page: exit_page || false,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    // Create the page view
    const pageView = await PageView.create(pageViewData);

    // Also create a page_view event for consistency
    const eventData = {
      session_id,
      event_type: EventType.PAGE_VIEW,
      url,
      url_hash: url_hash || null,
      properties: {
        title: title || null,
        load_time: load_time || null,
        scroll_depth: scroll_depth || null,
        time_on_page: time_on_page || null,
        exit_page: exit_page || false
      },
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ...clientInfo
    };

    const event = await Event.create(eventData);

    // Update real-time caching for page view
    await CachingService.incrementPageView(url);
    await CachingService.trackActiveSession(session_id);

    res.status(201).json({
      success: true,
      data: {
        page_view_id: pageView.id,
        event_id: event.id,
        session_id: pageView.session_id,
        url: pageView.url,
        timestamp: pageView.timestamp
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Page tracking error:', error);
    const message = error instanceof Error ? error.message : 'Failed to track page view';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

/**
 * POST /api/track/batch
 * Track multiple events in batch
 */
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { events } = req.body;

    // Validate batch data
    if (!events || !Array.isArray(events)) {
      res.status(400).json({
        success: false,
        error: 'Events array is required'
      } as ApiResponse);
      return;
    }

    if (events.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Events array cannot be empty'
      } as ApiResponse);
      return;
    }

    if (events.length > 100) {
      res.status(400).json({
        success: false,
        error: 'Batch size cannot exceed 100 events'
      } as ApiResponse);
      return;
    }

    // Extract client information
    const clientInfo = extractClientInfo(req);

    // Process events and separate page views from regular events
    const eventsToCreate: any[] = [];
    const pageViewsToCreate: any[] = [];

    for (let i = 0; i < events.length; i++) {
      const eventData = events[i];

      // Validate required fields for each event
      if (!eventData.session_id) {
        res.status(400).json({
          success: false,
          error: `Event at index ${i}: Session ID is required`
        } as ApiResponse);
        return;
      }

      if (!eventData.event_type) {
        res.status(400).json({
          success: false,
          error: `Event at index ${i}: Event type is required`
        } as ApiResponse);
        return;
      }

      if (!eventData.url) {
        res.status(400).json({
          success: false,
          error: `Event at index ${i}: URL is required`
        } as ApiResponse);
        return;
      }

      // Prepare event data with client info
      const processedEvent = {
        session_id: eventData.session_id,
        event_type: eventData.event_type,
        url: eventData.url,
        url_hash: eventData.url_hash || null,
        properties: eventData.properties || null,
        timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
        ...clientInfo
      };

      eventsToCreate.push(processedEvent);

      // If this is a page view event, also create a page view record
      if (eventData.event_type === EventType.PAGE_VIEW) {
        const pageViewData = {
          session_id: eventData.session_id,
          url: eventData.url,
          url_hash: eventData.url_hash || null,
          title: eventData.properties?.title || null,
          load_time: eventData.properties?.load_time || null,
          scroll_depth: eventData.properties?.scroll_depth || null,
          time_on_page: eventData.properties?.time_on_page || null,
          exit_page: eventData.properties?.exit_page || false,
          timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date()
        };

        pageViewsToCreate.push(pageViewData);
      }
    }

    // Create events in batch
    const createdEvents = await Event.createBatch(eventsToCreate);

    // Create page views if any
    let createdPageViews: any[] = [];
    if (pageViewsToCreate.length > 0) {
      // Create page views one by one since we don't have a batch method for PageView
      for (const pageViewData of pageViewsToCreate) {
        try {
          const pageView = await PageView.create(pageViewData);
          createdPageViews.push(pageView);
        } catch (error) {
          console.error('Error creating page view in batch:', error);
          // Continue with other page views even if one fails
        }
      }
    }

    // Update real-time caching for batch events
    const uniqueSessions = new Set<string>();
    for (const event of eventsToCreate) {
      uniqueSessions.add(event.session_id);
      
      if (event.event_type === EventType.PAGE_VIEW) {
        await CachingService.incrementPageView(event.url);
      }
    }

    // Track active sessions
    for (const sessionId of uniqueSessions) {
      await CachingService.trackActiveSession(sessionId);
    }

    res.status(201).json({
      success: true,
      data: {
        events_created: createdEvents.length,
        page_views_created: createdPageViews.length,
        total_processed: events.length,
        events: createdEvents.map(event => ({
          event_id: event.id,
          session_id: event.session_id,
          event_type: event.event_type,
          timestamp: event.timestamp
        })),
        page_views: createdPageViews.map(pv => ({
          page_view_id: pv.id,
          session_id: pv.session_id,
          url: pv.url,
          timestamp: pv.timestamp
        }))
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Batch tracking error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process batch events';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

export default router;