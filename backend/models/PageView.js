const Joi = require('joi');
const BaseModel = require('./BaseModel');

/**
 * PageView model for tracking page view analytics
 */
class PageView extends BaseModel {
  constructor(data = {}) {
    super(data);
  }

  /**
   * Joi validation schema for page view data
   */
  static get schema() {
    return Joi.object({
      id: Joi.string().uuid().optional(),
      session_id: Joi.string().max(255).required(),
      url: Joi.string().max(2048).required(),
      url_hash: Joi.string().max(255).allow(null, ''),
      title: Joi.string().max(500).allow(null, ''),
      load_time: Joi.number().integer().min(0).allow(null),
      scroll_depth: Joi.number().integer().min(0).max(100).allow(null),
      time_on_page: Joi.number().integer().min(0).allow(null),
      exit_page: Joi.boolean().default(false),
      timestamp: Joi.date().default(() => new Date())
    });
  }

  /**
   * Create a new page view record
   * @param {Object} pageViewData - Page view data
   * @returns {Object} Created page view
   */
  static async create(pageViewData) {
    // Validate input data
    const validation = this.validate(this.schema, pageViewData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const data = validation.value;
    
    // Generate ID if not provided
    if (!data.id) {
      data.id = this.generateId();
    }

    // Sanitize data
    data.session_id = this.sanitizeString(data.session_id);
    data.url = this.sanitizeUrl(data.url);
    data.url_hash = data.url_hash ? this.sanitizeString(data.url_hash) : null;
    data.title = data.title ? this.sanitizeString(data.title) : null;

    const sql = `
      INSERT INTO analytics_page_views (
        id, session_id, url, url_hash, title, load_time,
        scroll_depth, time_on_page, exit_page, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const params = [
      data.id,
      data.session_id,
      data.url,
      data.url_hash,
      data.title,
      data.load_time,
      data.scroll_depth,
      data.time_on_page,
      data.exit_page,
      data.timestamp
    ];

    const result = await this.executeQuery(sql, params);
    return result.rows[0];
  }

  /**
   * Find page view by ID
   * @param {string} id - Page view ID
   * @returns {Object|null} Page view data or null
   */
  static async findById(id) {
    if (!id) return null;

    const sql = 'SELECT * FROM analytics_page_views WHERE id = $1';
    const result = await this.executeQuery(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find page views by session ID
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Array} Page views
   */
  static async findBySession(sessionId, options = {}) {
    if (!sessionId) return [];

    let sql = 'SELECT * FROM analytics_page_views WHERE session_id = $1';
    const params = [sessionId];

    if (options.limit) {
      params.push(options.limit);
      sql += ` ORDER BY timestamp DESC LIMIT $${params.length}`;
    } else {
      sql += ' ORDER BY timestamp ASC';
    }

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Update page view data (typically for scroll depth and time on page)
   * @param {string} id - Page view ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated page view
   */
  static async update(id, updates) {
    if (!id) throw new Error('Page view ID is required');

    // Validate updates
    const allowedFields = ['scroll_depth', 'time_on_page', 'exit_page'];
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
      UPDATE analytics_page_views 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const params = [id, ...Object.values(updateData)];
    const result = await this.executeQuery(sql, params);
    
    if (result.rows.length === 0) {
      throw new Error('Page view not found');
    }

    return result.rows[0];
  }

  /**
   * Mark page view as exit page
   * @param {string} id - Page view ID
   * @returns {Object} Updated page view
   */
  static async markAsExitPage(id) {
    if (!id) throw new Error('Page view ID is required');

    const sql = `
      UPDATE analytics_page_views 
      SET exit_page = true
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.executeQuery(sql, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Page view not found');
    }

    return result.rows[0];
  }

  /**
   * Get page view statistics
   * @param {Object} filters - Optional filters
   * @returns {Object} Page view statistics
   */
  static async getStatistics(filters = {}) {
    let whereClause = '';
    const params = [];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      whereClause += ` AND timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      whereClause += ` AND timestamp <= $${params.length}`;
    }

    if (filters.url) {
      params.push(filters.url);
      whereClause += ` AND url = $${params.length}`;
    }

    const sql = `
      SELECT 
        COUNT(*) as total_page_views,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT url) as unique_pages,
        AVG(CASE WHEN time_on_page IS NOT NULL THEN time_on_page END) as avg_time_on_page,
        AVG(CASE WHEN scroll_depth IS NOT NULL THEN scroll_depth END) as avg_scroll_depth,
        COUNT(CASE WHEN exit_page = true THEN 1 END) as exit_pages,
        AVG(CASE WHEN load_time IS NOT NULL THEN load_time END) as avg_load_time
      FROM analytics_page_views 
      WHERE 1=1 ${whereClause}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows[0];
  }

