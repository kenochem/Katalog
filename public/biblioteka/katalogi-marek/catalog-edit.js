import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://fgkkvbniyjysgqcjuxpl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZna2t2Ym5peWp5c2dxY2p1eHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE0MjgsImV4cCI6MjEwMDcyNzQyOH0.HiiaVnv_G5QR8WQ1YggA_iPRO5I7mJa0nd0C8K9KOHQ';
const TABLE = 'catalog_product_overrides';
const BRAND_META_SKU = '__brand__'; // sentinel "sku" in the same table — stores the hero intro text (category column unused for it)

const CATALOG = window.CATALOG;
const SLUG = window.CATALOG_SLUG;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById('categories');
const toolbar = document.querySelector('.toolbar .acts');
const ledeWrap = document.getElementById('heroLedeWrap');

let editing = false;
const dirty = new Map(); // sku -> { category, description }
let ledeText = ledeWrap ? ledeWrap.textContent.trim() : '';

function fmtPrice(n) {
  return n.toFixed(2).replace('.', ',') + ' zł';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function categoryOptions(selected) {
  return CATALOG.categoryOrder.map((c) =>
    `<option value="${escapeHtml(c.name)}"${c.name === selected ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');
}

function render() {
  const bySlug = new Map();
  CATALOG.categoryOrder.forEach((c) => bySlug.set(c.name, []));
  CATALOG.items.forEach((p) => {
    if (!bySlug.has(p.cat)) bySlug.set(p.cat, []); // orphaned category (shouldn't happen, but don't drop the product)
    bySlug.get(p.cat).push(p);
  });

  let html = '';
  CATALOG.categoryOrder.forEach((cat) => {
    const items = bySlug.get(cat.name) || [];
    if (items.length === 0 && !editing) return;
    html += `<section class="category"><h2>${escapeHtml(cat.name)} <span class="count">(${items.length})</span></h2>`;
    if (cat.note) html += `<p class="subnote">${escapeHtml(cat.note)}</p>`;
    html += '<div class="grid">';
    items.forEach((p) => {
      const sizes = p.s.map((s) => {
        const price = s.p !== undefined ? fmtPrice(s.p) : '—';
        return `<div class="row"><span class="v">${escapeHtml(s.v)}</span><span class="p">${price}</span></div>`;
      }).join('');
      const descBlock = editing
        ? `<textarea class="d-edit" data-sku="${escapeHtml(p.sku)}" rows="3">${escapeHtml(p.d)}</textarea>`
        : `<p class="d">${escapeHtml(p.d)}</p>`;
      const catBlock = editing
        ? `<select class="cat-edit" data-sku="${escapeHtml(p.sku)}">${categoryOptions(p.cat)}</select>`
        : '';
      html += `` +
        `<div class="card${editing ? ' editing' : ''}">` +
          `<div class="thumb"><img loading="lazy" src="${p.img}" alt="${escapeHtml(p.n)}"></div>` +
          `<h3>${escapeHtml(p.n)}</h3>` +
          descBlock +
          catBlock +
          `<div class="foot"><div class="sizes">${sizes}</div><span class="sku">${escapeHtml(p.sku)}</span></div>` +
        `</div>`;
    });
    html += '</div></section>';
  });
  root.innerHTML = html;

  if (editing) wireEditHandlers();
}
window.render = render;

function renderLede() {
  if (!ledeWrap) return;
  if (editing) {
    ledeWrap.innerHTML =
      '<label class="lede-edit-label">Opis producenta (nagłówek katalogu)</label>' +
      `<textarea id="ledeEdit" class="lede lede-edit" rows="5">${escapeHtml(ledeText)}</textarea>`;
    document.getElementById('ledeEdit').addEventListener('input', (e) => {
      ledeText = e.target.value;
      dirty.set(BRAND_META_SKU, { category: null, description: ledeText });
      updateSaveBar();
    });
  } else {
    ledeWrap.innerHTML = `<p class="lede">${escapeHtml(ledeText)}</p>`;
  }
}

function wireEditHandlers() {
  root.querySelectorAll('.d-edit').forEach((el) => {
    el.addEventListener('input', () => {
      const sku = el.dataset.sku;
      const item = CATALOG.items.find((p) => p.sku === sku);
      if (!item) return;
      item.d = el.value;
      markDirty(sku, item);
    });
  });
  root.querySelectorAll('.cat-edit').forEach((el) => {
    el.addEventListener('change', () => {
      const sku = el.dataset.sku;
      const item = CATALOG.items.find((p) => p.sku === sku);
      if (!item) return;
      item.cat = el.value;
      markDirty(sku, item);
      render();
    });
  });
}

function markDirty(sku, item) {
  dirty.set(sku, { category: item.cat, description: item.d });
  updateSaveBar();
}

function updateSaveBar() {
  const bar = document.getElementById('editSaveBar');
  if (!bar) return;
  bar.querySelector('.count').textContent = dirty.size;
  bar.hidden = dirty.size === 0;
}

function toast(msg) {
  let el = document.getElementById('catalogToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'catalogToast';
    el.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1e2220;color:#f1f0e9;font-family:"IBM Plex Mono",monospace;font-size:12.5px;padding:9px 16px;border-radius:8px;z-index:9999;opacity:0;transition:opacity .25s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}

function buildToolbar(session) {
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.id = 'editToggleBtn';
  editBtn.textContent = '✏️ Edytuj';
  toolbar.insertBefore(editBtn, toolbar.firstChild);

  const saveBar = document.createElement('div');
  saveBar.id = 'editSaveBar';
  saveBar.hidden = true;
  saveBar.style.cssText = 'display:flex;align-items:center;gap:8px;';
  saveBar.innerHTML =
    '<span class="mono" style="font-size:11.5px;color:var(--ink-soft);">Zmian: <b class="count">0</b></span>' +
    '<button type="button" id="editCancelBtn">Anuluj</button>' +
    '<button type="button" id="editSaveBtn" class="primary">💾 Zapisz</button>';
  toolbar.insertBefore(saveBar, editBtn.nextSibling);

  editBtn.addEventListener('click', () => {
    editing = !editing;
    editBtn.textContent = editing ? '✕ Zamknij edycję' : '✏️ Edytuj';
    if (!editing) { dirty.clear(); updateSaveBar(); }
    render();
    renderLede();
  });

  document.getElementById('editCancelBtn').addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('editSaveBtn').addEventListener('click', async () => {
    if (dirty.size === 0) return;
    const rows = [...dirty.entries()].map(([sku, v]) => ({
      catalog_slug: SLUG,
      sku,
      category: v.category,
      description: v.description,
      updated_by: session.user.email || session.user.id,
    }));
    try {
      const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'catalog_slug,sku' });
      if (error) throw error;
      toast(`Zapisano (${rows.length})`);
      dirty.clear();
      updateSaveBar();
      editing = false;
      editBtn.textContent = '✏️ Edytuj';
      render();
      renderLede();
    } catch (e) {
      console.warn('Zapis nie powiódł się — czy migracja SQL (catalog_product_overrides) jest uruchomiona w Supabase?', e);
      toast('Błąd zapisu — zobacz konsolę (migracja SQL może nie być uruchomiona)');
    }
  });
}

async function loadOverridesAndInit() {
  try {
    const { data, error } = await supabase.from(TABLE).select('sku,category,description').eq('catalog_slug', SLUG);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (row.sku === BRAND_META_SKU) {
        if (row.description) ledeText = row.description;
        return;
      }
      const item = CATALOG.items.find((p) => p.sku === row.sku);
      if (!item) return;
      if (row.description) item.d = row.description;
      if (row.category && CATALOG.categoryOrder.some((c) => c.name === row.category)) item.cat = row.category;
    });
  } catch (e) {
    console.warn('Katalog: brak zapisanych nadpisań (migracja SQL może nie być jeszcze uruchomiona) — pokazuję domyślną treść.', e);
  }
  render();
  renderLede();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) buildToolbar(session);
  } catch (e) {
    console.warn('Katalog: nie udało się sprawdzić sesji logowania.', e);
  }
}

loadOverridesAndInit();

/* ---------- motyw ---------- */
const THEME_KEY = 'katalog-theme';
function syncThemeBtnLabel() {
  const t = document.documentElement.getAttribute('data-theme');
  document.getElementById('themeBtn').textContent = t === 'dark' ? '☀️ Jasny' : t === 'light' ? '🌙 Ciemny' : '🌓 Motyw';
}
syncThemeBtnLabel();
document.getElementById('themeBtn').addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme');
  const next = t === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  syncThemeBtnLabel();
});
