/* ============================================================
   PTO Spirit Wear + Gift Cards — shop page builder
   ------------------------------------------------------------
   Everything editable (items, prices, sizes, colors, designs,
   front logos, gift card amounts, Shopify connection) lives in
   js/spiritwear-catalog.json. This file only draws the page.

   Checkout runs through Shopify: the order built here becomes a
   Shopify cart (Storefront API), with every choice attached to
   its line — Size, Color, Design, Front/Back, Front logo, gift
   card recipient — so Shopify's checkout, order page and
   confirmation email show the full order. Store setup steps:
   SPIRITWEAR_SHOPIFY_SETUP.md.

   Images live in images/spiritwear/:
     blanks/<shirt>-<color>-<front|back>.webp   product photos
     designs/<dark|light>/<id>.webp (+ designs/thumbs/...)   designs, outlined for dark or light fabric
     logos/<id>.png                              small front logos
   ============================================================ */
(async function () {
  const root = document.getElementById('sw-builder');
  if (!root) return;

  let SW;
  try {
    SW = await (await fetch('js/spiritwear-catalog.json?v=5', { cache: 'no-cache' })).json();
  } catch (e) {
    root.style.display = 'none';
    return;
  }
  SW.designs = SW.designs.map((d) => ({ ...d, group: d.id.slice(0, 2), number: d.id.toUpperCase() }));

  const CART_KEY = 'sw-cart-v2';
  const PENDING_KEY = 'sw-pending-checkout';
  const IMG = 'images/spiritwear/';
  const $ = (sel) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + n.toFixed(2).replace(/\.00$/, '');
  const byId = (list, id) => list.find((x) => x.id === id);
  // Each item can limit its colors and size groups (e.g. a youth-only hoodie).
  const shirtColors = (s) => s.colors || SW.colors.map((c) => c.id);
  const shirtGroups = (s) => SW.sizes.filter((g) => !s.sizeGroups || s.sizeGroups.includes(g.group));
  const shirtSizes = (s) => shirtGroups(s).flatMap((g) => g.options.map((o) => g.group + ' ' + o));
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const state = {
    tab: location.hash === '#giftcards' ? 'gift' : 'shirt',
    shirt: SW.shirts[0].id,
    size: null,
    color: SW.colors[0].id,
    design: SW.designs[0].id,
    placement: 'back',
    logo: 'none',
    logoWarn: null,   // logo they tried to add while the design is on the front
    logoNote: false,  // true right after moving the design to the front removed their logo
    qty: 1,
    side: 'back',
    group: 'all',
    search: ''
  };
  const gift = { amount: SW.giftCards.amounts[1] || SW.giftCards.amounts[0], kind: 'email', sendTo: 'me', ship: 'local' };

  // Drop anything saved from an older version of the menu.
  let cart = (store.get(CART_KEY) || []).map((i) => ({ type: 'shirt', ...i })).filter((i) => {
    if (i.type === 'gift') return SW.giftCards.amounts.includes(i.amount) && (i.kind === 'email' || i.kind === 'print');
    const shirt = byId(SW.shirts, i.shirt);
    return shirt && shirtColors(shirt).includes(i.color) && shirtSizes(shirt).includes(i.size) &&
      byId(SW.designs, i.design) && byId(SW.placements, i.placement) && byId(SW.frontLogos, i.logo);
  });
  const saveCart = () => store.set(CART_KEY, cart);

  const unitPrice = (i) => (i.type === 'gift' ? i.amount : byId(SW.shirts, i.shirt).price);

  /* ---------- Shopify (Storefront API) ---------- */
  const shop = SW.shopify || {};
  const shopReady = !!(shop.storeDomain && shop.storefrontToken);
  let products = null;

  async function sf(query, variables) {
    const res = await fetch(`https://${shop.storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/${shop.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': shop.storefrontToken },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error((json.errors && json.errors[0] && json.errors[0].message) || 'Shopify request failed');
    return json.data;
  }

  async function loadProducts() {
    if (products) return products;
    const handles = [...SW.shirts.map((s) => s.shopifyHandle), SW.giftCards.emailHandle, SW.giftCards.printedHandle];
    const fields = handles.map((h, n) => `p${n}: product(handle: ${JSON.stringify(h)}) {
      title variants(first: 100) { nodes { id availableForSale price { amount } selectedOptions { name value } } } }`).join('\n');
    const data = await sf(`query { ${fields} }`);
    products = {};
    handles.forEach((h, n) => { products[h] = data['p' + n]; });
    return products;
  }

  function product(handle, label) {
    const p = products[handle];
    if (!p) throw new Error(`“${label}” isn’t in the online store yet. Please contact the PTO.`);
    return p;
  }

  // Use Size/Color variants when the Shopify product has them; otherwise its single variant.
  function shirtVariant(item) {
    const shirt = byId(SW.shirts, item.shirt);
    const p = product(shirt.shopifyHandle, shirt.name);
    const want = { size: item.size, color: byId(SW.colors, item.color).name, colour: byId(SW.colors, item.color).name };
    const v = p.variants.nodes.find((n) => n.selectedOptions.every((o) => {
      const w = want[o.name.toLowerCase()];
      return w === undefined || w.toLowerCase() === o.value.toLowerCase();
    }));
    if (!v) throw new Error(`${shirt.name} in ${want.size} / ${want.color} isn’t set up in the online store. Please contact the PTO.`);
    return v;
  }

  function giftVariant(item) {
    const handle = item.kind === 'email' ? SW.giftCards.emailHandle : SW.giftCards.printedHandle;
    const p = product(handle, item.kind === 'email' ? 'Emailed Gift Card' : 'Printed Gift Card');
    const v = p.variants.nodes.find((n) => Math.abs(parseFloat(n.price.amount) - item.amount) < 0.001);
    if (!v) throw new Error(`A ${money(item.amount)} gift card isn’t set up in the online store. Please contact the PTO.`);
    return v;
  }

  function cartLine(i) {
    const attrs = [];
    const add = (key, value) => { if (value) attrs.push({ key, value: String(value) }); };
    let variant;
    if (i.type === 'gift') {
      variant = giftVariant(i);
      if (i.kind === 'email' && i.sendTo === 'them') {
        add('Recipient name', i.toName);
        add('Recipient email', i.toEmail);
        add('Message', i.message);
        add('__shopify_send_gift_card_to_recipient', 'on');
      }
      if (i.kind === 'print') {
        add('To', i.toName);
        add('From', i.fromName);
        add('Message', i.message);
        add('Delivery preference', i.ship === 'local' ? 'Local delivery' : 'Ship it');
      }
    } else {
      variant = shirtVariant(i);
      const d = byId(SW.designs, i.design);
      add('Size', i.size);
      add('Color', byId(SW.colors, i.color).name);
      add('Design', `#${d.number} ${d.name}`);
      add('Design placement', byId(SW.placements, i.placement).name);
      add('Print version', tone(i.color) === 'dark' ? 'Dark fabric (white outline)' : 'Light fabric (dark outline)');
      if (i.placement === 'back') add('Front logo', byId(SW.frontLogos, i.logo).name);
    }
    if (!variant.availableForSale) throw new Error('Something in your order is sold out right now. Please remove it and try again.');
    return { merchandiseId: variant.id, quantity: i.qty, attributes: attrs };
  }

  async function checkout() {
    const btn = $('#sw-checkout');
    const note = $('#sw-checkout-note');
    btn.disabled = true;
    btn.textContent = 'Starting checkout…';
    note.textContent = '';
    try {
      await loadProducts();
      const lines = cart.map(cartLine);
      const data = await sf(`mutation ($input: CartInput!) {
        cartCreate(input: $input) { cart { id checkoutUrl } userErrors { message } } }`,
        { input: { lines, attributes: [{ key: 'Ordered from', value: 'schalmontpto.com/shop' }] } });
      const r = data.cartCreate;
      if (r.userErrors.length || !r.cart) throw new Error(r.userErrors.map((e) => e.message).join(' ') || 'Checkout could not start.');
      store.set(PENDING_KEY, { id: r.cart.id, at: Date.now() });
      location.href = r.cart.checkoutUrl;
    } catch (e) {
      note.textContent = e.message || 'Checkout could not start. Please try again.';
      note.classList.add('is-error');
      btn.disabled = false;
      btn.textContent = 'Checkout →';
    }
  }

  // After someone pays, Shopify turns the cart into an order and the cart can no longer
  // be looked up — so a missing cart means the order went through: clear it here.
  async function checkPendingCheckout() {
    const pending = store.get(PENDING_KEY);
    if (!pending || !shopReady) return;
    if (Date.now() - pending.at > 14 * 864e5) { store.set(PENDING_KEY, null); return; }
    try {
      const data = await sf('query ($id: ID!) { cart(id: $id) { id } }', { id: pending.id });
      if (!data.cart) {
        store.set(PENDING_KEY, null);
        cart = [];
        saveCart();
        renderCart();
        $('#sw-thanks').hidden = false;
      }
    } catch (e) { /* try again next visit */ }
  }

  /* ---------- Mockup: product photo with the design laid on top ---------- */
  const box = ([l, t, w, h]) => `left:${l}%;top:${t}%;width:${w}%;height:${h}%`;
  // Every design comes in a dark-fabric (white outline) and light-fabric (dark outline) version.
  const tone = (colorId) => byId(SW.colors, colorId).tone || 'dark';
  const designSrc = (id, colorId, thumb) => `${IMG}designs/${thumb ? 'thumbs/' : ''}${tone(colorId)}/${id}.webp`;

  function mockup(item, side, cls) {
    const shirt = byId(SW.shirts, item.shirt);
    let art = '';
    if (side === item.placement) {
      const d = byId(SW.designs, item.design);
      art = `<img class="sw-art" src="${designSrc(d.id, item.color, cls !== 'sw-mock-lg')}" alt="" style="${box(shirt[side])}">`;
    } else if (side === 'front') {
      const logo = byId(SW.frontLogos, item.logo);
      if (logo.image) art = `<img class="sw-art" src="${esc(logo.image)}" alt="" style="${box(shirt.chest)}">`;
    }
    return `<div class="sw-mock ${cls}"><img class="sw-blank" src="${IMG}blanks/${shirt.id}-${item.color}-${side}.webp" alt="">${art}</div>`;
  }

  /* ---------- Shirt builder ---------- */
  function renderShirts() {
    $('#sw-shirts').innerHTML = SW.shirts.map((s) => `
      <button type="button" class="sw-opt${s.id === state.shirt ? ' is-on' : ''}" data-pick="shirt" data-id="${s.id}" aria-pressed="${s.id === state.shirt}">
        <img src="${IMG}blanks/${s.id}-${shirtColors(s).includes(state.color) ? state.color : shirtColors(s)[0]}-front.webp" alt="" loading="lazy">
        <span class="sw-opt-name">${esc(s.name)}</span>
        <span class="sw-opt-price">${money(s.price)}</span>
      </button>`).join('');
  }

  function renderSizes() {
    $('#sw-sizes').innerHTML = shirtGroups(byId(SW.shirts, state.shirt)).map((g) => `
      <div class="sw-size-group">
        <div class="sw-size-group-label">${esc(g.group)}</div>
        <div class="sw-size-row">
          ${g.options.map((o) => {
            const id = g.group + ' ' + o;
            return `<button type="button" class="sw-size${id === state.size ? ' is-on' : ''}" data-pick="size" data-id="${esc(id)}" aria-pressed="${id === state.size}">${esc(o)}</button>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  function renderColors() {
    const allowed = shirtColors(byId(SW.shirts, state.shirt));
    $('#sw-colors').innerHTML = SW.colors.filter((c) => allowed.includes(c.id)).map((c) => `
      <button type="button" class="sw-swatch${c.id === state.color ? ' is-on' : ''}" data-pick="color" data-id="${c.id}" aria-pressed="${c.id === state.color}">
        <span style="background:${c.hex}"></span>${esc(c.name)}
      </button>`).join('');
  }

  function renderDesignFilters() {
    const groups = [{ id: 'all', name: 'All' }, ...SW.designGroups];
    $('#sw-design-tabs').innerHTML = groups.map((g) =>
      `<button type="button" class="sw-tab${g.id === state.group ? ' is-on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('');
  }

  function renderDesigns() {
    const q = state.search.trim().toLowerCase();
    const list = SW.designs.filter((d) =>
      (state.group === 'all' || d.group === state.group) &&
      (!q || d.name.toLowerCase().includes(q) || d.number.toLowerCase().includes(q)));
    $('#sw-designs').style.setProperty('--sw-tile', byId(SW.colors, state.color).hex);
    $('#sw-designs').innerHTML = list.length ? list.map((d) => `
      <button type="button" class="sw-design${d.id === state.design ? ' is-on' : ''}" data-pick="design" data-id="${d.id}" aria-pressed="${d.id === state.design}">
        <span class="sw-design-img"><img src="${designSrc(d.id, state.color, true)}" alt="" loading="lazy"></span>
        <span class="sw-design-num">#${esc(d.number)}</span>
        <span class="sw-design-name">${esc(d.name)}</span>
      </button>`).join('') : '<p class="sw-empty">No designs match your search.</p>';
  }

  function renderPlacements() {
    $('#sw-placements').innerHTML = SW.placements.map((p) => `
      <button type="button" class="sw-place${p.id === state.placement ? ' is-on' : ''}" data-pick="placement" data-id="${p.id}" aria-pressed="${p.id === state.placement}">
        ${mockup({ ...state, placement: p.id, logo: 'none' }, p.id, 'sw-mock-xs')}
        <span>${esc(p.name)}</span>
      </button>`).join('');
  }

  function renderLogos() {
    const warn = $('#sw-logo-warn');
    if (state.logoWarn) {
      warn.innerHTML = `<strong>⚠️ Your design is already on the front.</strong> There isn't room for a small
        ${esc(byId(SW.frontLogos, state.logoWarn).name)} logo there too.
        <div class="sw-warn-actions">
          <button type="button" class="btn btn-primary" data-warn="move">Move design to the back &amp; add logo</button>
          <button type="button" class="sw-tab" data-warn="keep">Keep design on the front</button>
        </div>`;
    } else if (state.logoNote) {
      warn.innerHTML = '<strong>⚠️ Front logo removed.</strong> Your design is on the front now, so there isn’t room for a small front logo too.';
    }
    warn.hidden = !state.logoWarn && !state.logoNote;
    warn.classList.toggle('is-note', !state.logoWarn);
    $('#sw-logos').innerHTML = SW.frontLogos.map((l) => `
      <button type="button" class="sw-logo${l.id === state.logo ? ' is-on' : ''}" data-pick="logo" data-id="${l.id}" aria-pressed="${l.id === state.logo}">
        ${l.image ? `<img src="${esc(l.image)}" alt="">` : '<span class="sw-logo-none">✕</span>'}
        <span>${esc(l.name)}</span>
      </button>`).join('');
  }

  function renderPreview() {
    const shirt = byId(SW.shirts, state.shirt);
    const design = byId(SW.designs, state.design);
    $('#sw-preview').innerHTML = mockup(state, state.side, 'sw-mock-lg');
    root.querySelectorAll('[data-side]').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.side === state.side);
      b.setAttribute('aria-pressed', b.dataset.side === state.side);
    });
    $('#sw-summary').innerHTML =
      `<strong>${esc(shirt.name)}</strong> · ${esc(byId(SW.colors, state.color).name)} · ` +
      (state.size ? esc(state.size) : '<span style="color:var(--warning)">Pick a size</span>') +
      `<br>${state.placement === 'front' ? 'Front' : 'Back'}: #${esc(design.number)} ${esc(design.name)}` +
      (state.placement === 'back' ? `<br>Front: ${esc(byId(SW.frontLogos, state.logo).name)}` : '');
    $('#sw-price').textContent = money(shirt.price * state.qty);
    $('#sw-qty').value = state.qty;
    $('#sw-add').disabled = !state.size;
  }

  /* ---------- Gift cards ---------- */
  function renderGift() {
    $('#sw-gc-amounts').innerHTML = SW.giftCards.amounts.map((a) =>
      `<button type="button" class="sw-size sw-gc-amount${a === gift.amount ? ' is-on' : ''}" data-gift="amount" data-val="${a}" aria-pressed="${a === gift.amount}">${money(a)}</button>`).join('');
    root.querySelectorAll('[data-gift="kind"], [data-gift="sendTo"], [data-gift="ship"]').forEach((b) => {
      const on = gift[b.dataset.gift] === b.dataset.val;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
    });
    $('#sw-gc-email').hidden = gift.kind !== 'email';
    $('#sw-gc-print').hidden = gift.kind !== 'print';
    $('#sw-gc-recipient').hidden = !(gift.kind === 'email' && gift.sendTo === 'them');
    $('#sw-gc-price').textContent = money(gift.amount);
  }

  function addGift() {
    const val = (id) => $(id).value.trim();
    const err = $('#sw-gc-error');
    const item = { type: 'gift', amount: gift.amount, kind: gift.kind, qty: 1 };
    if (gift.kind === 'email') {
      item.sendTo = gift.sendTo;
      if (gift.sendTo === 'them') {
        item.toName = val('#sw-gc-to-name');
        item.toEmail = val('#sw-gc-to-email');
        item.message = val('#sw-gc-message');
        if (!item.toName || !isEmail(item.toEmail)) { err.textContent = 'Please add the recipient’s name and a valid email address.'; err.hidden = false; return; }
      }
    } else {
      item.toName = val('#sw-gc-p-to');
      item.fromName = val('#sw-gc-p-from');
      item.message = val('#sw-gc-p-message');
      item.ship = gift.ship;
      if (!item.toName || !item.fromName) { err.textContent = 'Please fill in who the card is to and from.'; err.hidden = false; return; }
    }
    err.hidden = true;
    cart.push(item);
    saveCart();
    renderCart();
    root.querySelectorAll('#sw-panel-gift input, #sw-panel-gift textarea').forEach((f) => { f.value = ''; });
    flash('#sw-gc-added');
  }

  /* ---------- Order (cart) ---------- */
  function describe(i) {
    if (i.type === 'gift') {
      if (i.kind === 'email') return i.sendTo === 'them' ? `Emailed to ${i.toName} (${i.toEmail})` : 'Emailed to you';
      return `To ${i.toName}, from ${i.fromName} · ${i.ship === 'local' ? 'Local delivery' : 'Shipped'}`;
    }
    const d = byId(SW.designs, i.design);
    const base = `${i.size} · ${byId(SW.colors, i.color).name} · #${d.number} ${d.name}`;
    return i.placement === 'front' ? `${base} on Front` : `${base} on Back · Front logo: ${byId(SW.frontLogos, i.logo).name}`;
  }

  const itemName = (i) => (i.type === 'gift'
    ? `${i.kind === 'email' ? 'Emailed' : 'Printed'} Gift Card — ${money(i.amount)}`
    : byId(SW.shirts, i.shirt).name);

  function renderCart() {
    const count = cart.reduce((n, i) => n + i.qty, 0);
    const total = cart.reduce((n, i) => n + unitPrice(i) * i.qty, 0);
    $('#sw-cart-count').textContent = count ? `(${count})` : '';
    $('#sw-cart-total').textContent = money(total);
    $('#sw-cart-list').innerHTML = !cart.length
      ? '<p class="sw-empty">Your order is empty. Build a shirt or pick a gift card and tap “Add to Order.”</p>'
      : cart.map((i, idx) => `<div class="sw-cart-item">
          ${i.type === 'gift' ? `<img class="sw-cart-gc" src="${esc(SW.giftCards.image)}" alt="">` : mockup(i, i.placement, 'sw-mock-sm')}
          <div class="sw-cart-info">
            <div class="sw-cart-name">${esc(itemName(i))}</div>
            <div class="sw-cart-meta">${esc(describe(i))}</div>
            <div class="sw-cart-qty">
              <button type="button" data-cart="dec" data-idx="${idx}" aria-label="Decrease quantity">−</button>
              <span>${i.qty}</span>
              <button type="button" data-cart="inc" data-idx="${idx}" aria-label="Increase quantity">+</button>
              <button type="button" class="sw-remove" data-cart="remove" data-idx="${idx}">Remove</button>
            </div>
          </div>
          <div class="sw-cart-price">${money(unitPrice(i) * i.qty)}</div>
        </div>`).join('');
    const note = $('#sw-checkout-note');
    note.classList.remove('is-error');
    note.textContent = shopReady ? 'You’ll pay securely on Shopify.' : 'Online checkout opens soon.';
    $('#sw-checkout').disabled = !cart.length || !shopReady;
  }

  function flash(sel) {
    const el = $(sel);
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 1800);
  }

  function renderTab() {
    root.classList.toggle('is-gift', state.tab === 'gift');
    $('#sw-panel-shirt').hidden = state.tab !== 'shirt';
    $('#sw-panel-gift').hidden = state.tab !== 'gift';
    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.tab === state.tab);
      b.setAttribute('aria-selected', b.dataset.tab === state.tab);
    });
  }

  function renderAll() {
    renderTab(); renderShirts(); renderSizes(); renderColors(); renderDesignFilters(); renderDesigns();
    renderPlacements(); renderLogos(); renderPreview(); renderGift(); renderCart();
  }

  /* ---------- Events ---------- */
  root.addEventListener('click', (e) => {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t('[data-tab]'))) { state.tab = el.dataset.tab; renderTab(); return; }
    if ((el = t('[data-gift]'))) {
      const k = el.dataset.gift;
      gift[k] = k === 'amount' ? +el.dataset.val : el.dataset.val;
      renderGift();
      return;
    }
    if ((el = t('[data-warn]'))) {
      if (el.dataset.warn === 'move') {
        state.placement = 'back';
        state.logo = state.logoWarn;
        state.side = 'front';
        renderPlacements();
      }
      state.logoWarn = null;
      renderLogos();
      renderPreview();
      return;
    }
    if ((el = t('[data-pick]'))) {
      const key = el.dataset.pick;
      if (key === 'logo' && el.dataset.id !== 'none' && state.placement === 'front') {
        state.logoWarn = el.dataset.id;
        state.logoNote = false;
        renderLogos();
        return;
      }
      state[key] = el.dataset.id;
      state.logoWarn = null;
      state.logoNote = false;
      if (key === 'placement' && state.placement === 'front' && state.logo !== 'none') {
        state.logo = 'none';
        state.logoNote = true;
      }
      if (key === 'shirt') {
        const shirt = byId(SW.shirts, state.shirt);
        if (!shirtColors(shirt).includes(state.color)) state.color = shirtColors(shirt)[0];
        if (state.size && !shirtSizes(shirt).includes(state.size)) state.size = null;
        renderSizes(); renderColors(); renderDesigns();
      }
      if (key === 'design' || key === 'placement') state.side = state.placement;
      if (key === 'logo') state.side = state.logo === 'none' ? 'back' : 'front';
      if (key === 'shirt') { renderShirts(); renderPlacements(); }
      if (key === 'size') renderSizes();
      if (key === 'color') { renderShirts(); renderColors(); renderDesigns(); renderPlacements(); }
      if (key === 'design') { renderDesigns(); renderPlacements(); }
      if (key === 'placement') renderPlacements();
      renderLogos();
      renderPreview();
      return;
    }
    if ((el = t('[data-side]'))) { state.side = el.dataset.side; renderPreview(); return; }
    if ((el = t('[data-group]'))) { state.group = el.dataset.group; renderDesignFilters(); renderDesigns(); return; }
    if ((el = t('[data-cart]'))) {
      const idx = +el.dataset.idx;
      if (el.dataset.cart === 'inc') cart[idx].qty = Math.min(50, cart[idx].qty + 1);
      if (el.dataset.cart === 'dec') cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      if (el.dataset.cart === 'remove') cart.splice(idx, 1);
      saveCart();
      renderCart();
    }
  });

  $('#sw-design-search').addEventListener('input', (e) => { state.search = e.target.value; renderDesigns(); });
  $('#sw-qty').addEventListener('input', (e) => {
    state.qty = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
    renderPreview();
  });

  $('#sw-add').addEventListener('click', () => {
    if (!state.size) return;
    const keys = ['shirt', 'size', 'color', 'design', 'placement', 'logo'];
    const match = cart.find((i) => i.type === 'shirt' && keys.every((k) => i[k] === state[k]));
    if (match) match.qty = Math.min(50, match.qty + state.qty);
    else cart.push({ type: 'shirt', ...Object.fromEntries(keys.map((k) => [k, state[k]])), qty: state.qty });
    state.qty = 1;
    saveCart();
    renderCart();
    renderPreview();
    flash('#sw-added');
  });

  $('#sw-gc-add').addEventListener('click', addGift);
  $('#sw-checkout').addEventListener('click', checkout);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#giftcards') { state.tab = 'gift'; renderTab(); }
  });

  renderAll();

  if (shopReady) {
    checkPendingCheckout();
    // Show the store's real prices if they differ from the catalog.
    loadProducts().then(() => {
      SW.shirts.forEach((s) => {
        const p = products[s.shopifyHandle];
        if (p && p.variants.nodes.length) s.price = Math.min(...p.variants.nodes.map((v) => parseFloat(v.price.amount)));
      });
      renderShirts();
      renderPreview();
      renderCart();
    }).catch(() => {});
  }
})();
