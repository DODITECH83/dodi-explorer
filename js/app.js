/**
 * DODI Explorer — Main App Logic
 * Developed by Adry Doditech
 * 
 * Technologies:
 * - Leaflet.js + OpenStreetMap for maps
 * - Overpass API for POI discovery
 * - Wikipedia API for descriptions
 * - HTML5 Geolocation API
 * - PWA Service Worker registration
 */

'use strict';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  nominatimUrl: 'https://nominatim.openstreetmap.org',
  wikiApiUrl: 'https://en.wikipedia.org/api/rest_v1',
  wikiSearchUrl: 'https://en.wikipedia.org/w/api.php',
  wikiItUrl: 'https://it.wikipedia.org/w/api.php',
  defaultRadius: 5000,   // meters
  maxRadius: 50000,
  defaultLat: 45.4654, // Milan fallback
  defaultLng: 9.1859,
  splashDuration: 2200,
  mapTiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  mapTilesLight: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  mapAttrib: '© OpenStreetMap contributors, © CARTO',
  gemTags: ['ruins','castle','archaeological_site','waterfall','cave_entrance','viewpoint','spring','natural_monument'],
};

// ============================================================
// CATEGORY DEFINITIONS
// ============================================================
const CATEGORIES = {
  historic: {
    label: 'Storico', emoji: '🏛️', color: '#d97706',
    query: `node["historic"](BBOX);way["historic"](BBOX);relation["historic"](BBOX);`
  },
  nature: {
    label: 'Natura', emoji: '🌿', color: '#16a34a',
    query: `node["natural"](BBOX);node["leisure"="park"](BBOX);node["leisure"="nature_reserve"](BBOX);`
  },
  viewpoint: {
    label: 'Panorami', emoji: '🔭', color: '#2563eb',
    query: `node["tourism"="viewpoint"](BBOX);node["natural"="peak"](BBOX);`
  },
  hidden: {
    label: 'Gemme', emoji: '💎', color: '#9333ea',
    query: `node["historic"="ruins"](BBOX);node["historic"="castle"](BBOX);node["natural"="cave_entrance"](BBOX);node["waterway"="waterfall"](BBOX);`
  },
  food: {
    label: 'Cibo', emoji: '🍽️', color: '#dc2626',
    query: `node["amenity"~"restaurant|cafe|bar|fast_food"](BBOX);`
  },
  adventure: {
    label: 'Avventura', emoji: '🥾', color: '#7c3aed',
    query: `node["natural"="peak"](BBOX);node["sport"~"hiking|climbing|cycling"](BBOX);node["tourism"="camp_site"](BBOX);`
  },
  all: {
    label: 'Tutti', emoji: '🌍', color: '#4ade80',
    query: `
      node["tourism"~"attraction|viewpoint|museum|gallery"](BBOX);
      node["historic"](BBOX);
      node["natural"~"peak|waterfall|cave_entrance|spring"](BBOX);
      node["leisure"~"park|nature_reserve"](BBOX);
    `
  }
};

// ============================================================
// WIKI DESCRIPTION CACHE
// ============================================================
const wikiCache = new Map();

// ============================================================
// MAIN APP CLASS
// ============================================================
class DODIExplorer {
  constructor() {
    this.map = null;
    this.tileLayer = null;
    this.userMarker = null;
    this.userCircle = null;
    this.placeMarkers = L.layerGroup();
    this.places = [];
    this.favorites = this._loadFavorites();
    this.currentPlace = null;
    this.userLat = null;
    this.userLng = null;
    this.radius = CONFIG.defaultRadius;
    this.activeFilter = 'all';
    this.isDark = true;
    this.installPrompt = null;

    this._init();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  async _init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW:', err));
    }

    // Wait for splash
    await this._sleep(CONFIG.splashDuration);
    this._showApp();

    // Wire up UI
    this._setupEventListeners();
    this._initMap();

