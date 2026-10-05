// VIBED home: the app reader (hero + launch), listing a coin, the claim checker, the live board, the vault, the story.
import { CONFIG, $, $$, esc, short, ago, sol, usd, getJ, toast, copy, reveal, reduce, wallets, connect, human, act } from './core.js';
import { flow } from './flow.js';

const TX = s => 'https://solscan.io/tx/' + s;
const ACCT = a => 'https://solscan.io/account/' + a;
const ICON = h => 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(h) + '.ico';
let board = null, me = null;
const lineFor = h => `vibes ${h} via VIBED`;
const hostOf = v => { try { let u = String(v || '').trim(); if (!u) return ''; if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u; return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };

/* ---------- chrome: words, marquee, progress, nav, flows ---------- */
function words() {
  const h = $('#h1'); let i = 0;
  $$('.ln', h).forEach(ln => {
    const em = ln.querySelector('em'); const target = em || ln; const parts = target.textContent.split(' ');
    target.innerHTML = parts.map(w => `<span class="wd" style="--i:${i++}">${esc(w)}</span>`).join(' ');
  });
  const em = h.querySelector('em');
  const paint = () => { if (!em) return; const W = em.offsetWidth; $$('.wd', em).forEach(w => { w.style.setProperty('--lw', W + 'px'); w.style.setProperty('--x', w.offsetLeft - em.offsetLeft + 'px'); }); };
  paint(); addEventListener('resize', paint); document.fonts && document.fonts.ready.then(paint);
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready')));
}
function marquee() {
  const t = ['Any host', 'One URL', 'pump.fun', '100% of creator fees', 'Public vault', 'One meta tag', 'Every payout posted', 'Whoever vibed it'];
  const row = t.map(x => `<span>${esc(x)}</span>`).join('');
  $('#marq').innerHTML = row + row + row + row;
}
function chrome() {
  const prog = $('#prog'), nav = $('#nav');
  const links = $$('.links a'), secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  let tick = false;
  const onScroll = () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const h = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
      nav.classList.toggle('scrolled', scrollY > 10);
      const y = scrollY + innerHeight * 0.35; let cur = null;
      for (const s of secs) if (s.offsetTop <= y) cur = s.id;
      links.forEach(a => { const on = a.getAttribute('href') === '#' + cur; if (on && !a.classList.contains('on') && innerWidth < 1060) a.parentElement.scrollTo({ left: a.offsetLeft - 60, behavior: 'smooth' }); a.classList.toggle('on', on); });
      story();
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (CONFIG.ca) { const p = $('#caPill'); p.hidden = false; $('#caShort').textContent = short(CONFIG.ca); p.onclick = () => copy(CONFIG.ca, 'Contract address copied'); }
  flow($('#flow'), { clear: (w, h) => ({ x: w / 2, y: h * 0.47, rx: Math.min(w * 0.44, 640), ry: Math.min(h * 0.36, 300) }) });
  flow($('#xflow'), { density: 1 / 1500, clear: (w, h) => ({ x: w / 2, y: h * 0.5, rx: Math.min(w * 0.36, 520), ry: h * 0.32 }) });
  flow($('#vflow'), { bg: [11, 11, 13], ink: [255, 255, 255], inkA: 0.13, fade: 0.07, density: 1 / 700, accent: 0.08 });
}

/* ---------- 01: the drawn wire under the three steps ---------- */
function wire() {
  const box = $('#steps'), svg = $('svg.wire', box), dots = $$('.dot', box);
  const draw = () => {
    const b = box.getBoundingClientRect(); if (!dots.length || b.width < 700) return;
    const p = dots.map(d => { const r = d.getBoundingClientRect(); return [r.left - b.left + r.width / 2, 10]; });
    const d = `M${p[0][0]},10 C${p[0][0] + 120},-14 ${p[1][0] - 120},34 ${p[1][0]},10 S${p[2][0] - 120},-14 ${p[2][0]},10`;
    svg.setAttribute('viewBox', `0 0 ${b.width} 20`); $('#wireBase').setAttribute('d', d); const dr = $('#wireDraw'); dr.setAttribute('d', d);
    dr.style.setProperty('--len', Math.ceil(dr.getTotalLength()));
  };
  draw(); addEventListener('resize', draw);
}

/* ---------- 02: the pinned story ---------- */
let frame = -1, typer = 0;
const URLS = ['your-app.com', 'pump.fun', 'solscan.io · vibed vault', 'your-app.com · index.html', 'solscan.io · payout'];
let cyc = 0;
function story() {
  const s = $('#story'); if (!s) return;
  if (innerWidth <= 960) {
    const r = s.getBoundingClientRect(), vis = r.top < innerHeight && r.bottom > 0;
    if (vis && !cyc) { if (frame < 0 || frame > 4) setFrame(0); cyc = setInterval(() => setFrame((frame + 1) % 5), reduce ? 4000 : 2800); }
    if (!vis && cyc) { clearInterval(cyc); cyc = 0; }
    return;
  }
  if (cyc) { clearInterval(cyc); cyc = 0; }
  const r = s.getBoundingClientRect(), total = s.offsetHeight - innerHeight;
  const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, total)));
  setFrame(Math.floor(p * 5));
}
function setFrame(f) {
  if (f === frame) return; frame = f;
  $$('#storyList li').forEach((li, i) => li.classList.toggle('on', i === f));
  $$('.fr').forEach((x, i) => x.classList.toggle('on', i === f));
  $('#screenUrl').textContent = URLS[f];
  if (f === 3) typeTag();
}
function typeTag(instant) {
  const el = $('#typed'), full = 'YOUR_SOLANA_WALLET'; clearInterval(typer);
  if (instant || reduce) { el.textContent = full; return; }
  let i = 0; el.textContent = '';
  typer = setInterval(() => { el.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(typer); }, 55);
}

