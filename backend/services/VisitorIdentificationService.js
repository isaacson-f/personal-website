const crypto = require('crypto');
const Visitor = require('../models/Visitor');
const Session = require('../models/Session');

/**
 * Service for visitor identification and session management
 * Handles cookie-based identification, browser fingerprinting, and returning visitor detection
 */
class VisitorIdentificationService {
  static COOKIE_NAME = 'analytics_visitor_id';
  static COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  static SESSION_TIMEOUT_MINUTES = 30;

  /**
   * Generate a unique visitor ID
   */
  static generateVisitorId() {
    return crypto.randomUUID();
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Create browser fingerprint from request headers and user agent
   */
  static createBrowserFingerprint(req) {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.headers['accept'] || '',
      req.ip || '',
      // Add screen resolution if available in custom headers
      req.headers['x-screen-resolution'] || '',
      // Add timezone if available in custom headers
      req.headers['x-timezone'] || ''
    ];

    const fingerprint = components.join('|');
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
  }

  /**
   * Extract visitor ID from cookies
   */
  static getVisitorIdFromCookies(req) {
    return req.cookies?.[this.COOKIE_NAME] || null;
  }

  /**
   * Set visitor ID cookie in response
   */
  static setVisitorIdCookie(res, visitorId) {
    res.cookie(this.COOKIE_NAME, visitorId, {
      maxAge: this.COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }

  /**
   * Find existing visitor by cookie ID or browser fingerprint
   */
  static async findExistingVisitor(cookieId, browserFingerprint) {
    if (cookieId) {
      // First try to find by cookie ID (most reliable)
      const visitor = await Visitor.findById(cookieId);
      if (visitor) {
        return visitor;
      }
    }

    // Fallback to browser fingerprint for cookie-disabled users
    if (browserFingerprint) {
      try {
        return await this.findVisitorByFingerprint(browserFingerprint);
      } catch (error) {
        console.error('Error finding visitor by fingerprint:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Find visitor by browser fingerprint (separate method for easier testing)
   */
  static async findVisitorByFingerprint(browserFingerprint) {
    // This would need to be implemented in the Visitor model
    // For now, return null as fallback
    return null;
  }

  /**
   * Create a new visitor record
   */
  static async createNewVisitor(visitorId, userAgent, ipAddress, deviceInfo, geolocationData) {
    const now = new Date();
    
    const visitorData = {
      id: visitorId,
      first_visit: now,
      last_visit: now,
      total_sessions: 1,
      total_page_views: 0,
      user_agent: userAgent,
      ip_address: ipAddress,
      device_info: deviceInfo || {},
      geographic_data: geolocationData || {},
      created_at: now,
      updated_at: now
    };

    return await Visitor.create(visitorData);
  }

  /**
   * Update existing visitor with new session
   */
  static async updateExistingVisitor(visitorId, deviceInfo, geolocationData) {
    // Update visitor data and increment session count
    const visitor = await Visitor.incrementSessions(visitorId);
    
    // Update device info and geolocation if provided
    if (deviceInfo || geolocationData) {
      const updates = {};
      if (deviceInfo) updates.device_info = deviceInfo;
      if (geolocationData) updates.geographic_data = geolocationData;
      
      return await Visitor.update(visitorId, updates);
    }
    
    return visitor;
  }

  /**
   * Create a new session
   */
  static async createSession(sessionId, visitorId, cookieId, browserFingerprint, deviceInfo, geolocationData, isReturningVisitor) {
    const sessionData = {
      id: sessionId,
      visitor_id: visitorId,
      cookie_id: cookieId,
      start_time: new Date(),
      page_views: 0,
      browser_fingerprint: browserFingerprint,
      device_info: deviceInfo || {},
      geographic_data: geolocationData || {},
      is_returning_visitor: isReturningVisitor,
      created_at: new Date()
    };

    return await Session.create(sessionData);
  }

  /**
   * Check if visitor is returning based on existing data
   */
  static async isReturningVisitor(visitorId) {
    const visitor = await Visitor.findById(visitorId);
    return visitor ? visitor.total_sessions > 1 : false;
  }

  /**
   * Identify or create visitor and session
   */
  static async identifyVisitor(req, res, deviceInfo = null, geolocationData = null) {
    const cookieId = this.getVisitorIdFromCookies(req);
    const browserFingerprint = this.createBrowserFingerprint(req);
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || null;

    let visitor;
    let isNewVisitor = false;
    let isReturningVisitor = false;

    // Try to find existing visitor
    const existingVisitor = await this.findExistingVisitor(cookieId, browserFingerprint);

    if (existingVisitor) {
      // Update existing visitor
      visitor = await this.updateExistingVisitor(
        existingVisitor.id,
        deviceInfo,
        geolocationData
      );
      isReturningVisitor = visitor.total_sessions > 1;
    } else {
      // Create new visitor
      const newVisitorId = cookieId || this.generateVisitorId();
      visitor = await this.createNewVisitor(
        newVisitorId,
        userAgent,
        ipAddress,
        deviceInfo,
        geolocationData
      );
      isNewVisitor = true;
      
      // Set cookie if not already present
      if (!cookieId) {
        this.setVisitorIdCookie(res, visitor.id);
      }
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const session = await this.createSession(
      sessionId,
      visitor.id,
      cookieId,
      browserFingerprint,
      deviceInfo,
      geolocationData,
      isReturningVisitor
    );

    return {
      visitor,
      session,
      isNewVisitor,
      isReturningVisitor
    };
  }

  /**
   * Get or create session for existing visitor
   */
  static async getOrCreateSession(visitorId, browserFingerprint, deviceInfo = null, geolocationData = null) {
    // Check for active sessions
    const activeSessions = await Session.findActiveByVisitor(visitorId);
    
    // If there's an active session within timeout period, return it
    if (activeSessions.length > 0) {
      const latestSession = activeSessions[0];
      const sessionAge = Date.now() - new Date(latestSession.start_time).getTime();
      const timeoutMs = this.SESSION_TIMEOUT_MINUTES * 60 * 1000;
      
      if (sessionAge < timeoutMs) {
        return latestSession;
      } else {
        // End expired session
        await Session.endSession(latestSession.id);
      }
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const isReturningVisitor = await this.isReturningVisitor(visitorId);
    
    return await this.createSession(
      sessionId,
      visitorId,
      null, // Cookie ID not needed for existing visitor
      browserFingerprint,
      deviceInfo,
      geolocationData,
      isReturningVisitor
    );
  }

  /**
   * End expired sessions for cleanup
   */
  static async endExpiredSessions() {
    return await Session.endExpiredSessions(this.SESSION_TIMEOUT_MINUTES);
  }

  /**
   * Get visitor statistics
   */
  static async getVisitorStatistics(dateFrom, dateTo) {
    const stats = await Visitor.getStatistics({ dateFrom, dateTo });
    
    return {
      totalVisitors: parseInt(stats.total_visitors.toString()),
      newVisitors: parseInt(stats.total_visitors.toString()) - parseInt(stats.returning_visitors.toString()),
      returningVisitors: parseInt(stats.returning_visitors.toString()),
      averageSessionsPerVisitor: parseFloat(stats.avg_sessions_per_visitor?.toString() || '0'),
      averagePageViewsPerVisitor: parseFloat(stats.avg_page_views_per_visitor?.toString() || '0')
    };
  }

  /**
   * Clean up old visitor data for privacy compliance
   */
  static async cleanupOldData(retentionDays = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const visitorsDeleted = await Visitor.deleteOldRecords(cutoffDate);
    const sessionsDeleted = await Session.deleteOldRecords(cutoffDate);

    return {
      visitorsDeleted,
      sessionsDeleted
    };
  }
}

module.exports = VisitorIdentificationService;