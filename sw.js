// Service Worker פשוט - מאפשר התקנה כ-PWA והפעלה אופליין בסיסית
// ע"י cache-first לקבצים הסטטיים של האפליקציה.

const CACHE_NAME = "fm-lite-cache-v11";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./players.json",
  "./css/style.css",
  "./js/ui/app.js",
  "./js/ui/render.js",
  "./js/ui/format.js",
  "./js/engine/controller.js",
  "./js/engine/newGame.js",
  "./js/engine/round.js",
  "./js/engine/simulate.js",
  "./js/engine/squad.js",
  "./js/engine/table.js",
  "./js/engine/fixtures.js",
  "./js/engine/economy.js",
  "./js/engine/transferMarket.js",
  "./js/engine/events.js",
  "./js/engine/seasonEnd.js",
  "./js/engine/career.js",
  "./js/engine/playerStats.js",
  "./js/engine/save.js",
  "./js/engine/rng.js",
  "./js/engine/playersRepo.js",
  "./js/engine/loadPlayers.js",
  "./js/data/leagues.js",
  "./js/data/settings.js",
  "./js/data/events.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first, fallback ל-cache: כשיש אינטרנט תמיד מביא את הקובץ העדכני
// מהשרת (ומעדכן את ה-cache), וחוזר לגרסה השמורה רק אם אין רשת. כך עדכון
// קבצים (כמו זה) נכנס לתוקף באופן אוטומטי אצל כל מי שכבר התקין את ה-PWA,
// בלי להישאר תקוע על גרסה ישנה בגלל cache-first.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
