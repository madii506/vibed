// GET /api/board : VIBED rebuilt from Solana. Reads every transaction that carries the REF key, keeps the ones with a
// "vibed:" memo and replays them: coins listed for an app (checked against pump.fun: the description must say
// "vibes <host> via VIBED"), builders who claimed an app (their tag is re-read live), and payouts the vault sent.
const L = require('./_lib');
const { readApp } = require('./_app');
const LIMIT = 500;
const seen = new Map();
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const json = s => { try { const j = JSON.parse(s); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } };
const hostOk = h => /^[a-z0-9.-]{3,120}$/.test(h) && h.includes('.');

function parseTx(tx, sig) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const msg = tx.transaction && tx.transaction.message; if (!msg) return null;
  const keys = (msg.accountKeys || []).map(k => (k && k.pubkey) || k);
  const ins = msg.instructions || [];
  const memo = ins.find(i => i.program === 'spl-memo' || i.programId === L.MEMO);
  const text = memo && typeof memo.parsed === 'string' ? memo.parsed : null;
  if (!text || !text.startsWith(L.PREFIX)) return null;
  const transfers = ins.filter(i => i.program === 'system' && i.parsed && i.parsed.type === 'transfer')
    .map(i => i.parsed.info).filter(x => x && Number(x.lamports) > 0).map(x => ({ from: x.source, to: x.destination, lamports: Number(x.lamports) }));
  return { sig, t: (tx.blockTime || 0) * 1000, by: String(keys[0] || ''), text, transfers };
}

async function liveTag(host) {
  return L.cached('tag:' + host, 300000, async () => { try { const a = await readApp(host); return a.vibed; } catch (e) { return undefined; } });
}

async function load() {
  const sigs = (await L.rpc('getSignaturesForAddress', [L.REF, { limit: LIMIT, commitment: 'confirmed' }])) || [];
  const fresh = sigs.filter(s => !s.err && !seen.has(s.signature)).map(s => s.signature);
  for (let i = 0; i < fresh.length; i += 8) {
    await Promise.all(fresh.slice(i, i + 8).map(async sig => {
      try { const tx = await L.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); seen.set(sig, parseTx(tx, sig)); }
      catch (e) { /* next read */ }
    }));
  }
  const recs = sigs.map(s => seen.get(s.signature)).filter(Boolean).sort((a, b) => a.t - b.t || (a.sig < b.sig ? -1 : 1));
  const apps = new Map(), listed = [], feed = [];
  const app = h => { if (!apps.has(h)) apps.set(h, { host: h, coins: [], claim: null, paid: [], paidSol: 0, first: null }); return apps.get(h); };
  for (const r of recs) {
    const kind = r.text.slice(L.PREFIX.length).split(':')[0];
    const j = json(r.text.slice(L.PREFIX.length + kind.length + 1)) || {};
    const h = clean(j.h, 120).toLowerCase();
    if (!hostOk(h)) continue;
    if (kind === 'list' && L.isKey(String(j.m || ''))) {
      if (listed.some(c => c.mint === j.m)) continue;
      listed.push({ mint: String(j.m), host: h, by: r.by, t: r.t, sig: r.sig });
    } else if (kind === 'claim') {
      const a = app(h); a.claim = { wallet: r.by, t: r.t, sig: r.sig };      // the latest claim wins; the tag is re-read below
      feed.push({ kind: 'claim', host: h, wallet: r.by, t: r.t, sig: r.sig });
    } else if (kind === 'paid' && L.VAULT && r.by === L.VAULT) {
      const a = app(h);
      for (const x of r.transfers) {
        if (x.from !== L.VAULT) continue;
        const sol = x.lamports / 1e9; a.paid.push({ to: x.to, sol, t: r.t, sig: r.sig }); a.paidSol += sol;
        feed.push({ kind: 'paid', host: h, to: x.to, sol, t: r.t, sig: r.sig });
      }
    }
  }
  // coins: only the ones pump.fun confirms, with the line in their own description
  const coins = (await Promise.all(listed.map(async c => {
    const p = await L.pumpCoin(c.mint); if (!p) return null;
    const desc = String(p.description || '').toLowerCase().replace(/\s+/g, ' ');
    if (!desc.includes('vibes ' + c.host + ' via vibed')) return null;
    return { ...c, name: clean(p.name, 40), symbol: clean(p.symbol, 12), image: p.image_uri ? String(p.image_uri) : null,
      mcap: p.usd_market_cap != null ? Number(p.usd_market_cap) : null, graduated: !!p.complete, created: p.created_timestamp || null };
  }))).filter(Boolean);
  for (const c of coins) { const a = app(c.host); a.coins.push(c); a.first = Math.min(a.first || c.t, c.t); feed.push({ kind: 'list', host: c.host, mint: c.mint, symbol: c.symbol, t: c.t, sig: c.sig }); }
  // claims: re-read the tag; a claim only counts while the homepage still names that wallet
  await Promise.all([...apps.values()].filter(a => a.claim).map(async a => {
    const tag = await liveTag(a.host);
    a.claim.live = tag === undefined ? null : tag === a.claim.wallet;
  }));
  let vault = null;
  if (L.VAULT) { try { const b = await L.rpc('getBalance', [L.VAULT, { commitment: 'confirmed' }]); vault = { address: L.VAULT, sol: (b && b.value || 0) / 1e9 }; } catch (e) { vault = { address: L.VAULT, sol: null }; } }
  const list = [...apps.values()].filter(a => a.coins.length || a.claim || a.paid.length)
    .sort((x, y) => (y.coins.length - x.coins.length) || ((y.first || 0) - (x.first || 0)));
  feed.sort((a, b) => b.t - a.t);
  const paidSol = list.reduce((s, a) => s + a.paidSol, 0);
  return { apps: list, coins: coins.sort((a, b) => b.t - a.t), feed: feed.slice(0, 60), vault,
    stats: { coins: coins.length, apps: list.filter(a => a.coins.length).length, claimed: list.filter(a => a.claim && a.claim.live !== false).length, paidSol: Math.round(paidSol * 1e4) / 1e4 } };
}

module.exports = L.wrap(async (req, res) => {
  const data = await L.cached('board', 8000, load);
  L.send(res, 200, { ok: true, ref: L.REF, at: Date.now(), ...data }, 'public, s-maxage=8, stale-while-revalidate=30');
});
