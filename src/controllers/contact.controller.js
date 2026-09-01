const prisma = require('../config/db');
const emailSvc = require('../services/email.service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createContact(req, res, next) {
  try {
    const name = String(req.body.name || '').trim().slice(0, 100);
    const email = String(req.body.email || '').trim().slice(0, 200);
    const service = String(req.body.service || '').trim().slice(0, 100);
    const message = String(req.body.message || '').trim().slice(0, 2000);

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and project details are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    await prisma.contactMessage.create({
      data: { name, email, service: service || null, message },
    });

    emailSvc.notify(
      `New enquiry — ${service || 'General'}`,
      `From: ${name} <${email}>\nService: ${service || '—'}\n\n${message}`
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listContactsForAdmin(req, res, next) {
  try {
    const contacts = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
}

async function setContactRead(req, res, next) {
  try {
    const existing = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Message not found.' });
    const read = req.body.read !== undefined ? !!req.body.read : !existing.read;

    const contact = await prisma.contactMessage.update({ where: { id: req.params.id }, data: { read } });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
}

module.exports = { createContact, listContactsForAdmin, setContactRead };
