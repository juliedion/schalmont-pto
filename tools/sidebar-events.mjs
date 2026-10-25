#!/usr/bin/env node
/* Write data/sidebar-events.json: every upcoming PTO event on the calendar, for the left menu.

   Runs the calendar's own code (js/public-calendar.js loadAll) against Firestore's REST API,
   so the list has exactly the events, names, merges and links the website calendar shows.
   District entries are left out. js/menus.js merges these into the sidebar alphabetically and
   drops each one after it ends. Runs daily in .github/workflows/lunch-menus.yml; by hand:

       node tools/sidebar-events.mjs
*/
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = 'https://firestore.googleapis.com/v1/projects/schalmont-pto/databases/(default)/documents:runQuery?key=AIzaSyCaH3Xo14pCxhxgvtg31Co2gDi1VuAHoFk';

function val(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return null;
}
const lit = (x) => Array.isArray(x) ? { arrayValue: { values: x.map(lit) } } : { stringValue: String(x) };
// Just enough of the Firestore web API for public-calendar.js: collection().where().get().
function collection(name) {
  const filters = [];
  const q = {
    where(field, op, value) { filters.push({ fieldFilter: { field: { fieldPath: field }, op: op === '==' ? 'EQUAL' : op === 'in' ? 'IN' : op, value: lit(value) } }); return q; },
    async get() {
      const where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
      const r = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: name }], where } }) });
      const rows = (await r.json()).filter((x) => x.document).map((x) => x.document);
      return { docs: rows.map((d) => ({ id: d.name.split('/').pop(), data: () => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) })) };
    }
  };
  return q;
}
const store = {};
const ctx = {
  console, Promise, Date, JSON, Math, Object, Array, String, RegExp, Number, setTimeout,
  sessionStorage: { getItem: () => null, setItem: () => {} },
  document: { addEventListener() {}, querySelectorAll: () => [], createElement: () => ({}) },
  firebase: { firestore: () => ({ collection }) }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/public-calendar.js'), 'utf8'), ctx);

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const r = await ctx.PTOEventData.loadAll();
const key = (t) => String(t).toLowerCase().replace(/&amp;/g, '&').replace(/\b20\d\d\b|\b1st annual\b|\bschalmont pto\b|\s*-?\s*\b(wk|week)\s*\d.*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const best = {};
for (const e of r.events) {                     // PTO events only (district dates are separate)
  const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
  if (end < today) continue;
  const k = key(e.title);
  const cur = best[k];
  const own = e.href && !e.href.startsWith('/event?');
  if (!cur || (own && !cur.own) || (own === cur.own && e.date < cur.date)) {
    best[k] = { title: e.title.replace(/\s*-\s*wk\s*\d.*$/i, '').trim(), date: e.date, end: cur ? (cur.end > end ? cur.end : end) : end, href: e.href, own };
  } else if (end > cur.end) cur.end = end;
}
const events = Object.values(best).sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())).map(({ own, ...x }) => x);
fs.writeFileSync(path.join(ROOT, 'data/sidebar-events.json'), JSON.stringify({ updated: today, events }, null, 1));
console.log(events.length + ' upcoming events written to data/sidebar-events.json');
