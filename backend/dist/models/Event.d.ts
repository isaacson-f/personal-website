import { BaseModel } from './BaseModel';
import { EventData, EventType, FilterOptions, EventStatistics, EventTypeCount, PopularUrl } from '../types';
/**
 * Event model for tracking analytics events
 */
export declare class Event extends BaseModel {
    constructor(data?: Record<string, any>);
    /**
     * Joi validation schema for event data
     */
    private static get schema();
    /**
     * Valid event types
     */
    static get EVENT_TYPES(): typeof EventType;
    /**
     * Create a new event record
     */
    static create(eventData: Partial<EventData>): Promise<EventData>;
    /**
     * Create multiple events in batch
     */
    static createBatch(eventsData: Partial<EventData>[]): Promise<EventData[]>;
    /**
     * Find event by ID
     */
    static findById(id: string): Promise<EventData | null>;
    /**
     * Find events by session ID
     */
    static findBySession(sessionId: string, options?: {
        eventType?: EventType;
        limit?: number;
    }): Promise<EventData[]>;
    /**
     * Find events by filters
     */
    static findByFilters(filters?: FilterOptions & {
        limit?: number;
        offset?: number;
    }): Promise<EventData[]>;
    /**
     * Get event statistics
     */
    static getStatistics(filters?: FilterOptions): Promise<EventStatistics>;
    /**
     * Get event counts by type
     */
    static getEventCountsByType(filters?: FilterOptions): Promise<EventTypeCount[]>;
    /**
     * Get popular URLs
     */
    static getPopularUrls(filters?: FilterOptions & {
        limit?: number;
    }): Promise<PopularUrl[]>;
    /**
     * Delete old event records (for data retention)
     */
    static deleteOldRecords(beforeDate: Date): Promise<number>;
}
//# sourceMappingURL=Event.d.ts.map