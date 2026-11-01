// Service worker cho mô hình drone Hà Nội:
// - ảnh vệ tinh Esri: lấy từ bộ nhớ đệm trước, chưa có mới tải (giữ tối đa khoảng 3000 mảnh)
// - trang: tải bản mới nếu mạng nhanh, mạng chậm hoặc mất mạng thì dùng bản đã lưu
const TILES = 'tiles-v1', PAGE = 'page-v1', MAX_TILES = 3000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'server.arcgisonline.com' && url.pathname.includes('/World_Imagery/')) e.respondWith(tile(req));
  else if (url.origin === self.location.origin && (url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) e.respondWith(page(req));
});

let puts = 0;
async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type !== 'opaque') {
    await cache.put(req, res.clone());
    if (++puts % 200 === 0) trim(cache);
  }
  return res;
}
async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(k);
}
async function page(req) {
  const cache = await caches.open(PAGE);
  try {
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    const fallback = new Promise((r) => setTimeout(r, 4000)).then(() => cache.match(req));
    const first = await Promise.race([net, fallback]);
    return first || (await net);
  } catch {
    return (await cache.match(req)) || Response.error();
  }
}
