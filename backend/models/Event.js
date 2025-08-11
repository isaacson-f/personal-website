const Joi = require('joi');
const BaseModel = require('./BaseModel');

/**
 * Event model for tracking analytics events
 */
class Event extends BaseModel {
  constructor(data = {}) {
    super(data);
  }

  /**
   * Joi validation schema for event data
   */
  static get schema() {
    return Joi.object({
      id: Joi.string().uuid().optional(),
      session_id: Joi.string().max(255).required(),
      event_type: Joi.string().max(100).required(),
      url: Joi.string().max(2048).required(),
      url_hash: Joi.string().max(255).allow(null, ''),
      referrer: Joi.string().max(2048).allow(null, ''),
      user_agent: Joi.string().max(1000).allow(null, ''),
      ip_address: Joi.string().ip().allow(null),
      timestamp: Joi.date().default(() => new Date()),
      properties: Joi.object().allow(null),
      created_at: Joi.date().default(() => new Date())
    });
  }

  /**
   * Valid event types
   */
  static get EVENT_TYPES() {
    return {
      PAGE_VIEW: 'page_view',
      CLICK: 'click',
      SCROLL: 'scroll',
      FORM_SUBMIT: 'form_submit',
      CUSTOM: 'custom',
      SESSION_START: 'session_start',
      SESSION_END: 'session_end'
    };
  }

