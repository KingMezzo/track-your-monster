// Local Storage Keys
const STORAGE_KEY_VAULT = 'monster_vault_collection_v2';
const STORAGE_KEY_WISHLIST = 'monster_vault_wishlist_v2';
const STORAGE_KEY_RATINGS = 'monster_vault_ratings_v2';
const STORAGE_KEY_HISTORY = 'monster_vault_history_v2';

// App State
let collection = JSON.parse(localStorage.getItem(STORAGE_KEY_VAULT)) || {};
let wishlist = JSON.parse(localStorage.getItem(STORAGE_KEY_WISHLIST)) || [];
let ratings = JSON.parse(localStorage.getItem(STORAGE_KEY_RATINGS)) || {};
let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];

let html5QrCode = null;
let currentEditingBarcode = null;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    renderAll();
});

function saveState() {
    localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(collection));
    localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(wishlist));
    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(ratings));
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    renderAll();
}

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-green-500/10', 'text-green-400', 'border', 'border-green-500/30');
        btn.classList.add('text-zinc-400', 'hover:text-white', 'hover:bg-zinc-900');
    });

    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tabId}`);
    activeBtn.classList.remove('text-zinc-400', 'hover:text-white', 'hover:bg-zinc-900');
    activeBtn.classList.add('bg-green-500/10', 'text-green-400', 'border', 'border-green-500/30');
    lucide.createIcons();
}

// Fetch Product Info (Local DB first, OpenFoodFacts Fallback)
async function fetchMonsterInfo(barcode) {
    if (MONSTER_DATABASE[barcode]) {
        return MONSTER_DATABASE[barcode];
    }

    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const p = data.product;
            return {
                id: barcode,
                name: p.product_name_de || p.product_name || `Monster Sorte (${barcode})`,
                image: p.image_front_url || p.image_url || 'https://via.placeholder.com/200x400?text=Kein+Bild',
                caffeine: p.nutriments?.caffeine_100g ? Math.round(p.nutriments.caffeine_100g * 5000) : 160,
                color: '#22c55e'
            };
        }
    } catch (err) {
        console.error("API Fehler:", err);
    }

    return {
        id: barcode,
        name: `Monster Sorte (${barcode.slice(-4)})`,
        image: 'https://images.openfoodfacts.org/images/products/506/033/750/2504/front_de.34.400.jpg',
        caffeine: 160,
        color: '#22c55e'
    };
}

async function addMonster(barcode) {
    closeScanner();

    let productInfo = MONSTER_DATABASE[barcode];
    if (!productInfo) {
        productInfo = await fetchMonsterInfo(barcode);
    }

    if (collection[barcode]) {
        collection[barcode].count += 1;
    } else {
        collection[barcode] = {
            ...productInfo,
            barcode: barcode,
            count: 1
        };
    }

    history.unshift({
        barcode: barcode,
        name: productInfo.name,
        caffeine: productInfo.caffeine || 160,
        timestamp: new Date().toISOString()
    });

    saveState();
}

function removeOne(barcode) {
    if (collection[barcode]) {
        collection[barcode].count -= 1;
        if (collection[barcode].count <= 0) {
            delete collection[barcode];
        }
        saveState();
    }
}

// Render Everything
function renderAll() {
    renderVault();
    renderCatalog();
    renderHealth();
    lucide.createIcons();
}

// 1. Render Vault (Sammlung)
function renderVault() {
    const grid = document.getElementById('vault-grid');
    const emptyState = document.getElementById('vault-empty');
    grid.innerHTML = '';

    const items = Object.values(collection);
    
    let totalDrunk = 0;
    let totalCaffeine = 0;
    let maxCount = 0;
    let favName = '-';

    items.forEach(item => {
        totalDrunk += item.count;
        totalCaffeine += (item.caffeine || 160) * item.count;
        if (item.count > maxCount) {
            maxCount = item.count;
            favName = item.name;
        }
    });

    document.getElementById('stat-total').innerText = totalDrunk;
    document.getElementById('stat-unique').innerText = items.length;
    document.getElementById('stat-caffeine').innerText = totalCaffeine;
    document.getElementById('stat-fav').innerText = favName;
    document.getElementById('collection-count').innerText = `${items.length} Sorten`;

    if (items.length === 0) {
        emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.classList.remove('hidden');

        items.forEach(item => {
            const itemRating = ratings[item.barcode]?.stars || 0;
            const starsHtml = '★'.repeat(itemRating) + '☆'.repeat(5 - itemRating);

            const card = document.createElement('div');
            card.className = "bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between relative group hover:border-zinc-700 transition-all";
            card.innerHTML = `
                <div class="absolute top-3 right-3 bg-green-500/10 text-green-400 border border-green-500/20 font-black text-xs px-2 py-1 rounded-full">
                    x${item.count}
                </div>
                
                <div class="h-44 flex items-center justify-center mb-3 pt-2 cursor-pointer" onclick="openDetailsModal('${item.barcode}')">
                    <img src="${item.image}" alt="${item.name}" class="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300">
                </div>

                <div>
                    <div class="flex items-center justify-between">
                        <span class="text-amber-400 text-xs">${starsHtml}</span>
                        <button onclick="openDetailsModal('${item.barcode}')" class="text-zinc-500 hover:text-white text-xs"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                    </div>
                    <h3 class="font-bold text-white text-sm line-clamp-1 mt-1">${item.name}</h3>
                    <p class="text-xs text-zinc-500 mt-0.5">${item.caffeine || 160} mg Koffein</p>
                    
                    <div class="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                        <button onclick="removeOne('${item.barcode}')" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-1.5 rounded-lg transition-colors font-bold">- 1</button>
                        <button onclick="addMonster('${item.barcode}')" class="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-xs py-1.5 rounded-lg transition-colors font-bold">+ 1</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

