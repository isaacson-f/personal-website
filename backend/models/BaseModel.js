const Joi = require('joi');
const { query, transaction } = require('../config/database');

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
   * @param {Object} schema - Joi validation schema
   * @param {Object} data - Data to validate
   * @returns {Object} Validation result
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
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Object} Query result
   */
  static async executeQuery(sql, params = []) {
    try {
      return await query(sql, params);
    } catch (error) {
      console.error('Database query error:', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback - Transaction callback
   * @returns {*} Transaction result
   */
  static async executeTransaction(callback) {
    try {
      return await transaction(callback);
    } catch (error) {
      console.error('Transaction error:', error.message);
      throw error;
    }
  }

  /**
   * Generate UUID for primary keys
   * @returns {string} UUID
   */
  static generateId() {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }

  /**
   * Get current timestamp
   * @returns {Date} Current timestamp
   */
  static getCurrentTimestamp() {
    return new Date();
  }

  /**
   * Sanitize string input to prevent XSS
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 10000); // Limit length
  }

  /**
   * Validate and sanitize URL
   * @param {string} url - URL to validate
   * @returns {string|null} Sanitized URL or null if invalid
   */
  static sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      // Allow relative URLs and full URLs
      if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
        return url.substring(0, 2048); // Limit URL length
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate IP address
   * @param {string} ip - IP address to validate
   * @returns {string|null} Valid IP or null
   */
  static validateIpAddress(ip) {
    if (!ip || typeof ip !== 'string') return null;
    
    // Basic IPv4 and IPv6 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return ip;
    }
    
    return null;
  }
}

module.exports = BaseModel;