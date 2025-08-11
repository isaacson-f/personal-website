"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const joi_1 = __importDefault(require("joi"));
const BaseModel_1 = require("./BaseModel");
/**
 * Session model for tracking user sessions
 */
class Session extends BaseModel_1.BaseModel {
    constructor(data = {}) {
        super(data);
    }
    /**
     * Joi validation schema for session data
     */
    static get schema() {
        return joi_1.default.object({
            id: joi_1.default.string().max(255).required(),
            visitor_id: joi_1.default.string().max(255).allow(null),
            cookie_id: joi_1.default.string().max(255).allow(null),
            start_time: joi_1.default.date().required(),
            end_time: joi_1.default.date().allow(null),
            page_views: joi_1.default.number().integer().min(0).default(0),
            duration_seconds: joi_1.default.number().integer().min(0).allow(null),
            browser_fingerprint: joi_1.default.string().max(255).allow(null),
            device_info: joi_1.default.object().allow(null),
            geographic_data: joi_1.default.object().allow(null),
            is_returning_visitor: joi_1.default.boolean().default(false),
            created_at: joi_1.default.date().default(() => new Date())
        });
    }
    /**
     * Create a new session record
     */
    static async create(sessionData) {
        // Validate input data
        const validation = this.validate(this.schema, sessionData);
        if (!validation.isValid) {
            throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const data = validation.value;
        // Sanitize data
        data.id = this.sanitizeString(data.id) || '';
        data.visitor_id = data.visitor_id ? this.sanitizeString(data.visitor_id) : null;
        data.cookie_id = data.cookie_id ? this.sanitizeString(data.cookie_id) : null;
        data.browser_fingerprint = data.browser_fingerprint ? this.sanitizeString(data.browser_fingerprint) : null;
        const sql = `
      INSERT INTO analytics_sessions (
        id, visitor_id, cookie_id, start_time, end_time, page_views,
        duration_seconds, browser_fingerprint, device_info, geographic_data,
        is_returning_visitor, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
        const params = [
            data.id,
            data.visitor_id,
            data.cookie_id,
            data.start_time,
            data.end_time,
            data.page_views,
            data.duration_seconds,
            data.browser_fingerprint,
            JSON.stringify(data.device_info),
            JSON.stringify(data.geographic_data),
            data.is_returning_visitor,
            data.created_at
        ];
        const result = await this.executeQuery(sql, params);
        return result.rows[0];
    }
    /**
     * Find session by ID
     */
    static async findById(id) {
        if (!id)
            return null;
        const sql = 'SELECT * FROM analytics_sessions WHERE id = $1';
        const result = await this.executeQuery(sql, [id]);
        return result.rows[0] || null;
    }
    /**
     * Find active sessions for a visitor
     */
    static async findActiveByVisitor(visitorId) {
        if (!visitorId)
            return [];
        const sql = `
      SELECT * FROM analytics_sessions 
      WHERE visitor_id = $1 AND end_time IS NULL
      ORDER BY start_time DESC
    `;
        const result = await this.executeQuery(sql, [visitorId]);
        return result.rows;
    }
    /**
     * Find sessions by visitor ID
     */
    static async findByVisitor(visitorId, options = {}) {
        if (!visitorId)
            return [];
        let sql = 'SELECT * FROM analytics_sessions WHERE visitor_id = $1';
        const params = [visitorId];
        if (options.limit) {
            params.push(options.limit);
            sql += ` ORDER BY start_time DESC LIMIT $${params.length}`;
        }
        const result = await this.executeQuery(sql, params);
        return result.rows;
    }
    /**
     * Update session data
     */
    static async update(id, updates) {
        if (!id)
            throw new Error('Session ID is required');
        // Validate updates
        const allowedFields = [
            'end_time', 'page_views', 'duration_seconds',
            'device_info', 'geographic_data'
        ];
        const updateData = {};
        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                if (field === 'device_info' || field === 'geographic_data') {
                    updateData[field] = JSON.stringify(updates[field]);
                }
                else {
                    updateData[field] = updates[field];
                }
            }
        }
        if (Object.keys(updateData).length === 0) {
            throw new Error('No valid fields to update');
        }
        // Build dynamic SQL
        const setClause = Object.keys(updateData)
            .map((field, index) => `${field} = $${index + 2}`)
            .join(', ');
        const sql = `
      UPDATE analytics_sessions 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
        const params = [id, ...Object.values(updateData)];
        const result = await this.executeQuery(sql, params);
        if (result.rows.length === 0) {
            throw new Error('Session not found');
        }
        return result.rows[0];
    }
    /**
     * End a session
     */
    static async endSession(id, endTime = null) {
        if (!id)
            throw new Error('Session ID is required');
        const actualEndTime = endTime || new Date();
        // Calculate duration
        const session = await this.findById(id);
        if (!session) {
            throw new Error('Session not found');
        }
        const startTime = new Date(session.start_time);
        const durationSeconds = Math.floor((actualEndTime.getTime() - startTime.getTime()) / 1000);
        const sql = `
      UPDATE analytics_sessions 
      SET end_time = $2, duration_seconds = $3
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.executeQuery(sql, [id, actualEndTime, durationSeconds]);
        return result.rows[0];
    }
    /**
     * Increment page view count for session
     */
    static async incrementPageViews(id, count = 1) {
        if (!id)
            throw new Error('Session ID is required');
        const sql = `
      UPDATE analytics_sessions 
      SET page_views = page_views + $2
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.executeQuery(sql, [id, count]);
        if (result.rows.length === 0) {
            throw new Error('Session not found');
        }
        return result.rows[0];
    }
    /**
     * Get session statistics
     */
    static async getStatistics(filters = {}) {
        let whereClause = '';
        const params = [];
        if (filters.dateFrom) {
            params.push(filters.dateFrom);
            whereClause += ` AND start_time >= $${params.length}`;
        }
        if (filters.dateTo) {
            params.push(filters.dateTo);
            whereClause += ` AND start_time <= $${params.length}`;
        }
        const sql = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN is_returning_visitor = true THEN 1 END) as returning_visitor_sessions,
        AVG(CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds END) as avg_duration_seconds,
        AVG(page_views) as avg_page_views_per_session,
        MAX(start_time) as last_session_start
      FROM analytics_sessions 
      WHERE 1=1 ${whereClause}
    `;
        const result = await this.executeQuery(sql, params);
        return result.rows[0];
    }
    /**
     * Get active sessions count
     */
    static async getActiveSessionsCount() {
        const sql = 'SELECT COUNT(*) as count FROM analytics_sessions WHERE end_time IS NULL';
        const result = await this.executeQuery(sql);
        return parseInt(result.rows[0].count);
    }
    /**
     * End expired sessions (sessions without activity for specified minutes)
     */
    static async endExpiredSessions(timeoutMinutes = 30) {
        const timeoutDate = new Date(Date.now() - (timeoutMinutes * 60 * 1000));
        const sql = `
      UPDATE analytics_sessions 
      SET end_time = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
      WHERE end_time IS NULL 
        AND start_time < $1
      RETURNING id
    `;
        const result = await this.executeQuery(sql, [timeoutDate]);
        return result.rowCount || 0;
    }
    /**
     * Delete old session records (for data retention)
     */
    static async deleteOldRecords(beforeDate) {
        if (!beforeDate)
            throw new Error('Before date is required');
        const sql = 'DELETE FROM analytics_sessions WHERE created_at < $1';
        const result = await this.executeQuery(sql, [beforeDate]);
        return result.rowCount || 0;
    }
}
exports.Session = Session;
//# sourceMappingURL=Session.js.map