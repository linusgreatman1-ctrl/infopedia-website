(function () {
  const grid = document.getElementById('testimonialGrid');
  if (!grid) return;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  function renderTestimonials(items) {
    grid.innerHTML = items.map((t) => `
      <figure class="testimonial-card">
        <blockquote>"${escapeHtml(t.quote)}"</blockquote>
        <figcaption>
          <span class="testimonial-avatar">${escapeHtml(t.avatar || initials(t.name))}</span>
          <span><strong>${escapeHtml(t.name)}</strong><br>${[t.role, t.company].filter(Boolean).map(escapeHtml).join(', ')}</span>
        </figcaption>
      </figure>
    `).join('');
  }

  async function loadTestimonials() {
    try {
      const res = await fetch('/api/testimonials');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      // Leave the server-rendered fallback cards in place if the API
      // returns nothing — an empty state here would blank the section.
      if (data.testimonials && data.testimonials.length) renderTestimonials(data.testimonials);
    } catch (e) {
      // Keep whatever was already in the markup rather than showing an error.
    }
  }

  loadTestimonials();
})();
