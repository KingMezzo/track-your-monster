/* ==========================================================================
   database.js – lokale Produktdatenbank + OpenFoodFacts-Fallback
   --------------------------------------------------------------------------
   PRODUCTS:  bekannte EANs (hier eigene Sorten ergänzen).
   VARIANTS:  Schlagwörter, mit denen OpenFoodFacts-Treffer automatisch
              Akzentfarbe und Koffeinwert bekommen.
   Bilder:    werden per EAN von OpenFoodFacts geladen und im LocalStorage
              gecacht. Fehlt ein Bild, wird eine Dosen-Grafik in der
              Akzentfarbe angezeigt.
   ========================================================================== */
(function () {
  "use strict";

  const IMG_CACHE_KEY = "monsterTracker.imgCache.v1";
  const OFF_URL = "https://world.openfoodfacts.org/api/v2/product/";
  const OFF_FIELDS = "product_name,brands,quantity,image_front_url,image_front_small_url,nutriments";

  // Standard: 32 mg Koffein pro 100 ml (Monster Energy, 500-ml-Dose = 160 mg)
  const DEFAULT_PER_100ML = 32;
  const DEFAULT_ML = 500;

  /* ---- Bekannte Dosen (EAN -> Daten) ------------------------------------
     Weitere Sorten einfach nach diesem Muster ergänzen. Alle anderen Codes
     findet die App über OpenFoodFacts und merkt sie sich danach lokal.     */
  const PRODUCTS = {
    "5060337500401": {
      name: "Monster Energy",
      sub: "Original Green",
      mg: 160,
      ml: 500,
      accent: "#7dff00",
      image: "" // leer = per OpenFoodFacts nach EAN laden
    }
  };

  /* ---- Sorten-Erkennung für OpenFoodFacts-Treffer ------------------------ */
  const VARIANTS = [
    { keys: ["ultra white", "ultra zero"],         sub: "Ultra White",    accent: "#dfe9ff", per100: 30 },
    { keys: ["ultra paradise"],                    sub: "Ultra Paradise", accent: "#46f0c8", per100: 30 },
    { keys: ["ultra gold"],                        sub: "Ultra Gold",     accent: "#ffd34d", per100: 30 },
    { keys: ["ultra red"],                         sub: "Ultra Red",      accent: "#ff3b4e", per100: 30 },
    { keys: ["ultra violet"],                      sub: "Ultra Violet",   accent: "#a56bff", per100: 30 },
    { keys: ["ultra blue", "ultra sunrise"],       sub: "Ultra",          accent: "#3b8bff", per100: 30 },
    { keys: ["ultra fiesta", "fiesta mango"],      sub: "Ultra Fiesta",   accent: "#ff9f1a", per100: 30 },
    { keys: ["ultra"],                             sub: "Ultra",          accent: "#cfd8e3", per100: 30 },
    { keys: ["mango loco"],                        sub: "Mango Loco",     accent: "#ffb300" },
    { keys: ["pipeline punch"],                    sub: "Pipeline Punch", accent: "#ff4fa3" },
    { keys: ["aussie lemonade", "lemonade"],       sub: "Aussie Lemonade",accent: "#e6ff3b" },
    { keys: ["the doctor", "vr46"],                sub: "The Doctor",     accent: "#ffa500" },
    { keys: ["khaotic"],                           sub: "Khaotic",        accent: "#ff7a1a" },
    { keys: ["juiced"],                            sub: "Juiced",         accent: "#ff6a3d" },
    { keys: ["rehab"],                             sub: "Rehab",          accent: "#7fd6ff" },
    { keys: ["zero sugar", "absolutely zero"],     sub: "Zero Sugar",     accent: "#c9d4df" },
    { keys: ["java"],                              sub: "Java",           accent: "#c08a5a" },
    { keys: ["original", "energy"],                sub: "Original Green", accent: "#7dff00" }
  ];

  const DEFAULT_ACCENT = "#39ff14";

  /* ---- Hilfsfunktionen -------------------------------------------------- */
  function readImgCache() {
    try { return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeImgCache(cache) {
    try { localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* voll/gesperrt */ }
  }

  const sessionMisses = new Set(); // pro Sitzung nicht erneut abfragen

  function parseVolumeMl(quantity) {
    if (!quantity) return null;
    const m = String(quantity).replace(",", ".").match(/([\d.]+)\s*(ml|cl|l)\b/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (!isFinite(v)) return null;
    return Math.round(u === "l" ? v * 1000 : u === "cl" ? v * 10 : v);
  }

  function matchVariant(text) {
    const t = (text || "").toLowerCase();
    return VARIANTS.find(v => v.keys.some(k => t.includes(k))) || null;
  }

  /** Dosen-Grafik als Data-URI (Fallback, wenn kein Foto vorhanden) */
  function placeholder(accent, label) {
    const c = accent || DEFAULT_ACCENT;
    const txt = String(label || "").replace(/[<>&"']/g, "").slice(0, 14);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200">' +
      '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#05080a"/><stop offset=".5" stop-color="#1b242d"/><stop offset="1" stop-color="#05080a"/></linearGradient></defs>' +
      '<rect x="22" y="14" width="76" height="12" rx="4" fill="#8a97a6"/>' +
      '<rect x="18" y="24" width="84" height="158" rx="12" fill="url(#g)" stroke="' + c + '" stroke-width="3"/>' +
      '<rect x="22" y="172" width="76" height="10" rx="4" fill="#8a97a6"/>' +
      '<path d="M44 52h10l4 44 8-44h10l-6 70H58l-4-34-4 34H40z" fill="' + c + '"/>' +
      '<text x="60" y="152" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="11" fill="' + c + '">' + txt + '</text>' +
      '</svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---- API -------------------------------------------------------------- */
  function getLocal(ean) {
    const p = PRODUCTS[ean];
    return p ? Object.assign({ ean: ean, source: "local" }, p) : null;
  }

  function cachedImage(ean) {
    return readImgCache()[ean] || "";
  }

  /** Produktbild per EAN von OpenFoodFacts holen (mit Cache). */
  async function fetchImage(ean) {
    const cache = readImgCache();
    if (cache[ean]) return cache[ean];
    if (sessionMisses.has(ean)) return "";
    try {
      const res = await fetch(OFF_URL + encodeURIComponent(ean) + ".json?fields=image_front_url,image_front_small_url");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const p = data && data.status === 1 ? data.product : null;
      const url = p ? (p.image_front_small_url || p.image_front_url || "") : "";
      if (url) {
        cache[ean] = url;
        writeImgCache(cache);
        return url;
      }
    } catch (e) { /* offline o. ä. – später erneut versuchen */ }
    sessionMisses.add(ean);
    return "";
  }

  /** Produkt bei OpenFoodFacts suchen. null = nicht gefunden, wirft bei Netzwerkfehler. */
  async function fetchOFF(ean) {
    const res = await fetch(OFF_URL + encodeURIComponent(ean) + ".json?fields=" + OFF_FIELDS);
    if (!res.ok && res.status !== 404) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data || data.status !== 1 || !data.product) return null;

    const p = data.product;
    const rawName = (p.product_name || "").trim();
    const brand = (p.brands || "").split(",")[0].trim();
    const name = rawName || brand || "Unbekanntes Produkt";
    const variant = matchVariant(name + " " + brand);

    const ml = parseVolumeMl(p.quantity) || DEFAULT_ML;
    let per100 = null;
    const n = p.nutriments || {};
    if (typeof n.caffeine_100g === "number" && n.caffeine_100g > 0) per100 = n.caffeine_100g * 1000; // g -> mg
    if (!per100 || per100 > 100) per100 = (variant && variant.per100) || DEFAULT_PER_100ML;
    const mg = Math.max(0, Math.round(per100 * ml / 100));

    const image = p.image_front_small_url || p.image_front_url || "";
    if (image) {
      const cache = readImgCache();
      cache[ean] = image;
      writeImgCache(cache);
    }

    return {
      ean: ean,
      name: name,
      sub: variant ? variant.sub : (brand || ""),
      mg: mg,
      ml: ml,
      accent: variant ? variant.accent : DEFAULT_ACCENT,
      image: image,
      source: "openfoodfacts"
    };
  }

  /** Lokal -> OpenFoodFacts. Gibt Produkt oder null zurück (wirft bei Netzfehler). */
  async function resolve(ean) {
    const local = getLocal(ean);
    if (local) return local;
    return fetchOFF(ean);
  }

  window.MonsterDB = {
    PRODUCTS: PRODUCTS,
    VARIANTS: VARIANTS,
    DEFAULT_ACCENT: DEFAULT_ACCENT,
    getLocal: getLocal,
    cachedImage: cachedImage,
    fetchImage: fetchImage,
    fetchOFF: fetchOFF,
    resolve: resolve,
    placeholder: placeholder
  };
})();
