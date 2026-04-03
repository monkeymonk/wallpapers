const FAVORITES_KEY = 'wallpaper-vault-favorites';

function loadSet(key) {
  try { const raw = localStorage.getItem(key); return raw ? new Set(JSON.parse(raw)) : new Set(); }
  catch { return new Set(); }
}
function saveSet(key, set) { localStorage.setItem(key, JSON.stringify([...set])); }

function normalizeFavorites(storedFavorites, items) {
  const favorites = new Set();
  const itemsById = new Map();
  const validSrcs = new Set(items.map((item) => item.src));

  items.forEach((item) => {
    const matches = itemsById.get(item.id) || [];
    matches.push(item);
    itemsById.set(item.id, matches);
  });

  storedFavorites.forEach((value) => {
    if (validSrcs.has(value)) {
      favorites.add(value);
      return;
    }

    const legacyMatches = itemsById.get(value) || [];
    legacyMatches.forEach((item) => favorites.add(item.src));
  });

  return favorites;
}

class WallpaperGallery extends HTMLElement {
  constructor() {
    super();
    this._items = [];
    this._filteredItems = [];
    this._favorites = new Set();
    this._query = '';
    this._selectedThemes = [];
    this._selectedSizes = [];
    this._viewMode = 'all';
    this._toastTimer = null;
  }

  connectedCallback() {
    this._baseUrl = this.dataset.baseUrl || '';
    requestAnimationFrame(() => this._init());
  }

  _init() {
    this._cards = Array.from(this.querySelectorAll('wallpaper-card'));
    this._items = this._cards.map(card => card.data);
    this._items.forEach(item => {
      item._search = `${item.title} ${(item.tags || []).join(' ')} ${item.theme} ${item.size}`.toLowerCase();
    });
    this._favorites = normalizeFavorites(loadSet(FAVORITES_KEY), this._items);
    saveSet(FAVORITES_KEY, this._favorites);

    this._allThemes = Array.from(new Set(this._items.map(i => i.theme).filter(Boolean))).sort();

    this._lightbox = document.createElement('wallpaper-lightbox');
    this.appendChild(this._lightbox);

    this._filteredItems = [...this._items];
    this._filters = this.querySelector('wallpaper-filters');

    this._cards.forEach(card => { card.favorite = this._favorites.has(card.data.src); });
    this._updateFilters();

    this.addEventListener('wallpaper:filter', (e) => this._onFilter(e.detail));
    this.addEventListener('wallpaper:preview', (e) => this._onPreview(e.detail));
    this.addEventListener('wallpaper:favorite', (e) => this._onFavorite(e.detail));
    this.addEventListener('wallpaper:toast', (e) => this._showToast(e.detail.message));
    this.addEventListener('wallpaper:download-zip', () => this._downloadZip());
    this.addEventListener('wallpaper:lightbox-close', () => this._lightbox.close());
    this.addEventListener('wallpaper:lightbox-change', (e) => {
      this._lightbox.updateFavorite(this._favorites.has(e.detail.src));
    });
  }

  _onFilter({ query, themes, sizes, viewMode }) {
    this._query = query || '';
    this._selectedThemes = themes || [];
    this._selectedSizes = sizes || [];
    this._viewMode = viewMode || 'all';
    this._applyFilters();
  }

  _applyFilters() {
    const q = this._query.trim().toLowerCase();
    this._cards.forEach(card => {
      const item = card.data;
      let visible = true;
      if (this._viewMode === 'favorites') visible = this._favorites.has(item.src);
      if (visible && q) visible = item._search.includes(q);
      if (visible && this._selectedThemes.length > 0) visible = this._selectedThemes.includes(item.theme);
      if (visible && this._selectedSizes.length > 0) visible = this._selectedSizes.includes(item.size);
      card.style.display = visible ? '' : 'none';
    });

    const visibleCount = this._cards.filter(c => c.style.display !== 'none').length;
    this._filteredItems = this._items.filter((_, i) => this._cards[i].style.display !== 'none');
    this._filters?.update({
      filteredCount: visibleCount,
      totalCount: this._items.length,
      favoritesCount: this._cards.filter((card) => this._favorites.has(card.data.src)).length,
    });
    this._updateEmptyState(visibleCount);
  }

  _updateEmptyState(count) {
    let empty = this.querySelector('.wallpaper-empty-state');
    if (count === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'state-container wallpaper-empty-state';
        empty.setAttribute('role', 'status');
        empty.innerHTML = '<div class="state-empty"><div class="state-empty-icon" aria-hidden="true">:/</div><div class="state-text" style="color:var(--text-muted)">No wallpapers match your search</div></div>';
        this.querySelector('.wallpaper-grid')?.after(empty);
      }
      empty.style.display = '';
    } else if (empty) {
      empty.style.display = 'none';
    }
  }

  _onPreview(item) {
    this._lightbox.open(item, this._filteredItems, this._favorites.has(item.src));
  }

  _onFavorite({ id, src }) {
    const key = src || this._items.find((item) => item.id === id)?.src;
    if (!key) return;
    if (this._favorites.has(key)) this._favorites.delete(key);
    else this._favorites.add(key);
    saveSet(FAVORITES_KEY, this._favorites);
    this._cards
      .filter((card) => card.data.src === key)
      .forEach((card) => { card.favorite = this._favorites.has(key); });
    if (this._lightbox.isOpen) this._lightbox.updateFavorite(this._favorites.has(key));
    this._filters?.update({ favoritesCount: this._cards.filter((card) => this._favorites.has(card.data.src)).length });
    if (this._viewMode === 'favorites') this._applyFilters();
  }

  _updateFilters() {
    this._filters?.update({
      allThemes: this._allThemes,
      totalCount: this._items.length,
      filteredCount: this._items.length,
      favoritesCount: this._cards.filter((card) => this._favorites.has(card.data.src)).length,
    });
  }

  async _downloadZip() {
    if (typeof JSZip === 'undefined') {
      this._showToast('JSZip not loaded');
      return;
    }
    const favItems = this._items.filter(item => this._favorites.has(item.src));
    if (!favItems.length) return;

    const zip = new JSZip();
    let done = 0;
    this._filters?.setZipProgress(0, favItems.length);
    this._showToast(`Fetching 0/${favItems.length}...`);

    for (const item of favItems) {
      try {
        const res = await fetch(item.src);
        const blob = await res.blob();
        const filename = `${item.theme}/${item.id}.${item.ext}`;
        zip.file(filename, blob);
      } catch {
        // skip failed files
      }
      done++;
      this._filters?.setZipProgress(done, favItems.length);
      this._showToast(`Fetching ${done}/${favItems.length}...`);
    }

    this._showToast('Creating ZIP...');
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallpapers-${favItems.length}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._showToast('Download started');
  }

  _showToast(message) {
    clearTimeout(this._toastTimer);
    let toast = this.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      this.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = '';
    toast.style.animation = 'none';
    toast.offsetHeight;
    toast.style.animation = '';
    this._toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }
}

customElements.define('wallpaper-gallery', WallpaperGallery);
