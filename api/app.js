// GET /api/app?url=<app link> : the app's name, description, preview image, icon and its VIBED claim tag (if any).
const L = require('./_lib');
const { readApp } = require('./_app');
module.exports = L.wrap(async (req, res) => {
  const url = L.q(req).get('url');
  try {
    const a = await L.cached('app:' + String(url).toLowerCase(), 20000, () => readApp(url));
    L.send(res, 200, a, 'public, s-maxage=20');
  } catch (e) {
    L.send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 160) });
  }
});
