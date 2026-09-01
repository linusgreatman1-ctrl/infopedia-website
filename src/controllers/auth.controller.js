const prisma = require('../config/db');
const { comparePassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/jwt');

const REFRESH_COOKIE_NAME = 'infopedia_admin_refresh';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function publicAdmin(admin) {
  const { passwordHash, ...rest } = admin;
  return rest;
}

async function issueSession(res, admin) {
  const accessToken = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);

  await prisma.refreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  // Also returned in the JSON body (not just the cookie) so the admin panel
  // can store it in sessionStorage — same reasoning as the consumer apps:
  // a cookie alone is shared across every tab of the same browser.
  return { accessToken, refreshToken };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const admin = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!admin || !(await comparePassword(password, admin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const { accessToken, refreshToken } = await issueSession(res, admin);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    res.json({ admin: publicAdmin(admin), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'No refresh token.' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin) return res.status(401).json({ error: 'Account no longer exists.' });

    // Rotate: revoke the used refresh token, issue a fresh pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const { accessToken, refreshToken } = await issueSession(res, admin);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      const tokenHash = hashToken(token);
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } }).catch(() => {});
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
