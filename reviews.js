(function () {
  const listEl = document.getElementById('reviewsList');
  const form = document.getElementById('reviewForm');
  const starInput = document.getElementById('starInput');
  const ratingField = document.getElementById('rvRating');
  const noteEl = document.getElementById('reviewFormNote');
  if (!listEl || !form) return;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function starString(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      listEl.innerHTML = '<p class="reviews-status">Be the first to leave a review.</p>';
      return;
    }
    listEl.innerHTML = reviews.map((r) => `
      <article class="review-card">
        <div class="review-head">
          <span class="review-stars" aria-label="${r.rating} out of 5 stars">${starString(r.rating)}</span>
          <span class="review-date">${formatDate(r.createdAt)}</span>
        </div>
        <p class="review-comment">"${escapeHtml(r.comment)}"</p>
        <p class="review-author"><strong>${escapeHtml(r.name)}</strong>${r.company ? ' &middot; ' + escapeHtml(r.company) : ''}</p>
        ${r.response ? `
          <div class="review-response">
            <p class="response-label">Response from Infopedia Technology</p>
            <p>${escapeHtml(r.response)}</p>
          </div>
        ` : ''}
      </article>
    `).join('');
  }

  async function loadReviews() {
    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      renderReviews(data.reviews || []);
    } catch (e) {
      listEl.innerHTML = '<p class="reviews-status">Couldn\'t load reviews right now — please refresh the page.</p>';
    }
  }

  starInput.addEventListener('click', (e) => {
    const btn = e.target.closest('.star');
    if (!btn) return;
    const value = Number(btn.dataset.value);
    ratingField.value = value;
    Array.from(starInput.querySelectorAll('.star')).forEach((s) => {
      s.classList.toggle('is-active', Number(s.dataset.value) <= value);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const company = form.company.value.trim();
    const comment = form.comment.value.trim();
    const rating = Number(ratingField.value);

    if (!name || !comment || !rating) {
      noteEl.textContent = 'Please add your name, a rating, and a comment.';
      noteEl.classList.add('is-error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    noteEl.classList.remove('is-error');
    noteEl.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, comment, rating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      form.reset();
      ratingField.value = 0;
      Array.from(starInput.querySelectorAll('.star')).forEach((s) => s.classList.remove('is-active'));
      noteEl.textContent = 'Thanks — your review is live below.';
      await loadReviews();
    } catch (err) {
      noteEl.textContent = err.message || 'Something went wrong. Please try again.';
      noteEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadReviews();
})();
