import Joi from 'joi';
import { BaseModel } from './BaseModel';
import { EventData, EventType, FilterOptions, EventStatistics, EventTypeCount, PopularUrl } from '../types';

/**
 * Event model for tracking analytics events
 */
export class Event extends BaseModel {
  constructor(data: Record<string, any> = {}) {
    super(data);
  }

  /**
   * Joi validation schema for event data
   */
  private static get schema(): Joi.ObjectSchema<EventData> {
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
  static get EVENT_TYPES(): typeof EventType {
    return EventType;
  }

  /**
   * Create a new event record
   */
  static async create(eventData: Partial<EventData>): Promise<EventData> {
    // Validate input data
    const validation = this.validate<EventData>(this.schema, eventData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const data = validation.value!;
    
    // Generate ID if not provided
    if (!data.id) {
      data.id = this.generateId();
    }

    // Sanitize data
    data.session_id = this.sanitizeString(data.session_id) || '';
    data.event_type = this.sanitizeString(data.event_type) as EventType;
    data.url = this.sanitizeUrl(data.url) || '';
    data.url_hash = data.url_hash ? this.sanitizeString(data.url_hash) : null;
    data.referrer = data.referrer ? this.sanitizeUrl(data.referrer) : null;
    data.user_agent = data.user_agent ? this.sanitizeString(data.user_agent) : null;
    data.ip_address = this.validateIpAddress(data.ip_address);

    // Validate event type
    const validEventTypes = Object.values(EventType);
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
    return result.rows[0]!;
  }

  /**
   * Create multiple events in batch
   */
  static async createBatch(eventsData: Partial<EventData>[]): Promise<EventData[]> {
    if (!Array.isArray(eventsData) || eventsData.length === 0) {
      throw new Error('Events data must be a non-empty array');
    }

    return await this.executeTransaction(async (client) => {
      const createdEvents: EventData[] = [];

      for (const eventData of eventsData) {
        // Validate each event
        const validation = this.validate<EventData>(this.schema, eventData);
        if (!validation.isValid) {
          throw new Error(`Validation failed for event: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        const data = validation.value!;
        
        // Generate ID if not provided
        if (!data.id) {
          data.id = this.generateId();
        }

        // Sanitize data (same as create method)
        data.session_id = this.sanitizeString(data.session_id) || '';
        data.event_type = this.sanitizeString(data.event_type) as EventType;
        data.url = this.sanitizeUrl(data.url) || '';
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
   */
  static async findById(id: string): Promise<EventData | null> {
    if (!id) return null;

    const sql = 'SELECT * FROM analytics_events WHERE id = $1';
    const result = await this.executeQuery(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find events by session ID
   */
  static async findBySession(
    sessionId: string, 
    options: { eventType?: EventType; limit?: number } = {}
  ): Promise<EventData[]> {
    if (!sessionId) return [];

    let sql = 'SELECT * FROM analytics_events WHERE session_id = $1';
    const params: any[] = [sessionId];

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
   */
  static async findByFilters(filters: FilterOptions & { limit?: number; offset?: number } = {}): Promise<EventData[]> {
    let sql = 'SELECT * FROM analytics_events WHERE 1=1';
    const params: any[] = [];

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
   */
  static async getStatistics(filters: FilterOptions = {}): Promise<EventStatistics> {
    let whereClause = '';
    const params: any[] = [];

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
    return result.rows[0]!;
  }

  /**
   * Get event counts by type
   */
  static async getEventCountsByType(filters: FilterOptions = {}): Promise<EventTypeCount[]> {
    let whereClause = '';
    const params: any[] = [];

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
   */
  static async getPopularUrls(filters: FilterOptions & { limit?: number } = {}): Promise<PopularUrl[]> {
    let whereClause = '';
    const params: any[] = [];

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
   */
  static async deleteOldRecords(beforeDate: Date): Promise<number> {
    if (!beforeDate) throw new Error('Before date is required');

    const sql = 'DELETE FROM analytics_events WHERE created_at < $1';
    const result = await this.executeQuery(sql, [beforeDate]);
    return result.rowCount || 0;
  }
}