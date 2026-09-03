const prisma = require('../config/db');

async function getActivePublic(req, res, next) {
  try {
    const announcement = await prisma.announcement.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
    res.json({ announcement: announcement || null });
  } catch (err) {
    next(err);
  }
}

async function listForAdmin(req, res, next) {
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
}

function readBody(req) {
  const kind = req.body.kind === 'circular' ? 'circular' : 'news';
  const title = String(req.body.title || '').trim().slice(0, 150);
  const message = String(req.body.message || '').trim().slice(0, 1000);
  return { kind, title, message };
}

async function createAnnouncement(req, res, next) {
  try {
    const body = readBody(req);
    if (!body.title || !body.message) return res.status(400).json({ error: 'Title and message are required.' });
    const announcement = await prisma.announcement.create({ data: body });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
}

async function updateAnnouncement(req, res, next) {
  try {
    const body = readBody(req);
    if (!body.title || !body.message) return res.status(400).json({ error: 'Title and message are required.' });
    const announcement = await prisma.announcement.update({ where: { id: req.params.id }, data: body });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

async function publishAnnouncement(req, res, next) {
  try {
    await prisma.$transaction([
      prisma.announcement.updateMany({ where: { active: true }, data: { active: false } }),
      prisma.announcement.update({ where: { id: req.params.id }, data: { active: true } }),
    ]);
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

async function unpublishAnnouncement(req, res, next) {
  try {
    const announcement = await prisma.announcement.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

async function deleteAnnouncement(req, res, next) {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getActivePublic,
  listForAdmin,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  deleteAnnouncement,
};
