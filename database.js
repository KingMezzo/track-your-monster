/* Barcode → Sorte → lokales Foto. OpenFoodFacts liefert ausschließlich Produktdaten. */
(function () {
  "use strict";
  const CATALOG = window.MonsterCatalog;
  const MAP_KEY = "monsterTracker.barcodeMap.v1";
  const OFF_URL = "https://world.openfoodfacts.org/api/v2/product/";
  const OFF_FIELDS = "product_name,brands,quantity,nutriments";
  const DEFAULT_ACCENT = "#b4df42";

  // Mehrere Länder-/Größen-Barcodes dürfen dieselbe Sorte referenzieren.
  // Hier nur gesicherte Zuordnungen eintragen; keine EANs aus Namen ableiten.
  const BARCODE_MAP = { "5060337500401": "original" };
  function readMappings() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY)) || {}; }
    catch { return {}; }
  }
  function barcodeKey(ean) {
    const digits = String(ean).trim();
    // UPC-A, EAN-13 und GTIN-14 mit führenden Nullen sind äquivalent.
    return /^\d{12,14}$/.test(digits) ? digits.padStart(14, "0") : digits;
  }
  function byId(id) { return CATALOG.find(p => p.id === id) || null; }
  function mappedId(ean) {
    if (String(ean).startsWith("catalog:")) return String(ean).slice(8);
    const key = barcodeKey(ean);
    const custom = readMappings();
    if (Object.hasOwn(custom, key)) return custom[key];
    const known = Object.keys(BARCODE_MAP).find(code => barcodeKey(code) === key);
    return known ? BARCODE_MAP[known] : null;
  }
  function linkBarcode(ean, id) {
    if (id && !byId(id)) return false;
    const mappings = readMappings();
    mappings[barcodeKey(ean)] = id || "";
    try { localStorage.setItem(MAP_KEY, JSON.stringify(mappings)); return true; }
    catch { return false; }
  }
  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function matchVariant(text) {
    const value = " " + normalize(text) + " ";
    const matches = CATALOG.flatMap(p => p.aliases.map(alias => ({ p, alias: normalize(alias) })))
      .filter(({ alias }) => value.includes(" " + alias + " "))
      .sort((a, b) => b.alias.length - a.alias.length);
    if (matches.length && !(matches[0].p.id === "original" && /zero|ultra|sugar/.test(value))) return matches[0].p;
    if (/^(monster|monster energy|monster energy drink|monster energy original)$/.test(normalize(text))) return byId("original");
    return null;
  }
  function catalogFor(p) {
    const key = barcodeKey(p.ean || "");
    const mappings = readMappings();
    if (Object.hasOwn(mappings, key)) return byId(mappings[key]);
    return byId(mappedId(p.ean)) || byId(p.catalogId) || matchVariant((p.name || "") + " " + (p.sub || ""));
  }
  function localImage(p) {
    const item = catalogFor(p);
    return item ? item.image : "";
  }
  function getLocal(ean) {
    const item = byId(mappedId(ean));
    return item ? Object.assign({}, item, { ean, source: "local" }) : null;
  }
  function parseVolumeMl(quantity) {
    const m = String(quantity || "").replace(",", ".").match(/([\d.]+)\s*(ml|cl|l)\b/i);
    if (!m) return 500;
    return Math.round(Number(m[1]) * ({ ml: 1, cl: 10, l: 1000 }[m[2].toLowerCase()]));
  }
  function placeholder(accent) {
    const color = /^#[0-9a-f]{3,8}$/i.test(accent || "") ? accent : DEFAULT_ACCENT;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200"><rect x="29" y="10" width="62" height="8" rx="3" fill="#8e918a"/><rect x="25" y="18" width="70" height="170" rx="12" fill="#242722" stroke="#565a50" stroke-width="2"/><path d="M45 55v60m15-70v80m15-70v60" stroke="' + color + '" stroke-width="7"/><text x="60" y="157" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#b8bcb1">KEIN FOTO</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  async function fetchOFF(ean) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(OFF_URL + encodeURIComponent(ean) + ".json?fields=" + OFF_FIELDS, { signal: controller.signal });
      if (!res.ok && res.status !== 404) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || data.status !== 1 || !data.product) return null;
      const p = data.product;
      const name = (p.product_name || "").trim();
      const brand = p.brands || "";
      if (!/monster/i.test(name + " " + brand)) return null;
      const variant = matchVariant(name);
      if (variant) linkBarcode(ean, variant.id);
      const ml = parseVolumeMl(p.quantity);
      const caffeine = (p.nutriments || {}).caffeine_100g;
      const hasCaffeine = typeof caffeine === "number" && caffeine >= 0 && caffeine <= 0.1;
      const per100 = hasCaffeine ? caffeine * 1000 : variant && variant.line === "Ultra" ? 30 : 32;
      return {
        ean, name: variant ? "Monster" : name || "Monster Energy",
        sub: variant ? variant.sub : "", catalogId: variant ? variant.id : "",
        mg: Math.round(per100 * ml / 100), ml, estimated: !hasCaffeine,
        accent: variant ? variant.accent : DEFAULT_ACCENT,
        source: "openfoodfacts"
      };
    } finally { clearTimeout(timeout); }
  }
  async function resolve(ean) { return getLocal(ean) || fetchOFF(ean); }
  window.MonsterDB = {
    CATALOG, BARCODE_MAP, MAP_KEY, DEFAULT_ACCENT,
    byId, getLocal, catalogFor, localImage, linkBarcode, matchVariant,
    resolve, fetchOFF, placeholder,
    clearMappings() { localStorage.removeItem(MAP_KEY); }
  };
})();
