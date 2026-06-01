# 🗺️ DODI Explorer — Local Discovery App

**Developed by Adry Doditech**

Una PWA gratuita per scoprire attrazioni, luoghi nascosti, punti panoramici e gemme nascoste vicino alla tua posizione.

---

## 📁 Struttura del Progetto

```
dodi-explorer/
├── index.html              # App shell principale (PWA)
├── manifest.json           # Manifest PWA (installazione)
├── sw.js                   # Service Worker (offline)
├── generate_icons.py       # Script generazione icone
│
├── css/
│   └── style.css           # Tema dark/light, mobile-first
│
├── js/
│   └── app.js              # Logica principale app
│
└── icons/
    ├── icon-192.svg        # Icona app (192px)
    ├── icon-512.svg        # Icona app (512px)
    └── icon-*.svg          # Altre dimensioni
```

---

## 🚀 Tecnologie Usate (TUTTE GRATUITE)

| Tecnologia | Scopo | Costo |
|---|---|---|
| HTML/CSS/JS | Frontend | ✅ Free |
| Leaflet.js | Mappa interattiva | ✅ Free |
| OpenStreetMap | Tiles mappa | ✅ Free |
| CartoCDN | Tiles dark/light | ✅ Free |
| Overpass API | Dati POI (luoghi) | ✅ Free |
| Wikipedia API | Descrizioni luoghi | ✅ Free |
| Nominatim | Geocoding/ricerca | ✅ Free |
| HTML5 Geolocation | Posizione utente | ✅ Free |
| Service Worker | Offline mode | ✅ Free |
| PWA Manifest | Installazione | ✅ Free |
| localStorage | Preferiti locali | ✅ Free |

---

## ⚙️ API Utilizzate

### 1. Overpass API (OpenStreetMap)
Interroga tutti i POI (punti di interesse) entro un raggio dato.
```
https://overpass-api.de/api/interpreter
POST: data=[out:json];(node["tourism"](bbox););out;
```

### 2. Wikipedia API (Italiano)
Ottieni descrizioni e immagini dei luoghi.
```
https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=NOME&format=json&origin=*
```

### 3. Nominatim (geocoding)
Ricerca testuale di luoghi → coordinate.
```
https://nominatim.openstreetmap.org/search?q=QUERY&format=json
```

---

## 📱 Funzionalità Implementate

- ✅ **Geolocalizzazione** HTML5 con fallback
- ✅ **Mappa interattiva** Leaflet + OpenStreetMap
- ✅ **Pin categorizzati** per tipo di luogo
- ✅ **Ricerca luoghi** via Nominatim
- ✅ **Filtri per categoria** (Storico, Natura, Panorami, Gemme, Cibo, Avventura)
- ✅ **Schede luogo** con descrizione Wikipedia
- ✅ **Immagini** da Wikipedia
- ✅ **Distanza** calcolata in tempo reale
- ✅ **Gemme Nascoste** sezione dedicata
- ✅ **Percorsi** (piedi/bici/moto via OSM)
- ✅ **Esplorazione casuale** (shuffle POI)
- ✅ **Preferiti** salvati in localStorage
- ✅ **Condivisione** via Web Share API
- ✅ **Tema dark/light** switchabile
- ✅ **Service Worker** per cache offline
- ✅ **Manifest PWA** installabile
- ✅ **Banner installazione** automatico
- ✅ **Toast notifiche** feedback utente
- ✅ **Raggio regolabile** 1–50 km

---

## 🌐 Deploy GRATUITO

### Opzione 1 — GitHub Pages (CONSIGLIATA)
```bash
# 1. Crea repo su GitHub
git init
git add .
git commit -m "DODI Explorer v1.0"
git remote add origin https://github.com/TUO_USERNAME/dodi-explorer.git
git push -u origin main

# 2. Vai su Settings → Pages → Source: main branch
# URL: https://TUO_USERNAME.github.io/dodi-explorer/
```

### Opzione 2 — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
# URL: https://dodi-explorer.web.app
```

### Opzione 3 — Netlify
Trascina la cartella del progetto su:
https://app.netlify.com/drop
URL automatico gratuito in 30 secondi!

### Opzione 4 — Vercel
```bash
npx vercel
```

---

## 📲 Pubblicazione Google Play Store

Per pubblicare come app Android sul Play Store **a costo zero**:

### Metodo 1 — Bubblewrap (Google ufficiale)
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://TUO_SITO/manifest.json
bubblewrap build
# Genera un .apk / .aab pronto per il Play Store
```

### Metodo 2 — PWABuilder (GRATUITO)
1. Vai su https://www.pwabuilder.com
2. Inserisci l'URL della tua PWA
3. Clicca "Package for stores" → Android
4. Download del file .aab
5. Carica sul Google Play Console

### Costi Play Store
- Account sviluppatore: **$25 una tantum** (unico costo)
- Hosting: $0 (usa GitHub Pages)
- App: $0

---

## 🔮 Funzionalità Future (Roadmap)

### v1.1
- [ ] Firebase Auth (login Google)
- [ ] Firestore per preferiti cross-device
- [ ] Upload foto luoghi da utenti
- [ ] Sistema di rating e recensioni

### v1.2
- [ ] Percorsi GPX scaricabili
- [ ] Modalità AR (realtà aumentata) con DeviceOrientation API
- [ ] Notifiche push per nuovi luoghi
- [ ] Modalità multi-lingua

### v2.0
- [ ] Community features
- [ ] Gamification (badge esploratore)
- [ ] Integrazione Flickr API per più foto
- [ ] Sincronizzazione offline avanzata

---

## 🛠️ Sviluppo Locale

```bash
# Clona il repo
git clone https://github.com/adry-doditech/dodi-explorer.git
cd dodi-explorer

# Avvia server locale (HTTPS necessario per geolocalizzazione)
npx serve .
# oppure
python3 -m http.server 8080

# Per HTTPS locale (necessario per PWA):
npx local-ssl-proxy --source 8443 --target 8080
# poi apri: https://localhost:8443
```

---

## 📋 Limiti API Gratuiti

| API | Limite Gratuito | Note |
|---|---|---|
| Overpass API | ~10.000 req/giorno | Rate limiting automatico |
| Wikipedia API | Illimitata | Throttle 200 req/s |
| Nominatim | 1 req/secondo | No bulk queries |
| OpenStreetMap tiles | Ragionevole uso | No commerciale |

---

## 📄 Licenza

MIT License — libero uso, modifica e distribuzione.

```
Developed with ❤️ by Adry Doditech
© 2024 DODI Explorer — Tutti i diritti riservati
```
