import { BaseModel } from './BaseModel';
import { SessionData, FilterOptions } from '../types';
/**
 * Session model for tracking user sessions
 */
export declare class Session extends BaseModel {
    constructor(data?: Record<string, any>);
    /**
     * Joi validation schema for session data
     */
    private static get schema();
    /**
     * Create a new session record
     */
    static create(sessionData: Partial<SessionData>): Promise<SessionData>;
    /**
     * Find session by ID
     */
    static findById(id: string): Promise<SessionData | null>;
    /**
     * Find active sessions for a visitor
     */
    static findActiveByVisitor(visitorId: string): Promise<SessionData[]>;
    /**
     * Find sessions by visitor ID
     */
    static findByVisitor(visitorId: string, options?: {
        limit?: number;
    }): Promise<SessionData[]>;
    /**
     * Update session data
     */
    static update(id: string, updates: Partial<Pick<SessionData, 'end_time' | 'page_views' | 'duration_seconds' | 'device_info' | 'geographic_data'>>): Promise<SessionData>;
    /**
     * End a session
     */
    static endSession(id: string, endTime?: Date | null): Promise<SessionData>;
    /**
     * Increment page view count for session
     */
    static incrementPageViews(id: string, count?: number): Promise<SessionData>;
    /**
     * Get session statistics
     */
    static getStatistics(filters?: FilterOptions): Promise<{
        total_sessions: number;
        completed_sessions: number;
        returning_visitor_sessions: number;
        avg_duration_seconds: number | null;
        avg_page_views_per_session: number;
        last_session_start: Date | null;
    }>;
    /**
     * Get active sessions count
     */
    static getActiveSessionsCount(): Promise<number>;
    /**
     * End expired sessions (sessions without activity for specified minutes)
     */
    static endExpiredSessions(timeoutMinutes?: number): Promise<number>;
    /**
     * Delete old session records (for data retention)
     */
    static deleteOldRecords(beforeDate: Date): Promise<number>;
}
//# sourceMappingURL=Session.d.ts.map