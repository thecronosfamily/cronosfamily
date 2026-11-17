/* $CROFAM website: navigation, hero, staking chart, live treasury. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TOKEN = '0x48bda6f282acdaa8870f762e8797f7b39d036c7d';     // $CROFAM
  const WCRO = '0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23';
  const STAKING = '0xb92a381AB51DDfD21F81243671F46E67256DDB20';   // WolfSwap staking contract
  const TREASURY = '0xeef6783014abeC80397B67e259Df1DBbE5f94A19';
  const RPCS = ['https://evm.cronos.org', 'https://cronos-evm-rpc.publicnode.com'];
  const pad = a => a.toLowerCase().replace('0x', '').padStart(64, '0');

  /* ---------- JSON-RPC mit Ausweich-Endpunkt ---------- */
  async function rpcBatch(calls, raw = false) {
    const body = JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c[0], params: c[1] })));
    for (const url of RPCS) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: ctrl.signal });
        clearTimeout(t);
        const json = await res.json();
        const arr = Array.isArray(json) ? json : [json];
        const out = calls.map((_, i) => { const r = arr.find(x => x.id === i); return r && r.result && r.result !== '0x' ? (raw ? r.result : BigInt(r.result)) : null; });
        if (out.some(v => v !== null)) return out;
      } catch (e) { /* nächsten Endpunkt versuchen */ }
    }
    return null;
  }
  const units = v => v === null ? null : Number(v / 10n ** 12n) / 1e6;   // 18 Dezimalstellen
  const TOTAL_SUPPLY = 1000000000;

  /* ---------- gemeinsame Live-Daten (Live-Leiste, Staking, Treasury, Mint) ---------- */
  const live = { stakedPct: 63.6, prices: null, market: null, treasury: null, nftContract: '' };
  const bus = new EventTarget();
  const publish = (key, val) => { live[key] = val; bus.dispatchEvent(new Event('update')); };

  /* ---------- Menü ---------- */
  const toggle = $('.menu-toggle'), nav = $('#primary-nav');
  function closeMenu() { nav.classList.remove('is-open'); toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu'); }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* aktiver Menüpunkt */
  if ('IntersectionObserver' in window) {
    const links = $$('a', nav); const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(l => l.classList.toggle('is-active', l === byId.get(e.target.id))); }), { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); }); io.observe($('#top'));
  }

  /* ---------- Toast + Kopieren ---------- */
  const toast = $('#toast'); let toastTimer;
  function showToast(msg) { toast.textContent = msg; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400); }
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const text = document.getElementById(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(text); showToast('Address copied.'); } catch { showToast('Copy is not available here. Please select the address and copy it manually.'); }
  }));

  /* ---------- Roadmap-Fortschritt + Jahr ---------- */
  const items = $$('.roadmap-item'), done = items.filter(i => i.classList.contains('is-done')).length;
  $('#progress-count').textContent = `${done} / ${items.length} complete`;
  $('#progress-bar').style.width = `${done / items.length * 100}%`;
  $('#progress-track').setAttribute('aria-valuenow', done);
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Hero: Löwen-Wand ---------- */
  (function () {
    const track = $('#lion-wall'); if (!track) return;
    const n = 21, cols = 7, rows = 4, frag = document.createDocumentFragment();
    // zwei identische Hälften, damit die Bewegung nahtlos weiterläuft
    for (let half = 0; half < 2; half++) {
      const grid = document.createElement('div'); grid.className = 'lion-grid';
      for (let i = 0; i < cols * rows; i++) {
        const img = document.createElement('img');
        img.src = `assets/lions/lion-${String(((i * 5 + half * 3) % n) + 1).padStart(2, '0')}.webp`;
        img.alt = ''; img.width = 320; img.height = 320; img.decoding = 'async'; if (half) img.loading = 'lazy';
        grid.appendChild(img);
      }
      frag.appendChild(grid);
    }
    track.appendChild(frag);
  })();

  /* ---------- Mint-Countdown ---------- */
  (function () {
    const card = $('#mint-card'); if (!card) return;
    const MINT = Date.UTC(2026, 10, 21, 20, 0, 0), MAX = 777;
    const cd = $('#mint-countdown'), parts = {}; $$('b[data-u]', cd).forEach(b => { parts[b.dataset.u] = b; });
    let liveMode = false, mintedTimer = null;
    async function loadMinted() {
      if (!live.nftContract) return;
      const r = await rpcBatch([['eth_call', [{ to: live.nftContract, data: '0x18160ddd' }, 'latest']]]);
      if (!r || r[0] === null) return;
      const n = Math.min(Number(r[0]), MAX);
      $('#minted').hidden = false; $('#minted-count').textContent = n; $('#minted-bar').style.width = (n / MAX * 100) + '%';
      if (n >= MAX) { $('#mint-title').textContent = 'Lionhearts sold out'; card.classList.remove('is-live'); clearInterval(mintedTimer); }
    }
    function goLive() {
      if (liveMode) return; liveMode = true;
      cd.hidden = true; card.classList.add('is-live');
      $('#mint-sub').textContent = 'Mint on Ebisus Bay. Whitelist 210 CRO, public 250 CRO.';
      $('#mint-cta').firstChild.textContent = 'Mint on Ebisus Bay ';
      loadMinted(); mintedTimer = setInterval(() => { if (!document.hidden) loadMinted(); }, 30000);
      bus.addEventListener('update', () => { if ($('#minted').hidden) loadMinted(); });
    }
    function tick() {
      const ms = MINT - Date.now();
      if (ms <= 0) { goLive(); return; }
      const v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
      Object.keys(v).forEach(k => { const t = String(v[k]).padStart(2, '0'); if (parts[k].textContent !== t) parts[k].textContent = t; });
      setTimeout(tick, 1000 - (Date.now() % 1000));
    }
    tick();
  })();

  /* ---------- Live-Leiste unter dem Hero ---------- */
  (function () {
    const box = $('#live-stats'); if (!box) return;
    const usd = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + n.toFixed(0);
    const price = n => '$' + (n >= 0.01 ? n.toFixed(4) : n.toPrecision(3));
    const cro = n => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : Math.round(n)) + ' CRO';
    function render() {
      const m = live.market, p = live.prices;
      if (p) {
        const pu = p.crofamCro * p.croUsd;
        $('#ls-price').textContent = price(pu);
        $('#ls-mcap').textContent = usd(m && m.mcap ? m.mcap : pu * TOTAL_SUPPLY);
      }
      if (m && m.liquidity) $('#ls-liq').textContent = usd(m.liquidity);
      const ch = $('#ls-change');
      if (m && typeof m.change24 === 'number' && isFinite(m.change24)) {
        ch.hidden = false; ch.textContent = (m.change24 >= 0 ? '+' : '') + m.change24.toFixed(1) + '% 24h';
        ch.className = 'chg ' + (m.change24 >= 0 ? 'up' : 'down');
      }
      $('#ls-staked').textContent = (Math.round(live.stakedPct * 10) / 10) + '%';
      if (live.treasury) $('#ls-treasury').textContent = cro(live.treasury.totalCro);
      const src = $('#ls-src');
      if (live.prices && live.treasury && live.treasury.live) { src.textContent = 'Live from Cronos and DexScreener'; src.classList.add('is-live'); }
      else if (live.treasury && live.treasury.checked) { src.textContent = 'Live data is not available right now. Showing the last known values.'; src.classList.remove('is-live'); }
    }
    bus.addEventListener('update', render); render();
  })();

  /* ---------- Staking-Kreisdiagramm ---------- */
  (function () {
    const root = $('#staking'), BURNED = 18;
    const names = { staked: 'STAKED', burned: 'BURNED', circulating: 'CIRCULATING' };
    const labels = { staked: 'Staked', burned: 'Burned liquidity', circulating: 'Circulating supply' };
    const C = 150, RO = 112, RI = 72; let shares = {}, current = 'staked';
    const fmt = n => (Math.round(n * 10) / 10) + '%';
    const pt = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
    function sector(a0, a1) {
      const large = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = pt(RO, a0), [x1, y1] = pt(RO, a1), [x2, y2] = pt(RI, a1), [x3, y3] = pt(RI, a0);
      return `M${x0} ${y0}A${RO} ${RO} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${RI} ${RI} 0 ${large} 0 ${x3} ${y3}Z`;
    }
    function showCenter(k) { current = k; $('#donut-value').textContent = fmt(shares[k]); $('#donut-label').textContent = names[k]; }
    function setShares(staked) {
      staked = Math.min(Math.max(staked, 0), 100 - BURNED); shares = { staked, burned: BURNED, circulating: 100 - BURNED - staked };
      let a = -Math.PI / 2;
      Object.keys(shares).forEach(k => {
        const span = Math.min(shares[k] / 100 * 2 * Math.PI, 2 * Math.PI - .01), p = span > .05 ? .012 : 0;
        $$(`.seg[data-seg="${k}"] path`, root).forEach(path => path.setAttribute('d', span > .001 ? sector(a + p, a + span - p) : ''));
        $(`.seg[data-seg="${k}"]`, root).setAttribute('aria-label', `${labels[k]}: ${fmt(shares[k])}`);
        $(`li[data-seg="${k}"] .supply-value`, root).textContent = fmt(shares[k]);
        a += span;
      });
      showCenter(current);
    }
    const segs = $$('[data-seg]', root);
    function hover(k) { segs.forEach(el => el.classList.toggle('is-active', Boolean(k) && el.dataset.seg === k)); showCenter(k || 'staked'); }
    segs.forEach(el => { el.addEventListener('mouseenter', () => hover(el.dataset.seg)); el.addEventListener('mouseleave', () => hover(null)); el.addEventListener('focus', () => hover(el.dataset.seg)); el.addEventListener('blur', () => hover(null)); });
    setShares(63.6);
    rpcBatch([['eth_call', [{ to: TOKEN, data: '0x70a08231' + pad(STAKING) }, 'latest']], ['eth_call', [{ to: TOKEN, data: '0x18160ddd' }, 'latest']]]).then(r => {
      const note = $('#supply-note');
      if (!r || !r[0] || !r[1]) { note.textContent = 'Live data is not available right now. Showing the last known staked share.'; return; }
      setShares(Number(r[0] * 10000n / r[1]) / 100); publish('stakedPct', shares.staked);
      note.textContent = 'The staked share is read live from the staking contract on Cronos. Burned liquidity is fixed at 18%, circulating supply is the rest.';
    });
  })();

  /* ---------- Liquid-NFTs-Link (folgt) ---------- */
  const LIQUID_NFT_URL = '';   // TODO: Obsidian-Link für Liquid NFTs hier eintragen
  (function () {
    const a = $('#liquid-link'); if (!a) return;
    if (LIQUID_NFT_URL) { a.href = LIQUID_NFT_URL; a.removeAttribute('data-pending'); const s = $('.soon', a); if (s) s.remove(); a.insertAdjacentHTML('beforeend', ' <span aria-hidden="true">↗</span>'); return; }
    a.addEventListener('click', e => { e.preventDefault(); showToast('The Liquid NFTs link on Obsidian follows soon.'); });
  })();

  /* ---------- Wallet + Your Lionhearts + Stimmrecht ---------- */
  (function () {
    const root = $('#my-lions'); if (!root) return;
    const CFG = {
      contract: '',                 // TODO: LIONHEARTS-NFT-Contract auf Cronos (nach dem Mint)
      firstId: 1, maxSupply: 777,
      rarityTrait: 'rarity',        // trait_type der Seltenheit in den Metadaten
      tattooTrait: 'tattoo',        // trait_type der Tattoos (auch "Tattoo 2" usw.)
      projectTattoos: ['BARK', 'CAW', 'CROFAM', 'Crobinhood', 'Crobone', 'Croots', 'Kult', 'Loaded', 'MERY', 'Obsidian', 'Ultcat', 'Ultdeg', 'Ulti', 'Ulton', 'Wolfswap'],   // Ersatzwerte, die Liste im Admin hat Vorrang
      legendaryIds: [1, 69, 100, 200, 300, 400, 500, 600, 700, 777],
      ipfsGateway: 'https://ipfs.io/ipfs/'
    };
    const normTattoo = v => String(v || '').toLowerCase().replace(/^\s*tattoo\b/, '').replace(/\b(kopie|copy)\s*\d*\s*$/, '').replace(/[^a-z0-9]/g, '');
    const WEIGHTS = { common: 1, uncommon: 1.5, rare: 2, epic: 3.5, legendary: 5 };
    const RNAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
    const CRONOS = { chainId: '0x19', chainName: 'Cronos', nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 }, rpcUrls: ['https://evm.cronos.org'], blockExplorerUrls: ['https://explorer.cronos.com'] };
    const DEMO = {
      tattoos: ['BARK', 'CAW', 'CROFAM', 'Crobinhood', 'Crobone', 'Croots', 'Kult', 'Loaded', 'MERY', 'Obsidian', 'Ultcat', 'Ultdeg', 'Ulti', 'Ulton', 'Wolfswap'],
      lions: [
        { id: 300, rarity: 'legendary', img: 'assets/nft/legendary-300.webp', tattoos: ['Tattoo Wolfswap'] },
        { id: 412, rarity: 'epic', img: 'assets/nft/epic.webp', tattoos: [] },
        { id: 87, rarity: 'rare', img: 'assets/nft/rare.webp', tattoos: ['Tattoo Obsidian'] },
        { id: 158, rarity: 'uncommon', img: 'assets/nft/uncommon.webp', tattoos: ['Tattoo Ulton'] },
        { id: 42, rarity: 'common', img: 'assets/nft/common.webp', tattoos: ['Tattoo CROFAM'] },
        { id: 613, rarity: 'common', img: 'assets/lions/lion-07.webp', tattoos: [] }
      ]
    };
    const el = id => document.getElementById(id);
    const status = el('vault-status'), grid = el('vault-grid'), btn = el('wallet-connect'), off = el('wallet-disconnect');
    const picker = el('wallet-picker'), addrBox = el('vault-addr'), hdr = el('wallet-header'), hdrLabel = el('wallet-header-label');
    const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(a);
    const shortA = a => a.slice(0, 6) + '…' + a.slice(-4);
    const num = n => (Math.round(n * 100) / 100).toLocaleString('en-US');
    const multOf = (n, total) => total > 0 && n >= total ? 2 : Math.round((1 + 0.05 * n) * 100) / 100;
    let provider = null, account = null, run = 0, lastCount = null, power = null, wcProvider = null;

    function say(msg, err) { status.textContent = msg || ''; status.classList.toggle('is-error', Boolean(err)); }

    /* EIP-6963: alle installierten Wallets einsammeln */
    const found = new Map();
    window.addEventListener('eip6963:announceProvider', e => { const d = e.detail; if (d && d.info && d.provider) found.set(d.info.uuid || d.info.name, d); });
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    function render(lions, tattooList, opts = {}) {
      const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
      lions.forEach(l => { counts[l.rarity] = (counts[l.rarity] || 0) + 1; });
      $$('#votes-weights li').forEach(li => { $('strong', li).textContent = counts[li.dataset.r]; });
      const base = lions.reduce((s, l) => s + WEIGHTS[l.rarity], 0);
      const owned = new Set(lions.flatMap(l => l.tattoos.map(normTattoo)).filter(Boolean));
      const have = tattooList.filter(t => owned.has(normTattoo(t)));
      const mult = multOf(new Set(have.map(normTattoo)).size, new Set(tattooList.map(normTattoo)).size), full = mult > 1;
      const total = Math.round(base * mult * 100) / 100;
      lastCount = { base, total, lions: lions.length, mult };
      el('votes-total').textContent = num(total);
      el('votes-calc').textContent = opts.empty ? opts.empty : lions.length === 0 ? 'No Lionhearts in this wallet yet.' :
        `${lions.length} lion${lions.length === 1 ? '' : 's'}, ${num(base)} base votes` + (full ? ` × ${num(mult)} tattoo bonus` : '');
      el('bonus-chip').classList.toggle('is-on', full);
      el('bonus-chip').textContent = full ? `x${num(mult)} bonus active` : 'up to x2';
      el('tattoo-count').textContent = tattooList.length ? `${have.length} / ${tattooList.length}` : '';
      const list = el('tattoo-list');
      if (!tattooList.length) { const li = document.createElement('li'); li.className = 'note'; li.textContent = 'The list of project tattoos is published with the mint.'; list.replaceChildren(li); }
      else list.replaceChildren(...tattooList.map(t => { const li = document.createElement('li'); li.textContent = String(t).replace(/^\s*tattoo\s+/i, '').replace(/\s+(kopie|copy)\s*\d*\s*$/i, ''); if (owned.has(normTattoo(t))) li.classList.add('has'); return li; }));
      const items = lions.slice().sort((a, b) => WEIGHTS[b.rarity] - WEIGHTS[a.rarity] || a.id - b.id).map(l => {
        const li = document.createElement('li'); li.className = 'r-' + l.rarity;
        const img = document.createElement('img'); img.src = l.img || 'assets/crofam-logo-96.png'; img.alt = `Lionheart #${l.id}, ${RNAME[l.rarity]}`; img.loading = 'lazy'; img.width = 300; img.height = 300;
        const m = document.createElement('div'); m.className = 'meta';
        const b = document.createElement('strong'); b.textContent = '#' + l.id;
        const r = document.createElement('span'); r.textContent = `${RNAME[l.rarity]}${l.guess ? '*' : ''} · ${num(WEIGHTS[l.rarity])}`;
        r.title = l.guess ? 'Rarity not found in the metadata, counted as Common' : `${num(WEIGHTS[l.rarity])} votes`;
        m.append(b, r); li.append(img, m); return li;
      });
      if (opts.banner) { const p = document.createElement('p'); p.className = 'vault-banner'; p.textContent = opts.banner; items.unshift(p); }
      grid.replaceChildren(...items);
    }

    /* ---- Chain lesen ---- */
    const sel = { balanceOf: '0x70a08231', byIndex: '0x2f745c59', ownerOf: '0x6352211e', tokenURI: '0xc87b56dd' };
    const word = n => BigInt(n).toString(16).padStart(64, '0');
    function decodeString(hex) {
      const h = hex.slice(2), off = parseInt(h.slice(0, 64), 16) * 2, len = parseInt(h.slice(off, off + 64), 16);
      const bytes = new Uint8Array((h.slice(off + 64, off + 64 + len * 2).match(/../g) || []).map(x => parseInt(x, 16)));
      return new TextDecoder().decode(bytes);
    }
    const gw = u => u ? u.replace(/^ipfs:\/\/(ipfs\/)?/, CFG.ipfsGateway) : u;
    async function chunked(calls, size = 60, raw = false) {
      const out = [];
      for (let i = 0; i < calls.length; i += size) { const r = await rpcBatch(calls.slice(i, i + size), raw); if (!r) throw new Error('rpc'); out.push(...r); }
      return out;
    }
    async function tokenIds(owner) {
      const c = CFG.contract, bal = await rpcBatch([['eth_call', [{ to: c, data: sel.balanceOf + pad(owner) }, 'latest']]]);
      if (!bal) throw new Error('rpc');
      const n = Number(bal[0] || 0n); if (!n) return [];
      // ERC721Enumerable versuchen, sonst alle 777 ownerOf abfragen
      try {
        const r = await chunked([...Array(n)].map((_, i) => ['eth_call', [{ to: c, data: sel.byIndex + pad(owner) + word(i) }, 'latest']]));
        if (r.every(v => v !== null)) return r.map(Number);
      } catch (e) { /* weiter mit ownerOf */ }
      const ids = [...Array(CFG.maxSupply)].map((_, i) => CFG.firstId + i);
      const r = await chunked(ids.map(id => ['eth_call', [{ to: c, data: sel.ownerOf + word(id) }, 'latest']]), 80);
      const me = BigInt(owner);
      return ids.filter((_, i) => r[i] === me);
    }
    async function metadata(ids) {
      const uris = await chunked(ids.map(id => ['eth_call', [{ to: CFG.contract, data: sel.tokenURI + word(id) }, 'latest']]), 60, true);
      const out = []; let i = 0;
      async function worker() {
        while (i < ids.length) {
          const k = i++, id = ids[k]; let meta = null;
          try {
            const uri = uris[k] ? decodeString(uris[k]) : '';
            if (uri.startsWith('data:application/json;base64,')) meta = JSON.parse(atob(uri.split(',')[1]));
            else if (uri.startsWith('data:application/json')) meta = JSON.parse(decodeURIComponent(uri.split(',').slice(1).join(',')));
            else if (uri) meta = await (await fetch(gw(uri))).json();
          } catch (e) { /* ohne Metadaten weiter */ }
          const attrs = (meta && Array.isArray(meta.attributes)) ? meta.attributes : [];
          const tt = a => String(a.trait_type || '').toLowerCase();
          const rv = String((attrs.find(a => tt(a) === CFG.rarityTrait) || {}).value || '').toLowerCase();
          let rarity = Object.keys(WEIGHTS).find(k2 => rv.includes(k2) && !(k2 === 'common' && rv.includes('uncommon')));
          let guess = false;
          if (!rarity) { rarity = CFG.legendaryIds.includes(id) ? 'legendary' : 'common'; guess = !CFG.legendaryIds.includes(id); }
          const tattoos = attrs.filter(a => tt(a).includes(CFG.tattooTrait)).flatMap(a => [String(a.value || ''), String(a.trait_type || '')]).filter(v => normTattoo(v) && !/^none$/i.test(v));
          out[k] = { id, rarity, guess, tattoos, img: gw(meta && meta.image) };
        }
      }
      await Promise.all([...Array(Math.min(6, ids.length))].map(worker));
      return out;
    }

    async function show(addr, label) {
      const me = ++run;
      addrBox.hidden = false; addrBox.innerHTML = ''; const sm = document.createElement('small'); sm.textContent = label; addrBox.append(sm, addr);
      if (!CFG.contract) {
        render([], [], { empty: 'Counting starts with the mint on Nov 21.' });
        say('The Lionhearts contract goes live with the mint on November 21. Your lions will show up here after you mint.');
        el('vault-demo').hidden = false; return;
      }
      say('Looking for Lionhearts in this wallet…'); grid.replaceChildren();
      try {
        const ids = await tokenIds(addr); if (me !== run) return;
        if (!ids.length) { render([], CFG.projectTattoos); say('No Lionhearts found in this wallet.'); return; }
        say(`Found ${ids.length} Lionheart${ids.length === 1 ? '' : 's'}. Loading the details…`);
        const lions = await metadata(ids); if (me !== run) return;
        render(lions, CFG.projectTattoos); if (addr === account) { power = lastCount; renderVote(); } say(lions.some(l => l.guess) ? 'Lions marked with * have no rarity in their metadata and count as Common.' : '');
      } catch (e) { if (me === run) say('The Cronos network could not be reached. Please try again in a moment.', true); }
    }

    function setConnected(a) {
      account = a; hdr.classList.toggle('is-connected', Boolean(a)); hdrLabel.textContent = a ? shortA(a) : 'Connect wallet';
      btn.hidden = Boolean(a); off.hidden = !a; picker.hidden = true;
      power = null; renderVote();
      if (a) show(a, 'Connected wallet');
      else { run++; addrBox.hidden = true; grid.replaceChildren(); render([], CFG.projectTattoos, { empty: 'Connect a wallet to calculate.' }); say(''); }
    }

    async function connectWith(p) {
      picker.hidden = true; say('Confirm the connection in your wallet…');
      try {
        const accs = await p.request({ method: 'eth_requestAccounts' });
        if (!accs || !accs[0]) { say('No account was shared.', true); return; }
        provider = p;
        try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CRONOS.chainId }] }); }
        catch (err) {
          const code = err && (err.code || (err.data && err.data.originalError && err.data.originalError.code));
          if (code === 4902 || code === -32603) { try { await p.request({ method: 'wallet_addEthereumChain', params: [CRONOS] }); } catch (e2) { /* Lesen geht trotzdem */ } }
        }
        if (p.on && !p._crofam) {
          p._crofam = true;
          p.on('accountsChanged', a => { if (provider === p) setConnected(a && a[0] ? a[0] : null); });
        }
        setConnected(accs[0]);
      } catch (err) {
        say(err && err.code === 4001 ? 'The connection was cancelled in the wallet.' : 'The wallet could not connect. Please try again.', true);
      }
    }

    /* ---- WalletConnect über Reown AppKit (wird erst beim Klick geladen) ---- */
    const WC = {
      projectId: '559a8d8afa8c3d926aeccbf226e67239',   // Reown-Projekt CROFAM, Allowlist: thecronosfamily.com + www
      cdn: 'https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.8.24/dist/appkit.js'
    };
    let appkit = null, viaWC = false;
    async function loadAppKit() {
      if (appkit) return appkit;
      const m = await import(WC.cdn);
      const cronos = (m.networks && m.networks.cronos) || {
        id: 25, name: 'Cronos', nativeCurrency: CRONOS.nativeCurrency,
        rpcUrls: { default: { http: CRONOS.rpcUrls } }, blockExplorers: { default: { name: 'Cronos Explorer', url: CRONOS.blockExplorerUrls[0] } },
        chainNamespace: 'eip155', caipNetworkId: 'eip155:25'
      };
      const adapter = new m.WagmiAdapter({ projectId: WC.projectId, networks: [cronos] });
      appkit = m.createAppKit({
        adapters: [adapter], networks: [cronos], defaultNetwork: cronos, projectId: WC.projectId,
        metadata: { name: 'The Cronos Family', description: 'See your Lionhearts and your CROFAM voting power.', url: location.origin, icons: [location.origin + '/assets/crofam-logo-96.png'] },
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
        themeMode: 'dark', themeVariables: { '--w3m-accent': '#ffc247', '--w3m-border-radius-master': '2px' }
      });
      appkit.subscribeAccount(st => {
        if (!viaWC) return;
        if (st && st.isConnected && st.address) { if (st.address !== account) setConnected(st.address); }
        else if (account) setConnected(null);
      });
      try { if (appkit.subscribeProviders) appkit.subscribeProviders(st => { wcProvider = st && st.eip155 ? st.eip155 : null; }); } catch (e) { /* ältere Version */ }
      return appkit;
    }
    async function connectWC() {
      picker.hidden = true; say('Loading WalletConnect…');
      try { const k = await loadAppKit(); viaWC = true; provider = null; say(''); await k.open(); }
      catch (e) { say('WalletConnect could not be loaded. Check your connection or use a wallet in this browser.', true); }
    }

    function connect() {
      const list = [...found.values()];
      if (!list.length && window.ethereum) list.push({ info: { name: 'Browser wallet' }, provider: window.ethereum });
      if (!list.length) return connectWC();   // keine Browser-Wallet: direkt QR-Code / Handy-Wallet
      picker.hidden = false;
      const wc = document.createElement('button'); wc.type = 'button'; wc.className = 'wc';
      wc.innerHTML = '<span class="wc-icon" aria-hidden="true"></span><span>WalletConnect<small>QR code or mobile wallet</small></span>';
      wc.addEventListener('click', connectWC);
      picker.replaceChildren(...list.map(d => {
        const b = document.createElement('button'); b.type = 'button';
        if (d.info.icon) { const i = document.createElement('img'); i.src = d.info.icon; i.alt = ''; b.append(i); }
        b.append(d.info.name || 'Wallet'); b.addEventListener('click', () => { viaWC = false; connectWith(d.provider); }); return b;
      }), wc);
      say('Choose a wallet.');
    }


    /* ================= Umfragen ================= */
    const VOTE_API = window.CROFAM_VOTE_API || 'https://crofam-votes.thecronosfamily.workers.dev';   // Vote-Server (Cloudflare Worker)
    const strip = el('poll-strip'), voteBody = el('vote-body'), heroVote = el('hero-vote');
    let polls = null, pollError = false, mine = {}, busyVote = false;
    const api = (path, opts) => fetch(VOTE_API.replace(/\/$/, '') + path, opts).then(r => r.json());
    const fmtDate = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    function until(t) {
      const ms = t - Date.now(); if (ms <= 0) return 'now';
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.max(1, Math.floor(ms / 6e4) % 60);
      return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const pct = (v, total) => total > 0 ? v / total * 100 : 0;
    function leader(p) { let best = -1, idx = -1; p.options.forEach((o, i) => { if (o.votes > best) { best = o.votes; idx = i; } }); return best > 0 ? idx : -1; }
    function featured() {
      if (!polls) return null;
      const active = polls.filter(p => p.status === 'active').sort((a, b) => a.endsAt - b.endsAt)[0];
      if (active) return active;
      const up = polls.filter(p => p.status === 'upcoming').sort((a, b) => a.startsAt - b.startsAt)[0];
      if (up) return up;
      return polls.find(p => p.status === 'closed' && Date.now() - p.endsAt < 21 * 864e5) || null;
    }
    function resultRows(p, compact) {
      const lead = leader(p);
      return p.options.map((o, i) => {
        const li = mk('li', i === lead ? 'is-lead' : ''), share = pct(o.votes, p.totalVotes);
        const top = mk('div', 'res-top'); top.append(mk('span', 'res-label', o.label), mk('span', 'res-num', `${num(o.votes)} votes · ${num(share)}%`));
        const bar = mk('div', 'res-bar'); const fill = mk('span'); fill.style.width = share + '%'; bar.append(fill);
        if (i === lead && p.status === 'closed' && !compact) top.firstChild.append(mk('span', 'win-chip', 'Winner'));
        li.append(top, bar); return li;
      });
    }
    function renderStrip() {
      const p = featured(); strip.hidden = !p; heroVote.hidden = !(p && p.status === 'active');
      document.body.classList.toggle('has-poll', Boolean(p));
      el('tab-vote-dot').hidden = !(p && p.status === 'active');
      if (!p) return;
      const chip = el('ps-chip'); chip.className = 'poll-chip is-' + p.status;
      chip.textContent = p.status === 'active' ? 'Live poll' : p.status === 'upcoming' ? 'Next poll' : 'Poll closed';
      el('ps-time').textContent = p.status === 'active' ? `Ends in ${until(p.endsAt)}` : p.status === 'upcoming' ? `Starts in ${until(p.startsAt)}` : `Closed ${fmtDate(p.endsAt)}`;
      el('ps-title').textContent = p.title; el('ps-desc').textContent = p.description; el('ps-desc').hidden = !p.description;
      const cta = el('ps-cta'); cta.hidden = p.status !== 'active';
      el('ps-results').replaceChildren(...resultRows(p));
      el('ps-meta').textContent = p.voters ? `${num(p.totalVotes)} votes from ${p.voters} wallet${p.voters === 1 ? '' : 's'}. Votes are weighted by Lionhearts rarity.` : 'No votes yet. Votes are weighted by Lionhearts rarity.';
      const rec = el('ps-record'); rec.dataset.poll = p.id; rec.hidden = !p.voters;
      if (rec.open) loadRecord(p);
    }
    async function loadRecord(p) {
      const box = el('ps-record-body'); box.textContent = 'Loading…';
      try {
        const j = await api(`/polls/${p.id}/votes`); if (!j.ok) throw 0;
        const t = mk('table', 'record-table'), head = mk('tr');
        ['Wallet', 'Choice', 'Lions', 'Votes'].forEach(h => head.append(mk('th', '', h))); const th = mk('thead'); th.append(head); t.append(th);
        const tb = mk('tbody');
        j.votes.forEach(v => { const tr = mk('tr'); const a = mk('a', '', shortA(v.address)); a.href = 'https://explorer.cronos.com/address/' + v.address; a.target = '_blank'; a.rel = 'noopener noreferrer';
          const td = mk('td'); td.append(a); tr.append(td, mk('td', '', p.options[v.option] ? p.options[v.option].label : '?'), mk('td', '', String(v.lions.length)), mk('td', '', num(v.weight) + (v.multiplier > 1 ? ` (x${num(v.multiplier)})` : ''))); tb.append(tr); });
        t.append(tb); box.replaceChildren(t);
      } catch (e) { box.textContent = 'The vote record could not be loaded.'; }
    }
    el('ps-record').addEventListener('toggle', e => { if (e.target.open && polls) { const p = polls.find(x => String(x.id) === e.target.dataset.poll); if (p) loadRecord(p); } });

    function renderVote() {
      if (!voteBody) return;
      const out = [];
      if (!VOTE_API) { out.push(mk('p', 'vote-empty', 'Polls start soon. When a new poll opens, it shows up here and on the start page.')); voteBody.replaceChildren(...out); return; }
      if (pollError) { out.push(mk('p', 'vote-empty', 'The polls could not be loaded right now. Please try again in a moment.')); voteBody.replaceChildren(...out); return; }
      if (!polls) { out.push(mk('p', 'vote-empty', 'Loading polls…')); voteBody.replaceChildren(...out); return; }
      const active = polls.filter(p => p.status === 'active');
      if (!active.length) {
        const up = polls.find(p => p.status === 'upcoming');
        out.push(mk('p', 'vote-empty', up ? `The next poll "${up.title}" starts in ${until(up.startsAt)}.` : 'No poll is open right now. New polls show up here and on the start page.'));
      }
      active.forEach(p => out.push(pollForm(p)));
      const closed = polls.filter(p => p.status === 'closed').slice(0, 5);
      if (closed.length) {
        const sec = mk('div', 'past-polls'); sec.append(mk('h4', '', 'Previous polls'));
        const ul = mk('ul'); closed.forEach(p => { const li = mk('li'), lead = leader(p);
          li.append(mk('strong', '', p.title), mk('span', '', lead >= 0 ? `Winner: ${p.options[lead].label}, ${num(p.options[lead].votes)} of ${num(p.totalVotes)} votes` : 'No votes'), mk('small', '', `Closed ${fmtDate(p.endsAt)}`)); ul.append(li); });
        sec.append(ul); out.push(sec);
      }
      voteBody.replaceChildren(...out);
    }
    function pollForm(p) {
      const card = mk('form', 'vote-card'); card.noValidate = true;
      const head = mk('div', 'vote-head'); head.append(mk('h4', '', p.title), mk('span', 'poll-chip is-active', `Ends in ${until(p.endsAt)}`));
      card.append(head); if (p.description) card.append(mk('p', 'vote-desc', p.description));
      const myVote = account ? mine[p.id + ':' + account.toLowerCase()] : null;
      const fs = mk('fieldset', 'vote-options'); fs.append(mk('legend', 'sr-only', 'Choose one option'));
      p.options.forEach((o, i) => {
        const lab = mk('label', 'vote-opt'); const r = mk('input'); r.type = 'radio'; r.name = 'opt-' + p.id; r.value = i; if (myVote && myVote.option === i) r.checked = true;
        const share = pct(o.votes, p.totalVotes); const txt = mk('span', 'opt-text'); txt.append(mk('span', 'opt-label', o.label), mk('span', 'opt-num', `${num(o.votes)} votes · ${num(share)}%`));
        const bar = mk('span', 'opt-bar'); const f = mk('span'); f.style.width = share + '%'; bar.append(f); txt.append(bar);
        lab.append(r, txt); fs.append(lab);
      });
      card.append(fs);
      const foot = mk('div', 'vote-foot'), info = mk('p', 'vote-power');
      if (!account) info.textContent = 'Connect the wallet that holds your Lionhearts to vote.';
      else if (!CFG.contract) info.textContent = 'Voting opens once the Lionhearts are minted.';
      else if (!power) info.textContent = 'Counting your lions…';
      else if (!power.lions) info.textContent = 'This wallet holds no Lionhearts, so it cannot vote.';
      else info.textContent = `You vote with ${num(power.total)} votes from ${power.lions} lion${power.lions === 1 ? '' : 's'}${power.mult > 1 ? `, including the x${num(power.mult)} tattoo bonus` : ''}.`;
      if (myVote) info.textContent += ` Your current vote: ${p.options[myVote.option].label} (${num(myVote.weight)} votes). You can change it until the poll closes.`;
      const b = mk('button', 'button button-solid', !account ? 'Connect wallet to vote' : myVote ? 'Sign and change vote' : 'Sign and vote'); b.type = 'submit';
      const st = mk('p', 'vote-status'); st.setAttribute('role', 'status');
      foot.append(info, b); card.append(foot, st, mk('p', 'small-note', 'Signing is free. Your wallet only signs a message, no transaction is sent. Each lion counts once per poll.'));
      card.addEventListener('submit', e => { e.preventDefault(); castVote(p, card, st, b); });
      return card;
    }
    async function castVote(p, form, st, b) {
      if (!account) { connect(); return; }
      if (busyVote) return;
      const sel = form.querySelector('input[type=radio]:checked');
      if (!sel) { st.textContent = 'Choose an option first.'; st.classList.add('is-error'); return; }
      const i = Number(sel.value), label = p.options[i].label;
      const signerP = viaWC ? (wcProvider || (appkit && appkit.getWalletProvider && appkit.getWalletProvider())) : provider;
      if (!signerP) { st.textContent = 'Reconnect your wallet to sign.'; st.classList.add('is-error'); return; }
      const message = `CROFAM vote\nPoll: ${p.id}\nOption: ${i} - ${label}\nWallet: ${account}\nIssued: ${new Date().toISOString()}`;
      const hexMsg = '0x' + [...new TextEncoder().encode(message)].map(x => x.toString(16).padStart(2, '0')).join('');
      busyVote = true; b.disabled = true; st.classList.remove('is-error'); st.textContent = 'Confirm the signature in your wallet…';
      try {
        const signature = await signerP.request({ method: 'personal_sign', params: [hexMsg, account] });
        st.textContent = 'Counting your vote…';
        const j = await api('/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, signature }) });
        if (!j.ok) throw new Error(j.error || 'The vote was not accepted.');
        mine[p.id + ':' + account.toLowerCase()] = { option: i, weight: j.weight };
        showToast(`Vote counted: ${num(j.weight)} votes for "${label}".`);
        await loadPolls();
        if (j.skipped) showToast(`${j.skipped} lion${j.skipped === 1 ? '' : 's'} already voted from another wallet and did not count again.`);
      } catch (err) {
        st.textContent = err && err.code === 4001 ? 'The signature was cancelled in the wallet.' : (err && err.message) || 'The vote could not be sent.';
        st.classList.add('is-error');
      } finally { busyVote = false; b.disabled = false; }
    }
    async function loadMine() {
      if (!account || !polls) return;
      await Promise.all(polls.filter(p => p.status === 'active' && p.voters).map(async p => {
        try { const j = await api(`/polls/${p.id}/votes`); const v = j.ok && j.votes.find(x => x.address === account.toLowerCase()); if (v) mine[p.id + ':' + v.address] = { option: v.option, weight: v.weight }; } catch (e) { /* egal */ }
      }));
    }
    async function loadPolls() {
      if (!VOTE_API) { renderVote(); return; }
      try { const j = await api('/polls'); if (!j.ok) throw 0; polls = j.polls; pollError = false; } catch (e) { pollError = true; }
      await loadMine(); renderStrip(); renderVote();
    }
    async function loadSettings() {
      if (!VOTE_API) return;
      try {
        const j = await api('/settings'); if (!j.ok) return;
        if (j.contract) { CFG.contract = j.contract; el('vault-demo').hidden = true; publish('nftContract', j.contract); }
        if (Array.isArray(j.projectTattoos) && j.projectTattoos.length) CFG.projectTattoos = j.projectTattoos;
        if (!account) render([], CFG.projectTattoos, { empty: 'Connect a wallet to calculate.' });
      } catch (e) { /* Standardwerte bleiben */ }
    }

    /* Tabs: My lions / Vote */
    const tabs = [el('tab-lions'), el('tab-vote')];
    function selectTab(which) {
      tabs.forEach(t => { const on = t.id === 'tab-' + which; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; el(t.getAttribute('aria-controls')).hidden = !on; });
      if (which === 'vote') renderVote();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t.id.slice(4)));
      t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + 1) % 2]; n.focus(); selectTab(n.id.slice(4)); } });
    });
    function openVote(e) { if (e) e.preventDefault(); selectTab('vote'); root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); history.replaceState(null, '', '#vote'); }
    $$('a[href="#vote"]').forEach(a => a.addEventListener('click', openVote));
    if (location.hash === '#vote') setTimeout(() => openVote(), 300);
    loadSettings().then(loadPolls);
    setInterval(() => { if (!document.hidden && polls && polls.some(p => p.status !== 'closed')) loadPolls(); }, 60000);

    btn.addEventListener('click', connect);
    off.addEventListener('click', async () => { if (viaWC && appkit) { try { await appkit.disconnect(); } catch (e) { /* egal */ } } viaWC = false; provider = null; setConnected(null); showToast('Wallet disconnected.'); });
    hdr.addEventListener('click', () => { root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); if (!account) connect(); });
    el('vault-lookup').addEventListener('submit', e => {
      e.preventDefault(); const v = el('lookup-input').value.trim();
      if (!isAddr(v)) { say('Enter a full Cronos address that starts with 0x and has 42 characters.', true); return; }
      show(v, 'Checked address');
    });
    el('vault-demo').addEventListener('click', () => {
      run++; addrBox.hidden = true;
      render(DEMO.lions, DEMO.tattoos, { banner: 'Preview with sample lions. These are not real holdings.' });
      say('This preview shows how the count works: 14 base votes × 1.2 for 4 different project tattoos = 16.8 votes.');
    });
    render([], CFG.projectTattoos, { empty: 'Connect a wallet to calculate.' });
    if (!CFG.contract) el('vault-demo').hidden = false;
    if (/[?&]demo=1/.test(location.search)) el('vault-demo').click();
  })();

  /* ---------- Treasury live ---------- */
  (function () {
    const sec = $('#treasury'); if (!sec) return;
    // zuletzt bekannte Werte (16. Nov 2026), werden live überschrieben
    const state = {
      prices: { crofamCro: 0.001187, croUsd: 0.04239 },
      bal: { staked: 237585962.45, crofam: 8924.771, wcro: 132.676, cro: 18.7789 },
      live: false, updated: null
    };
    const nf = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    const short = n => n >= 1e9 ? nf(n / 1e9, 2) + 'B' : n >= 1e6 ? nf(n / 1e6, 2) + 'M' : n >= 1e4 ? nf(n / 1e3, 1) + 'K' : nf(n, n < 100 ? 2 : 0);
    const GOALS = [1e6, 2.5e6, 5e6, 10e6];
    const ASSETS = [
      { key: 'staked', name: 'Staked $CROFAM', sub: 'In WolfSwap staking', color: '#00e5ff', sym: 'CROFAM', toCro: b => b * state.prices.crofamCro },
      { key: 'crofam', name: '$CROFAM', sub: 'In the wallet', color: '#ffc247', sym: 'CROFAM', toCro: b => b * state.prices.crofamCro },
      { key: 'wcro', name: 'WCRO', sub: 'Wrapped CRO', color: '#7a8cff', sym: 'WCRO', toCro: b => b },
      { key: 'cro', name: 'CRO', sub: 'Native balance', color: '#b9c7e6', sym: 'CRO', toCro: b => b }
    ];
    let shownTotal = 0;
    function animateTo(el, to) {
      if (reduceMotion || shownTotal === 0) { el.textContent = nf(to); shownTotal = to; return; }
      const from = shownTotal, t0 = performance.now(), dur = 900; shownTotal = to;
      (function step(now) { const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = nf(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
    }
    function render() {
      const rows = ASSETS.map(a => ({ ...a, amount: state.bal[a.key], cro: a.toCro(state.bal[a.key]) }));
      const total = rows.reduce((s, r) => s + r.cro, 0), usd = total * state.prices.croUsd;
      animateTo($('#tr-total-cro'), total);
      $('#tr-total-usd').textContent = '$' + nf(usd) + ' USD';
      $('#tr-kpi-staked').textContent = short(state.bal.staked);
      // Anteil am Gesamtsupply: alle $CROFAM der Treasury (gestakt + in der Wallet) / 1.000.000.000
      $('#tr-kpi-share').textContent = nf((state.bal.staked + state.bal.crofam) / TOTAL_SUPPLY * 100, 1) + '%';
      const goal = GOALS.find(g => g > total) || GOALS[GOALS.length - 1], pct = Math.min(total / goal * 100, 100);
      $('#tr-goal-label').textContent = nf(goal) + ' CRO';
      $('#tr-goal-pct').textContent = nf(pct, 1) + '%';
      // feste Skala 0, 500K, 1M, 2.5M, 5M, gleichmäßig verteilt; der Balken wird zwischen den Marken anteilig gefüllt
      const MARKS = [0, 5e5, 1e6, 2.5e6, 5e6], seg = 100 / (MARKS.length - 1);
      let fill = 100;
      for (let i = 1; i < MARKS.length; i++) if (total < MARKS[i]) { fill = (i - 1) * seg + (total - MARKS[i - 1]) / (MARKS[i] - MARKS[i - 1]) * seg; break; }
      $('#tr-road-bar').style.width = fill + '%'; $('#tr-road-track').setAttribute('aria-valuenow', Math.round(pct));
      const lbl = n => n === 0 ? '0' : n >= 1e6 ? String(+(n / 1e6).toFixed(3)) + 'M' : Math.round(n / 1e3) + 'K';
      $('#tr-road-marks').replaceChildren(...MARKS.map((m, i) => { const li = document.createElement('li'); li.style.left = i * seg + '%'; li.textContent = lbl(m); li.classList.toggle('is-reached', m > 0 && total >= m); return li; }));
      $('#tr-rows').replaceChildren(...rows.map(r => {
        const tr = document.createElement('tr'), share = total ? r.cro / total * 100 : 0;
        const cell = (label, html) => { const td = document.createElement('td'); td.dataset.label = label; td.append(...html); return td; };
        const name = document.createElement('span'); name.className = 'asset'; name.style.setProperty('--c', r.color);
        const b = document.createElement('strong'); b.textContent = r.name; const s = document.createElement('small'); s.textContent = r.sub; name.append(b, s);
        tr.append(cell('Asset', [name]), cell('Amount', [nf(r.amount, r.amount < 1000 ? 2 : 0) + ' ' + r.sym]), cell('Value in CRO', [nf(r.cro, r.cro < 100 ? 2 : 0) + ' CRO']),
          cell('Value in USD', ['$' + nf(r.cro * state.prices.croUsd, 2)]), cell('Share', [nf(share, share < 1 ? 2 : 1) + '%']));
        return tr;
      }));
      $('#tr-mix').replaceChildren(...rows.filter(r => r.cro > 0).map(r => { const s = document.createElement('span'); s.style.cssText = `--c:${r.color};flex-grow:${Math.max(r.cro / total * 100, .6)}`; s.title = r.name; return s; }));
      publish('treasury', { totalCro: total, live: state.live, checked: Boolean(state.updated) });
    }
    async function loadPrices() {
      const urls = [`https://api.dexscreener.com/tokens/v1/cronos/${TOKEN},${WCRO}`, `https://api.dexscreener.com/latest/dex/tokens/${TOKEN},${WCRO}`];
      for (const u of urls) {
        try {
          const j = await (await fetch(u)).json(); const pairs = (Array.isArray(j) ? j : j.pairs || []).filter(p => p.chainId === 'cronos');
          const byLiq = (a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0);
          const fam = pairs.filter(p => p.baseToken.address.toLowerCase() === TOKEN && p.quoteToken.address.toLowerCase() === WCRO).sort(byLiq)[0];
          const cro = pairs.filter(p => p.baseToken.address.toLowerCase() === WCRO && /^(USDC|USDT)$/.test(p.quoteToken.symbol)).sort(byLiq)[0];
          if (!fam) continue;
          const out = { crofamCro: Number(fam.priceNative) };
          out.croUsd = cro ? Number(cro.priceUsd) : Number(fam.priceUsd) / Number(fam.priceNative);
          if (out.crofamCro > 0 && out.croUsd > 0) {
            publish('market', { change24: Number((fam.priceChange || {}).h24), liquidity: Number((fam.liquidity || {}).usd) || 0, mcap: Number(out.crofamCro * out.croUsd * TOTAL_SUPPLY) });
            return out;
          }
        } catch (e) { /* nächste Quelle */ }
      }
      return null;
    }
    async function loadBalances() {
      const r = await rpcBatch([
        ['eth_call', [{ to: STAKING, data: '0xaf500ba3' + pad(TREASURY) }, 'latest']],   // gestakte Menge der Treasury
        ['eth_call', [{ to: TOKEN, data: '0x70a08231' + pad(TREASURY) }, 'latest']],
        ['eth_call', [{ to: WCRO, data: '0x70a08231' + pad(TREASURY) }, 'latest']],
        ['eth_getBalance', [TREASURY, 'latest']]
      ]);
      if (!r) return null;
      return { staked: units(r[0]), crofam: units(r[1]), wcro: units(r[2]), cro: units(r[3]) };
    }
    let busy = false;
    async function refresh() {
      if (busy) return; busy = true; const status = $('#tr-status'); status.textContent = 'Updating live values…';
      const [p, b] = await Promise.all([loadPrices(), loadBalances()]);
      if (p) { state.prices = p; publish('prices', p); }
      if (b) Object.keys(b).forEach(k => { if (b[k] !== null) state.bal[k] = b[k]; });
      state.live = Boolean(p && b);
      state.updated = Date.now(); render(); busy = false;
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      status.textContent = state.live ? `Live, updated at ${t}` : (p || b) ? `Partly live, updated at ${t}. Some sources could not be reached.` : 'Live data is not available right now. Showing the last known values.';
      status.classList.toggle('is-live', state.live);
    }
    render(); refresh();   // einmal sofort, damit die Live-Leiste im Hero echte Werte zeigt
    $('#tr-refresh').addEventListener('click', refresh);
    let timer = null, visible = false;
    const start = () => { if (!timer) { if (state.updated && Date.now() - state.updated > 30000) refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000); } };
    const stop = () => { clearInterval(timer); timer = null; };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { rootMargin: '200px 0px' }).observe(sec);
    } else start();
  })();
})();