/* ---------- the reader: hero + launch panel ---------- */
const appCache = new Map();
async function readApp(v) {
  const k = hostOf(v); if (!k) return { ok: false, error: 'Paste an app link, like your-app.lovable.app' };
  if (appCache.has(k)) return appCache.get(k);
  const j = await getJ('/api/app?url=' + encodeURIComponent(v.trim()), 20000);
  if (j && j.ok) appCache.set(k, j);
  return j || { ok: false, error: 'Could not read that app.' };
}
function coinsFor(host) { return board && board.coins ? board.coins.filter(c => c.host === host) : []; }
function kitRows(host) {
  const v = board && board.vault && board.vault.address;
  return `<div class="krow"><span>Description</span><code>vibes <b>${esc(host)}</b> via VIBED</code><button class="cbtn" type="button" data-copy="${esc(lineFor(host))}" data-label="Line copied">Copy</button></div>
    <div class="krow"><span>Fee share</span><code>100% → VIBED vault${v ? ' · ' + esc(short(v)) : ''}</code>${v ? `<button class="cbtn" type="button" data-copy="${esc(v)}" data-label="Vault address copied">Copy</button>` : '<span class="mono" style="font-size:11.5px;color:var(--mute)">at launch</span>'}</div>`;
}
function tagChip(a) {
  if (!a.vibed) return `<span class="chip"><i></i>no claim tag yet</span>`;
  if (!a.tagValid) return `<span class="chip bad"><i></i>tag is not a wallet</span>`;
  return `<span class="chip ok"><i></i>tagged · ${esc(short(a.vibed))}</span>`;
}
function appCard(a) {
  const shot = a.image ? `<img class="og" src="${esc(a.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : PH;
  const n = coinsFor(a.host).length;
  return `<div class="appcard">
    <div class="shot">${shot}<div class="bar"><img src="${esc(ICON(a.host))}" alt="" referrerpolicy="no-referrer">${esc(a.host)}</div></div>
    <div class="bd">
      <div><h3>${esc(a.title || a.host)}</h3>${a.description ? `<p class="desc">${esc(a.description)}</p>` : ''}</div>
      <div class="chips"><span class="chip live"><i></i>read live</span>${tagChip(a)}<span class="chip"><i></i>${n} coin${n === 1 ? '' : 's'} listed</span></div>
      <div class="kit">${kitRows(a.host)}</div>
      <div class="acts"><a class="btn" href="https://pump.fun/create" target="_blank" rel="noopener">Launch on pump.fun ↗</a><button class="btn ghost" type="button" data-go="launch" data-host="${esc(a.host)}">Then list it</button></div>
    </div></div>`;
}
const PH = '<div class="ph"><svg viewBox="-9 -9 132 200" aria-hidden="true"><use href="#mk"/></svg></div>';
function wireImgs(root) { $$('img.og', root).forEach(i => i.addEventListener('error', () => { i.insertAdjacentHTML('afterend', PH); i.remove(); }, { once: true })); }
async function hero(e) {
  e && e.preventDefault();
  const v = $('#pasteUrl').value, box = $('#result');
  if (!v.trim()) { $('#pasteUrl').focus(); return; }
  box.innerHTML = `<div class="loading"><span class="spin"></span>Reading ${esc(hostOf(v) || 'the app')}…</div>`;
  const a = await readApp(v);
  if (!a.ok) { box.innerHTML = `<div class="err">${esc(a.error || 'Could not read that app.')}</div>`; return; }
  box.innerHTML = appCard(a); wireImgs(box);
  ['#lUrl', '#mUrl', '#cUrl'].forEach(s => { if (!$(s).value) $(s).value = a.host; });
  history.replaceState(null, '', '?app=' + encodeURIComponent(a.host) + location.hash);
}
async function launchRead() {
  const v = $('#lUrl').value, st = $('#lStatus'), kit = $('#lKit');
  const h = hostOf(v); if (!h) { st.textContent = 'Paste an app link first.'; return; }
  st.textContent = 'Reading…'; kit.innerHTML = '';
  const a = await readApp(v);
  if (!a.ok) { st.textContent = a.error; return; }
  st.textContent = (a.title ? a.title + ' · ' : '') + 'read live';
  kit.innerHTML = kitRows(a.host) + `<div class="acts"><a class="btn sm" href="https://pump.fun/create" target="_blank" rel="noopener">Open pump.fun ↗</a></div>`;
  if (!$('#mUrl').value) $('#mUrl').value = a.host;
}

/* ---------- wallet picker ---------- */
function picker(title, text) {
  return new Promise(resolve => {
    const list = wallets();
    const v = document.createElement('div'); v.className = 'veil';
    const here = encodeURIComponent(location.href.split('#')[0]);
    v.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="wl">${list.length ? list.map(w => `<button type="button" data-w="${w.id}">${esc(w.name)} <small>connect</small></button>`).join('')
        : `<a href="https://phantom.app/ul/browse/${here}?ref=${here}">Open in Phantom <small>app</small></a><a href="https://solflare.com/ul/v1/browse/${here}?ref=${here}">Open in Solflare <small>app</small></a>`}</div>
      <div class="err" id="wErr" style="margin-top:12px"></div><button class="btn ghost sm" type="button" data-x style="margin-top:14px;width:100%">Cancel</button></div>`;
    const done = r => { v.remove(); resolve(r); };
    v.addEventListener('click', async e => {
      if (e.target === v || e.target.closest('[data-x]')) return done(null);
      const b = e.target.closest('[data-w]'); if (!b) return;
      try { me = await connect(b.dataset.w); onWallet(); done(me); } catch (err) { $('#wErr', v).textContent = human(err); }
    });
    document.body.append(v);
  });
}
async function needWallet(title, text) { return me || picker(title, text); }
function onWallet() {
  const b = $('#cWallet'); if (me && b) b.textContent = 'Wallet · ' + short(me.address);
  tagCode(); renderOp();
}

