const prisma = require('../config/db');
const emailSvc = require('../services/email.service');

async function listPublicReviews(req, res, next) {
  try {
    const reviews = await prisma.review.findMany({
      where: { hidden: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const company = String(req.body.company || '').trim().slice(0, 80);
    const comment = String(req.body.comment || '').trim().slice(0, 1000);
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body.rating))));

    if (!name || !comment || !rating) {
      return res.status(400).json({ error: 'Name, rating and comment are required.' });
    }

    const review = await prisma.review.create({
      data: { name, company: company || null, comment, rating },
    });

    emailSvc.notify(
      `New ${rating}★ review from ${name}`,
      `${name}${company ? ' (' + company + ')' : ''} left a ${rating}-star review:\n\n"${comment}"\n\nRespond from the admin panel: /admin.html`
    );

    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

async function listReviewsForAdmin(req, res, next) {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
}

async function respondToReview(req, res, next) {
  try {
    const response = String(req.body.response || '').trim().slice(0, 1000);
    if (!response) return res.status(400).json({ error: 'Response text is required.' });

    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { response, respondedAt: new Date(), respondedByAdminId: req.admin.id },
    });
    res.json({ review });
  } catch (err) {
    next(err);
  }
}

async function setReviewHidden(req, res, next) {
  try {
    const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Review not found.' });
    const hidden = req.body.hidden !== undefined ? !!req.body.hidden : !existing.hidden;

    const review = await prisma.review.update({ where: { id: req.params.id }, data: { hidden } });
    res.json({ review });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublicReviews, createReview, listReviewsForAdmin, respondToReview, setReviewHidden };
