// Reads an app's public homepage: its name, description, preview image, icon, and the VIBED claim tag if present.
// Only http(s), only public hosts (private, loopback and link-local addresses are refused, redirects re-checked),
// 7 s and 1.5 MB at most. The claim tag is <meta name="vibed" content="SOLANA_WALLET"> in the HTML the server sends.
const dns = require('dns').promises;
const net = require('net');
const L = require('./_lib');

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const s = ip.toLowerCase();
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80') || s.startsWith('::ffff:127.') || s.startsWith('::ffff:10.') || s.startsWith('::ffff:192.168.');
}
function normal(input) {
  let u = String(input || '').trim();
  if (!u) throw new Error('Paste an app link.');
  if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  let url; try { url = new URL(u); } catch (e) { throw new Error('That does not look like a link.'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Only http and https links.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host === 'localhost' || /\.(local|internal|lan|home|corp)$/.test(host)) throw new Error('That host is not public.');
  if (net.isIP(host) && privateIp(host)) throw new Error('That host is not public.');
  return { url: url.protocol + '//' + url.host + '/', host: host.replace(/^www\./, '') };
}
async function safeHost(hostname) {
  if (net.isIP(hostname)) { if (privateIp(hostname)) throw new Error('That host is not public.'); return; }
  let addrs;
  try { addrs = await dns.lookup(hostname, { all: true }); } catch (e) { throw new Error('No site answers at that address.'); }
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('That host is not public.');
}
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
function attrs(tag) {
  const o = {}; const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g; let m;
  while ((m = re.exec(tag))) o[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return o;
}
function parse(html, base) {
  const head = html.slice(0, 400000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]));
  const meta = k => { const x = metas.find(a => (a.property || a.name || '').toLowerCase() === k); return x ? decode(x.content) : ''; };
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0]));
  const abs = h => { try { return h ? new URL(h, base).href : ''; } catch (e) { return ''; } };
  const titleTag = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const icon = links.find(a => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(a.rel || ''));
  const vib = metas.filter(a => (a.name || '').toLowerCase() === 'vibed').map(a => String(a.content || '').trim());
  return {
    title: (meta('og:title') || decode(titleTag) || '').slice(0, 90),
    description: (meta('og:description') || meta('description') || '').slice(0, 200),
    image: abs(meta('og:image') || meta('twitter:image')),
    icon: abs(icon && icon.href) || abs('/favicon.ico'),
    vibed: vib.length ? vib[0].slice(0, 64) : null,
  };
}
async function readApp(input) {
  const n = normal(input);
  let url = n.url, r;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(url);
    await safeHost(u.hostname);
    r = await L.get(url, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; VIBED/1.0; reads the homepage for the claim tag)', accept: 'text/html,application/xhtml+xml' } }, 7000);
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url).href; if (!/^https?:/.test(url)) throw new Error('That site redirects somewhere we cannot read.'); continue; }
    break;
  }
  const type = r.headers.get('content-type') || '';
  if (!/html|xml|text\/plain/i.test(type)) throw new Error('That address does not serve a web page.');
  const reader = r.body && r.body.getReader ? r.body.getReader() : null;
  let html = '';
  if (reader) {
    const dec = new TextDecoder(); let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; got += value.length; html += dec.decode(value, { stream: true }); if (got > 1500000) { try { reader.cancel(); } catch (e) { } break; } }
  } else html = (await r.text()).slice(0, 1500000);
  const p = parse(html, url);
  return { ok: true, host: n.host, url: n.url, finalUrl: url, status: r.status, ...p, tagValid: !!(p.vibed && L.isKey(p.vibed)) };
}
module.exports = { readApp, normal };
