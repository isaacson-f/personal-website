const Joi = require('joi');
const BaseModel = require('./BaseModel');

/**
 * Visitor model for tracking unique website visitors
 */
class Visitor extends BaseModel {
  constructor(data = {}) {
    super(data);
  }

  /**
   * Joi validation schema for visitor data
   */
  static get schema() {
    return Joi.object({
      id: Joi.string().max(255).required(),
      cookie_id: Joi.string().max(255).allow(null),
      first_visit: Joi.date().required(),
      last_visit: Joi.date().required(),
      total_sessions: Joi.number().integer().min(0).default(1),
      total_page_views: Joi.number().integer().min(0).default(0),
      browser_fingerprint: Joi.string().max(255).allow(null),
      created_at: Joi.date().default(() => new Date())
    });
  }

  /**
   * Create a new visitor record
   * @param {Object} visitorData - Visitor data
   * @returns {Object} Created visitor
   */
  static async create(visitorData) {
    // Validate input data
    const validation = this.validate(this.schema, visitorData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const data = validation.value;
    
    // Sanitize data
    data.id = this.sanitizeString(data.id);
    data.cookie_id = data.cookie_id ? this.sanitizeString(data.cookie_id) : null;
    data.browser_fingerprint = data.browser_fingerprint ? this.sanitizeString(data.browser_fingerprint) : null;

    const sql = `
      INSERT INTO analytics_visitors (
        id, cookie_id, first_visit, last_visit, total_sessions, 
        total_page_views, browser_fingerprint, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const params = [
      data.id,
      data.cookie_id,
      data.first_visit,
      data.last_visit,
      data.total_sessions,
      data.total_page_views,
      data.browser_fingerprint,
      data.created_at
    ];

    const result = await this.executeQuery(sql, params);
    return result.rows[0];
  }

  /**
   * Find visitor by ID
   * @param {string} id - Visitor ID
   * @returns {Object|null} Visitor data or null
   */
  static async findById(id) {
    if (!id) return null;

    const sql = 'SELECT * FROM analytics_visitors WHERE id = $1';
    const result = await this.executeQuery(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find visitor by cookie ID
   * @param {string} cookieId - Cookie ID
   * @returns {Object|null} Visitor data or null
   */
  static async findByCookieId(cookieId) {
    if (!cookieId) return null;

    const sql = 'SELECT * FROM analytics_visitors WHERE cookie_id = $1';
    const result = await this.executeQuery(sql, [cookieId]);
    return result.rows[0] || null;
  }

  /**
   * Find visitor by browser fingerprint
   * @param {string} fingerprint - Browser fingerprint
   * @returns {Object|null} Visitor data or null
   */
  static async findByFingerprint(fingerprint) {
    if (!fingerprint) return null;

    const sql = 'SELECT * FROM analytics_visitors WHERE browser_fingerprint = $1';
    const result = await this.executeQuery(sql, [fingerprint]);
    return result.rows[0] || null;
  }

  /**
   * Update visitor statistics
   * @param {string} id - Visitor ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated visitor
   */
  static async update(id, updates) {
    if (!id) throw new Error('Visitor ID is required');

    // Validate updates
    const allowedFields = ['last_visit', 'total_sessions', 'total_page_views'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        updateData[field] = updates[field];
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
   * @param {string} id - Visitor ID
   * @returns {Object} Updated visitor
   */
  static async incrementSessions(id) {
    if (!id) throw new Error('Visitor ID is required');

    const sql = `
      UPDATE analytics_visitors 
      SET total_sessions = total_sessions + 1,
          last_visit = NOW()
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
   * @param {string} id - Visitor ID
   * @param {number} count - Number of page views to add (default: 1)
   * @returns {Object} Updated visitor
   */
  static async incrementPageViews(id, count = 1) {
    if (!id) throw new Error('Visitor ID is required');

    const sql = `
      UPDATE analytics_visitors 
      SET total_page_views = total_page_views + $2,
          last_visit = NOW()
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
   * @param {Object} filters - Optional filters
   * @returns {Object} Visitor statistics
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
   * @param {Date} beforeDate - Delete records before this date
   * @returns {number} Number of deleted records
   */
  static async deleteOldRecords(beforeDate) {
    if (!beforeDate) throw new Error('Before date is required');

    const sql = 'DELETE FROM analytics_visitors WHERE created_at < $1';
    const result = await this.executeQuery(sql, [beforeDate]);
    return result.rowCount;
  }
}

module.exports = Visitor;