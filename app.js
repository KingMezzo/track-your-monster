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
    return state.custom[ean] || MonsterDB.getLocal(ean) ||
      { ean: ean, name: "Unbekannte Dose", sub: "", mg: 160, accent: MonsterDB.DEFAULT_ACCENT, image: "" };
  }

  function imageSrc(p) {
    return p.image || MonsterDB.cachedImage(p.ean) || MonsterDB.placeholder(accentOf(p), p.sub);
  }
  function needsImage(p) {
    return !p.image && !MonsterDB.cachedImage(p.ean);
  }

  /** Fehlende Produktbilder nachladen und einsetzen */
  function hydrateImages(root) {
    $$('img[data-need-img="1"]', root).forEach(img => {
      img.removeAttribute("data-need-img");
      MonsterDB.fetchImage(img.dataset.ean).then(url => { if (url && img.isConnected) img.src = url; });
    });
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
    if (product.source && product.source !== "local") state.custom[ean] = product;
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
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    window.scrollTo({ top: 0 });
    if (name === "vault") renderVault();
    if (name === "health") renderHealth();
  }

  /* ---------- Rendering: Header ---------- */
  function renderHeader() {
    const total = todayTotal();
    const chip = $("#header-chip");
    chip.textContent = total + " / " + LIMIT + " mg";
    chip.classList.toggle("warn", statusFor(total) === "warn");
    chip.classList.toggle("over", statusFor(total) === "over");
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
          '<div class="can-img-wrap"><img src="' + esc(imageSrc(p)) + '" alt="" loading="lazy" data-ean="' + esc(ean) + '"' + (needsImage(p) ? ' data-need-img="1"' : '') + '></div>' +
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

    hydrateImages(grid);
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
    if (detailEan && !$("#modal-detail").classList.contains("hidden")) renderDetail();
  }

  /* ---------- Modals ---------- */
  function openModal(id) { $("#" + id).classList.remove("hidden"); document.body.style.overflow = "hidden"; }
  function closeModal(id) {
    $("#" + id).classList.add("hidden");
    if (!$$(".modal").some(m => !m.classList.contains("hidden"))) document.body.style.overflow = "";
    if (id === "modal-detail") detailEan = null;
  }

  /* Scan-Ergebnis */
  function openScanModal(product) {
    const total = todayTotal();
    const after = total + (+product.mg || 0);
    const st = statusFor(after);
    const note = product.source === "openfoodfacts"
      ? '<p class="hint" style="text-align:center">Quelle: OpenFoodFacts – Koffeinwert ggf. prüfen.</p>' : "";

    $("#scan-modal-body").innerHTML =
      '<div class="modal-hero" style="--accent:' + esc(accentOf(product)) + '">' +
        '<img src="' + esc(imageSrc(product)) + '" alt="" data-ean="' + esc(product.ean) + '"' + (needsImage(product) ? ' data-need-img="1"' : '') + '>' +
        '<div class="name" id="scan-modal-title">' + esc(product.name) + '</div>' +
        (product.sub ? '<div class="sub">' + esc(product.sub) + '</div>' : '') +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat"><b>' + (+product.mg || 0) + ' mg</b><span>Koffein</span></div>' +
        '<div class="stat"><b>' + total + ' mg</b><span>heute bisher</span></div>' +
        '<div class="stat ' + (st === "ok" ? "" : st) + '"><b>' + after + ' mg</b><span>danach</span></div>' +
      '</div>' +
      (after > LIMIT ? '<div class="notice">Mit dieser Dose würdest du das Tageslimit von ' + LIMIT + ' mg überschreiten.</div>' : "") +
      note +
      '<div class="flex gap-2 mt-3" style="display:flex;gap:8px">' +
        '<button type="button" class="btn btn-ghost" style="flex:1" data-close="modal-scan">Abbrechen</button>' +
        '<button type="button" class="btn btn-neon" style="flex:1" id="scan-confirm">Getrunken (+1)</button>' +
      '</div>';

    $("#scan-confirm").addEventListener("click", () => {
      addCan(product.ean, product);
      closeModal("modal-scan");
      toast(product.name + " zum Vault hinzugefügt");
    });
    hydrateImages($("#scan-modal-body"));
    openModal("modal-scan");
  }

  /* Unbekannte Dose */
  let unknownEan = null;
  function openUnknownModal(ean) {
    unknownEan = ean;
    $("#unknown-ean").textContent = ean;
    $("#unknown-name").value = "";
    $("#unknown-mg").value = 160;
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
        '<img src="' + esc(imageSrc(p)) + '" alt="" data-ean="' + esc(ean) + '"' + (needsImage(p) ? ' data-need-img="1"' : '') + '>' +
        '<div class="name" id="detail-name">' + esc(p.name) + '</div>' +
        (p.sub ? '<div class="sub">' + esc(p.sub) + '</div>' : '') +
        '<span class="count-pill">×' + c.count + ' getrunken</span>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat"><b>' + (+p.mg || 0) + ' mg</b><span>pro Dose</span></div>' +
        '<div class="stat"><b>' + (c.count * (+p.mg || 0)) + ' mg</b><span>insgesamt</span></div>' +
      '</div>' +
      '<div class="section-label" style="margin-top:4px">Bewertung</div>' +
      '<div class="stars">' + stars + '</div>' +
      '<div class="section-label">Geschmack &amp; Tags</div>' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="section-label">Notiz</div>' +
      '<textarea id="detail-note" class="input" maxlength="500" placeholder="Wie hat sie geschmeckt? Wo gekauft?">' + esc(noteVal) + '</textarea>' +
      '<div class="flex gap-2 mt-4" style="display:flex;gap:8px;margin-top:16px">' +
        '<button type="button" class="btn btn-ghost" style="flex:1" id="detail-minus">− Dose</button>' +
        '<button type="button" class="btn btn-neon" style="flex:1" data-close="modal-detail">Fertig</button>' +
      '</div>';

    hydrateImages(body);
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
    if (ean.length < 8 || ean.length > 14) {
      toast("Ungültiger Barcode");
      setScanMsg("Bitte einen gültigen Barcode (8–14 Ziffern) eingeben.", true);
      return;
    }
    setScanMsg("Suche " + ean + " …");
    let product = null;
    try {
      product = state.custom[ean] ? Object.assign({ source: "custom" }, state.custom[ean]) : await MonsterDB.resolve(ean);
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
    });

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

    // Unbekanntes Produkt anlegen
    $("#unknown-form").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#unknown-name").value.trim();
      const mg = Math.max(0, Math.min(500, parseInt($("#unknown-mg").value, 10) || 0));
      if (!name || !unknownEan) return;
      const product = {
        ean: unknownEan, name: name, sub: "", mg: mg, ml: 0,
        accent: MonsterDB.DEFAULT_ACCENT, image: "", source: "custom"
      };
      state.custom[unknownEan] = product;
      save();
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
      try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_IMG_KEY); } catch (e) { /* ignorieren */ }
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
    bindEvents();
    renderHeader();
    showView("scan");
  });
})();
