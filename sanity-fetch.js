const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid';

async function initArchive() {
    const status = document.getElementById('status-tag');
    
    // FETCH QUERY: Added explicit expansion for thumbnail asset to get the URL directly if possible
    const QUERY = encodeURIComponent(`{
        "projects": *[_type == "project"] | order(order asc) {
            ...,
            "clientSlug": clientTag->slug.current,
            "clientTitle": clientTag->title,
            "categorySlugs": categoryTags[]->slug.current,
            "categoryTitles": categoryTags[]->title,
            "thumbnailUrl": thumbnail.asset->url
        },
        "clients": *[_type == "client"] | order(title asc),
        "categories": *[_type == "category"] | order(title asc)
    }`);
    
    const API_URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const response = await fetch(API_URL);
        const { result } = await response.json();
        
        allProjects = result.projects || [];
        allClients = result.clients || [];
        allCategories = result.categories || [];

        renderFilters();
        applyFilters();

        if (status) {
            status.innerText = "Synchronized";
            status.style.color = "#22c55e"; 
        }
    } catch (e) {
        console.error("Sync failed:", e);
        if (status) {
            status.innerText = "Offline";
            status.style.color = "#ef4444";
        }
    }
}

function renderFilters() {
    const clientRow = document.getElementById('client-row');
    const catRow = document.getElementById('category-row');

    if (clientRow) {
        clientRow.innerHTML = `<span class="text-zinc-800 pr-2">Client //</span>
            <button onclick="setFilter('client', 'all')" class="tag-btn client-link active-client">All</button>` + 
            allClients.map(c => `
                <button onclick="setFilter('client', '${c.slug.current}')" class="tag-btn client-link">${c.title}</button>
            `).join('');
    }

    if (catRow) {
        catRow.innerHTML = `<span class="text-zinc-800 pr-2">Genre //</span>
            <button onclick="setFilter('cat', 'all')" class="tag-btn cat-link active-cat">All</button>` + 
            allCategories.map(c => `
                <button onclick="setFilter('cat', '${c.slug.current}')" class="tag-btn cat-link hover:text-amber-500">${c.title}</button>
            `).join('');
    }
}

function setFilter(type, value) {
    activeFilters[type] = value;
    const btns = document.querySelectorAll(`.${type}-link`);
    btns.forEach(b => {
        if (b.getAttribute('onclick').includes(`'${value}'`)) {
            b.classList.add(type === 'client' ? 'active-client' : 'active-cat');
        } else {
            b.classList.remove(type === 'client' ? 'active-client' : 'active-cat');
        }
    });
    applyFilters();
}

function applyFilters() {
    let filtered = allProjects;
    if (activeFilters.client !== 'all') filtered = filtered.filter(p => p.clientSlug === activeFilters.client);
    if (activeFilters.cat !== 'all') filtered = filtered.filter(p => p.categorySlugs && p.categorySlugs.includes(activeFilters.cat));
    renderGrid(filtered);
}

function getYouTubeID(url) {
    if (!url) return null;
    
    // Handle YouTube Shorts
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        return parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
    }
    
    // Handle standard and other formats
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

function renderGrid(data) {
    const grid = document.getElementById('portfolio-grid');
    const counter = document.getElementById('project-counter');
    if (!grid) return;

    grid.innerHTML = '';
    if (counter) counter.innerText = data.length.toString().padStart(3, '0');

    data.forEach((p, index) => {
        const ytId = getYouTubeID(p.videoUrl);
        
        // Use the thumbnailUrl from our expanded query, 
        // fallback to YouTube HQ, then YouTube standard, then a black pixel
        let primaryThumb = p.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

        if (currentView === 'list') {
            const div = document.createElement('div');
            div.className = "list-view-item flex items-center justify-between py-3 px-2 cursor-pointer group";
            div.onclick = () => openModal(p.videoUrl);
            div.innerHTML = `
                <div class="flex items-center gap-6">
                    <span class="text-[9px] text-zinc-700 font-mono">${(index + 1).toString().padStart(3, '0')}</span>
                    <h3 class="text-[11px] uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">${p.title}</h3>
                </div>
                <div class="flex gap-8 items-center">
                    <span class="text-[8px] uppercase tracking-tighter text-zinc-600">${p.clientTitle || ''}</span>
                    <span class="text-[8px] text-amber-600 uppercase tracking-tighter w-24 text-right">${p.categoryTitles?.join(', ') || ''}</span>
                </div>
            `;
            grid.appendChild(div);
        } else {
            const density = document.getElementById('grid-select')?.value || 12;
            grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;
            
            const div = document.createElement('div');
            div.className = "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden";
            div.onclick = () => openModal(p.videoUrl);
            
            // Smarter onerror chain: 
            // 1. If Sanity URL fails, try YouTube HQ
            // 2. If YouTube HQ fails, try YouTube 0.jpg (standard)
            // 3. Stop there to avoid infinite loops
            div.innerHTML = `
                <img src="${primaryThumb}" 
                     class="w-full h-full object-cover grayscale brightness-50 hover:grayscale-0 hover:brightness-100 transition-all duration-500"
                     onerror="handleImageError(this, '${ytId}')">
                <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                    <h3 class="text-[8px] uppercase tracking-tighter text-white">${p.title}</h3>
                </div>
            `;
            grid.appendChild(div);
        }
    });
}

// Global error handler for images to avoid inline string complexity
function handleImageError(img, ytId) {
    if (!ytId) {
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        return;
    }

    if (img.src.includes('sanity.io')) {
        img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (img.src.includes('hqdefault')) {
        img.src = `https://img.youtube.com/vi/${ytId}/0.jpg`;
    } else {
        img.onerror = null; // Prevent loops
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
}

window.onload = initArchive;
