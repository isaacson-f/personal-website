// Simple in-memory rate limiting for serverless
const requests = new Map();

function rateLimit(ip, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean old entries
  for (const [key, timestamps] of requests.entries()) {
    const filtered = timestamps.filter(time => time > windowStart);
    if (filtered.length === 0) {
      requests.delete(key);
    } else {
      requests.set(key, filtered);
    }
  }
  
  // Check current IP
  const ipRequests = requests.get(ip) || [];
  const recentRequests = ipRequests.filter(time => time > windowStart);
  
  if (recentRequests.length >= maxRequests) {
    return false; // Rate limited
  }
  
  // Add current request
  recentRequests.push(now);
  requests.set(ip, recentRequests);
  
  return true; // Allowed
}

function validateRequest(req) {
  const { body, headers } = req;
  
  // Basic validation
  if (!body || typeof body !== 'object') {
    return false;
  }
  
  // Check for suspicious patterns
  const userAgent = headers['user-agent'] || '';
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i
  ];
  
  // Allow legitimate bots but block obvious scrapers
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent)) && 
      !userAgent.includes('Googlebot') && 
      !userAgent.includes('Bingbot')) {
    return false;
  }
  
  return true;
}

module.exports = { rateLimit, validateRequest };