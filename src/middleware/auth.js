const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../config/db');

// Verifies the Bearer access token and loads a fresh minimal admin record
// (so a deleted admin is rejected even with a still-valid token), attaching
// it to req.admin.
async function requireAdminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdminAuth };
