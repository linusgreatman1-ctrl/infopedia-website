const prisma = require('../config/db');
const storage = require('../services/storage.service');

async function uploadMedia(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { filename, url } = storage.saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    const media = await prisma.media.create({
      data: { filename, url, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ media });
  } catch (err) {
    next(err);
  }
}

async function listMedia(req, res, next) {
  try {
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ media });
  } catch (err) {
    next(err);
  }
}

async function deleteMedia(req, res, next) {
  try {
    const existing = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'File not found.' });

    storage.deleteFile(existing.filename);
    await prisma.media.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadMedia, listMedia, deleteMedia };
