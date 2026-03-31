const SEARCH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

class WallpaperFilters extends HTMLElement {
  constructor() {
    super();
    this._query = '';
    this._themes = [];
    this._sizes = [];
    this._viewMode = 'all';
    this._allThemes = [];
    this._allSizes = ['mobile', 'desktop', 'wide'];
    this._totalCount = 0;
    this._filteredCount = 0;
    this._favoritesCount = 0;
    this._initialized = false;
  }

  connectedCallback() {
    this._readURL();
    this._render();
    this._initialized = true;
    this._emitFilter();

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== this._input) { e.preventDefault(); this._input?.focus(); }
      if (e.key === 'Escape') this._input?.blur();
    });
  }

  update({ allThemes, totalCount, filteredCount, favoritesCount }) {
    if (allThemes) this._allThemes = allThemes;
    if (totalCount !== undefined) this._totalCount = totalCount;
    if (filteredCount !== undefined) this._filteredCount = filteredCount;
    if (favoritesCount !== undefined) this._favoritesCount = favoritesCount;
    this._renderThemes();
    this._renderThemeToggle();
    this._renderCount();
    this._renderViewTabs();
  }

  _readURL() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const theme = params.get('theme')?.split(',').map(t => t.trim()).filter(Boolean);
    const size = params.get('size')?.split(',').map(t => t.trim()).filter(Boolean);
    if (q) this._query = q;
    if (theme?.length) this._themes = theme;
    if (size?.length) this._sizes = size;
  }

  _syncURL() {
    const params = new URLSearchParams(window.location.search);
    params.delete('q'); params.delete('theme'); params.delete('size');
    if (this._query) params.set('q', this._query);
    if (this._themes.length) params.set('theme', this._themes.join(','));
    if (this._sizes.length) params.set('size', this._sizes.join(','));
    const search = params.toString();
    history.replaceState(null, '', `${window.location.pathname}${search ? '?' + search : ''}${window.location.hash}`);
  }

  _render() {
    this.innerHTML = `
      <search class="filter-bar" role="search" aria-label="Filter wallpapers">
        <div class="filter-row">
          <div class="view-tabs" role="tablist" aria-label="View mode">
            <button type="button" role="tab" class="view-tab" data-mode="all" aria-selected="true">All</button>
            <button type="button" role="tab" class="view-tab" data-mode="favorites" aria-selected="false">Favorites<span class="view-tab-count"></span></button>
          </div>
          <div class="search-box">
            <span class="search-icon" aria-hidden="true">${SEARCH_SVG}</span>
            <input type="search" class="search-input" aria-label="Search wallpapers" placeholder='Search...  "/"' value="${this._query}" />
            <button type="button" class="search-clear" aria-label="Clear search" style="${this._query ? '' : 'display:none'}">&#x2715;</button>
          </div>
          <div class="filter-actions">
            <button type="button" class="btn-sm clear-btn" style="display:none">Clear</button>
            <output class="count-display" aria-live="polite" aria-atomic="true">${this._totalCount}</output>
          </div>
        </div>
        <div class="size-row">
          <span style="font-size:0.75rem;font-family:var(--font-mono);color:var(--text-muted)">Size:</span>
          ${this._allSizes.map(s => `<button type="button" class="size-pill" aria-pressed="${this._sizes.includes(s)}" data-size="${s}">${s}</button>`).join('')}
        </div>
        <div class="tag-row">
          <button type="button" class="tag-toggle btn-sm" aria-expanded="false" aria-controls="theme-list">Themes</button>
          <div class="tag-list" id="theme-list" role="group" aria-label="Filter by theme"></div>
        </div>
      </search>
    `;

    this._input = this.querySelector('.search-input');
    this._input.addEventListener('input', () => { this._query = this._input.value; this._updateClearBtn(); this._syncURL(); this._emitFilter(); });
    this.querySelector('.search-clear')?.addEventListener('click', () => { this._query = ''; this._input.value = ''; this._input.focus(); this._updateClearBtn(); this._syncURL(); this._emitFilter(); });
    this.querySelector('.clear-btn').addEventListener('click', () => {
      this._query = ''; this._themes = []; this._sizes = []; this._input.value = ''; this._input.focus();
      this._updateClearBtn(); this._syncURL(); this._renderThemes(); this._renderSizes(); this._emitFilter();
    });
    this.querySelector('.tag-toggle').addEventListener('click', () => {
      const list = this.querySelector('.tag-list');
      const btn = this.querySelector('.tag-toggle');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      list.classList.toggle('is-open', !expanded);
    });
    this.querySelectorAll('.size-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        this._sizes = this._sizes.includes(size) ? this._sizes.filter(s => s !== size) : [...this._sizes, size];
        btn.setAttribute('aria-pressed', this._sizes.includes(size));
        this._updateClearBtn(); this._syncURL(); this._emitFilter();
      });
    });
    this.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => { this._viewMode = tab.dataset.mode; this._renderViewTabs(); this._emitFilter(); });
    });
    this._renderThemeToggle();
    this._updateClearBtn();
  }

  _renderThemes() {
    const container = this.querySelector('.tag-list');
    if (!container) return;
    container.innerHTML = this._allThemes.map(t => `
      <button type="button" class="tag-pill" aria-pressed="${this._themes.includes(t)}" data-theme="${t}">${t}</button>
    `).join('');
    container.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this._themes = this._themes.includes(theme) ? this._themes.filter(t => t !== theme) : [...this._themes, theme];
        btn.setAttribute('aria-pressed', this._themes.includes(theme));
        this._renderThemeToggle();
        this._updateClearBtn(); this._syncURL(); this._emitFilter();
      });
    });
  }

  _renderThemeToggle() {
    const btn = this.querySelector('.tag-toggle');
    if (!btn) return;
    const hasThemes = this._themes.length > 0;
    btn.classList.toggle('is-active', hasThemes);
    btn.setAttribute('aria-pressed', hasThemes);
    btn.textContent = hasThemes ? `Themes (${this._themes.length})` : 'Themes';
  }

  _renderSizes() {
    this.querySelectorAll('.size-pill').forEach(btn => {
      btn.setAttribute('aria-pressed', this._sizes.includes(btn.dataset.size));
    });
  }

  _renderCount() {
    const display = this.querySelector('.count-display');
    if (!display) return;
    const hasFilters = this._query || this._themes.length || this._sizes.length;
    display.textContent = hasFilters && this._filteredCount !== this._totalCount
      ? `${this._filteredCount}/${this._totalCount}` : `${this._totalCount}`;
  }

  _renderViewTabs() {
    this.querySelectorAll('.view-tab').forEach(tab => {
      tab.setAttribute('aria-selected', tab.dataset.mode === this._viewMode);
      const count = tab.querySelector('.view-tab-count');
      if (count) count.textContent = tab.dataset.mode === 'favorites' && this._favoritesCount > 0 ? this._favoritesCount : '';
    });
  }

  _updateClearBtn() {
    const btn = this.querySelector('.clear-btn');
    if (btn) btn.style.display = (this._query || this._themes.length || this._sizes.length) ? '' : 'none';
    const searchClear = this.querySelector('.search-clear');
    if (searchClear) searchClear.style.display = this._query ? '' : 'none';
  }

  _emitFilter() {
    if (!this._initialized) return;
    this.dispatchEvent(new CustomEvent('wallpaper:filter', {
      bubbles: true, composed: true,
      detail: { query: this._query, themes: this._themes, sizes: this._sizes, viewMode: this._viewMode },
    }));
  }
}

customElements.define('wallpaper-filters', WallpaperFilters);
