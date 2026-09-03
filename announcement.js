(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function dismissedKey(id) {
    return 'infopedia_dismissed_announcement_' + id;
  }

  const KIND_LABELS = {
    news: 'News',
    circular: 'Circular',
    update: 'Update',
    advertisement: 'Advertisement',
    warning: 'Warning',
    announcement: 'Announcement',
  };

  function showAnnouncement(a) {
    const label = KIND_LABELS[a.kind] || 'News';
    const tagClass = a.kind && a.kind !== 'news' ? ' is-' + a.kind : '';
    const backdrop = document.createElement('div');
    backdrop.className = 'announce-backdrop';
    backdrop.innerHTML = `
      <div class="announce-card" role="dialog" aria-modal="true" aria-label="${label}">
        <button class="announce-close" aria-label="Close">&times;</button>
        ${a.image ? `<img class="announce-image" src="${escapeHtml(a.image)}" alt="">` : ''}
        <span class="announce-tag${tagClass}">${label}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.message)}</p>
      </div>
    `;
    document.body.appendChild(backdrop);

    function close() {
      try { localStorage.setItem(dismissedKey(a.id), '1'); } catch (e) { /* private mode etc — fine, it'll just show again */ }
      backdrop.remove();
    }
    backdrop.querySelector('.announce-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
  }

  async function loadAnnouncement() {
    try {
      const res = await fetch('/api/announcement');
      if (!res.ok) return;
      const data = await res.json();
      const a = data.announcement;
      if (!a) return;
      let dismissed = false;
      try { dismissed = localStorage.getItem(dismissedKey(a.id)) === '1'; } catch (e) { /* ignore */ }
      if (!dismissed) showAnnouncement(a);
    } catch (e) {
      // Silently skip — a broken announcement fetch shouldn't affect the rest of the page.
    }
  }

  loadAnnouncement();
})();