/* ---------- 03B: list a coin ---------- */
async function listCoin() {
  const err = $('#mErr'), ok = $('#mOk'), btn = $('#mList'); err.textContent = ''; ok.innerHTML = '';
  const mint = $('#mMint').value.trim(), host = hostOf($('#mUrl').value);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) { err.textContent = 'Paste the coin\'s mint address from pump.fun.'; return; }
  if (!host) { err.textContent = 'Paste the app link the coin names.'; return; }
  const w = await needWallet('Connect to list', 'Your wallet signs one small memo. It holds no SOL for anyone.'); if (!w) return;
  btn.disabled = true;
  try {
    const sig = await act(w, { kind: 'list', mint, host }, s => { btn.textContent = s; });
    ok.innerHTML = `<div class="okm">Listed. It shows on the board within a few seconds. <a href="${TX(sig)}" target="_blank" rel="noopener" style="text-decoration:underline">View transaction ↗</a></div>`;
    setTimeout(loadBoard, 4000);
  } catch (e) { err.textContent = human(e); }
  btn.disabled = false; btn.textContent = 'Check & list';
}

/* ---------- 04: claim ---------- */
function tagCode() {
  const wv = me ? me.address : 'YOUR_SOLANA_WALLET';
  $('#tagPre').innerHTML = `<span class="c">&lt;!-- inside &lt;head&gt; of your homepage --&gt;</span>\n<span class="hl"><span class="t">&lt;meta</span> <span class="a">name</span>=<span class="s">"vibed"</span> <span class="a">content</span>=<span class="s">"${esc(wv)}"</span><span class="t">&gt;</span></span>`;
}
async function checkSite() {
  const v = $('#cUrl').value, out = $('#cVerdict'), err = $('#cErr'), btn = $('#cCheck'); err.textContent = ''; out.innerHTML = '';
  const host = hostOf(v); if (!host) { err.textContent = 'Paste your app\'s link.'; return; }
  btn.disabled = true; btn.textContent = 'Reading your page…';
  appCache.delete(host);
  const a = await readApp(v); btn.disabled = false; btn.textContent = 'Check my site';
  if (!a.ok) { err.textContent = a.error; return; }
  const rows = [];
  const row = (y, t, c) => `<div class="vrow ${y ? 'y' : 'n'}"><i>${y ? '✓' : '✕'}</i><div>${t}${c ? `<br><code>${esc(c)}</code>` : ''}</div></div>`;
  rows.push(row(true, `Read <b>${esc(host)}</b> live.`));
  if (!a.vibed) rows.push(row(false, 'No vibed tag in the HTML yet. Add the line on the left, deploy, then check again.'));
  else if (!a.tagValid) rows.push(row(false, 'Found a vibed tag, but its content is not a Solana wallet.', a.vibed));
  else {
    rows.push(row(true, 'Found the tag. It names:', a.vibed));
    if (!me) rows.push(row(false, 'Connect that wallet to record the claim.'));
    else if (me.address !== a.vibed) rows.push(row(false, 'Your connected wallet is a different one:', me.address));
    else rows.push(row(true, 'Your connected wallet matches. Record the claim on Solana.'));
  }
  const n = coinsFor(host).length;
  rows.push(row(n > 0, n ? `${n} coin${n === 1 ? '' : 's'} on the board name this app.` : 'No coin on the board names this app yet.'));
  out.innerHTML = rows.join('') + (a.tagValid && me && me.address === a.vibed ? `<div class="acts" style="margin-top:6px"><button class="btn sm sun" type="button" id="cRecord">Record my claim</button></div>` : '');
  const rec = $('#cRecord');
  if (rec) rec.onclick = async () => {
    rec.disabled = true;
    try {
      const sig = await act(me, { kind: 'claim', host }, s => { rec.textContent = s; });
      out.insertAdjacentHTML('beforeend', `<div class="vrow y"><i>✓</i><div>Claim recorded. Payouts go to the wallet in your tag and are posted with their transactions. <a href="${TX(sig)}" target="_blank" rel="noopener" style="text-decoration:underline">View ↗</a></div></div>`);
      rec.remove(); setTimeout(loadBoard, 4000);
    } catch (e) { err.textContent = human(e); rec.disabled = false; rec.textContent = 'Record my claim'; }
  };
}