// 2. Render Holy Grail Catalog & Wishlist
function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    const query = document.getElementById('catalog-search').value.toLowerCase();
    grid.innerHTML = '';

    const allSorts = Object.entries(MONSTER_DATABASE);

    allSorts.forEach(([barcode, data]) => {
        if (query && !data.name.toLowerCase().includes(query)) return;

        const isCollected = !!collection[barcode];
        const isWishlisted = wishlist.includes(barcode);

        const card = document.createElement('div');
        card.className = `bg-zinc-900 border rounded-2xl p-4 flex flex-col justify-between relative transition-all ${isCollected ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'}`;
        
        card.innerHTML = `
            <div class="absolute top-3 right-3 flex gap-1.5">
                <button onclick="toggleWishlist('${barcode}')" class="p-1.5 rounded-full bg-zinc-950/80 border border-zinc-800 ${isWishlisted ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}">
                    <i data-lucide="bookmark" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="h-44 flex items-center justify-center mb-3 pt-2">
                <img src="${data.image}" alt="${data.name}" class="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] ${isCollected ? '' : 'grayscale'}">
            </div>

            <div>
                <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isCollected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-zinc-400'}">
                    ${isCollected ? 'Gesammelt (' + collection[barcode].count + ')' : 'Fehlt noch'}
                </span>
                <h3 class="font-bold text-white text-sm line-clamp-1 mt-2">${data.name}</h3>
                
                <button onclick="addMonster('${barcode}')" class="w-full mt-3 bg-zinc-800 hover:bg-green-500 hover:text-black text-white text-xs py-2 rounded-xl transition-all font-bold">
                    + Als getrunken loggen
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function toggleWishlist(barcode) {
    if (wishlist.includes(barcode)) {
        wishlist = wishlist.filter(b => b !== barcode);
    } else {
        wishlist.push(barcode);
    }
    saveState();
}

// 3. Render Health & Caffeine Tracker
function renderHealth() {
    const todayStr = new Date().toDateString();
    const todayCans = history.filter(h => new Date(h.timestamp).toDateString() === todayStr);
    
    let todayMg = 0;
    todayCans.forEach(c => todayMg += c.caffeine);

    document.getElementById('health-today-mg').innerText = `${todayMg} mg`;
    document.getElementById('health-today-cans').innerText = `${todayCans.length} Dosen heute getrunken`;

    const percentage = Math.min(Math.round((todayMg / 400) * 100), 100);
    const progressBar = document.getElementById('health-progress-bar');
    progressBar.style.width = `${percentage}%`;

    const badge = document.getElementById('health-badge');
    if (todayMg > 400) {
        progressBar.className = "bg-red-500 h-full transition-all duration-500";
        badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30";
        badge.innerText = "⚠️ Limit überschritten!";
    } else if (todayMg > 250) {
        progressBar.className = "bg-yellow-400 h-full transition-all duration-500";
        badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
        badge.innerText = "Achtung, hoher Konsum";
    } else {
        progressBar.className = "bg-green-400 h-full transition-all duration-500";
        badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30";
        badge.innerText = "Im grünen Bereich";
    }

    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = `<p class="text-xs text-zinc-500">Noch keine Historie vorhanden.</p>`;
        return;
    }

    history.slice(0, 10).forEach((item) => {
        const dateObj = new Date(item.timestamp);
        const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = dateObj.toLocaleDateString();

        const row = document.createElement('div');
        row.className = "bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between text-xs";
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <i data-lucide="zap" class="text-yellow-400 w-4 h-4"></i>
                <div>
                    <p class="font-bold text-white">${item.name}</p>
                    <p class="text-zinc-500">${dateFormatted} um ${timeFormatted} Uhr</p>
                </div>
            </div>
            <div class="text-right">
                <span class="text-yellow-400 font-bold">${item.caffeine} mg</span>
            </div>
        `;
        historyList.appendChild(row);
    });
}

