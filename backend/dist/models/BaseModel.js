"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModel = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
/**
 * Base model class providing common functionality for all models
 */
class BaseModel {
    constructor(data = {}) {
        this.data = data;
        this.errors = [];
    }
    /**
     * Validate model data against schema
     */
    static validate(schema, data) {
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        return {
            isValid: !error,
            errors: error ? error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            })) : [],
            value
        };
    }
    /**
     * Execute a database query with error handling
     */
    static async executeQuery(sql, params = []) {
        try {
            return await (0, database_1.query)(sql, params);
        }
        catch (error) {
            console.error('Database query error:', {
                sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Execute multiple queries in a transaction
     */
    static async executeTransaction(callback) {
        try {
            return await (0, database_1.transaction)(callback);
        }
        catch (error) {
            console.error('Transaction error:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
    /**
     * Generate UUID for primary keys
     */
    static generateId() {
        return (0, uuid_1.v4)();
    }
    /**
     * Get current timestamp
     */
    static getCurrentTimestamp() {
        return new Date();
    }
    /**
     * Sanitize string input to prevent XSS
     */
    static sanitizeString(input) {
        if (typeof input !== 'string')
            return input;
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .trim()
            .substring(0, 10000); // Limit length
    }
    /**
     * Validate and sanitize URL
     */
    static sanitizeUrl(url) {
        if (!url || typeof url !== 'string')
            return null;
        try {
            // Allow relative URLs and full URLs
            if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
                return url.substring(0, 2048); // Limit URL length
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Validate IP address
     */
    static validateIpAddress(ip) {
        if (!ip || typeof ip !== 'string')
            return null;
        // Basic IPv4 and IPv6 validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
            return ip;
        }
        return null;
    }
}
exports.BaseModel = BaseModel;
//# sourceMappingURL=BaseModel.js.map