  /**
   * Create a new event record
   * @param {Object} eventData - Event data
   * @returns {Object} Created event
   */
  static async create(eventData) {
    // Validate input data
    const validation = this.validate(this.schema, eventData);
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
    data.event_type = this.sanitizeString(data.event_type);
    data.url = this.sanitizeUrl(data.url);
    data.url_hash = data.url_hash ? this.sanitizeString(data.url_hash) : null;
    data.referrer = data.referrer ? this.sanitizeUrl(data.referrer) : null;
    data.user_agent = data.user_agent ? this.sanitizeString(data.user_agent) : null;
    data.ip_address = this.validateIpAddress(data.ip_address);

    // Validate event type
    const validEventTypes = Object.values(this.EVENT_TYPES);
    if (!validEventTypes.includes(data.event_type)) {
      throw new Error(`Invalid event type: ${data.event_type}`);
    }

    const sql = `
      INSERT INTO analytics_events (
        id, session_id, event_type, url, url_hash, referrer,
        user_agent, ip_address, timestamp, properties, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const params = [
      data.id,
      data.session_id,
      data.event_type,
      data.url,
      data.url_hash,
      data.referrer,
      data.user_agent,
      data.ip_address,
      data.timestamp,
      JSON.stringify(data.properties),
      data.created_at
    ];

    const result = await this.executeQuery(sql, params);
    return result.rows[0];
  }

  /**
   * Create multiple events in batch
   * @param {Array} eventsData - Array of event data
   * @returns {Array} Created events
   */
  static async createBatch(eventsData) {
    if (!Array.isArray(eventsData) || eventsData.length === 0) {
      throw new Error('Events data must be a non-empty array');
    }

    return await this.executeTransaction(async (client) => {
      const createdEvents = [];

      for (const eventData of eventsData) {
        // Validate each event
        const validation = this.validate(this.schema, eventData);
        if (!validation.isValid) {
          throw new Error(`Validation failed for event: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        const data = validation.value;
        
        // Generate ID if not provided
        if (!data.id) {
          data.id = this.generateId();
        }

        // Sanitize data (same as create method)
        data.session_id = this.sanitizeString(data.session_id);
        data.event_type = this.sanitizeString(data.event_type);
        data.url = this.sanitizeUrl(data.url);
        data.url_hash = data.url_hash ? this.sanitizeString(data.url_hash) : null;
        data.referrer = data.referrer ? this.sanitizeUrl(data.referrer) : null;
        data.user_agent = data.user_agent ? this.sanitizeString(data.user_agent) : null;
        data.ip_address = this.validateIpAddress(data.ip_address);

        const sql = `
          INSERT INTO analytics_events (
            id, session_id, event_type, url, url_hash, referrer,
            user_agent, ip_address, timestamp, properties, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const params = [
          data.id, data.session_id, data.event_type, data.url, data.url_hash,
          data.referrer, data.user_agent, data.ip_address, data.timestamp,
          JSON.stringify(data.properties), data.created_at
        ];

        const result = await client.query(sql, params);
        createdEvents.push(result.rows[0]);
      }

      return createdEvents;
    });
  }

  /**
   * Find event by ID
   * @param {string} id - Event ID
   * @returns {Object|null} Event data or null
   */
  static async findById(id) {
    if (!id) return null;

    const sql = 'SELECT * FROM analytics_events WHERE id = $1';
    const result = await this.executeQuery(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find events by session ID
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Array} Events
   */
  static async findBySession(sessionId, options = {}) {
    if (!sessionId) return [];

    let sql = 'SELECT * FROM analytics_events WHERE session_id = $1';
    const params = [sessionId];

    if (options.eventType) {
      params.push(options.eventType);
      sql += ` AND event_type = $${params.length}`;
    }

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
   * Find events by filters
   * @param {Object} filters - Search filters
   * @returns {Array} Events
   */
  static async findByFilters(filters = {}) {
    let sql = 'SELECT * FROM analytics_events WHERE 1=1';
    const params = [];

    if (filters.eventType) {
      params.push(filters.eventType);
      sql += ` AND event_type = $${params.length}`;
    }

    if (filters.url) {
      params.push(filters.url);
      sql += ` AND url = $${params.length}`;
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      sql += ` AND timestamp >= $${params.length}`;
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      sql += ` AND timestamp <= $${params.length}`;
    }

    if (filters.sessionId) {
      params.push(filters.sessionId);
      sql += ` AND session_id = $${params.length}`;
    }

    // Add ordering and pagination
    sql += ' ORDER BY timestamp DESC';
    
    if (filters.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(filters.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Get event statistics
   * @param {Object} filters - Optional filters
   * @returns {Object} Event statistics
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

    if (filters.eventType) {
      params.push(filters.eventType);
      whereClause += ` AND event_type = $${params.length}`;
    }

    const sql = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT event_type) as unique_event_types,
        COUNT(DISTINCT url) as unique_urls,
        MAX(timestamp) as last_event_time,
        MIN(timestamp) as first_event_time
      FROM analytics_events 
      WHERE 1=1 ${whereClause}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows[0];
  }

  /**
   * Get event counts by type
   * @param {Object} filters - Optional filters
   * @returns {Array} Event counts by type
   */
  static async getEventCountsByType(filters = {}) {
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
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events 
      WHERE 1=1 ${whereClause}
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Get popular URLs
   * @param {Object} filters - Optional filters
   * @returns {Array} Popular URLs with counts
   */
  static async getPopularUrls(filters = {}) {
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

    if (filters.eventType) {
      params.push(filters.eventType);
      whereClause += ` AND event_type = $${params.length}`;
    }

    const sql = `
      SELECT 
        url,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events 
      WHERE 1=1 ${whereClause}
      GROUP BY url
      ORDER BY count DESC
      LIMIT ${filters.limit || 50}
    `;

    const result = await this.executeQuery(sql, params);
    return result.rows;
  }

  /**
   * Delete old event records (for data retention)
   * @param {Date} beforeDate - Delete records before this date
   * @returns {number} Number of deleted records
   */
  static async deleteOldRecords(beforeDate) {
    if (!beforeDate) throw new Error('Before date is required');

    const sql = 'DELETE FROM analytics_events WHERE created_at < $1';
    const result = await this.executeQuery(sql, [beforeDate]);
    return result.rowCount;
  }
}

module.exports = Event;