/* UI smoke test without npm dependencies. Node 22+ and Chromium/Edge required.
   Set MONSTER_TEST_BROWSER to override the browser executable. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'monster-ui-'));
const edgeCore = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'EdgeCore');
const candidates = [process.env.MONSTER_TEST_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
if (fs.existsSync(edgeCore)) candidates.push(...fs.readdirSync(edgeCore)
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(v => path.join(edgeCore, v, 'msedge.exe')));
const browserPath = candidates.find(p => p && fs.existsSync(p));
let browser, socket, server;
const pending = new Map();
let nextId = 0;
const errors = [], requests = [];
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 12000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await pause(100); }
  throw new Error('Timed out: ' + expression);
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function input(selector, value, event = 'input') {
  await evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));}`);
}
async function screenshot(name) {
  await pause(250); // Let the view transition finish before capturing.
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const target = path.join(temp, name + '.png');
  fs.writeFileSync(target, Buffer.from(data, 'base64'));
  console.log('Screenshot:', target);
}
(async () => {
  server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const body = fs.readFileSync(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
      res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + (file.endsWith('.webp') ? '' : '; charset=utf-8') });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => { console.error(error.message); process.exitCode = 1; });
  const portFile = path.join(temp, 'profile', 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await pause(100);
  if (!fs.existsSync(portFile)) throw new Error('Browser debugging endpoint unavailable: ' + browserPath);
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['*unpkg.com*', '*openfoodfacts.org*'] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  await until('!!window.MonsterDB && !!document.querySelector("#manual-form")');
  await pause(200);
  await screenshot('scan-desktop');
  await click('[data-view="catalog"]');
  assert.equal(await evaluate('document.querySelectorAll(".catalog-card").length'), 32);
  await evaluate('Promise.all([...document.querySelectorAll(".catalog-card img")].map(img => {img.loading="eager";return img.decode()}))');
  assert.equal(await evaluate('[...document.querySelectorAll(".catalog-card img")].every(img=>img.naturalWidth>0)'), true);
  await screenshot('catalog-desktop');
  await input('#catalog-search', 'mango');
  assert.equal(await evaluate('document.querySelectorAll(".catalog-card").length'), 2);
  await input('#catalog-search', '');
  await click('[data-line="Ultra"]');
  assert.equal(await evaluate('document.querySelectorAll(".catalog-card").length'), 9);
  await click('[data-line="Alle"]');
  await click('[data-catalog="mango-loco"]');
  assert.match(await evaluate('document.querySelector("#scan-modal-body img").getAttribute("src")'), /monster-mango-loco.webp$/);
  await input('#scan-mg', '155');
  await click('#scan-confirm');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("monsterTracker.v1")).log[0].mg'), 155);
  assert.equal(await evaluate('document.querySelector("#catalog-tried").textContent'), '1 / 32');
  await input('#catalog-status', 'tried', 'change');
  assert.equal(await evaluate('document.querySelectorAll(".catalog-card").length'), 1);
  await click('[data-view="scan"]');
  await input('#manual-ean', '5060337500401');
  await evaluate('document.querySelector("#manual-form").requestSubmit()');
  await until('!document.querySelector("#modal-scan").classList.contains("hidden")');
  assert.match(await evaluate('document.querySelector("#scan-modal-body img").getAttribute("src")'), /monster-original.webp$/);
  await input('#scan-catalog', 'pipeline-punch', 'change');
  assert.match(await evaluate('document.querySelector("#scan-modal-body img").getAttribute("src")'), /monster-pipeline-punch.webp$/);
  await click('#scan-confirm');
  await click('[data-view="vault"]');
  assert.equal(await evaluate('document.querySelectorAll(".can-card").length'), 2);
  await click('.can-card');
  await click('[data-star="4"]');
  await input('#detail-note', 'Schmeckt gut.');
  await click('[data-close="modal-detail"]');
  await click('[data-view="health"]');
  assert.equal(await evaluate('document.querySelector("#health-total").textContent'), '315');
  // Unknown barcode while offline → catalog assignment → next scan works locally.
  await click('[data-view="scan"]');
  await evaluate('window.fetch=async()=>{throw new Error("offline test")};');
  await input('#manual-ean', '1234567890123');
  await evaluate('document.querySelector("#manual-form").requestSubmit()');
  await until('!document.querySelector("#modal-unknown").classList.contains("hidden")');
  await input('#unknown-catalog', 'ultra-white', 'change');
  await evaluate('document.querySelector("#unknown-form").requestSubmit()');
  assert.match(await evaluate('document.querySelector("#scan-modal-body img").getAttribute("src")'), /monster-ultra-white.webp$/);
  await click('#scan-confirm');
  await cdp('Page.reload');
  await until('!!window.MonsterDB && !!document.querySelector("#manual-form")');
  await input('#manual-ean', '1234567890123');
  await evaluate('document.querySelector("#manual-form").requestSubmit()');
  await until('!document.querySelector("#modal-scan").classList.contains("hidden")');
  assert.match(await evaluate('document.querySelector("#scan-modal-body img").getAttribute("src")'), /monster-ultra-white.webp$/);
  await click('[data-close="modal-scan"]');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('scan-mobile');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await click('[data-view="catalog"]');
  await screenshot('catalog-mobile');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await click('[data-view="vault"]');
  await screenshot('collection-mobile');
  assert.equal(await evaluate('document.querySelectorAll(".can-card").length'), 3);
  for (const width of [320, 768, 1024]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 760 });
    for (const view of ['scan', 'catalog', 'health', 'settings']) {
      await click('[data-view="' + view + '"]');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, view + ' overflow at ' + width);
    }
  }
  // A pre-existing collection keeps ratings/notes and replaces stale remote images.
  await evaluate(`localStorage.setItem('monsterTracker.v1', JSON.stringify({cans:{'5060337500401':{count:2,rating:4,tags:['Fruchtig'],note:'Alte Notiz',first:1}},log:[],custom:{'5060337500401':{ean:'5060337500401',name:'Monster Energy',sub:'Original Green',mg:160,image:'https://old.openfoodfacts.org/photo.jpg'}}}));`);
  await cdp('Page.reload');
  await until('!!window.MonsterDB && !!document.querySelector("#manual-form")');
  await click('[data-view="vault"]');
  assert.match(await evaluate('document.querySelector(".can-card img").getAttribute("src")'), /monster-pipeline-punch.webp$/);
  await click('.can-card');
  assert.equal(await evaluate('document.querySelector("#detail-note").value'), 'Alte Notiz');
  assert.equal(await evaluate('document.querySelectorAll(".star-btn.on").length'), 4);
  assert.ok(requests.filter(u => /openfoodfacts/i.test(u)).every(u => !/image|photo/.test(u)), 'No OFF photo requests');
  assert.deepEqual(errors, [], 'No uncaught browser exceptions');
  console.log('PASS: 32 local photos, filters, scan, correction, offline assignment, persistence, ratings, notes, caffeine, desktop/mobile layouts.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await cdp('Browser.close'); } catch {} socket.close(); }
  browser?.kill(); server?.close();
  // Keep screenshots for visual review. Only this run\'s own browser profile is removed.
  const profile = path.resolve(temp, 'profile');
  if (profile.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.dirname(profile) === temp) {
    await pause(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
});
