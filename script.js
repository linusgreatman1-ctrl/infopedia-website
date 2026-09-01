document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const header = document.querySelector('.site-header');
navToggle.addEventListener('click', () => {
  const isOpen = header.classList.toggle('nav-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.main-nav a').forEach(a => {
  a.addEventListener('click', () => {
    header.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Services accordion
document.querySelectorAll('.service-item').forEach(item => {
  const head = item.querySelector('.service-head');
  head.addEventListener('click', () => {
    const willOpen = !item.classList.contains('is-open');
    document.querySelectorAll('.service-item').forEach(i => {
      i.classList.remove('is-open');
      i.querySelector('.service-head').setAttribute('aria-expanded', 'false');
    });
    if (willOpen) {
      item.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
    }
  });
});

// Contact form -> real backend submission (falls back to mailto if the
// backend is unreachable, e.g. when this page is opened as a static file
// with no server behind it).
const form = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const service = form.service.value;
  const message = form.message.value.trim();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalNote = formNote ? formNote.textContent : '';
  if (formNote) { formNote.textContent = 'Sending…'; formNote.classList.remove('is-error'); }

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, service, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');

    form.reset();
    if (formNote) formNote.textContent = "Thanks — we've got your message and will be in touch shortly.";
  } catch (err) {
    // Backend unreachable (e.g. static preview with no server) — fall back
    // to opening the user's own email client with the details pre-filled.
    const subject = `New enquiry — ${service}`;
    const body = `Name: ${name}\nEmail: ${email}\nService: ${service}\n\n${message}`;
    window.location.href = `mailto:info@infopediatech.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (formNote) formNote.textContent = originalNote;
  } finally {
    submitBtn.disabled = false;
  }
});
