import Joi from 'joi';
import { EventData, PageViewData, SessionData, EventType } from '../types';

/**
 * Service for validating and sanitizing analytics events
 */
export class EventValidationService {
  private readonly eventSchema: Joi.ObjectSchema<EventData>;
  private readonly pageViewSchema: Joi.ObjectSchema<PageViewData>;
  private readonly sessionSchema: Joi.ObjectSchema<SessionData>;

  constructor() {
    // Define validation schemas for different event types
    this.eventSchema = Joi.object({
      session_id: Joi.string().required().max(255),
      event_type: Joi.string().required().max(100).valid(
        ...Object.values(EventType)
      ),
      url: Joi.string().required().uri().max(2048),
      url_hash: Joi.string().allow('').max(255),
      referrer: Joi.string().allow('').uri().max(2048),
      user_agent: Joi.string().allow('').max(1000),
      ip_address: Joi.string().ip().required(),
      timestamp: Joi.date().iso().default(() => new Date()),
      properties: Joi.object().default({})
    });

    this.pageViewSchema = Joi.object({
      session_id: Joi.string().required().max(255),
      url: Joi.string().required().uri().max(2048),
      url_hash: Joi.string().allow('').max(255),
      title: Joi.string().allow('').max(500),
      load_time: Joi.number().integer().min(0).max(60000),
      scroll_depth: Joi.number().integer().min(0).max(100),
      time_on_page: Joi.number().integer().min(0).max(86400),
      exit_page: Joi.boolean().default(false),
      timestamp: Joi.date().iso().default(() => new Date())
    });

    this.sessionSchema = Joi.object({
      id: Joi.string().required().max(255),
      visitor_id: Joi.string().allow('').max(255),
      cookie_id: Joi.string().allow('').max(255),
      start_time: Joi.date().iso().required(),
      end_time: Joi.date().iso().allow(null),
      page_views: Joi.number().integer().min(0).default(0),
      duration_seconds: Joi.number().integer().min(0).allow(null),
      browser_fingerprint: Joi.string().allow('').max(255),
      device_info: Joi.object().default({}),
      geographic_data: Joi.object().default({}),
      is_returning_visitor: Joi.boolean().default(false)
    });
  }

  /**
   * Validate and sanitize an analytics event
   */
  validateEvent(eventData: any): EventData {
    const { error, value } = this.eventSchema.validate(eventData, {
      stripUnknown: true,
      abortEarly: false
    });

    if (error) {
      throw new Error(`Event validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }

    return this.sanitizeEvent(value);
  }

  /**
   * Validate and sanitize a page view event
   */
  validatePageView(pageViewData: any): PageViewData {
    const { error, value } = this.pageViewSchema.validate(pageViewData, {
      stripUnknown: true,
      abortEarly: false
    });

    if (error) {
      throw new Error(`Page view validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }

    return this.sanitizePageView(value);
  }

  /**
   * Validate and sanitize session data
   */
  validateSession(sessionData: any): SessionData {
    const { error, value } = this.sessionSchema.validate(sessionData, {
      stripUnknown: true,
      abortEarly: false
    });

    if (error) {
      throw new Error(`Session validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }

    return this.sanitizeSession(value);
  }

  /**
   * Sanitize event data to prevent XSS and injection attacks
   */
  private sanitizeEvent(eventData: EventData): EventData {
    return {
      ...eventData,
      url: this.sanitizeUrl(eventData.url),
      url_hash: this.sanitizeString(eventData.url_hash),
      referrer: eventData.referrer ? this.sanitizeUrl(eventData.referrer) : null,
      user_agent: this.sanitizeString(eventData.user_agent),
      properties: this.sanitizeProperties(eventData.properties)
    };
  }

  /**
   * Sanitize page view data
   */
  private sanitizePageView(pageViewData: PageViewData): PageViewData {
    return {
      ...pageViewData,
      url: this.sanitizeUrl(pageViewData.url),
      url_hash: this.sanitizeString(pageViewData.url_hash),
      title: this.sanitizeString(pageViewData.title)
    };
  }

  /**
   * Sanitize session data
   */
  private sanitizeSession(sessionData: SessionData): SessionData {
    return {
      ...sessionData,
      visitor_id: this.sanitizeString(sessionData.visitor_id),
      cookie_id: this.sanitizeString(sessionData.cookie_id),
      browser_fingerprint: this.sanitizeString(sessionData.browser_fingerprint),
      device_info: this.sanitizeProperties(sessionData.device_info),
      geographic_data: this.sanitizeProperties(sessionData.geographic_data)
    };
  }

  /**
   * Sanitize URL to prevent malicious URLs
   */
  private sanitizeUrl(url: string | null | undefined): string {
    if (!url) return '';
    
    // Remove any script tags or javascript: protocols
    const sanitized = url
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');
    
    return sanitized.trim();
  }

  /**
   * Sanitize string to prevent XSS
   */
  private sanitizeString(str: string | null | undefined): string | null {
    if (!str) return null;
    
    return str
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize properties object recursively
   */
  private sanitizeProperties(properties: Record<string, any> | null | undefined): Record<string, any> {
    if (!properties || typeof properties !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      const sanitizedKey = this.sanitizeString(key) || key;
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeProperties(value);
      }
    }

    return sanitized;
  }

  /**
   * Validate batch of events
   */
  validateEventBatch(events: any[]): EventData[] {
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }

    if (events.length === 0) {
      throw new Error('Events array cannot be empty');
    }

    if (events.length > 100) {
      throw new Error('Batch size cannot exceed 100 events');
    }

    return events.map((event, index) => {
      try {
        return this.validateEvent(event);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Event at index ${index}: ${message}`);
      }
    });
  }
}