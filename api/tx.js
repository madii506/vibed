// POST /api/tx : builds an UNSIGNED Solana transaction for one VIBED action. The caller's own wallet signs and sends it.
// Every transaction = compute budget + (optional SOL transfer) + a "vibed:" memo + a 0-lamport self-transfer that
// carries the read-only REF key, so the whole board can be rebuilt with getSignaturesForAddress(REF).
//   {wallet, kind:'list', mint, host}       anyone: list a pump.fun coin whose description says "vibes <host> via VIBED"
//   {wallet, kind:'claim', host}            the builder: the app's live homepage must carry <meta name="vibed" content="<wallet>">
//   {wallet, kind:'paid', host, to, sol}    the vault only: pay an app's verified builder (moves the SOL in the same transaction)
const L = require('./_lib');
const { readApp, normal } = require('./_app');
const CB = 'ComputeBudget111111111111111111111111111111', SYS = '11111111111111111111111111111111';
const cu16 = n => { const o = []; for (;;) { let b = n & 0x7f; n >>= 7; if (n) o.push(b | 0x80); else { o.push(b); return Buffer.from(o); } } };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function build({ wallet, memo, to, lamports, blockhash }) {
  const head = to ? [wallet, to] : [wallet];
  const ro = [CB, L.MEMO, SYS, L.REF];
  const all = [...head, ...ro], at = k => all.indexOf(k);
  const ix = (prog, accts, data) => Buffer.concat([Buffer.from([at(prog)]), cu16(accts.length), Buffer.from(accts), cu16(data.length), data]);
  const ixs = [
    ix(CB, [], Buffer.concat([Buffer.from([2]), u32(80000)])),
    ix(CB, [], Buffer.concat([Buffer.from([3]), u64(100000)])),
    ...(to ? [ix(SYS, [0, 1], Buffer.concat([u32(2), u64(lamports)]))] : []),
    ix(L.MEMO, [], Buffer.from(memo, 'utf8')),
    ix(SYS, [0, 0, at(L.REF)], Buffer.concat([u32(2), u64(0)])),
  ];
  const msg = Buffer.concat([Buffer.from([1, 0, ro.length]), cu16(all.length), ...all.map(k => L.b58d(k)), L.b58d(blockhash), cu16(ixs.length), ...ixs]);
  const tx = Buffer.concat([cu16(1), Buffer.alloc(64), msg]);
  if (tx.length > 1232) throw new Error('That message is too long for one transaction.');
  return tx.toString('base64');
}


const lineFor = host => 'vibes ' + host + ' via vibed';
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only.' });
  const b = await L.body(req);
  const wallet = String(b.wallet || ''), kind = String(b.kind || '');
  if (!L.isKey(wallet) || wallet === L.REF) return L.send(res, 400, { ok: false, error: 'Connect a Solana wallet first.' });
  let memo, to = null, lamports = 0, host;
  try { host = normal(b.host || b.url).host; } catch (e) { return L.send(res, 400, { ok: false, error: e.message }); }
  if (kind === 'list') {
    const mint = String(b.mint || '').trim();
    if (!L.isKey(mint)) return L.send(res, 400, { ok: false, error: 'Paste the coin\'s mint address from pump.fun.' });
    const c = await L.pumpCoin(mint);
    if (!c) return L.send(res, 400, { ok: false, error: 'pump.fun does not know that mint yet. Try again in a minute.' });
    const desc = String(c.description || '').toLowerCase().replace(/\s+/g, ' ');
    if (!desc.includes(lineFor(host))) return L.send(res, 400, { ok: false, error: 'That coin\'s description does not include "vibes ' + host + ' via VIBED".' });
    memo = L.PREFIX + 'list:' + JSON.stringify({ m: mint, h: host });
  } else if (kind === 'claim') {
    let a; try { a = await readApp(host); } catch (e) { return L.send(res, 400, { ok: false, error: e.message }); }
    if (!a.vibed) return L.send(res, 400, { ok: false, error: 'No <meta name="vibed"> tag on ' + host + ' yet. Deploy it, then check again.' });
    if (a.vibed !== wallet) return L.send(res, 400, { ok: false, error: 'The tag on ' + host + ' names a different wallet.' });
    memo = L.PREFIX + 'claim:' + JSON.stringify({ h: host });
  } else if (kind === 'paid') {
    if (!L.VAULT || wallet !== L.VAULT) return L.send(res, 403, { ok: false, error: 'Only the VIBED vault can record a payout.' });
    to = String(b.to || ''); lamports = Math.round(Number(b.sol) * 1e9);
    if (!L.isKey(to) || to === wallet || to === L.REF) return L.send(res, 400, { ok: false, error: 'to: the builder\'s wallet.' });
    if (!(lamports >= 1e5 && lamports <= 1000e9)) return L.send(res, 400, { ok: false, error: 'sol: 0.0001 to 1000.' });
    memo = L.PREFIX + 'paid:' + JSON.stringify({ h: host });
  } else return L.send(res, 400, { ok: false, error: 'kind must be list, claim or paid.' });
  const bh = await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const tx = build({ wallet, memo, to, lamports, blockhash: bh.value.blockhash });
  L.send(res, 200, { ok: true, tx, memo, lastValidBlockHeight: bh.value.lastValidBlockHeight });
});
