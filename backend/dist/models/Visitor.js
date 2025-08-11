"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Visitor = void 0;
const joi_1 = __importDefault(require("joi"));
const BaseModel_1 = require("./BaseModel");
/**
 * Visitor model for tracking unique website visitors
 */
class Visitor extends BaseModel_1.BaseModel {
    constructor(data = {}) {
        super(data);
    }
    /**
     * Joi validation schema for visitor data
     */
    static get schema() {
        return joi_1.default.object({
            id: joi_1.default.string().max(255).required(),
            first_visit: joi_1.default.date().required(),
            last_visit: joi_1.default.date().allow(null),
            total_sessions: joi_1.default.number().integer().min(0).default(1),
            total_page_views: joi_1.default.number().integer().min(0).default(0),
            user_agent: joi_1.default.string().max(1000).allow(null),
            ip_address: joi_1.default.string().ip().allow(null),
            geographic_data: joi_1.default.object().allow(null),
            device_info: joi_1.default.object().allow(null),
            created_at: joi_1.default.date().default(() => new Date()),
            updated_at: joi_1.default.date().default(() => new Date())
        });
    }
    /**
     * Create a new visitor record
     */
    static async create(visitorData) {
        // Validate input data
        const validation = this.validate(this.schema, visitorData);
        if (!validation.isValid) {
            throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const data = validation.value;
        // Sanitize data
        data.id = this.sanitizeString(data.id) || '';
        data.user_agent = data.user_agent ? this.sanitizeString(data.user_agent) : null;
        data.ip_address = this.validateIpAddress(data.ip_address);
        const sql = `
      INSERT INTO analytics_visitors (
        id, first_visit, last_visit, total_sessions, 
        total_page_views, user_agent, ip_address, 
        geographic_data, device_info, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
        const params = [
            data.id,
            data.first_visit,
            data.last_visit,
            data.total_sessions,
            data.total_page_views,
            data.user_agent,
            data.ip_address,
            JSON.stringify(data.geographic_data),
            JSON.stringify(data.device_info),
            data.created_at,
            data.updated_at
        ];
        const result = await this.executeQuery(sql, params);
        return result.rows[0];
    }
    /**
     * Find visitor by ID
     */
    static async findById(id) {
        if (!id)
            return null;
        const sql = 'SELECT * FROM analytics_visitors WHERE id = $1';
        const result = await this.executeQuery(sql, [id]);
        return result.rows[0] || null;
    }
    /**
     * Update visitor statistics
     */
    static async update(id, updates) {
        if (!id)
            throw new Error('Visitor ID is required');
        // Validate updates
        const allowedFields = ['last_visit', 'total_sessions', 'total_page_views', 'geographic_data', 'device_info'];
        const updateData = {};
        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                if (field === 'geographic_data' || field === 'device_info') {
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
        // Add updated_at timestamp
        updateData['updated_at'] = new Date();
        // Build dynamic SQL
        const setClause = Object.keys(updateData)
            .map((field, index) => `${field} = $${index + 2}`)
            .join(', ');
        const sql = `
      UPDATE analytics_visitors 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
        const params = [id, ...Object.values(updateData)];
        const result = await this.executeQuery(sql, params);
        if (result.rows.length === 0) {
            throw new Error('Visitor not found');
        }
        return result.rows[0];
    }
    /**
     * Increment session count for visitor
     */
    static async incrementSessions(id) {
        if (!id)
            throw new Error('Visitor ID is required');
        const sql = `
      UPDATE analytics_visitors 
      SET total_sessions = total_sessions + 1,
          last_visit = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.executeQuery(sql, [id]);
        if (result.rows.length === 0) {
            throw new Error('Visitor not found');
        }
        return result.rows[0];
    }
    /**
     * Increment page view count for visitor
     */
    static async incrementPageViews(id, count = 1) {
        if (!id)
            throw new Error('Visitor ID is required');
        const sql = `
      UPDATE analytics_visitors 
      SET total_page_views = total_page_views + $2,
          last_visit = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.executeQuery(sql, [id, count]);
        if (result.rows.length === 0) {
            throw new Error('Visitor not found');
        }
        return result.rows[0];
    }
    /**
     * Get visitor statistics
     */
    static async getStatistics(filters = {}) {
        let whereClause = '';
        const params = [];
        if (filters.dateFrom) {
            params.push(filters.dateFrom);
            whereClause += ` AND first_visit >= $${params.length}`;
        }
        if (filters.dateTo) {
            params.push(filters.dateTo);
            whereClause += ` AND first_visit <= $${params.length}`;
        }
        const sql = `
      SELECT 
        COUNT(*) as total_visitors,
        COUNT(CASE WHEN total_sessions > 1 THEN 1 END) as returning_visitors,
        AVG(total_sessions) as avg_sessions_per_visitor,
        AVG(total_page_views) as avg_page_views_per_visitor,
        MAX(last_visit) as last_activity
      FROM analytics_visitors 
      WHERE 1=1 ${whereClause}
    `;
        const result = await this.executeQuery(sql, params);
        return result.rows[0];
    }
    /**
     * Delete old visitor records (for data retention)
     */
    static async deleteOldRecords(beforeDate) {
        if (!beforeDate)
            throw new Error('Before date is required');
        const sql = 'DELETE FROM analytics_visitors WHERE created_at < $1';
        const result = await this.executeQuery(sql, [beforeDate]);
        return result.rowCount || 0;
    }
}
exports.Visitor = Visitor;
//# sourceMappingURL=Visitor.js.map