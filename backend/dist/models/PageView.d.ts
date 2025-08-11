import { BaseModel } from './BaseModel';
import { PageViewData, FilterOptions } from '../types';
/**
 * PageView model for tracking page view analytics
 */
export declare class PageView extends BaseModel {
    constructor(data?: Record<string, any>);
    /**
     * Joi validation schema for page view data
     */
    private static get schema();
    /**
     * Create a new page view record
     */
    static create(pageViewData: Partial<PageViewData>): Promise<PageViewData>;
    /**
     * Find page view by ID
     */
    static findById(id: string): Promise<PageViewData | null>;
    /**
     * Find page views by session ID
     */
    static findBySession(sessionId: string, options?: {
        limit?: number;
    }): Promise<PageViewData[]>;
    /**
     * Update page view data (typically for scroll depth and time on page)
     */
    static update(id: string, updates: Partial<Pick<PageViewData, 'scroll_depth' | 'time_on_page' | 'exit_page'>>): Promise<PageViewData>;
    /**
     * Mark page view as exit page
     */
    static markAsExitPage(id: string): Promise<PageViewData>;
    /**
     * Get page view statistics
     */
    static getStatistics(filters?: FilterOptions & {
        url?: string;
    }): Promise<{
        total_page_views: number;
        unique_sessions: number;
        unique_pages: number;
        avg_time_on_page: number | null;
        avg_scroll_depth: number | null;
        exit_pages: number;
        avg_load_time: number | null;
    }>;
    /**
     * Get popular pages
     */
    static getPopularPages(filters?: FilterOptions & {
        limit?: number;
    }): Promise<Array<{
        url: string;
        page_views: number;
        unique_visitors: number;
        avg_time_on_page: number | null;
        avg_scroll_depth: number | null;
        exits: number;
        exit_rate: number;
    }>>;
    /**
     * Delete old page view records (for data retention)
     */
    static deleteOldRecords(beforeDate: Date): Promise<number>;
}
//# sourceMappingURL=PageView.d.ts.map