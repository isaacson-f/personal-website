"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventValidationService = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
/**
 * Service for validating and sanitizing analytics events
 */
class EventValidationService {
    constructor() {
        // Define validation schemas for different event types
        this.eventSchema = joi_1.default.object({
            session_id: joi_1.default.string().required().max(255),
            event_type: joi_1.default.string().required().max(100).valid(...Object.values(types_1.EventType)),
            url: joi_1.default.string().required().uri().max(2048),
            url_hash: joi_1.default.string().allow('').max(255),
            referrer: joi_1.default.string().allow('').uri().max(2048),
            user_agent: joi_1.default.string().allow('').max(1000),
            ip_address: joi_1.default.string().ip().required(),
            timestamp: joi_1.default.date().iso().default(() => new Date()),
            properties: joi_1.default.object().default({})
        });
        this.pageViewSchema = joi_1.default.object({
            session_id: joi_1.default.string().required().max(255),
            url: joi_1.default.string().required().uri().max(2048),
            url_hash: joi_1.default.string().allow('').max(255),
            title: joi_1.default.string().allow('').max(500),
            load_time: joi_1.default.number().integer().min(0).max(60000),
            scroll_depth: joi_1.default.number().integer().min(0).max(100),
            time_on_page: joi_1.default.number().integer().min(0).max(86400),
            exit_page: joi_1.default.boolean().default(false),
            timestamp: joi_1.default.date().iso().default(() => new Date())
        });
        this.sessionSchema = joi_1.default.object({
            id: joi_1.default.string().required().max(255),
            visitor_id: joi_1.default.string().allow('').max(255),
            cookie_id: joi_1.default.string().allow('').max(255),
            start_time: joi_1.default.date().iso().required(),
            end_time: joi_1.default.date().iso().allow(null),
            page_views: joi_1.default.number().integer().min(0).default(0),
            duration_seconds: joi_1.default.number().integer().min(0).allow(null),
            browser_fingerprint: joi_1.default.string().allow('').max(255),
            device_info: joi_1.default.object().default({}),
            geographic_data: joi_1.default.object().default({}),
            is_returning_visitor: joi_1.default.boolean().default(false)
        });
    }
    /**
     * Validate and sanitize an analytics event
     */
    validateEvent(eventData) {
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
    validatePageView(pageViewData) {
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
    validateSession(sessionData) {
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
    sanitizeEvent(eventData) {
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
    sanitizePageView(pageViewData) {
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
    sanitizeSession(sessionData) {
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
    sanitizeUrl(url) {
        if (!url)
            return '';
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
    sanitizeString(str) {
        if (!str)
            return null;
        return str
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }
    /**
     * Sanitize properties object recursively
     */
    sanitizeProperties(properties) {
        if (!properties || typeof properties !== 'object') {
            return {};
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(properties)) {
            const sanitizedKey = this.sanitizeString(key) || key;
            if (typeof value === 'string') {
                sanitized[sanitizedKey] = this.sanitizeString(value);
            }
            else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[sanitizedKey] = value;
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[sanitizedKey] = this.sanitizeProperties(value);
            }
        }
        return sanitized;
    }
    /**
     * Validate batch of events
     */
    validateEventBatch(events) {
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Event at index ${index}: ${message}`);
            }
        });
    }
}
exports.EventValidationService = EventValidationService;
//# sourceMappingURL=EventValidationService.js.map