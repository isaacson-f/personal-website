import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../models/Session';
import { Visitor } from '../models/Visitor';
import { ApiResponse } from '../types';
import { CachingService } from '../services/CachingService';

const router = express.Router();

/**
 * POST /api/session/start
 * Initialize a new session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const {
      visitor_id,
      cookie_id,
      browser_fingerprint,
      device_info,
      geographic_data
    } = req.body;

    // Generate session ID
    const sessionId = uuidv4();
    const startTime = new Date();

    // Check if this is a returning visitor
    let isReturningVisitor = false;
    if (visitor_id) {
      const existingVisitor = await Visitor.findById(visitor_id);
      isReturningVisitor = !!existingVisitor;
    }

    // Create session data
    const sessionData = {
      id: sessionId,
      visitor_id: visitor_id || null,
      cookie_id: cookie_id || null,
      start_time: startTime,
      end_time: null,
      page_views: 0,
      duration_seconds: null,
      browser_fingerprint: browser_fingerprint || null,
      device_info: device_info || null,
      geographic_data: geographic_data || null,
      is_returning_visitor: isReturningVisitor
    };

    // Create the session
    const session = await Session.create(sessionData);

    // Cache session data and track as active
    await CachingService.cacheSession(session.id, session);
    await CachingService.trackActiveSession(session.id);

    // Cache visitor data if available
    if (visitor_id) {
      await CachingService.cacheVisitorData(visitor_id, {
        cookie_id: cookie_id || undefined,
        browser_fingerprint: browser_fingerprint || undefined,
        is_returning: isReturningVisitor,
        last_seen: startTime
      });
    }

    res.status(201).json({
      success: true,
      data: {
        session_id: session.id,
        visitor_id: session.visitor_id,
        start_time: session.start_time,
        is_returning_visitor: session.is_returning_visitor
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Session start error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start session';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

/**
 * PUT /api/session/update
 * Update session data
 */
router.put('/update', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, ...updates } = req.body;

    if (!session_id) {
      res.status(400).json({
        success: false,
        error: 'Session ID is required'
      } as ApiResponse);
      return;
    }

    // Validate that session exists
    const existingSession = await Session.findById(session_id);
    if (!existingSession) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      } as ApiResponse);
      return;
    }

    // Update the session
    const updatedSession = await Session.update(session_id, updates);

    // Update cached session data
    await CachingService.updateCachedSession(session_id, updates);
    await CachingService.trackActiveSession(session_id);

    res.json({
      success: true,
      data: {
        session_id: updatedSession.id,
        page_views: updatedSession.page_views,
        duration_seconds: updatedSession.duration_seconds,
        updated_at: new Date().toISOString()
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Session update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update session';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

/**
 * POST /api/session/end
 * End a session
 */
router.post('/end', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, end_time } = req.body;

    if (!session_id) {
      res.status(400).json({
        success: false,
        error: 'Session ID is required'
      } as ApiResponse);
      return;
    }

    // Validate that session exists
    const existingSession = await Session.findById(session_id);
    if (!existingSession) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      } as ApiResponse);
      return;
    }

    // Check if session is already ended
    if (existingSession.end_time) {
      res.status(400).json({
        success: false,
        error: 'Session is already ended'
      } as ApiResponse);
      return;
    }

    // End the session
    const endedSession = await Session.endSession(session_id, end_time ? new Date(end_time) : null);

    // Update cached session and remove from active sessions
    await CachingService.updateCachedSession(session_id, {
      end_time: endedSession.end_time,
      duration_seconds: endedSession.duration_seconds
    });

    res.json({
      success: true,
      data: {
        session_id: endedSession.id,
        start_time: endedSession.start_time,
        end_time: endedSession.end_time,
        duration_seconds: endedSession.duration_seconds,
        page_views: endedSession.page_views
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Session end error:', error);
    const message = error instanceof Error ? error.message : 'Failed to end session';
    res.status(400).json({
      success: false,
      error: message
    } as ApiResponse);
  }
});

/**
 * GET /api/session/:id
 * Get session details (for testing/debugging)
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Session ID is required'
      } as ApiResponse);
      return;
    }

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: session
    } as ApiResponse);

  } catch (error) {
    console.error('Session get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session'
    } as ApiResponse);
  }
});

export default router;