/* ---------- 05 + 06: board and vault ---------- */
function countTo(el, to, dec = 0) {
  if (to == null || isNaN(to)) { el.textContent = '—'; return; }
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (reduce || from === to) { el.textContent = Number(to).toLocaleString('en-US', { maximumFractionDigits: dec }); return; }
  const t0 = performance.now(), d = 900;
  const f = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = (from + (to - from) * e).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec }); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function renderBoard() {
  const s = board.stats;
  $$('#stats [data-k]').forEach(b => countTo(b, s[b.dataset.k], b.dataset.k === 'paidSol' ? 4 : 0));
  const box = $('#apps');
  if (!board.apps.length) {
    box.innerHTML = `<div class="empty"><b>The board is empty, for now.</b><p>No VIBED coin has been listed yet. Paste an app at the top, launch it on pump.fun with the line, then list it here.</p><a class="btn" href="#top">Paste an app</a></div>`;
  } else {
    box.innerHTML = `<div class="apps">${board.apps.map((a, i) => {
      const claim = a.claim ? (a.claim.live === false ? `<span class="chip bad"><i></i>tag removed</span>` : `<span class="chip ok"><i></i>claimed · ${esc(short(a.claim.wallet))}</span>`) : `<span class="chip"><i></i>unclaimed</span>`;
      return `<article class="app" style="animation-delay:${Math.min(i, 8) * 60}ms">
        <div class="hd"><img src="${esc(ICON(a.host))}" alt="" referrerpolicy="no-referrer" loading="lazy"><div style="min-width:0"><b>${esc(a.host)}</b><small>${a.coins.length} coin${a.coins.length === 1 ? '' : 's'}${a.paidSol ? ' · ' + sol(a.paidSol) + ' SOL paid' : ''}</small></div></div>
        <div class="chips">${claim}<a class="chip" href="https://${esc(a.host)}" target="_blank" rel="noopener nofollow"><i></i>open app ↗</a></div>
        ${a.coins.slice(0, 4).map(c => `<div class="coinrow">${c.image && /^https?:/.test(c.image) ? `<img src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="noimg"></span>'}<b>$${esc(c.symbol || '?')}</b><span class="mc">${usd(c.mcap)}</span><a class="go" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">trade ↗</a><button class="cbtn" type="button" data-copy="${esc(c.mint)}" data-label="Mint copied">CA</button></div>`).join('')}
      </article>`; }).join('')}</div>`;
  }
  const fb = $('#feedBox');
  if (board.feed.length) {
    fb.hidden = false;
    $('#feed').innerHTML = board.feed.slice(0, 12).map(f => `<div class="fr2"><span class="k ${f.kind}">${f.kind === 'list' ? 'listed' : f.kind === 'claim' ? 'claimed' : 'paid'}</span>
      <span>${f.kind === 'list' ? `$${esc(f.symbol || '?')} for <b>${esc(f.host)}</b>` : f.kind === 'claim' ? `<b>${esc(f.host)}</b> by ${esc(short(f.wallet))}` : `${sol(f.sol)} SOL to ${esc(short(f.to))} for <b>${esc(f.host)}</b>`}</span>
      <a href="${TX(f.sig)}" target="_blank" rel="noopener">${ago(f.t)} ↗</a></div>`).join('');
  } else fb.hidden = true;
  // vault
  const v = board.vault;
  if (v && v.address) {
    countTo($('#vNum'), v.sol, 4);
    $('#vAddr').innerHTML = `<span>${esc(v.address)}</span><button type="button" data-copy="${esc(v.address)}" data-label="Vault address copied">Copy</button><a href="${ACCT(v.address)}" target="_blank" rel="noopener">Solscan ↗</a>`;
  }
  const pays = board.feed.filter(f => f.kind === 'paid');
  $('#payouts').innerHTML = pays.length ? `<div class="feed"><div class="fh"><span>Payouts from the vault</span><span>${pays.length}</span></div>${pays.map(f => `<div class="fr2"><span class="k paid">paid</span><span>${sol(f.sol)} SOL to ${esc(short(f.to))} for <b>${esc(f.host)}</b></span><a href="${TX(f.sig)}" target="_blank" rel="noopener">${ago(f.t)} ↗</a></div>`).join('')}</div>` : '';
  renderOp();
  // refresh the hero card's coin count if one is open
  const card = $('#result .appcard'); if (card) { const h = card.querySelector('.bar').textContent.trim(); const n = coinsFor(h).length; const c = card.querySelectorAll('.chips .chip')[2]; if (c) c.innerHTML = `<i></i>${n} coin${n === 1 ? '' : 's'} listed`; }
}
function renderOp() {
  const op = $('#op'); const v = board && board.vault && board.vault.address;
  if (!me || !v || me.address !== v) { op.hidden = true; return; }
  const claimed = board.apps.filter(a => a.claim && a.claim.live !== false);
  op.hidden = false;
  op.innerHTML = `<div class="panel"><h3>Vault desk</h3><p>You are connected as the vault. Pay a claimed app's builder; the payout and its memo land on the board.</p>
    ${claimed.length ? claimed.map(a => `<div class="krow" style="grid-template-columns:minmax(0,1fr) 120px auto"><code>${esc(a.host)} → ${esc(short(a.claim.wallet))}</code><input data-sol="${esc(a.host)}" placeholder="SOL" inputmode="decimal" style="height:36px;border-radius:10px;border:1px solid var(--line2);padding:0 10px;font:500 13px var(--mono)"><button class="cbtn" type="button" data-pay="${esc(a.host)}" data-to="${esc(a.claim.wallet)}">Pay</button></div>`).join('') : '<p class="mono" style="font-size:13px;color:var(--mute)">No claimed apps yet.</p>'}
    <div class="err" id="opErr" style="margin-top:12px"></div></div>`;
}
async function pay(btn) {
  const host = btn.dataset.pay, to = btn.dataset.to, amt = Number(($(`[data-sol="${CSS.escape(host)}"]`) || {}).value);
  const err = $('#opErr'); err.textContent = '';
  if (!(amt > 0)) { err.textContent = 'Enter an amount in SOL.'; return; }
  btn.disabled = true;
  try { const sig = await act(me, { kind: 'paid', host, to, sol: amt }, s => { btn.textContent = s; }); toast('Paid · posted on chain'); btn.textContent = 'Paid ✓'; setTimeout(loadBoard, 4000); }
  catch (e) { err.textContent = human(e); btn.disabled = false; btn.textContent = 'Pay'; }
}
let bt = null, fails = 0;
async function loadBoard() {
  clearTimeout(bt);
  const j = await getJ('/api/board', 25000);
  if (j && j.ok) { fails = 0; board = j; renderBoard(); }
  else {
    fails++;
    if (!board) $('#apps').innerHTML = `<div class="empty"><b>Reading Solana…</b><p>${esc((j && j.error) || 'The chain did not answer yet.')} Trying again.</p></div>`;
  }
  bt = setTimeout(loadBoard, document.hidden ? 60000 : fails ? Math.min(60000, 8000 * (fails + 1)) : 15000);
}

/* ---------- faq: smooth open/close ---------- */
function faq() {
  $$('.faq details').forEach(d => {
    const s = d.querySelector('summary'), a = d.querySelector('.a');
    s.addEventListener('click', e => {
      if (reduce) return; e.preventDefault();
      if (d.open) { const h = a.scrollHeight; a.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = () => { d.open = false; }; }
      else { d.open = true; const h = a.scrollHeight; a.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' }); }
    });
  });
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const c = e.target.closest('[data-copy]'); if (c) { copy(c.dataset.copy, c.dataset.label || 'Copied'); return; }
  const g = e.target.closest('[data-go]'); if (g) { const h = g.dataset.host; if (h) { $('#mUrl').value = h; $('#lUrl').value = h; } document.getElementById(g.dataset.go).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => $('#mMint').focus({ preventScroll: true }), 700); return; }
  const p = e.target.closest('[data-pay]'); if (p) { pay(p); return; }
});
$('#pasteForm').addEventListener('submit', hero);
$('#lRead').addEventListener('click', launchRead);
$('#lUrl').addEventListener('keydown', e => { if (e.key === 'Enter') launchRead(); });
$('#mList').addEventListener('click', listCoin);
$('#cCheck').addEventListener('click', checkSite);
$('#cUrl').addEventListener('keydown', e => { if (e.key === 'Enter') checkSite(); });
$('#cWallet').addEventListener('click', async () => { if (!me) await picker('Connect your wallet', 'Use the wallet you put in your tag. Connecting signs nothing.'); });
$('#copyTag').addEventListener('click', () => copy(`<meta name="vibed" content="${me ? me.address : 'YOUR_SOLANA_WALLET'}">`, 'Tag copied'));
document.addEventListener('visibilitychange', () => { if (!document.hidden && board) loadBoard(); });

document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && !t.classList.contains('og')) t.classList.add('gone'); }, true);
words(); marquee(); chrome(); wire(); reveal(); faq(); tagCode(); loadBoard();
const qp = new URLSearchParams(location.search).get('app');
if (qp) { $('#pasteUrl').value = qp; hero(); }
