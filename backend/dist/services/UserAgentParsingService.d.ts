import { UserAgentInfo } from '../types';
/**
 * Service for parsing user agent strings to extract device and browser information
 * Uses lightweight regex-based parsing to avoid external dependencies
 */
export declare class UserAgentParsingService {
    private readonly browserPatterns;
    private readonly osPatterns;
    private readonly devicePatterns;
    private readonly botPatterns;
    constructor();
    /**
     * Parse user agent string and extract device/browser information
     */
    parseUserAgent(userAgent: string | null | undefined): UserAgentInfo;
    /**
     * Sanitize user agent string
     */
    private sanitizeUserAgent;
    /**
     * Parse browser information from user agent
     */
    private parseBrowser;
    /**
     * Parse operating system information from user agent
     */
    private parseOperatingSystem;
    /**
     * Get operating system family
     */
    private getOSFamily;
    /**
     * Parse device information from user agent
     */
    private parseDevice;
    /**
     * Check if user agent indicates a bot/crawler
     */
    isBot(userAgent: string): boolean;
    /**
     * Get default device information
     */
    private getDefaultDeviceInfo;
    /**
     * Parse multiple user agent strings in batch
     */
    batchParseUserAgents(userAgents: string[]): Array<{
        index: number;
        userAgent: string;
        parsed: UserAgentInfo;
        error: string | null;
    }>;
    /**
     * Get browser market share category
     */
    getBrowserCategory(browserName: string): 'major' | 'minor';
    /**
     * Check if browser version is outdated
     */
    isOutdatedBrowser(browserName: string, majorVersion: number | null): boolean;
    /**
     * Extract screen resolution from user agent (if available)
     */
    extractScreenResolution(userAgent: string): {
        width: number;
        height: number;
    } | null;
    /**
     * Get device capabilities based on parsed information
     */
    getDeviceCapabilities(deviceInfo: UserAgentInfo): {
        touch_support: boolean;
        javascript_enabled: boolean;
        cookies_enabled: null;
        local_storage_support: boolean;
        webgl_support: null;
        canvas_support: boolean;
    };
}
//# sourceMappingURL=UserAgentParsingService.d.ts.map