  /**
   * Get popular pages
   * @param {Object} filters - Optional filters
   * @returns {Array} Popular pages with statistics
   */
  static async getPopularPages(filters = {}) {
    let whereClause = '';
    const params = [];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      whereClause += ` AND timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      whereClause += ` AND timestamp <= $${params.length}`;
    }

    const sql = `
      SELECT 
        url,
        COUNT(*) as page_views,
        COUNT(DISTINCT session_id) as unique_visitors,
        AVG(CASE WHEN time_on_page IS NOT NULL THEN time_on_page END) as avg_time_on_page,
        AVG(CASE WHEN scroll_depth IS NOT NULL THEN scroll_depth END) as avg_scroll_depth,
        COUNT(CASE WHEN exit_page = true THEN 1 END) as exits,
        ROUND(COUNT(CASE WHEN exit_page = true THEN 1 END) * 100.0 / COUNT(*), 2) as exit_rate
      FROM analytics_page_views 
      WHERE 1=1 ${whereClause}
      GROUP BY url
      ORDER BY page_views DESC
      LIMIT ${filters.limit || 50}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Get entry pages (first page in session)
   * @param {Object} filters - Optional filters
   * @returns {Array} Entry pages with statistics
   */
  static async getEntryPages(filters = {}) {
    let whereClause = '';
    const params = [];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      whereClause += ` AND pv.timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      whereClause += ` AND pv.timestamp <= $${params.length}`;
    }

    const sql = `
      WITH first_page_views AS (
        SELECT DISTINCT ON (session_id) 
          session_id, url, timestamp
        FROM analytics_page_views
        WHERE 1=1 ${whereClause}
        ORDER BY session_id, timestamp ASC
      )
      SELECT 
        url,
        COUNT(*) as entries,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM first_page_views), 2) as entry_rate
      FROM first_page_views
      GROUP BY url
      ORDER BY entries DESC
      LIMIT ${filters.limit || 50}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Get exit pages
   * @param {Object} filters - Optional filters
   * @returns {Array} Exit pages with statistics
   */
  static async getExitPages(filters = {}) {
    let whereClause = '';
    const params = [];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      whereClause += ` AND timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      whereClause += ` AND timestamp <= $${params.length}`;
    }

    const sql = `
      SELECT 
        url,
        COUNT(*) as exits,
        COUNT(*) * 100.0 / (
          SELECT COUNT(*) 
          FROM analytics_page_views 
          WHERE exit_page = true ${whereClause}
        ) as exit_percentage
      FROM analytics_page_views 
      WHERE exit_page = true ${whereClause}
      GROUP BY url
      ORDER BY exits DESC
      LIMIT ${filters.limit || 50}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Get page flow (navigation paths)
   * @param {string} fromUrl - Starting URL
   * @param {Object} filters - Optional filters
   * @returns {Array} Page flow data
   */
  static async getPageFlow(fromUrl, filters = {}) {
    if (!fromUrl) throw new Error('From URL is required');

    let whereClause = '';
    const params = [fromUrl];

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      whereClause += ` AND pv1.timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      whereClause += ` AND pv1.timestamp <= $${params.length}`;
    }

    const sql = `
      SELECT 
        pv2.url as next_page,
        COUNT(*) as transitions,
        ROUND(COUNT(*) * 100.0 / (
          SELECT COUNT(*) 
          FROM analytics_page_views 
          WHERE url = $1 ${whereClause}
        ), 2) as transition_rate
      FROM analytics_page_views pv1
      JOIN analytics_page_views pv2 ON pv1.session_id = pv2.session_id
      WHERE pv1.url = $1
        AND pv2.timestamp > pv1.timestamp
        AND pv2.id = (
          SELECT id FROM analytics_page_views pv3
          WHERE pv3.session_id = pv1.session_id 
            AND pv3.timestamp > pv1.timestamp
          ORDER BY timestamp ASC
          LIMIT 1
        )
        ${whereClause}
      GROUP BY pv2.url
      ORDER BY transitions DESC
      LIMIT ${filters.limit || 20}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Delete old page view records (for data retention)
   * @param {Date} beforeDate - Delete records before this date
   * @returns {number} Number of deleted records
   */
  static async deleteOldRecords(beforeDate) {
    if (!beforeDate) throw new Error('Before date is required');

    const sql = 'DELETE FROM analytics_page_views WHERE timestamp < $1';
    const result = await this.executeQuery(sql, [beforeDate]);
    return result.rowCount;
  }
}

module.exports = PageView;