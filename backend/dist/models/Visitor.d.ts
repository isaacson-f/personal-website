import { BaseModel } from './BaseModel';
import { VisitorData, FilterOptions } from '../types';
/**
 * Visitor model for tracking unique website visitors
 */
export declare class Visitor extends BaseModel {
    constructor(data?: Record<string, any>);
    /**
     * Joi validation schema for visitor data
     */
    private static get schema();
    /**
     * Create a new visitor record
     */
    static create(visitorData: Partial<VisitorData>): Promise<VisitorData>;
    /**
     * Find visitor by ID
     */
    static findById(id: string): Promise<VisitorData | null>;
    /**
     * Update visitor statistics
     */
    static update(id: string, updates: Partial<Pick<VisitorData, 'last_visit' | 'total_sessions' | 'total_page_views' | 'geographic_data' | 'device_info'>>): Promise<VisitorData>;
    /**
     * Increment session count for visitor
     */
    static incrementSessions(id: string): Promise<VisitorData>;
    /**
     * Increment page view count for visitor
     */
    static incrementPageViews(id: string, count?: number): Promise<VisitorData>;
    /**
     * Get visitor statistics
     */
    static getStatistics(filters?: FilterOptions): Promise<{
        total_visitors: number;
        returning_visitors: number;
        avg_sessions_per_visitor: number;
        avg_page_views_per_visitor: number;
        last_activity: Date | null;
    }>;
    /**
     * Delete old visitor records (for data retention)
     */
    static deleteOldRecords(beforeDate: Date): Promise<number>;
}
//# sourceMappingURL=Visitor.d.ts.map