    // Get user location
    await this._locateUser();
  }

  _showApp() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
  }

  // ============================================================
  // MAP INITIALIZATION
  // ============================================================
  _initMap() {
    this.map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      maxZoom: 18,
    }).setView([CONFIG.defaultLat, CONFIG.defaultLng], 13);

    this.tileLayer = L.tileLayer(CONFIG.mapTiles, {
      attribution: CONFIG.mapAttrib,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    this.placeMarkers.addTo(this.map);

    // Zoom controls (top-right)
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Click outside markers closes modal
    this.map.on('click', () => this._closeModal());
  }

  // ============================================================
  // GEOLOCATION
  // ============================================================
  async _locateUser() {
    this._showToast('📍 Rilevamento posizione…');
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        this._showToast('Geolocalizzazione non supportata', 'error');
        this._useDefaultLocation();
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLat = pos.coords.latitude;
          this.userLng = pos.coords.longitude;
          this._onLocationFound();
          resolve();
        },
        (err) => {
          console.warn('Geolocation error:', err);
          this._showToast('Posizione non disponibile, uso posizione di default', 'error');
          this._useDefaultLocation();
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  _useDefaultLocation() {
    this.userLat = CONFIG.defaultLat;
    this.userLng = CONFIG.defaultLng;
    this._onLocationFound();
  }

  _onLocationFound() {
    this.map.setView([this.userLat, this.userLng], 14, { animate: true });
    this._placeUserMarker();
    this._fetchPlaces();
    this._showToast('✅ Posizione trovata!', 'success');
  }

  _placeUserMarker() {
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.map.removeLayer(this.userCircle);
    }

    // Pulsing user dot
    const pulseIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:16px;height:16px;border-radius:50%;
        background:#4ade80;
        box-shadow:0 0 0 4px rgba(74,222,128,0.3),0 0 0 8px rgba(74,222,128,0.1);
        animation:pulse 2s infinite;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    this.userMarker = L.marker([this.userLat, this.userLng], { icon: pulseIcon })
      .addTo(this.map)
      .bindPopup('<b>Tu sei qui</b>');

    this.userCircle = L.circle([this.userLat, this.userLng], {
      radius: this.radius,
      color: '#4ade80',
      fillColor: '#4ade80',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '6 4',
    }).addTo(this.map);
  }

  // ============================================================
  // OVERPASS API — FETCH PLACES
  // ============================================================
  async _fetchPlaces() {
    const bbox = this._getBbox(this.userLat, this.userLng, this.radius);
    const cat = this.activeFilter;
    const queryBody = CATEGORIES[cat]?.query || CATEGORIES.all.query;
    const query = queryBody.replace(/BBOX/g, bbox);

    const overpassQuery = `
      [out:json][timeout:25];
      (${query});
      out body center 80;
    `;

    try {
      const res = await fetch(CONFIG.overpassUrl, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      this._processPlaces(data.elements || []);
    } catch (err) {
      console.error('Overpass error:', err);
      this._showToast('Errore nel caricamento dei luoghi', 'error');
      this._renderPlacesError();
    }
  }

  _getBbox(lat, lng, radius) {
    const deg = radius / 111320;
    const latDeg = deg;
    const lngDeg = deg / Math.cos(lat * Math.PI / 180);
    return `${lat - latDeg},${lng - lngDeg},${lat + latDeg},${lng + lngDeg}`;
  }

  _processPlaces(elements) {
    this.places = elements
      .filter(el => el.tags && (el.tags.name || el.tags['name:it'] || el.tags['name:en']))
      .map(el => {
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) return null;
        return {
          id: el.id,
          name: el.tags['name:it'] || el.tags.name || el.tags['name:en'],
          lat, lng,
          tags: el.tags,
          category: this._detectCategory(el.tags),
          distance: this._calcDistance(this.userLat, this.userLng, lat, lng),
          wiki: el.tags.wikipedia || el.tags['name:en'] || el.tags.name,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 60);

    this._renderMarkers();
    this._renderPlaceCards('places-grid', this.places);
    this._renderPlaceCards('gems-grid', this.places.filter(p => p.category === 'hidden'));
    this._renderFavorites();

    const count = this.places.length;
    document.getElementById('places-count').textContent = `${count} luoghi`;
  }

  _detectCategory(tags) {
    if (tags.historic === 'ruins' || tags.historic === 'castle' || tags.natural === 'cave_entrance' || tags.waterway === 'waterfall') return 'hidden';
    if (tags.tourism === 'viewpoint' || tags.natural === 'peak') return 'viewpoint';
    if (tags.historic) return 'historic';
    if (tags.natural || tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'nature';
    if (tags.amenity) return 'food';
    if (tags.sport) return 'adventure';
    return 'all';
  }

  _calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _formatDistance(m) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  // ============================================================
  // MAP MARKERS
  // ============================================================
  _renderMarkers() {
    this.placeMarkers.clearLayers();

    this.places.forEach(place => {
      const cat = CATEGORIES[place.category] || CATEGORIES.all;
      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-marker marker-${place.category}" title="${place.name}">
          <span>${cat.emoji}</span>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([place.lat, place.lng], { icon })
        .on('click', () => this._openPlaceModal(place));

      this.placeMarkers.addLayer(marker);
    });
  }

  // ============================================================
  // PLACE CARDS
  // ============================================================
  _renderPlaceCards(gridId, places) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!places.length) {
      grid.innerHTML = `<div class="empty-state">
        <p>Nessun luogo trovato in questa area.<br/>Prova ad aumentare il raggio!</p>
      </div>`;
      return;
    }

    grid.innerHTML = places.map(place => this._cardHTML(place)).join('');

    // Attach click listeners
    grid.querySelectorAll('.place-card').forEach(card => {
      const id = parseInt(card.dataset.id);
      const place = this.places.find(p => p.id === id);
      if (place) card.addEventListener('click', () => this._openPlaceModal(place));
    });
  }

  _cardHTML(place) {
    const cat = CATEGORIES[place.category] || CATEGORIES.all;
    const isFav = this.favorites.some(f => f.id === place.id);
    return `
    <div class="place-card" data-id="${place.id}">
      <div class="card-img-placeholder" role="img" aria-label="${place.name}">${cat.emoji}</div>
      <div class="card-body">
        <div class="card-cat">${cat.emoji} ${cat.label}</div>
        <div class="card-title">${this._esc(place.name)}</div>
        <div class="card-meta">
          <span class="card-dist">📍 ${this._formatDistance(place.distance)}</span>
          ${isFav ? '<span>❤️ Preferito</span>' : ''}
        </div>
      </div>
    </div>`;
  }

  _renderPlacesError() {
    const grid = document.getElementById('places-grid');
    if (grid) grid.innerHTML = `<div class="empty-state"><p>⚠️ Impossibile caricare i luoghi.<br/>Controlla la connessione.</p></div>`;
  }

  // ============================================================
  // PLACE MODAL
  // ============================================================
  async _openPlaceModal(place) {
    this.currentPlace = place;
    const modal = document.getElementById('modal');
    const cat = CATEGORIES[place.category] || CATEGORIES.all;

    // Basic info
    document.getElementById('modal-cat').textContent = `${cat.emoji} ${cat.label}`;
    document.getElementById('modal-title').textContent = place.name;
    document.getElementById('modal-dist').innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
      ${this._formatDistance(place.distance)}`;
    document.getElementById('modal-coords').innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;

    // Image placeholder emoji
    const img = document.getElementById('modal-img');
    img.src = '';
    img.alt = place.name;
    img.style.display = 'none';

    // Description — show spinner, then fetch wiki
    document.getElementById('modal-desc').innerHTML = '<div class="spinner small"></div>';

    // Favorite button
    const favBtn = document.getElementById('modal-fav');
    const isFav = this.favorites.some(f => f.id === place.id);
    favBtn.classList.toggle('active', isFav);

    // Navigate button
    document.getElementById('modal-navigate').onclick = () => {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank');
    };

    // Share button
    document.getElementById('modal-share').onclick = () => this._sharePlace(place);

    // Wikipedia button
    document.getElementById('modal-wiki').onclick = () => {
      const query = encodeURIComponent(place.name);
      window.open(`https://it.wikipedia.org/w/index.php?search=${query}`, '_blank');
    };

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Fetch Wikipedia description
    const desc = await this._fetchWikiDescription(place.name);
    document.getElementById('modal-desc').textContent = desc || `${place.name} è un luogo di interesse vicino a te. Esplora la zona per scoprire di più!`;

    // Try to get wiki image
    if (desc) {
      const imgUrl = await this._fetchWikiImage(place.name);
      if (imgUrl) {
        img.src = imgUrl;
        img.style.display = 'block';
        img.onerror = () => { img.style.display = 'none'; };
      }
    }
  }

  _closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
    this.currentPlace = null;
  }

  // ============================================================
  // WIKIPEDIA API
  // ============================================================
  async _fetchWikiDescription(name) {
    if (wikiCache.has(name)) return wikiCache.get(name);
    try {
      const url = `${CONFIG.wikiItUrl}?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*&srlimit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const page = data?.query?.search?.[0];
      if (!page) return null;

      const extractUrl = `${CONFIG.wikiItUrl}?action=query&prop=extracts&exintro=true&explaintext=true&pageids=${page.pageid}&format=json&origin=*`;
      const extRes = await fetch(extractUrl);
      const extData = await extRes.json();
      const pages = extData?.query?.pages;
      const extract = Object.values(pages)[0]?.extract;

      if (!extract) return null;
      const desc = extract.split('\n')[0].slice(0, 350);
      wikiCache.set(name, desc);
      return desc;
    } catch (e) {
      return null;
    }
  }

  async _fetchWikiImage(name) {
    try {
      const url = `${CONFIG.wikiItUrl}?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data?.query?.pages;
      return Object.values(pages)[0]?.thumbnail?.source || null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // FAVORITES
  // ============================================================
  _toggleFavorite(place) {
    const idx = this.favorites.findIndex(f => f.id === place.id);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
      this._showToast('💔 Rimosso dai preferiti');
    } else {
      this.favorites.push(place);
      this._showToast('❤️ Aggiunto ai preferiti!', 'success');
    }
    localStorage.setItem('dodi_favorites', JSON.stringify(this.favorites));
    const favBtn = document.getElementById('modal-fav');
    if (favBtn) favBtn.classList.toggle('active', idx < 0);
    this._renderFavorites();
  }

  _loadFavorites() {
    try { return JSON.parse(localStorage.getItem('dodi_favorites')) || []; }
    catch { return []; }
  }

  _renderFavorites() {
    this._renderPlaceCards('favs-grid', this.favorites);
  }

  // ============================================================
  // RANDOM EXPLORATION
  // ============================================================
  randomExplore() {
    if (!this.places.length) { this._showToast('Prima cerca luoghi nella mappa!'); return; }
    const random = this.places[Math.floor(Math.random() * this.places.length)];
    this.map.flyTo([random.lat, random.lng], 16, { animate: true, duration: 1.5 });
    setTimeout(() => this._openPlaceModal(random), 1600);
  }

  // ============================================================
  // ROUTES
  // ============================================================
  startRoute(type) {
    if (!this.userLat) { this._showToast('Posizione non disponibile'); return; }
    let params = { lat: this.userLat, lon: this.userLng };
    const urls = {
      walking: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${params.lat},${params.lon}`,
      cycling: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=${params.lat},${params.lon}`,
      motorcycle: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${params.lat},${params.lon}`,
    };
    window.open(urls[type] || urls.walking, '_blank');
  }

  // ============================================================
  // SHARE
  // ============================================================
  async _sharePlace(place) {
    const data = {
      title: place.name,
      text: `Ho trovato questo posto fantastico con DODI Explorer!\n📍 ${place.name}`,
      url: `https://www.google.com/maps?q=${place.lat},${place.lng}`,
    };
    if (navigator.share) {
      try { await navigator.share(data); }
      catch { this._copyToClipboard(data.url); }
    } else {
      this._copyToClipboard(data.url);
    }
  }

  _copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => this._showToast('🔗 Link copiato!', 'success'));
  }

  // ============================================================
  // THEME
  // ============================================================
  _toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('theme-dark', this.isDark);
    document.body.classList.toggle('theme-light', !this.isDark);

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = L.tileLayer(this.isDark ? CONFIG.mapTiles : CONFIG.mapTilesLight, {
        attribution: CONFIG.mapAttrib, subdomains: 'abcd', maxZoom: 19,
      }).addTo(this.map);
      this.tileLayer.bringToBack();
    }
  }

  // ============================================================
  // UI — TABS
  // ============================================================
  _switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    if (tabName === 'map') setTimeout(() => this.map?.invalidateSize(), 50);
  }

  // ============================================================
  // SEARCH / GEOCODING
  // ============================================================
  async _searchLocation(query) {
    if (!query.trim()) return;
    try {
      const url = `${CONFIG.nominatimUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await res.json();
      if (!data.length) { this._showToast('Luogo non trovato'); return; }
      const loc = data[0];
      this.map.flyTo([+loc.lat, +loc.lon], 13, { animate: true, duration: 1 });
      this._switchTab('map');
    } catch {
      this._showToast('Errore di ricerca', 'error');
    }
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  _showToast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  _setupEventListeners() {
    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // Filter chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        if (this.userLat) this._fetchPlaces();
      });
    });

    // Theme toggle
    document.getElementById('btn-theme').addEventListener('click', () => this._toggleTheme());

    // Favorites panel
    document.getElementById('btn-favorites').addEventListener('click', () => this._switchTab('favs'));

    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      if (searchInput.value.length > 2) {
        searchTimeout = setTimeout(() => this._searchLocation(searchInput.value), 800);
      }
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._searchLocation(searchInput.value);
    });

    // Locate button
    document.getElementById('btn-locate').addEventListener('click', async () => {
      await this._locateUser();
    });

    // Map buttons
    document.getElementById('btn-random').addEventListener('click', () => this.randomExplore());
    document.getElementById('btn-my-location').addEventListener('click', () => {
      if (this.userLat) this.map.flyTo([this.userLat, this.userLng], 15, { animate: true });
    });

    // Radius slider
    const slider = document.getElementById('radius-slider');
    const valEl = document.getElementById('radius-val');
    slider.addEventListener('input', () => {
      this.radius = slider.value * 1000;
      valEl.textContent = slider.value;
      if (this.userMarker && this.userCircle) {
        this.userCircle.setRadius(this.radius);
      }
    });
    slider.addEventListener('change', () => {
      if (this.userLat) this._fetchPlaces();
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => this._closeModal());
    document.getElementById('modal-backdrop').addEventListener('click', () => this._closeModal());

    // Modal favorite
    document.getElementById('modal-fav').addEventListener('click', () => {
      if (this.currentPlace) this._toggleFavorite(this.currentPlace);
    });

    // PWA install
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e;
      document.getElementById('install-banner').classList.remove('hidden');
    });
    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (this.installPrompt) {
        this.installPrompt.prompt();
        const result = await this.installPrompt.userChoice;
        if (result.outcome === 'accepted') this._showToast('✅ DODI Explorer installata!', 'success');
        document.getElementById('install-banner').classList.add('hidden');
      }
    });
    document.getElementById('install-no')?.addEventListener('click', () => {
      document.getElementById('install-banner').classList.add('hidden');
    });
  }

  // ============================================================
  // UTILS
  // ============================================================
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  _esc(str) { return str?.replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' })[c]) || ''; }
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DODIExplorer();
});
