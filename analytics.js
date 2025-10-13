// Simple Analytics Tracking Script
(function() {
  // Auto-detect the analytics URL based on environment
  const ANALYTICS_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : `${window.location.protocol}//${window.location.hostname}/api`;
  
  // Generate simple session ID
  let sessionId = sessionStorage.getItem('analytics_session');
  if (!sessionId) {
    sessionId = Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem('analytics_session', sessionId);
  }

  // Track page view
  function trackPageView() {
    // Process referrer - if it's from the same site, just use the path
    let referrer = document.referrer;
    if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        const currentUrl = new URL(window.location.href);
        
        // If same origin (protocol + hostname + port), just use pathname + search + hash
        if (referrerUrl.origin === currentUrl.origin) {
          referrer = referrerUrl.pathname + referrerUrl.search + referrerUrl.hash;
        }
      } catch (e) {
        // Keep original referrer if URL parsing fails
      }
    }

    const data = {
      url: window.location.href,
      referrer: referrer,
      userAgent: navigator.userAgent
    };

    fetch(`${ANALYTICS_URL}/track/pageview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      body: JSON.stringify(data)
    }).catch(err => console.warn('Analytics tracking failed:', err));
  }

  // Track custom event
  function trackEvent(name, properties = {}) {
    const data = {
      name,
      properties
    };

    fetch(`${ANALYTICS_URL}/track/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      body: JSON.stringify(data)
    }).catch(err => console.warn('Analytics tracking failed:', err));
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