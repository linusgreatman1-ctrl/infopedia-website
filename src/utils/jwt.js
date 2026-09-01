const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(admin) {
  return jwt.sign({ sub: admin.id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
  });
}

// jti makes each refresh token's tokenHash unique even when two are
// legitimately issued for the same admin within the same second.
function signRefreshToken(admin) {
  return jwt.sign({ sub: admin.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Refresh tokens are stored hashed, never in plaintext.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken };
