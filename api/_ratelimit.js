// Simple in-memory rate limiter
// Note: For serverless, this only works within a single instance.
// For production scale, consider Upstash Redis or Vercel KV.

const requests = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = {
  'sanitize': 10,      // 10 sanitize requests per minute
  'analyze': 10,       // 10 quality analysis requests per minute
  'transform': 20,     // 20 transform requests per minute (conversations)
  'save': 5,           // 5 save requests per minute
  'default': 30        // 30 requests per minute for other endpoints
};

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, data] of requests) {
    if (now - data.windowStart > WINDOW_MS) {
      requests.delete(key);
    }
  }
}

export function rateLimit(req, endpoint = 'default') {
  // Cleanup periodically
  if (Math.random() < 0.1) cleanupOldEntries();

  const ip = getClientIP(req);
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const maxRequests = MAX_REQUESTS[endpoint] || MAX_REQUESTS.default;

  const data = requests.get(key);

  if (!data || now - data.windowStart > WINDOW_MS) {
    // New window
    requests.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (data.count >= maxRequests) {
    const retryAfter = Math.ceil((data.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  data.count++;
  return { allowed: true, remaining: maxRequests - data.count };
}

export function rateLimitMiddleware(endpoint = 'default') {
  return (req, res, next) => {
    const result = rateLimit(req, endpoint);

    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: 'Too many requests. Please slow down.',
        retryAfter: result.retryAfter
      });
    }

    if (next) next();
    return true;
  };
}
