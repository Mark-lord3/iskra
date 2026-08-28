import { originAllowed } from '../config/security.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireTrustedBrowserOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method) || req.originalUrl === '/api/tickets/webhook') return next();
  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site')
    return res.status(403).json({ error:'Cross-site request blocked.', code:'UNTRUSTED_ORIGIN', requestId:req.requestId });
  const origin = req.get('origin');
  if (origin && !originAllowed(origin))
    return res.status(403).json({ error:'Request origin is not allowed.', code:'UNTRUSTED_ORIGIN', requestId:req.requestId });
  next();
}

export function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.set({
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy':'same-origin',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Permissions-Policy':'camera=(self), microphone=(), geolocation=(), payment=(self), usb=()'
  });
  const directives = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "form-action 'self'", "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob: https:",
    "connect-src 'self' ws: wss:", "media-src 'self' blob:", "worker-src 'self' blob:"
  ];
  if (process.env.NODE_ENV === 'production') {
    directives.push('upgrade-insecure-requests');
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.set('Content-Security-Policy', directives.join('; '));
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}