// Scanner Controls (Direktstart für den nativen Browser-Berechtigungsdialog)
function openScanner() {
    document.getElementById('scanner-modal').classList.remove('hidden');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
            addMonster(decodedText);
        },
        (errorMessage) => {
            // Scan-Fehler während des laufens ignorieren
        }
    ).catch(err => {
        console.error("Kamera-Zugriff verweigert oder Fehler:", err);
        alert("Kamera konnte nicht gestartet werden. Bitte erlaube den Zugriff in deinen Browsereinstellungen (HTTPS ist aktiv).");
    });
}

function closeScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Fehler beim Stoppen:", err));
    }
    document.getElementById('scanner-modal').classList.add('hidden');
}

function handleManualBarcode() {
    const input = document.getElementById('manual-barcode');
    if (input.value.trim()) {
        addMonster(input.value.trim());
        input.value = '';
    }
}

// Details Modal (Ratings & Notes)
function openDetailsModal(barcode) {
    currentEditingBarcode = barcode;
    const item = collection[barcode];
    if (!item) return;

    document.getElementById('detail-name').innerText = item.name;
    document.getElementById('detail-caffeine').innerText = `${item.caffeine || 160} mg Koffein/Dose`;
    document.getElementById('detail-count').innerText = `${item.count}x getrunken`;
    document.getElementById('detail-img').src = item.image;

    const currentRating = ratings[barcode]?.stars || 0;
    const currentNote = ratings[barcode]?.note || '';
    const currentTags = ratings[barcode]?.tags || [];

    document.getElementById('detail-note').value = currentNote;

    const starContainer = document.getElementById('star-rating');
    starContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const starBtn = document.createElement('button');
        starBtn.type = 'button';
        starBtn.className = `text-2xl ${i <= currentRating ? 'text-amber-400' : 'text-zinc-700'}`;
        starBtn.innerHTML = '★';
        starBtn.onclick = () => setRatingStars(i);
        starContainer.appendChild(starBtn);
    }

    const tagsContainer = document.getElementById('flavor-tags-container');
    tagsContainer.innerHTML = '';
    AVAILABLE_FLAVOR_TAGS.forEach(tag => {
        const isActive = currentTags.includes(tag);
        const tagBtn = document.createElement('button');
        tagBtn.type = 'button';
        tagBtn.className = `text-xs px-3 py-1.5 rounded-xl border transition-all ${isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-950 text-zinc-400 border-zinc-800'}`;
        tagBtn.innerText = tag;
        tagBtn.onclick = () => toggleTag(tag);
        tagsContainer.appendChild(tagBtn);
    });

    document.getElementById('details-modal').classList.remove('hidden');
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
    currentEditingBarcode = null;
}

function setRatingStars(stars) {
    if (!ratings[currentEditingBarcode]) ratings[currentEditingBarcode] = { stars: 0, note: '', tags: [] };
    ratings[currentEditingBarcode].stars = stars;
    openDetailsModal(currentEditingBarcode);
}

function toggleTag(tag) {
    if (!ratings[currentEditingBarcode]) ratings[currentEditingBarcode] = { stars: 0, note: '', tags: [] };
    let tags = ratings[currentEditingBarcode].tags;
    if (tags.includes(tag)) {
        ratings[currentEditingBarcode].tags = tags.filter(t => t !== tag);
    } else {
        ratings[currentEditingBarcode].tags.push(tag);
    }
    openDetailsModal(currentEditingBarcode);
}

function saveDetailsModal() {
    if (!currentEditingBarcode) return;
    const note = document.getElementById('detail-note').value;
    if (!ratings[currentEditingBarcode]) ratings[currentEditingBarcode] = { stars: 0, note: '', tags: [] };
    ratings[currentEditingBarcode].note = note;

    saveState();
    closeDetailsModal();
}
