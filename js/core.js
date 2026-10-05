// VIBED shared client: config, helpers, reveal, nav, wallets, and signing a transaction the server built.
export const CONFIG = {
  ca: '',          // $VIBED contract address, set at launch
  x: '',           // X profile URL, set at launch
};
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = a => { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; };
export function ago(t) { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; }
export const sol = n => (Math.round(Number(n || 0) * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4 });
export const usd = n => n == null ? '—' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function getJ(url, ms = 15000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); return await r.json(); }
  catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long. Try again.' : 'Network error. Try again.' }; }
  finally { clearTimeout(t); }
}
export async function postJ(url, body, ms = 25000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal }); return await r.json(); }
  catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long. Try again.' : 'Network error. Try again.' }; }
  finally { clearTimeout(t); }
}
async function rpc(method, params) {
  const j = await postJ('/api/rpc', { method, params }, 25000);
  if (j && j.error) throw new Error(typeof j.error === 'string' ? j.error : (j.error.message || 'RPC error'));
  return j.result;
}

let tt;
export function toast(text) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.append(el); }
  el.textContent = text; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 1900);
  const l = $('#live'); if (l) l.textContent = text;
}
export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (x) { } t.remove(); }
  toast(label);
}
export function reveal(root = document) {
  const els = $$('.rv:not(.vis)', root);
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('vis')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('vis'); }), 400);
}

// ---------- wallets ----------
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the Solana library.')); document.head.append(s); });
async function web3() { if (!window.Buffer) await script('/vendor/buffer.min.js'); if (!window.solanaWeb3) await script('/vendor/web3.min.js'); return window.solanaWeb3; }
export function wallets() {
  const w = window, out = [];
  const ph = (w.phantom && w.phantom.solana) || (w.solana && w.solana.isPhantom ? w.solana : null);
  if (ph) out.push({ id: 'phantom', name: 'Phantom', p: ph });
  if (w.solflare && (w.solflare.isSolflare || w.solflare.connect)) out.push({ id: 'solflare', name: 'Solflare', p: w.solflare });
  if (w.backpack && (w.backpack.isBackpack || w.backpack.connect)) out.push({ id: 'backpack', name: 'Backpack', p: w.backpack.solana || w.backpack });
  if (!out.length && w.solana && w.solana.connect) out.push({ id: 'solana', name: 'Solana wallet', p: w.solana });
  return out;
}
export async function connect(id) {
  const k = wallets().find(x => x.id === id); if (!k) throw new Error('Wallet not found.');
  const r = await k.p.connect(); const pk = (r && r.publicKey) || k.p.publicKey;
  if (!pk) throw new Error('cancelled');
  return { provider: k.p, address: pk.toString(), name: k.name };
}
export function human(e) {
  const m = String(e && (e.message || e) || '');
  if (/cancel|reject|denied|declined|closed/i.test(m)) return 'You cancelled it in your wallet. Nothing was sent.';
  if (/insufficient|0x1\b|lamports/i.test(m)) return 'This wallet needs a little SOL for the network fee.';
  if (/blockhash|expired/i.test(m)) return 'That took too long and expired. Try again.';
  return m.length < 200 ? m : 'Something went wrong. Nothing was sent unless a transaction link appears.';
}
// build on the server, sign in the wallet, send, wait for confirmation
export async function act(wallet, body, onStep) {
  onStep && onStep('Building…');
  const j = await postJ('/api/tx', { wallet: wallet.address, ...body });
  if (!j.ok) throw new Error(j.error || 'Could not build the transaction.');
  const W = await web3();
  const tx = W.VersionedTransaction.deserialize(Uint8Array.from(atob(j.tx), c => c.charCodeAt(0)));
  onStep && onStep('Approve in your wallet…');
  let sig;
  if (wallet.provider.signAndSendTransaction) { const r = await wallet.provider.signAndSendTransaction(tx); sig = typeof r === 'string' ? r : r && r.signature; }
  else { const signed = await wallet.provider.signTransaction(tx); let s = ''; const a = signed.serialize(); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); sig = await rpc('sendTransaction', [btoa(s), { encoding: 'base64' }]); }
  if (!sig) throw new Error('The wallet did not return a signature.');
  onStep && onStep('Confirming on Solana…');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try { const st = await rpc('getSignatureStatuses', [[sig]]); const v = st && st.value && st.value[0]; if (v && v.err) throw new Error('The transaction failed on Solana.'); if (v && /confirmed|finalized/.test(v.confirmationStatus || '')) return sig; } catch (e) { if (/failed/.test(e.message)) throw e; }
  }
  return sig;
}
