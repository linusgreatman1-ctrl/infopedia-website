const prisma = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');

function publicAdmin(admin) {
  const { passwordHash, ...rest } = admin;
  return rest;
}

async function listAdmins(req, res, next) {
  try {
    const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ admins: admins.map(publicAdmin) });
  } catch (err) {
    next(err);
  }
}

async function createAdmin(req, res, next) {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const name = String(req.body.name || '').trim().slice(0, 100);
    const password = String(req.body.password || '');

    if (!email || !name || password.length < 8) {
      return res.status(400).json({ error: 'Email, name and an 8+ character password are required.' });
    }

    const passwordHash = await hashPassword(password);
    const admin = await prisma.adminUser.create({ data: { email, name, passwordHash } });
    res.status(201).json({ admin: publicAdmin(admin) });
  } catch (err) {
    next(err);
  }
}

async function deleteAdmin(req, res, next) {
  try {
    if (req.params.id === req.admin.id) {
      return res.status(400).json({ error: 'You cannot remove your own account.' });
    }

    const count = await prisma.adminUser.count();
    if (count <= 1) {
      return res.status(400).json({ error: 'At least one admin account must remain.' });
    }

    await prisma.adminUser.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function changeOwnPassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: req.admin.id } });
    if (!(await comparePassword(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAdmins, createAdmin, deleteAdmin, changeOwnPassword };
