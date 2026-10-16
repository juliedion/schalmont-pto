/* ============================================================
   PTO Spiritwear Shoppe — shirt builder, gift cards, coupon book
   ------------------------------------------------------------
   One script for three pages that share one order (saved in the
   browser, so it follows the visitor between pages):
     shop.html        shirt builder        (#sw-panel-shirt)
     giftcards.html   gift cards           (#sw-panel-gift)
     couponbook.html  SaveAround book      (#sw-panel-coupon)
   Each page has the "Your Order" card (#sw-cart-list …) and only
   the panel(s) it needs; this script wires up whatever is there.

   Everything editable (items, prices, sizes, colors, designs,
   front logos, gift card amounts, coupon book, Shopify connection)
   lives in js/spiritwear-catalog.json.

   Checkout runs through Shopify: the order becomes a Shopify cart
   (Storefront API) with every choice attached to its line — Size,
   Color, Design, Front/Back, Front logo, gift card recipient,
   delivery — so Shopify's checkout, order page and confirmation
   email show the full order. Setup: SPIRITWEAR_SHOPIFY_SETUP.md.

   Images live in images/spiritwear/:
     blanks/<shirt>-<color>-<front|back>.webp   product photos
     blanks/<shirt>-generic-front.webp          color-neutral, for step 1
     designs/<dark|light>/<id>.webp (+ designs/thumbs/...)   designs, outlined for dark or light fabric
     logos/<id>.png                              small front logos
   ============================================================ */
