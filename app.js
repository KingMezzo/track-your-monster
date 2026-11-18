/* ==========================================================================
   app.js – Monster Tracker
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Konstanten ---------- */
  const LS_KEY = "monsterTracker.v1";
  const LS_IMG_KEY = "monsterTracker.imgCache.v1";
  const LIMIT = 400;
  const WARN_AT = 320; // 80 %
  const TAGS = ["Fruchtig", "Süß", "Sauer", "Herb", "Würzig", "Erfrischend", "Zu süß", "Top Sorte", "Nie wieder"];

  /* ---------- Helfer ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  function accentOf(p) {
    return /^#[0-9a-f]{3,8}$/i.test(p.accent || "") ? p.accent : MonsterDB.DEFAULT_ACCENT;
  }

  /* ---------- State / Persistenz ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          cans: s.cans && typeof s.cans === "object" ? s.cans : {},
          log: Array.isArray(s.log) ? s.log : [],
          custom: s.custom && typeof s.custom === "object" ? s.custom : {}
        };
      }
    } catch (e) { /* kaputte Daten ignorieren */ }
    return { cans: {}, log: [], custom: {} };
  }

  let state = loadState();

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast("Speichern fehlgeschlagen (Speicher voll?)"); }
  }

  function getProduct(ean) {
    const p = state.custom[ean] || MonsterDB.getLocal(ean) ||
      { ean: ean, name: "Unbekannte Dose", sub: "", mg: 160, accent: MonsterDB.DEFAULT_ACCENT };
    const item = MonsterDB.catalogFor(p);
    return item ? Object.assign({}, p, { name: item.name, sub: item.sub, catalogId: item.id, accent: item.accent }) : p;
  }

  function imageSrc(p) {
    return MonsterDB.localImage(p) || MonsterDB.placeholder(accentOf(p));
  }
  function catalogOptions(selected) {
    return '<option value="">Eigene / andere Sorte</option>' + MonsterDB.CATALOG.slice()
      .sort((a, b) => a.sub.localeCompare(b.sub, "de")).map(p =>
        '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.sub) + '</option>').join("");
  }
  function assignCatalog(product, id) {
    const item = MonsterDB.byId(id);
    if (!MonsterDB.linkBarcode(product.ean, id)) toast("Barcode-Zuordnung konnte nicht gespeichert werden");
    const updated = Object.assign({}, product, {
      name: item ? item.name : product.name, sub: item ? item.sub : product.sub,
      catalogId: id, accent: item ? item.accent : product.accent, source: "custom"
    });
    state.custom[product.ean] = updated;
    save();
    return updated;
  }
  function bindImgFallback(root) {
    root.addEventListener("error", e => {
      const img = e.target;
      if (img && img.tagName === "IMG" && !img.dataset.fb) {
        img.dataset.fb = "1";
        const p = getProduct(img.dataset.ean);
        img.src = MonsterDB.placeholder(accentOf(p), p.sub);
      }
    }, true);
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- Berechnungen ---------- */
  function todayTotal() {
    const key = dayKey(Date.now());
    return state.log.reduce((sum, e) => sum + (dayKey(e.ts) === key ? (+e.mg || 0) : 0), 0);
  }
  function statusFor(total) {
    if (total > LIMIT) return "over";
    if (total >= WARN_AT) return "warn";
    return "ok";
  }

  /* ---------- Aktionen ---------- */
  function addCan(ean, product) {
    state.custom[ean] = product;
    const c = state.cans[ean] || (state.cans[ean] = { count: 0, rating: 0, tags: [], note: "", first: Date.now() });
    c.count += 1;
    c.last = Date.now();
    state.log.push({ ts: Date.now(), ean: ean, name: product.name + (product.sub ? " " + product.sub : ""), mg: +product.mg || 0 });
    save();
    renderAll();
  }

  /** Entfernt eine Dose (und den neuesten Log-Eintrag dazu). Gibt false zurück, wenn abgebrochen. */
  function removeCan(ean) {
    const c = state.cans[ean];
    if (!c || c.count <= 0) return false;
    if (c.count === 1) {
      const hasMeta = c.rating || (c.tags && c.tags.length) || c.note;
      const msg = hasMeta
        ? "Letzte Dose entfernen? Bewertung, Tags und Notiz dieser Sorte gehen verloren."
        : "Letzte Dose entfernen? Die Sorte verschwindet aus dem Vault.";
      if (!confirm(msg)) return false;
    }
    c.count -= 1;
    for (let i = state.log.length - 1; i >= 0; i--) {
      if (state.log[i].ean === ean) { state.log.splice(i, 1); break; }
    }
    if (c.count <= 0) delete state.cans[ean];
    save();
    renderAll();
    return true;
  }

  function removeLogEntry(ts, ean) {
    const idx = state.log.findIndex(e => e.ts === ts && e.ean === ean);
    if (idx === -1) return;
    state.log.splice(idx, 1);
    const c = state.cans[ean];
    if (c) {
      c.count = Math.max(0, c.count - 1);
      if (c.count === 0) delete state.cans[ean];
    }
    save();
    renderAll();
  }

  /* ---------- Navigation ---------- */
  function showView(name) {
    if (name !== "scan") stopScanner();
    $$(".view").forEach(v => v.classList.toggle("hidden", v.id !== "view-" + name));
    $$(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.view === name);
      if (b.dataset.view === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0 });
    if (name === "vault") renderVault();
    if (name === "health") renderHealth();
    if (name === "catalog") renderCatalog();
  }

  /* ---------- Rendering: Header ---------- */
  function renderHeader() {
    const total = todayTotal();
    const chip = $("#header-chip");
    chip.textContent = total + " / " + LIMIT + " mg";
    chip.classList.toggle("warn", statusFor(total) === "warn");
    chip.classList.toggle("over", statusFor(total) === "over");
    const tried = triedCatalogIds().size;
    $("#home-tried").textContent = tried;
    $("#home-total").textContent = MonsterDB.CATALOG.length;
    $("#catalog-nav-count").textContent = MonsterDB.CATALOG.length;
  }

  /* ---------- Alle Sorten ---------- */
  let catalogLine = "Alle";
  function triedCatalogIds() {
    return new Set(Object.keys(state.cans).map(ean => MonsterDB.catalogFor(getProduct(ean)))
      .filter(Boolean).map(p => p.id));
  }
  function renderCatalog() {
    const tried = triedCatalogIds();
    const query = $("#catalog-search").value.trim().toLocaleLowerCase("de");
    const status = $("#catalog-status").value;
    const items = MonsterDB.CATALOG.filter(p =>
      (catalogLine === "Alle" || p.line === catalogLine) &&
      (p.sub + " " + p.line).toLocaleLowerCase("de").includes(query) &&
      (status === "all" || (status === "tried" ? tried.has(p.id) : !tried.has(p.id)))
    ).sort((a, b) => a.sub.localeCompare(b.sub, "de"));
    $("#catalog-tried").textContent = tried.size + " / " + MonsterDB.CATALOG.length;
    $("#catalog-progress").style.width = (tried.size / MonsterDB.CATALOG.length * 100) + "%";
    $("#catalog-summary").textContent = items.length + (items.length === 1 ? " Sorte" : " Sorten");
    $("#catalog-empty").classList.toggle("hidden", items.length > 0);
    $("#catalog-filters").innerHTML = ["Alle", ...new Set(MonsterDB.CATALOG.map(p => p.line))].map(line =>
      '<button type="button" class="filter-btn' + (catalogLine === line ? ' selected' : '') + '" data-line="' + esc(line) + '" aria-pressed="' + (catalogLine === line) + '">' + esc(line) + '</button>'
    ).join("");
    $("#catalog-grid").innerHTML = items.map(p =>
      '<button type="button" class="catalog-card" data-catalog="' + esc(p.id) + '" style="--accent:' + esc(p.accent) + '" aria-label="Monster ' + esc(p.sub) + ' ansehen">' +
        '<span class="catalog-card-top"><span>' + esc(p.line) + '</span>' +
        (tried.has(p.id) ? '<span class="tried-label">✓ Probiert</span>' : '<span class="untried-label">Noch offen</span>') + '</span>' +
        '<span class="catalog-image"><img src="' + esc(p.image) + '" alt="Monster ' + esc(p.sub) + ' Dose" loading="lazy" data-ean="' + esc(p.ean) + '"></span>' +
        '<span class="catalog-card-bottom"><span class="catalog-card-name">' + esc(p.sub) + '</span><span class="card-plus" aria-hidden="true">+</span></span>' +
      '</button>'
    ).join("");
  }

  /* ---------- Rendering: Vault ---------- */
  function renderVault() {
    const grid = $("#vault-grid");
    const eans = Object.keys(state.cans).sort((a, b) => {
      const ca = state.cans[a], cb = state.cans[b];
      return (cb.count - ca.count) || ((cb.last || 0) - (ca.last || 0));
    });

    $("#vault-empty").classList.toggle("hidden", eans.length > 0);
    grid.classList.toggle("hidden", eans.length === 0);

    let cans = 0, mg = 0;
    eans.forEach(e => { cans += state.cans[e].count; mg += state.cans[e].count * (+getProduct(e).mg || 0); });
    $("#vault-summary").textContent = eans.length
      ? eans.length + (eans.length === 1 ? " Sorte" : " Sorten") + " · " + cans + (cans === 1 ? " Dose" : " Dosen") + " · " + mg + " mg gesamt"
      : "";

    grid.innerHTML = eans.map(ean => {
      const c = state.cans[ean];
      const p = getProduct(ean);
      const stars = c.rating ? "★".repeat(c.rating) + "☆".repeat(5 - c.rating) : "";
      return (
        '<div class="can-card" style="--accent:' + esc(accentOf(p)) + '" data-ean="' + esc(ean) + '" role="button" tabindex="0" aria-label="' + esc(p.name + " " + (p.sub || "")) + ' Details">' +
          '<span class="can-count">×' + c.count + '</span>' +
          '<div class="can-img-wrap"><img src="' + esc(imageSrc(p)) + '" alt="" loading="lazy" data-ean="' + esc(ean) + '"></div>' +
          '<div class="can-name">' + esc(p.name) + (p.sub ? '<br><span style="color:var(--muted);font-weight:600">' + esc(p.sub) + '</span>' : '') + '</div>' +
          '<div class="can-meta"><span>' + (+p.mg || 0) + ' mg / Dose</span><span class="can-stars">' + stars + '</span></div>' +
          '<div class="can-controls">' +
            '<button class="round-btn" type="button" data-act="minus" data-ean="' + esc(ean) + '" aria-label="Eine Dose weniger">−</button>' +
            '<span class="can-mg">' + (c.count * (+p.mg || 0)) + ' mg</span>' +
            '<button class="round-btn" type="button" data-act="plus" data-ean="' + esc(ean) + '" aria-label="Eine Dose mehr">+</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");

  }

  /* ---------- Rendering: Health ---------- */
  function renderHealth() {
    const total = todayTotal();
    const st = statusFor(total);
    const pct = Math.min(100, (total / LIMIT) * 100);

    $("#health-date").textContent = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    $("#health-total").textContent = total;
    $("#health-total").parentElement.className = "big-number" + (st === "ok" ? "" : " " + st);

    const bar = $("#health-bar");
    bar.style.width = pct + "%";
    bar.className = "progress-bar" + (st === "ok" ? "" : " " + st);
    $("#health-progress").setAttribute("aria-valuenow", String(total));

    const badge = $("#health-badge");
    badge.className = "badge badge-" + st;
    badge.textContent = st === "over" ? "⚠ Limit überschritten" : st === "warn" ? "⚠ Fast am Limit" : "Im Rahmen";

    $("#health-remaining").textContent = total > LIMIT ? (total - LIMIT) + " mg drüber" : (LIMIT - total) + " mg übrig";

    renderWeek();
    renderHistory();
  }

  function renderWeek() {
    const sums = {};
    state.log.forEach(e => { const k = dayKey(e.ts); sums[k] = (sums[k] || 0) + (+e.mg || 0); });

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: dayKey(d.getTime()),
        label: i === 0 ? "Heute" : d.toLocaleDateString("de-DE", { weekday: "short" }),
        today: i === 0
      });
    }
    const max = Math.max(LIMIT, ...days.map(d => sums[d.key] || 0));
    const limitBottom = (LIMIT / max) * 100;

    $("#health-week").innerHTML =
      days.map(d => {
        const v = sums[d.key] || 0;
        const cls = "week-bar" + (v > LIMIT ? " over" : d.today ? " today" : "");
        return (
          '<div class="week-col">' +
            '<span class="week-val">' + (v || "") + '</span>' +
            '<div class="week-bar-area">' +
              '<div class="week-limit" style="bottom:' + limitBottom + '%" title="Limit ' + LIMIT + ' mg"></div>' +
              '<div class="' + cls + '" style="height:' + (v / max) * 100 + '%"></div>' +
            '</div>' +
            '<span class="week-label">' + esc(d.label) + '</span>' +
          '</div>'
        );
      }).join("");
  }

  function renderHistory() {
    const key = dayKey(Date.now());
    const today = state.log.filter(e => dayKey(e.ts) === key).sort((a, b) => b.ts - a.ts);
    $("#health-history-empty").classList.toggle("hidden", today.length > 0);
    $("#health-history").innerHTML = today.map(e =>
      '<li>' +
        '<span class="time">' + fmtTime(e.ts) + '</span>' +
        '<span class="name">' + esc(e.name) + '</span>' +
        '<span class="mg">' + (+e.mg || 0) + ' mg</span>' +
        '<button class="del" type="button" data-ts="' + e.ts + '" data-ean="' + esc(e.ean) + '" aria-label="Eintrag löschen">✕</button>' +
      '</li>'
    ).join("");
  }

  function renderAll() {
    renderHeader();
    if (!$("#view-vault").classList.contains("hidden")) renderVault();
    if (!$("#view-health").classList.contains("hidden")) renderHealth();
    if (!$("#view-catalog").classList.contains("hidden")) renderCatalog();
    if (detailEan && !$("#modal-detail").classList.contains("hidden") && document.activeElement.id !== "detail-note") renderDetail();
  }

  /* ---------- Modals ---------- */
  let modalTrigger = null;
  function openModal(id) {
    if (!$$(".modal").some(m => !m.classList.contains("hidden"))) modalTrigger = document.activeElement;
    const modal = $("#" + id);
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    modal.querySelector("button, input, select, textarea").focus();
  }
  function closeModal(id) {
    $("#" + id).classList.add("hidden");
    if (!$$(".modal").some(m => !m.classList.contains("hidden"))) {
      document.body.style.overflow = "";
      if (modalTrigger && modalTrigger.isConnected) modalTrigger.focus();
    }
    if (id === "modal-detail") detailEan = null;
  }

  /* Scan-Ergebnis */
  function openScanModal(product) {
    const total = todayTotal();
    const after = total + (+product.mg || 0);
    const st = statusFor(after);
    const item = MonsterDB.catalogFor(product);
    const note = product.estimated
      ? '<p class="hint">Koffein ist ein Richtwert. Bitte mit der Angabe auf deiner Dose abgleichen.</p>' : "";

    $("#scan-modal-body").innerHTML =
      '<div class="modal-hero" style="--accent:' + esc(accentOf(product)) + '">' +
        '<img src="' + esc(imageSrc(product)) + '" alt="" data-ean="' + esc(product.ean) + '">' +
        '<div class="name" id="scan-modal-title">' + esc(product.name) + '</div>' +
        (product.sub ? '<div class="sub">' + esc(product.sub) + '</div>' : '') +
      '</div>' +
      (!String(product.ean).startsWith("catalog:") ? '<label class="label" for="scan-catalog">Sorte / Dosenbild zuordnen</label><select id="scan-catalog" class="input w-full">' + catalogOptions(item && item.id) + '</select>' : '') +
      '<label class="label mt-3" for="scan-mg">Koffein (mg pro Dose)</label><input id="scan-mg" class="input w-full" type="number" min="0" max="500" value="' + (+product.mg || 0) + '">' +
      '<div class="stat-row">' +
        '<div class="stat"><b>' + (+product.mg || 0) + ' mg</b><span>Koffein</span></div>' +
        '<div class="stat"><b>' + total + ' mg</b><span>heute bisher</span></div>' +
        '<div class="stat ' + (st === "ok" ? "" : st) + '"><b>' + after + ' mg</b><span>danach</span></div>' +
      '</div>' +
      '<div id="scan-limit-notice" class="notice' + (after > LIMIT ? '' : ' hidden') + '">Mit dieser Dose würdest du den Tagesrichtwert von ' + LIMIT + ' mg überschreiten.</div>' +
      note +
      '<div class="flex gap-2 mt-3" style="display:flex;gap:8px">' +
        '<button type="button" class="btn btn-ghost" style="flex:1" data-close="modal-scan">Abbrechen</button>' +
        '<button type="button" class="btn btn-neon" style="flex:1" id="scan-confirm">Getrunken (+1)</button>' +
      '</div>';

    $("#scan-catalog")?.addEventListener("change", e => {
      const updated = assignCatalog(product, e.target.value);
      openScanModal(updated);
      $("#scan-catalog").focus();
      renderAll();
    });
    $("#scan-mg").addEventListener("input", e => {
      if (!e.target.checkValidity() || e.target.value === "") return;
      product = Object.assign({}, product, { mg: Number(e.target.value), estimated: false });
      const after = total + product.mg;
      const stats = $$(".stat", $("#scan-modal-body"));
      $("b", stats[0]).textContent = product.mg + " mg";
      $("b", stats[2]).textContent = after + " mg";
      stats[2].className = "stat " + statusFor(after);
      $("#scan-limit-notice").classList.toggle("hidden", after <= LIMIT);
    });
    $("#scan-confirm").addEventListener("click", () => {
      const input = $("#scan-mg");
      if (!input.reportValidity() || input.value === "") { input.focus(); return; }
      product = Object.assign({}, product, { mg: Number(input.value) });
      addCan(product.ean, product);
      closeModal("modal-scan");
      toast((product.sub || product.name) + " zur Sammlung hinzugefügt");
    });
    openModal("modal-scan");
  }

  /* Unbekannte Dose */
  let unknownEan = null;
  function openUnknownModal(ean) {
    unknownEan = ean;
    $("#unknown-ean").textContent = ean;
    $("#unknown-name").value = "";
    $("#unknown-mg").value = 160;
    $("#unknown-catalog").innerHTML = catalogOptions("");
    openModal("modal-unknown");
    setTimeout(() => $("#unknown-name").focus(), 50);
  }

  /* Detail */
  let detailEan = null;
  function openDetail(ean) {
    if (!state.cans[ean]) return;
    detailEan = ean;
    renderDetail();
    openModal("modal-detail");
  }

  function renderDetail() {
    const ean = detailEan;
    const c = state.cans[ean];
    if (!c) { closeModal("modal-detail"); return; }
    const p = getProduct(ean);

    // Notizfeld nicht neu rendern, solange es Fokus hat (Cursor bleibt erhalten)
    const body = $("#detail-body");
    const stars = [1, 2, 3, 4, 5].map(n =>
      '<button type="button" class="star-btn' + (n <= c.rating ? " on" : "") + '" data-star="' + n + '" aria-label="' + n + ' Sterne">★</button>'
    ).join("");
    const tags = TAGS.map(t =>
      '<button type="button" class="tag' + (c.tags.includes(t) ? " on" : "") + '" data-tag="' + esc(t) + '" aria-pressed="' + c.tags.includes(t) + '">' + esc(t) + '</button>'
    ).join("");

    const noteVal = document.activeElement && document.activeElement.id === "detail-note"
      ? document.activeElement.value : c.note;

    body.innerHTML =
      '<div class="modal-hero" style="--accent:' + esc(accentOf(p)) + '">' +
        '<img src="' + esc(imageSrc(p)) + '" alt="" data-ean="' + esc(ean) + '">' +
        '<div class="name" id="detail-name">' + esc(p.name) + '</div>' +
        (p.sub ? '<div class="sub">' + esc(p.sub) + '</div>' : '') +
        '<span class="count-pill">×' + c.count + ' getrunken</span>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat"><b>' + (+p.mg || 0) + ' mg</b><span>pro Dose</span></div>' +
        '<div class="stat"><b>' + (c.count * (+p.mg || 0)) + ' mg</b><span>insgesamt</span></div>' +
      '</div>' +
      '<label class="label" for="detail-catalog">Sorte / Dosenbild korrigieren</label><select id="detail-catalog" class="input w-full">' + catalogOptions((MonsterDB.catalogFor(p) || {}).id) + '</select>' +
      '<div class="section-label">Bewertung</div>' +
      '<div class="stars">' + stars + '</div>' +
      '<div class="section-label">Geschmack &amp; Tags</div>' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="section-label">Notiz</div>' +
      '<textarea id="detail-note" class="input" maxlength="500" placeholder="Wie hat sie geschmeckt? Wo gekauft?">' + esc(noteVal) + '</textarea>' +
      '<div class="flex gap-2 mt-4" style="display:flex;gap:8px;margin-top:16px">' +
        '<button type="button" class="btn btn-ghost" style="flex:1" id="detail-minus">− Dose</button>' +
        '<button type="button" class="btn btn-neon" style="flex:1" data-close="modal-detail">Fertig</button>' +
      '</div>';

    $("#detail-catalog").addEventListener("change", e => {
      assignCatalog(p, e.target.value);
      renderAll();
      $("#detail-catalog").focus();
    });
    const note = $("#detail-note");
    note.addEventListener("input", () => { c.note = note.value; save(); });
    $("#detail-minus").addEventListener("click", () => { removeCan(ean); });
  }

  /* ---------- Scanner ---------- */
  let scanner = null;
  let scanning = false;
  let handling = false;

  function setScanMsg(text, isError) {
    const el = $("#scan-msg");
    el.textContent = text || "";
    el.classList.toggle("error", !!isError);
  }

  function setScanUi(on) {
    scanning = on;
    $("#reader-wrap").classList.toggle("live", on);
    $("#btn-scan-start").classList.toggle("hidden", on);
    $("#btn-scan-stop").classList.toggle("hidden", !on);
  }

  async function startScanner() {
    if (scanning) return;
    if (typeof Html5Qrcode === "undefined") {
      setScanMsg("Scanner-Bibliothek konnte nicht geladen werden. Bitte Verbindung prüfen oder Code manuell eingeben.", true);
      return;
    }
    if (!window.isSecureContext) {
      setScanMsg("Kamerazugriff braucht HTTPS (oder localhost). Nutze GitHub Pages über https:// oder gib den Code manuell ein.", true);
      return;
    }
    try {
      const fmts = window.Html5QrcodeSupportedFormats
        ? [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E]
        : undefined;
      if (!scanner) scanner = new Html5Qrcode("reader", fmts ? { formatsToSupport: fmts, verbose: false } : { verbose: false });

      setScanMsg("Kamera wird gestartet …");
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (w, h) => {
            const width = Math.floor(Math.min(w * 0.9, 340));
            return { width: width, height: Math.floor(Math.min(h * 0.8, width * 0.55)) };
          }
        },
        onDecoded,
        function () { /* pro Frame ohne Treffer – ignorieren */ }
      );
      setScanUi(true);
      setScanMsg("Halte den Barcode der Dose in den Rahmen.");
    } catch (err) {
      setScanUi(false);
      const name = err && (err.name || err.message || String(err));
      if (/NotAllowed|Permission/i.test(name)) {
        setScanMsg("Kamerazugriff wurde verweigert. Erlaube die Kamera in den Browser-Einstellungen oder gib den Code manuell ein.", true);
      } else if (/NotFound|Requested device not found/i.test(name)) {
        setScanMsg("Keine Kamera gefunden. Du kannst den Code manuell eingeben.", true);
      } else {
        setScanMsg("Kamera konnte nicht gestartet werden: " + name, true);
      }
    }
  }

  async function stopScanner() {
    if (!scanner || !scanning) { setScanUi(false); return; }
    try { await scanner.stop(); } catch (e) { /* bereits gestoppt */ }
    try { scanner.clear(); } catch (e) { /* ignorieren */ }
    setScanUi(false);
    setScanMsg("");
  }

  function onDecoded(text) {
    if (handling) return;
    handling = true;
    stopScanner().then(() => handleEan(text)).finally(() => { handling = false; });
  }

  /* ---------- Barcode verarbeiten ---------- */
  async function handleEan(raw) {
    const ean = String(raw || "").replace(/\D/g, "");
    if (![8, 12, 13, 14].includes(ean.length)) {
      toast("Ungültiger Barcode");
      setScanMsg("Bitte 8, 12, 13 oder 14 Ziffern eingeben.", true);
      return;
    }
    setScanMsg("Suche " + ean + " …");
    let product = null;
    try {
      product = state.custom[ean] ? getProduct(ean) : await MonsterDB.resolve(ean);
      if (product && product.source === "openfoodfacts") { state.custom[ean] = product; save(); }
    } catch (e) {
      setScanMsg("Online-Suche fehlgeschlagen (offline?). Du kannst die Dose manuell anlegen.", true);
      openUnknownModal(ean);
      return;
    }
    setScanMsg("");
    if (product) openScanModal(product);
    else openUnknownModal(ean);
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    // Navigation
    $$(".nav-btn").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
    document.addEventListener("click", e => {
      const g = e.target.closest("[data-goto]");
      if (g) showView(g.dataset.goto);

      const c = e.target.closest("[data-close]");
      if (c) closeModal(c.dataset.close);

      // Klick auf Backdrop
      if (e.target.classList && e.target.classList.contains("modal")) closeModal(e.target.id);
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") $$(".modal").forEach(m => { if (!m.classList.contains("hidden")) closeModal(m.id); });
      if (e.key === "Tab") {
        const modal = $$(".modal").find(m => !m.classList.contains("hidden"));
        if (!modal) return;
        const focusable = $$('button, input, select, textarea, [tabindex="0"]', modal).filter(el => !el.disabled);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    $("#catalog-search").addEventListener("input", renderCatalog);
    $("#catalog-status").addEventListener("change", renderCatalog);
    $("#catalog-filters").addEventListener("click", e => {
      const button = e.target.closest("[data-line]");
      if (!button) return;
      catalogLine = button.dataset.line;
      renderCatalog();
      $$("[data-line]").find(b => b.dataset.line === catalogLine).focus();
    });
    $("#catalog-clear").addEventListener("click", () => {
      catalogLine = "Alle";
      $("#catalog-search").value = "";
      $("#catalog-status").value = "all";
      renderCatalog();
      $("#catalog-search").focus();
    });
    $("#catalog-grid").addEventListener("click", e => {
      const card = e.target.closest("[data-catalog]");
      if (card) openScanModal(MonsterDB.byId(card.dataset.catalog));
    });
    bindImgFallback($("#catalog-grid"));

    // Scanner
    $("#btn-scan-start").addEventListener("click", startScanner);
    $("#btn-scan-stop").addEventListener("click", stopScanner);

    // Manuelle Eingabe
    $("#manual-form").addEventListener("submit", e => {
      e.preventDefault();
      const input = $("#manual-ean");
      const v = input.value.trim();
      if (!v) return;
      stopScanner().then(() => { handleEan(v); input.value = ""; });
    });

    // Vault
    const grid = $("#vault-grid");
    grid.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.act === "plus") addCan(btn.dataset.ean, getProduct(btn.dataset.ean));
        else removeCan(btn.dataset.ean);
        return;
      }
      const card = e.target.closest(".can-card");
      if (card) openDetail(card.dataset.ean);
    });
    grid.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("can-card")) {
        e.preventDefault();
        openDetail(e.target.dataset.ean);
      }
    });
    bindImgFallback(grid);
    bindImgFallback($("#modal-detail"));
    bindImgFallback($("#modal-scan"));

    // Detail: Sterne & Tags
    $("#detail-body").addEventListener("click", e => {
      const c = detailEan && state.cans[detailEan];
      if (!c) return;
      const star = e.target.closest("[data-star]");
      if (star) {
        const n = +star.dataset.star;
        c.rating = c.rating === n ? 0 : n;
        save(); renderDetail(); renderVault();
        return;
      }
      const tag = e.target.closest("[data-tag]");
      if (tag) {
        const t = tag.dataset.tag;
        c.tags = c.tags.includes(t) ? c.tags.filter(x => x !== t) : c.tags.concat(t);
        save(); renderDetail(); renderVault();
      }
    });

    // Unbekannten Barcode mit einem lokalen Dosenbild verknüpfen.
    $("#unknown-catalog").addEventListener("change", e => {
      const item = MonsterDB.byId(e.target.value);
      $("#unknown-name").value = item ? "Monster " + item.sub : "";
      $("#unknown-mg").value = item ? item.mg : 160;
    });
    $("#unknown-form").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#unknown-name").value.trim();
      const mg = Math.max(0, Math.min(500, parseInt($("#unknown-mg").value, 10) || 0));
      if (!name || !unknownEan) return;
      let product = {
        ean: unknownEan, name: name, sub: "", mg: mg, ml: 0,
        accent: MonsterDB.DEFAULT_ACCENT, image: "", source: "custom"
      };
      const selected = $("#unknown-catalog").value;
      product = assignCatalog(product, selected);
      closeModal("modal-unknown");
      openScanModal(product);
    });

    // Health-Verlauf: Eintrag löschen
    $("#health-history").addEventListener("click", e => {
      const b = e.target.closest(".del");
      if (b && confirm("Diesen Eintrag löschen?")) removeLogEntry(+b.dataset.ts, b.dataset.ean);
    });

    // Reset
    $("#btn-reset").addEventListener("click", () => {
      if (!confirm("Wirklich ALLE Daten löschen? Vault, Bewertungen, Notizen und Koffein-Verlauf gehen unwiderruflich verloren.")) return;
      try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_IMG_KEY); MonsterDB.clearMappings(); } catch (e) { /* ignorieren */ }
      state = { cans: {}, log: [], custom: {} };
      detailEan = null;
      $$(".modal").forEach(m => m.classList.add("hidden"));
      document.body.style.overflow = "";
      renderAll();
      toast("Alle Daten wurden zurückgesetzt");
    });

    // Kamera ausschalten, wenn Tab/App in den Hintergrund geht
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopScanner(); });
    window.addEventListener("pagehide", () => { stopScanner(); });

    // Mitternacht: Anzeige aktualisieren, wenn die App offen bleibt
    setInterval(renderAll, 60 * 1000);
  }

  /* ---------- Start ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    try { localStorage.removeItem(LS_IMG_KEY); } catch (e) { /* Browser-Speicher gesperrt */ }
    bindEvents();
    renderHeader();
    showView("scan");
  });
})();
