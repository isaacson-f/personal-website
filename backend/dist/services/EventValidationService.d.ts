import { EventData, PageViewData, SessionData } from '../types';
/**
 * Service for validating and sanitizing analytics events
 */
export declare class EventValidationService {
    private readonly eventSchema;
    private readonly pageViewSchema;
    private readonly sessionSchema;
    constructor();
    /**
     * Validate and sanitize an analytics event
     */
    validateEvent(eventData: any): EventData;
    /**
     * Validate and sanitize a page view event
     */
    validatePageView(pageViewData: any): PageViewData;
    /**
     * Validate and sanitize session data
     */
    validateSession(sessionData: any): SessionData;
    /**
     * Sanitize event data to prevent XSS and injection attacks
     */
    private sanitizeEvent;
    /**
     * Sanitize page view data
     */
    private sanitizePageView;
    /**
     * Sanitize session data
     */
    private sanitizeSession;
    /**
     * Sanitize URL to prevent malicious URLs
     */
    private sanitizeUrl;
    /**
     * Sanitize string to prevent XSS
     */
    private sanitizeString;
    /**
     * Sanitize properties object recursively
     */
    private sanitizeProperties;
    /**
     * Validate batch of events
     */
    validateEventBatch(events: any[]): EventData[];
}
//# sourceMappingURL=EventValidationService.d.ts.map