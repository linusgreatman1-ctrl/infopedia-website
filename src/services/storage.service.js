const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Local-disk media storage. Files land under <project root>/uploads and are
// served statically at /uploads/<filename> (wired in src/server.js).
//
// NOTE: this is NOT durable on hosts with an ephemeral filesystem (e.g.
// Render's free/starter web services) — every deploy or restart wipes
// /uploads, so previously uploaded media will 404 until re-uploaded. This
// is a deliberate placeholder pending a real object-storage key
// (Cloudinary/S3); saveFile() is the only function that needs to change to
// swap it in.
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

function saveFile(buffer, originalName, mimeType) {
  ensureUploadsDir();
  const ext = path.extname(originalName || '').slice(0, 10);
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return { filename, url: `/uploads/${filename}` };
}

function deleteFile(filename) {
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { uploadsDir, ensureUploadsDir, saveFile, deleteFile };
