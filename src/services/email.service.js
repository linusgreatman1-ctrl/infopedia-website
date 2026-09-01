// Optional email notifications — fires on every new review or contact
// submission if SMTP_* env vars are set, silently skipped otherwise
// (the submission itself is always saved regardless).
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // not installed — email notifications simply won't fire
}

function isConfigured() {
  return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NOTIFY_EMAIL);
}

let transport = null;
function getTransport() {
  if (!isConfigured()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

async function notify(subject, text) {
  const t = getTransport();
  if (!t) return;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL,
      subject,
      text,
    });
  } catch (err) {
    console.error('[email] notification failed (submission was still saved):', err.message);
  }
}

module.exports = { notify, isConfigured };