(async function () {
  const root = document.getElementById('sw-builder');
  if (!root) return;

  let SW;
  try {
    SW = await (await fetch('js/spiritwear-catalog.json?v=6', { cache: 'no-cache' })).json();
  } catch (e) {
    root.style.display = 'none';
    return;
  }
  SW.designs = SW.designs.map((d) => ({ ...d, group: d.id.slice(0, 2), number: d.id.toUpperCase() }));

  const CART_KEY = 'sw-cart-v2';
  const PENDING_KEY = 'sw-pending-checkout';
  const IMG = 'images/spiritwear/';
  const $ = (sel) => root.querySelector(sel);
  const has = { shirt: !!$('#sw-panel-shirt'), gift: !!$('#sw-panel-gift'), coupon: !!$('#sw-panel-coupon') };
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

  // How printed gift cards and coupon books get to people. Labels differ a little per item.
  const DELIVERY = {
    gift: {
      school: ['🏫 Deliver to school', 'We’ll send it home with your student.'],
      home: ['🏠 Deliver to a home', 'Local delivery around the Schalmont / Albany area.'],
      ship: ['🎁 Ship it wrapped', 'Mailed fully gift-wrapped and addressed.']
    },
    coupon: {
      school: ['🏫 Send home with my student', 'We’ll deliver it to your student at school.'],
      home: ['🏠 Local home delivery', 'Dropped off around the Schalmont / Albany area.'],
      ship: ['📦 Ship it', 'Mailed to the address you enter at checkout.']
    }
  };
  const DELIVERY_NAMES = { school: 'Deliver to school', home: 'Local home delivery', ship: 'Ship it' };

  const state = {
    shirt: SW.shirts[0].id,
    size: null,
    color: null,      // picked in step 2
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
  const gift = { amount: SW.giftCards.amounts[1] || SW.giftCards.amounts[0], kind: 'print', sendTo: 'me', ship: 'school' };
  const coupon = { qty: 1, ship: 'school' };

  // Drop anything saved from an older version of the menu (and update old delivery names).
  let cart = (store.get(CART_KEY) || []).map((i) => ({ type: 'shirt', ...i })).map((i) =>
    (i.type === 'gift' && i.ship === 'local' ? { ...i, ship: 'home' } : i)).filter((i) => {
    if (i.type === 'gift') return SW.giftCards.amounts.includes(i.amount) && (i.kind === 'email' || (i.kind === 'print' && DELIVERY.gift[i.ship]));
    if (i.type === 'coupon') return !!SW.couponBook && !!DELIVERY.coupon[i.ship];
    const shirt = byId(SW.shirts, i.shirt);
    return shirt && shirtColors(shirt).includes(i.color) && shirtSizes(shirt).includes(i.size) &&
      byId(SW.designs, i.design) && byId(SW.placements, i.placement) && byId(SW.frontLogos, i.logo);
  });
  const saveCart = () => store.set(CART_KEY, cart);

  const unitPrice = (i) => (i.type === 'gift' ? i.amount : i.type === 'coupon' ? SW.couponBook.price : byId(SW.shirts, i.shirt).price);

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
    if (SW.couponBook) handles.push(SW.couponBook.shopifyHandle);
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
    const addDelivery = () => {
      add('Delivery', DELIVERY_NAMES[i.ship]);
      if (i.ship === 'school') { add('Student', i.student); add('School', i.school); add('Teacher', i.teacher); }
    };
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
        addDelivery();
        if (i.ship === 'ship') add('Gift wrap', 'Wrapped and addressed');
      }
    } else if (i.type === 'coupon') {
      variant = product(SW.couponBook.shopifyHandle, SW.couponBook.name).variants.nodes[0];
      addDelivery();
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
    if (!variant || !variant.availableForSale) throw new Error('Something in your order is sold out right now. Please remove it and try again.');
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
        { input: { lines, attributes: [{ key: 'Ordered from', value: 'schalmontpto.com' }] } });
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
        const thanks = $('#sw-thanks');
        if (thanks) thanks.hidden = false;
      }
    } catch (e) { /* try again next visit */ }
  }

  /* ---------- Mockup: product photo with the design laid on top ---------- */
  const box = ([l, t, w, h]) => `left:${l}%;top:${t}%;width:${w}%;height:${h}%`;
  // Every design comes in a dark-fabric (white outline) and light-fabric (dark outline) version.
  const tone = (colorId) => (colorId && byId(SW.colors, colorId).tone) || 'dark';
  const designSrc = (id, colorId, thumb) => `${IMG}designs/${thumb ? 'thumbs/' : ''}${tone(colorId)}/${id}.webp`;
  // Until a color is picked, previews use the shirt's first color.
  const shownColor = () => state.color || shirtColors(byId(SW.shirts, state.shirt))[0];

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
        <img src="${IMG}blanks/${s.id}-generic-front.webp" alt="" loading="lazy">
        <span class="sw-opt-name">${esc(s.name)}</span>
        <span class="sw-opt-price">${money(s.price)}</span>
      </button>`).join('');
  }

  function renderColors() {
    const allowed = shirtColors(byId(SW.shirts, state.shirt));
    $('#sw-colors').innerHTML = SW.colors.filter((c) => allowed.includes(c.id)).map((c) => `
      <button type="button" class="sw-swatch${c.id === state.color ? ' is-on' : ''}" data-pick="color" data-id="${c.id}" aria-pressed="${c.id === state.color}">
        <span style="background:${c.hex}"></span>${esc(c.name)}
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
    $('#sw-designs').style.setProperty('--sw-tile', byId(SW.colors, shownColor()).hex);
    $('#sw-designs').innerHTML = list.length ? list.map((d) => `
      <button type="button" class="sw-design${d.id === state.design ? ' is-on' : ''}" data-pick="design" data-id="${d.id}" aria-pressed="${d.id === state.design}">
        <span class="sw-design-img"><img src="${designSrc(d.id, shownColor(), true)}" alt="" loading="lazy"></span>
        <span class="sw-design-num">#${esc(d.number)}</span>
        <span class="sw-design-name">${esc(d.name)}</span>
      </button>`).join('') : '<p class="sw-empty">No designs match your search.</p>';
  }

  function renderPlacements() {
    $('#sw-placements').innerHTML = SW.placements.map((p) => `
      <button type="button" class="sw-place${p.id === state.placement ? ' is-on' : ''}" data-pick="placement" data-id="${p.id}" aria-pressed="${p.id === state.placement}">
        ${mockup({ ...state, color: shownColor(), placement: p.id, logo: 'none' }, p.id, 'sw-mock-xs')}
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
    $('#sw-preview').innerHTML = mockup({ ...state, color: shownColor() }, state.side, 'sw-mock-lg');
    root.querySelectorAll('[data-side]').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.side === state.side);
      b.setAttribute('aria-pressed', b.dataset.side === state.side);
    });
    const need = (txt) => `<span style="color:var(--warning)">${txt}</span>`;
    $('#sw-summary').innerHTML =
      `<strong>${esc(shirt.name)}</strong> · ` +
      (state.color ? esc(byId(SW.colors, state.color).name) : need('Pick a color')) + ' · ' +
      (state.size ? esc(state.size) : need('Pick a size')) +
      `<br>${state.placement === 'front' ? 'Front' : 'Back'}: #${esc(design.number)} ${esc(design.name)}` +
      (state.placement === 'back' ? `<br>Front: ${esc(byId(SW.frontLogos, state.logo).name)}` : '');
    $('#sw-price').textContent = money(shirt.price * state.qty);
    $('#sw-qty').value = state.qty;
    $('#sw-add').disabled = !state.size || !state.color;
  }

  /* ---------- Delivery picker (printed gift cards, coupon books) ---------- */
  function renderDelivery(kind, model) {
    const wrap = $(`.sw-delivery[data-for="${kind}"]`);
    if (!wrap) return;
    const opts = DELIVERY[kind];
    wrap.querySelector('.sw-delivery-opts').innerHTML = Object.keys(opts).map((k) => `
      <button type="button" class="sw-gc-kind${model.ship === k ? ' is-on' : ''}" data-ship="${kind}" data-val="${k}" aria-pressed="${model.ship === k}">
        <strong>${opts[k][0]}</strong><span>${opts[k][1]}</span>
      </button>`).join('');
    wrap.querySelector('.sw-school-fields').hidden = model.ship !== 'school';
    wrap.querySelector('.sw-hint').textContent = model.ship === 'school'
      ? 'Tell us who to give it to — no address needed.'
      : 'You’ll enter the address at checkout.';
  }

  function readSchoolFields(kind) {
    const wrap = $(`.sw-delivery[data-for="${kind}"]`);
    const v = (n) => wrap.querySelector(`[name="${n}"]`).value.trim();
    return { student: v('student'), school: v('school'), teacher: v('teacher') };
  }

  function schoolOptions() {
    return '<option value="">Choose a school…</option>' + (SW.schools || []).map((s) => `<option>${esc(s)}</option>`).join('');
  }

  /* ---------- Gift cards ---------- */
  function renderGift() {
    $('#sw-gc-amounts').innerHTML = SW.giftCards.amounts.map((a) =>
      `<button type="button" class="sw-size sw-gc-amount${a === gift.amount ? ' is-on' : ''}" data-gift="amount" data-val="${a}" aria-pressed="${a === gift.amount}">${money(a)}</button>`).join('');
    root.querySelectorAll('[data-gift="kind"], [data-gift="sendTo"]').forEach((b) => {
      const on = gift[b.dataset.gift] === b.dataset.val;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
    });
    $('#sw-gc-email').hidden = gift.kind !== 'email';
    $('#sw-gc-print').hidden = gift.kind !== 'print';
    $('#sw-gc-recipient').hidden = !(gift.kind === 'email' && gift.sendTo === 'them');
    $('#sw-gc-price').textContent = money(gift.amount);
    renderDelivery('gift', gift);
  }

  function showError(sel, msg) {
    const err = $(sel);
    err.textContent = msg;
    err.hidden = !msg;
    return !msg;
  }

  function addGift() {
    const val = (id) => $(id).value.trim();
    const item = { type: 'gift', amount: gift.amount, kind: gift.kind, qty: 1 };
    if (gift.kind === 'email') {
      item.sendTo = gift.sendTo;
      if (gift.sendTo === 'them') {
        item.toName = val('#sw-gc-to-name');
        item.toEmail = val('#sw-gc-to-email');
        item.message = val('#sw-gc-message');
        if (!item.toName || !isEmail(item.toEmail)) return showError('#sw-gc-error', 'Please add the recipient’s name and a valid email address.');
      }
    } else {
      item.toName = val('#sw-gc-p-to');
      item.fromName = val('#sw-gc-p-from');
      item.message = val('#sw-gc-p-message');
      item.ship = gift.ship;
      if (!item.toName || !item.fromName) return showError('#sw-gc-error', 'Please fill in who the card is to and from.');
      if (gift.ship === 'school') {
        Object.assign(item, readSchoolFields('gift'));
        if (!item.student || !item.school) return showError('#sw-gc-error', 'Please add the student’s name and school so we can deliver it.');
      }
    }
    showError('#sw-gc-error', '');
    cart.push(item);
    saveCart();
    renderCart();
    root.querySelectorAll('#sw-panel-gift input, #sw-panel-gift textarea, #sw-panel-gift select').forEach((f) => { f.value = ''; });
    flash('#sw-gc-added');
  }

  /* ---------- Coupon book ---------- */
  function renderCoupon() {
    $('#sw-cb-qty').value = coupon.qty;
    $('#sw-cb-price').textContent = money(SW.couponBook.price * coupon.qty);
    renderDelivery('coupon', coupon);
  }

  function addCoupon() {
    const item = { type: 'coupon', qty: coupon.qty, ship: coupon.ship };
    if (coupon.ship === 'school') {
      Object.assign(item, readSchoolFields('coupon'));
      if (!item.student || !item.school) return showError('#sw-cb-error', 'Please add the student’s name and school so we can deliver it.');
    }
    showError('#sw-cb-error', '');
    cart.push(item);
    coupon.qty = 1;
    saveCart();
    renderCart();
    renderCoupon();
    flash('#sw-cb-added');
  }

  /* ---------- Order (cart) ---------- */
  function deliveryText(i) {
    if (i.ship === 'school') return `Deliver to ${i.student} at ${i.school}${i.teacher ? ` (${i.teacher})` : ''}`;
    return i.ship === 'home' ? 'Local home delivery' : (i.type === 'gift' ? 'Shipped, wrapped & addressed' : 'Shipped');
  }

  function describe(i) {
    if (i.type === 'coupon') return deliveryText(i);
    if (i.type === 'gift') {
      if (i.kind === 'email') return i.sendTo === 'them' ? `Emailed to ${i.toName} (${i.toEmail})` : 'Emailed to you';
      return `To ${i.toName}, from ${i.fromName} · ${deliveryText(i)}`;
    }
    const d = byId(SW.designs, i.design);
    const base = `${i.size} · ${byId(SW.colors, i.color).name} · #${d.number} ${d.name}`;
    return i.placement === 'front' ? `${base} on Front` : `${base} on Back · Front logo: ${byId(SW.frontLogos, i.logo).name}`;
  }

  const itemName = (i) => (i.type === 'gift'
    ? `${i.kind === 'email' ? 'Emailed' : 'Printed'} Gift Card — ${money(i.amount)}`
    : i.type === 'coupon' ? SW.couponBook.name : byId(SW.shirts, i.shirt).name);

  function itemThumb(i) {
    if (i.type === 'gift') return `<img class="sw-cart-gc" src="${esc(SW.giftCards.image)}" alt="">`;
    if (i.type === 'coupon') return '<span class="sw-cart-cb" aria-hidden="true">🎟️</span>';
    return mockup(i, i.placement, 'sw-mock-sm');
  }

  function renderCart() {
    const count = cart.reduce((n, i) => n + i.qty, 0);
    const total = cart.reduce((n, i) => n + unitPrice(i) * i.qty, 0);
    $('#sw-cart-count').textContent = count ? `(${count})` : '';
    $('#sw-cart-total').textContent = money(total);
    $('#sw-cart-list').innerHTML = !cart.length
      ? '<p class="sw-empty">Your order is empty. Add something and it will show up here.</p>'
      : cart.map((i, idx) => `<div class="sw-cart-item">
          ${itemThumb(i)}
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

  function renderShirtBuilder() {
    renderShirts(); renderColors(); renderSizes(); renderDesignFilters(); renderDesigns();
    renderPlacements(); renderLogos(); renderPreview();
  }

  /* ---------- Events ---------- */
  root.addEventListener('click', (e) => {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t('[data-ship]'))) {
      (el.dataset.ship === 'gift' ? gift : coupon).ship = el.dataset.val;
      renderDelivery(el.dataset.ship, el.dataset.ship === 'gift' ? gift : coupon);
      return;
    }
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
      if (key === 'design' || key === 'placement') state.side = state.placement;
      if (key === 'logo') state.side = state.logo === 'none' ? 'back' : 'front';
      if (key === 'shirt') {
        const shirt = byId(SW.shirts, state.shirt);
        if (state.color && !shirtColors(shirt).includes(state.color)) state.color = null;
        if (state.size && !shirtSizes(shirt).includes(state.size)) state.size = null;
        renderShirts(); renderColors(); renderSizes(); renderDesigns(); renderPlacements();
      }
      if (key === 'size') renderSizes();
      if (key === 'color') { renderColors(); renderDesigns(); renderPlacements(); }
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

  root.querySelectorAll('.sw-delivery select[name="school"]').forEach((s) => { s.innerHTML = schoolOptions(); });

  if (has.shirt) {
    $('#sw-design-search').addEventListener('input', (e) => { state.search = e.target.value; renderDesigns(); });
    $('#sw-qty').addEventListener('input', (e) => {
      state.qty = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
      renderPreview();
    });
    $('#sw-add').addEventListener('click', () => {
      if (!state.size || !state.color) return;
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
    renderShirtBuilder();
  }
  if (has.gift) {
    $('#sw-gc-add').addEventListener('click', addGift);
    renderGift();
  }
  if (has.coupon) {
    $('#sw-cb-qty').addEventListener('input', (e) => {
      coupon.qty = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
      $('#sw-cb-price').textContent = money(SW.couponBook.price * coupon.qty);
    });
    $('#sw-cb-add').addEventListener('click', addCoupon);
    renderCoupon();
  }
  $('#sw-checkout').addEventListener('click', checkout);
  renderCart();

  if (shopReady) {
    checkPendingCheckout();
    // Show the store's real prices if they differ from the catalog.
    loadProducts().then(() => {
      SW.shirts.forEach((s) => {
        const p = products[s.shopifyHandle];
        if (p && p.variants.nodes.length) s.price = Math.min(...p.variants.nodes.map((v) => parseFloat(v.price.amount)));
      });
      const cb = SW.couponBook && products[SW.couponBook.shopifyHandle];
      if (cb && cb.variants.nodes.length) SW.couponBook.price = parseFloat(cb.variants.nodes[0].price.amount);
      if (has.shirt) { renderShirts(); renderPreview(); }
      if (has.coupon) renderCoupon();
      renderCart();
    }).catch(() => {});
  }
})();
