const prisma = require('../config/db');

async function getOrCreateSettings() {
  const existing = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.siteSettings.create({ data: { id: 'singleton' } });
}

async function getPublicSettings(req, res, next) {
  try {
    const settings = await getOrCreateSettings();
    const { id, updatedAt, ...social } = settings;
    res.json({ settings: social });
  } catch (err) {
    next(err);
  }
}

async function getSettingsForAdmin(req, res, next) {
  try {
    const settings = await getOrCreateSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

function cleanUrl(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.slice(0, 300) : null;
}

async function updateSettings(req, res, next) {
  try {
    await getOrCreateSettings();
    const settings = await prisma.siteSettings.update({
      where: { id: 'singleton' },
      data: {
        linkedinUrl: cleanUrl(req.body.linkedinUrl),
        facebookUrl: cleanUrl(req.body.facebookUrl),
        instagramUrl: cleanUrl(req.body.instagramUrl),
        xUrl: cleanUrl(req.body.xUrl),
      },
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicSettings, getSettingsForAdmin, updateSettings };
