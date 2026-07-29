const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Allow OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  const url = req.originalUrl || req.url;

  // Whitelist public endpoints
  const isPublic = 
    url.startsWith('/api/users/login') ||
    url.startsWith('/api/User/login') ||
    url.startsWith('/api/license') ||
    url.startsWith('/api/License') ||
    url.includes('/public/') ||
    // Flutter app needs these on startup to build login screen (GET only, no sensitive mutations)
    (req.method === 'GET' && (url.startsWith('/api/users') || url.startsWith('/api/User'))) ||
    (req.method === 'GET' && (url.startsWith('/api/permissions') || url.startsWith('/api/Permission')));

  if (isPublic) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Authorization header format must be Bearer <token>' });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET || 'mySuperSecretJWTKeyForPOSSystem2026';

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // Contains user_id, client_id, role_id
    
    // Strict client isolation verification
    const headerClientId = req.headers['x-client-id'];
    if (headerClientId && decoded.client_id && headerClientId.toString() !== decoded.client_id.toString()) {
      return res.status(403).json({ error: 'Forbidden: Client ID mismatch with token' });
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
