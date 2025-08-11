"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Event_1 = require("../models/Event");
const PageView_1 = require("../models/PageView");
const types_1 = require("../types");
const router = express_1.default.Router();
/**
 * Helper function to extract client information from request
 */
function extractClientInfo(req) {
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
router.post('/event', async (req, res) => {
    try {
        const { session_id, event_type, url, url_hash, properties, timestamp } = req.body;
        // Validate required fields
        if (!session_id) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        if (!event_type) {
            res.status(400).json({
                success: false,
                error: 'Event type is required'
            });
            return;
        }
        if (!url) {
            res.status(400).json({
                success: false,
                error: 'URL is required'
            });
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
        const event = await Event_1.Event.create(eventData);
        res.status(201).json({
            success: true,
            data: {
                event_id: event.id,
                session_id: event.session_id,
                event_type: event.event_type,
                timestamp: event.timestamp
            }
        });
    }
    catch (error) {
        console.error('Event tracking error:', error);
        const message = error instanceof Error ? error.message : 'Failed to track event';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
/**
 * POST /api/track/page
 * Track page views
 */
router.post('/page', async (req, res) => {
    try {
        const { session_id, url, url_hash, title, load_time, scroll_depth, time_on_page, exit_page, timestamp } = req.body;
        // Validate required fields
        if (!session_id) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        if (!url) {
            res.status(400).json({
                success: false,
                error: 'URL is required'
            });
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
        const pageView = await PageView_1.PageView.create(pageViewData);
        // Also create a page_view event for consistency
        const eventData = {
            session_id,
            event_type: types_1.EventType.PAGE_VIEW,
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
        const event = await Event_1.Event.create(eventData);
        res.status(201).json({
            success: true,
            data: {
                page_view_id: pageView.id,
                event_id: event.id,
                session_id: pageView.session_id,
                url: pageView.url,
                timestamp: pageView.timestamp
            }
        });
    }
    catch (error) {
        console.error('Page tracking error:', error);
        const message = error instanceof Error ? error.message : 'Failed to track page view';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
/**
 * POST /api/track/batch
 * Track multiple events in batch
 */
router.post('/batch', async (req, res) => {
    try {
        const { events } = req.body;
        // Validate batch data
        if (!events || !Array.isArray(events)) {
            res.status(400).json({
                success: false,
                error: 'Events array is required'
            });
            return;
        }
        if (events.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Events array cannot be empty'
            });
            return;
        }
        if (events.length > 100) {
            res.status(400).json({
                success: false,
                error: 'Batch size cannot exceed 100 events'
            });
            return;
        }
        // Extract client information
        const clientInfo = extractClientInfo(req);
        // Process events and separate page views from regular events
        const eventsToCreate = [];
        const pageViewsToCreate = [];
        for (let i = 0; i < events.length; i++) {
            const eventData = events[i];
            // Validate required fields for each event
            if (!eventData.session_id) {
                res.status(400).json({
                    success: false,
                    error: `Event at index ${i}: Session ID is required`
                });
                return;
            }
            if (!eventData.event_type) {
                res.status(400).json({
                    success: false,
                    error: `Event at index ${i}: Event type is required`
                });
                return;
            }
            if (!eventData.url) {
                res.status(400).json({
                    success: false,
                    error: `Event at index ${i}: URL is required`
                });
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
            if (eventData.event_type === types_1.EventType.PAGE_VIEW) {
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
        const createdEvents = await Event_1.Event.createBatch(eventsToCreate);
        // Create page views if any
        let createdPageViews = [];
        if (pageViewsToCreate.length > 0) {
            // Create page views one by one since we don't have a batch method for PageView
            for (const pageViewData of pageViewsToCreate) {
                try {
                    const pageView = await PageView_1.PageView.create(pageViewData);
                    createdPageViews.push(pageView);
                }
                catch (error) {
                    console.error('Error creating page view in batch:', error);
                    // Continue with other page views even if one fails
                }
            }
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
        });
    }
    catch (error) {
        console.error('Batch tracking error:', error);
        const message = error instanceof Error ? error.message : 'Failed to process batch events';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
exports.default = router;
//# sourceMappingURL=tracking.js.map