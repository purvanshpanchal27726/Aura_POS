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

  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'mySuperSecretJWTKeyForPOSSystem2026';
      const decoded = jwt.verify(token, secret);
      req.user = decoded; // Contains user_id, client_id, role_id
      
      const headerClientId = req.headers['x-client-id'];
      const userCid = (decoded.client_id === null || decoded.client_id === undefined) ? 0 : parseInt(decoded.client_id);
      const isSuperAdmin = (decoded.role_id === 1 || decoded.role_id === 2 || decoded.role_id === '1' || decoded.role_id === '2' || decoded.is_superadmin === 1 || userCid === 0);

      if (!isSuperAdmin && headerClientId && headerClientId.toString() !== userCid.toString()) {
        return res.status(403).json({ error: 'Forbidden: Client ID mismatch with token' });
      }
    } catch (err) {
      if (!isPublic) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }
  }

  if (!isPublic && !req.user) {
    return res.status(401).json({ error: 'Authorization token is missing' });
  }

  next();
};
