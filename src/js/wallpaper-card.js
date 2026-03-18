function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const DOWNLOAD_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const LINK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

class WallpaperCard extends HTMLElement {
  constructor() {
    super();
    this._isFavorite = false;
  }

  connectedCallback() {
    this._data = {
      id: this.dataset.id,
      src: this.dataset.src,
      thumb: this.dataset.thumb,
      title: this.dataset.title,
      tags: (this.dataset.tags || '').split(',').filter(Boolean),
      theme: this.dataset.theme,
      size: this.dataset.size,
      width: parseInt(this.dataset.width, 10) || 0,
      height: parseInt(this.dataset.height, 10) || 0,
      bytes: parseInt(this.dataset.bytes, 10) || 0,
      ext: this.dataset.ext || 'jpg',
    };
    this._render();
    this._setupLazyLoad();
  }

  get data() { return this._data; }

  set favorite(val) {
    this._isFavorite = val;
    this._updateFavoriteUI();
  }

  _render() {
    const d = this._data;
    const isVideo = d.ext === 'webm' || d.ext === 'mp4';

    this.innerHTML = `
      <div class="card" role="button" tabindex="0"
           aria-label="${esc(d.title)}. Enter=preview, D=download, F=favorite">
        <div class="card-media-wrap">
          ${isVideo ? `
            <video autoplay loop muted playsinline class="card-media" src="${d.thumb || d.src}"></video>
          ` : `
            <img class="card-media" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${d.thumb || d.src}" alt="${esc(d.title)}" />
          `}
          <div class="card-badges">
            <span class="card-badge card-badge-theme">${esc(d.theme)}</span>
            <span class="card-badge card-badge-size">${esc(d.size)}</span>
          </div>
        </div>
        <div class="card-fav-idle" style="display:none" aria-hidden="true">★</div>
        <div class="card-overlay">
          <div class="card-overlay-fav">
            <button type="button" class="fav-btn" aria-label="Toggle favorite">☆</button>
          </div>
          <div class="card-title">${esc(d.title)}</div>
          <div class="card-actions">
            <button type="button" class="card-btn card-btn-primary copy-btn" aria-label="Copy URL for ${esc(d.title)}">
              ${LINK_SVG} URL
            </button>
            <button type="button" class="card-btn card-btn-secondary download-btn" aria-label="Download ${esc(d.title)}">
              ${DOWNLOAD_SVG} Save
            </button>
          </div>
        </div>
      </div>
    `;

    const card = this.querySelector('.card');
    card.addEventListener('click', () => this._dispatch('wallpaper:preview', this._data));
    card.addEventListener('keydown', (e) => this._handleKeyDown(e));
    this.querySelector('.copy-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this._copyUrl(); });
    this.querySelector('.download-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this._download(); });
    this.querySelector('.fav-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this._dispatch('wallpaper:favorite', { id: this._data.id }); });
  }

  _setupLazyLoad() {
    const img = this.querySelector('img.card-media');
    if (!img) return;
    if (!('IntersectionObserver' in window)) {
      img.src = img.dataset.src;
      img.onload = () => img.classList.add('is-loaded');
      return;
    }
    this._observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        img.src = img.dataset.src;
        img.onload = () => img.classList.add('is-loaded');
        this._observer.disconnect();
        this._observer = null;
      });
    }, { rootMargin: '300px' });
    this._observer.observe(img);
  }

  _updateFavoriteUI() {
    const idleStar = this.querySelector('.card-fav-idle');
    const favBtn = this.querySelector('.fav-btn');
    if (idleStar) idleStar.style.display = this._isFavorite ? '' : 'none';
    if (favBtn) {
      favBtn.textContent = this._isFavorite ? '★' : '☆';
      favBtn.classList.toggle('is-fav', this._isFavorite);
      favBtn.setAttribute('aria-pressed', this._isFavorite);
    }
  }

  async _copyUrl() {
    const fullUrl = new URL(this._data.src, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(fullUrl);
      this._dispatch('wallpaper:toast', { message: 'URL copied' });
    } catch {
      this._dispatch('wallpaper:toast', { message: 'Copy failed' });
    }
  }

  async _download() {
    try {
      const res = await fetch(this._data.src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this._data.id}.${this._data.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this._dispatch('wallpaper:toast', { message: 'Downloading...' });
    } catch {
      this._dispatch('wallpaper:toast', { message: 'Download failed' });
    }
  }

  _handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._dispatch('wallpaper:preview', this._data); }
    if (e.key === 'd') { e.preventDefault(); this._download(); }
    if (e.key === 'f') { e.preventDefault(); this._dispatch('wallpaper:favorite', { id: this._data.id }); }
  }

  _dispatch(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  disconnectedCallback() { this._observer?.disconnect(); }
}

customElements.define('wallpaper-card', WallpaperCard);
