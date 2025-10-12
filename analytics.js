// Simple Analytics Tracking Script
(function() {
  // Auto-detect the analytics URL based on environment
  const ANALYTICS_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : `${window.location.protocol}//${window.location.hostname}/api`;
  
  // Check if analytics backend is available
  const ANALYTICS_ENABLED = true; // KV is now configured!
  
  // Generate simple session ID
  let sessionId = sessionStorage.getItem('analytics_session');
  if (!sessionId) {
    sessionId = Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem('analytics_session', sessionId);
  }

  // Track page view
  function trackPageView() {
    const data = {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent
    };

    if (ANALYTICS_ENABLED) {
      fetch(`${ANALYTICS_URL}/track/pageview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify(data)
      }).catch(err => console.log('Analytics tracking failed:', err));
    } else {
      console.log('📊 Page view:', data.url);
    }
  }

  // Track custom event
  function trackEvent(name, properties = {}) {
    const data = {
      name,
      properties
    };

    if (ANALYTICS_ENABLED) {
      fetch(`${ANALYTICS_URL}/track/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify(data)
      }).catch(err => console.log('Analytics tracking failed:', err));
    } else {
      console.log('📊 Event:', name, properties);
    }
  }

  // Auto-track page view when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }

  // Expose tracking function globally
  window.analytics = {
    track: trackEvent,
    pageView: trackPageView
  };
})();