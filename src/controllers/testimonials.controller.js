const prisma = require('../config/db');

async function listPublicTestimonials(req, res, next) {
  try {
    const testimonials = await prisma.testimonial.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    res.json({ testimonials });
  } catch (err) {
    next(err);
  }
}

async function listTestimonialsForAdmin(req, res, next) {
  try {
    const testimonials = await prisma.testimonial.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    res.json({ testimonials });
  } catch (err) {
    next(err);
  }
}

function readBody(req) {
  const quote = String(req.body.quote || '').trim().slice(0, 800);
  const name = String(req.body.name || '').trim().slice(0, 100);
  const role = String(req.body.role || '').trim().slice(0, 100) || null;
  const company = String(req.body.company || '').trim().slice(0, 100) || null;
  const avatar = String(req.body.avatar || '').trim().slice(0, 4) || null;
  const position = Number.isFinite(Number(req.body.position)) ? Math.trunc(Number(req.body.position)) : 0;
  return { quote, name, role, company, avatar, position };
}

async function createTestimonial(req, res, next) {
  try {
    const body = readBody(req);
    if (!body.quote || !body.name) return res.status(400).json({ error: 'Quote and name are required.' });
    const testimonial = await prisma.testimonial.create({ data: body });
    res.status(201).json({ testimonial });
  } catch (err) {
    next(err);
  }
}

async function updateTestimonial(req, res, next) {
  try {
    const body = readBody(req);
    if (!body.quote || !body.name) return res.status(400).json({ error: 'Quote and name are required.' });
    const testimonial = await prisma.testimonial.update({ where: { id: req.params.id }, data: body });
    res.json({ testimonial });
  } catch (err) {
    next(err);
  }
}

async function deleteTestimonial(req, res, next) {
  try {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublicTestimonials, listTestimonialsForAdmin, createTestimonial, updateTestimonial, deleteTestimonial };
