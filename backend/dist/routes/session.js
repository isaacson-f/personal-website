"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const Session_1 = require("../models/Session");
const Visitor_1 = require("../models/Visitor");
const router = express_1.default.Router();
/**
 * POST /api/session/start
 * Initialize a new session
 */
router.post('/start', async (req, res) => {
    try {
        const { visitor_id, cookie_id, browser_fingerprint, device_info, geographic_data } = req.body;
        // Generate session ID
        const sessionId = (0, uuid_1.v4)();
        const startTime = new Date();
        // Check if this is a returning visitor
        let isReturningVisitor = false;
        if (visitor_id) {
            const existingVisitor = await Visitor_1.Visitor.findById(visitor_id);
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
        const session = await Session_1.Session.create(sessionData);
        res.status(201).json({
            success: true,
            data: {
                session_id: session.id,
                visitor_id: session.visitor_id,
                start_time: session.start_time,
                is_returning_visitor: session.is_returning_visitor
            }
        });
    }
    catch (error) {
        console.error('Session start error:', error);
        const message = error instanceof Error ? error.message : 'Failed to start session';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
/**
 * PUT /api/session/update
 * Update session data
 */
router.put('/update', async (req, res) => {
    try {
        const { session_id, ...updates } = req.body;
        if (!session_id) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        // Validate that session exists
        const existingSession = await Session_1.Session.findById(session_id);
        if (!existingSession) {
            res.status(404).json({
                success: false,
                error: 'Session not found'
            });
            return;
        }
        // Update the session
        const updatedSession = await Session_1.Session.update(session_id, updates);
        res.json({
            success: true,
            data: {
                session_id: updatedSession.id,
                page_views: updatedSession.page_views,
                duration_seconds: updatedSession.duration_seconds,
                updated_at: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Session update error:', error);
        const message = error instanceof Error ? error.message : 'Failed to update session';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
/**
 * POST /api/session/end
 * End a session
 */
router.post('/end', async (req, res) => {
    try {
        const { session_id, end_time } = req.body;
        if (!session_id) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        // Validate that session exists
        const existingSession = await Session_1.Session.findById(session_id);
        if (!existingSession) {
            res.status(404).json({
                success: false,
                error: 'Session not found'
            });
            return;
        }
        // Check if session is already ended
        if (existingSession.end_time) {
            res.status(400).json({
                success: false,
                error: 'Session is already ended'
            });
            return;
        }
        // End the session
        const endedSession = await Session_1.Session.endSession(session_id, end_time ? new Date(end_time) : null);
        res.json({
            success: true,
            data: {
                session_id: endedSession.id,
                start_time: endedSession.start_time,
                end_time: endedSession.end_time,
                duration_seconds: endedSession.duration_seconds,
                page_views: endedSession.page_views
            }
        });
    }
    catch (error) {
        console.error('Session end error:', error);
        const message = error instanceof Error ? error.message : 'Failed to end session';
        res.status(400).json({
            success: false,
            error: message
        });
    }
});
/**
 * GET /api/session/:id
 * Get session details (for testing/debugging)
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        const session = await Session_1.Session.findById(id);
        if (!session) {
            res.status(404).json({
                success: false,
                error: 'Session not found'
            });
            return;
        }
        res.json({
            success: true,
            data: session
        });
    }
    catch (error) {
        console.error('Session get error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve session'
        });
    }
});
exports.default = router;
//# sourceMappingURL=session.js.map