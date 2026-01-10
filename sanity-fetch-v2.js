console.log("🚀 SANITY-FETCH.JS IS LOADING!");

const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid'; // Track view state

/**
 * INITIALIZE DATA FROM SANITY
 */
async function initArchive() {
    const status = document.getElementById('status-tag');
    
    const QUERY = encodeURIComponent(`{
        "projects": *[_type == "project"] | order(order asc) {
            ...,
            "clientSlug": clientTag->slug.current,
            "clientTitle": clientTag->title,
            "categorySlugs": categoryTags[]->slug.current,
            "categoryTitles": categoryTags[]->title,
            "sanityThumbUrl": thumbnail.asset->url,
            "sanityAssetRef": thumbnail.asset._ref
        },
        "clients": *[_type == "client"] | order(title asc),
        "categories": *[_type == "category"] | order(title asc)
    }`);
    
    const API_URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (!data.result) throw new Error("No result in response");

        allProjects = data.result.projects || [];
        allClients = data.result.clients || [];
        allCategories = data.result.categories || [];

        renderFilters();
        applyFilters();

        if (status) {
            status.innerText = "Synchronized";
            status.style.color = "#22c55e"; 
        }
    } catch (e) {
        console.error("Sync Error:", e);
        if (status) {
            status.innerText = "Offline";
            status.style.color = "#ef4444";
        }
    }
}

/**
 * COUNTER LOGIC
 * Updates the project-counter element found in index.html
 */
function updateCounter(count) {
    const counterEl = document.getElementById('project-counter');
    if (counterEl) {
        // Aesthetic padding: 7 projects becomes "007"
        counterEl.innerText = count.toString().padStart(3, '0');
    }
}

/**
 * UTILITIES & IMAGE HANDLING
 */
function getYouTubeID(url) {
    if (!url) return null;
    let id = null;
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
        return id;
    }
    if (url.includes('youtu.be/')) {
        const parts = url.split('youtu.be/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
        return id;
    }
    if (url.includes('youtube.com/watch')) {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v');
        } catch (e) { return null; }
    }
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7] && match[7].length === 11) ? match[7] : null;
}

function buildSanityUrl(ref) {
    if (!ref) return null;
    const parts = ref.split('-');
    if (parts.length < 4) return null;
    const id = parts[1];
    const dims = parts[2];
    const ext = parts[3];
    return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${id}-${dims}.${ext}?w=800&auto=format`;
}

window.handleImageError = function(img, ytId, videoUrl) {
    if (!ytId) ytId = getYouTubeID(videoUrl);
    if (!ytId) {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23111'/%3E%3C/svg%3E";
        return;
    }
    if (!img.src.includes('youtube.com') && !img.src.includes('ytimg.com')) {
        img.src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    } else if (img.src.includes('maxresdefault')) {
        img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
}

/**
 * RENDER ENGINE
 */
function renderGrid(data) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    if (currentView === 'grid') {
        const density = document.getElementById('grid-select')?.value || 12;
        grid.className = "grid gap-1";
        grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;

        data.forEach((p) => {
            const ytId = getYouTubeID(p.videoUrl);
            let thumbSrc = p.sanityThumbUrl || buildSanityUrl(p.sanityAssetRef);
            if (!thumbSrc && ytId) thumbSrc = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
            
            const div = document.createElement('div');
            div.className = "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden group";
            div.onclick = () => openModal(p.videoUrl);
            
            const escapedVideoUrl = (p.videoUrl || '').replace(/'/g, "\\'");
            
            div.innerHTML = `
                <img src="${thumbSrc || ''}" 
                     class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500"
                     onerror="window.handleImageError(this, '${ytId || ''}', '${escapedVideoUrl}')">
                <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                    <h3 class="text-[8px] uppercase tracking-tighter text-white font-mono">${p.title}</h3>
                </div>
            `;
            grid.appendChild(div);
        });
    } else {
        // LIST VIEW RENDER
        grid.className = "flex flex-col border-t border-zinc-900";
        grid.style.gridTemplateColumns = "none";
        
        data.forEach(p => {
            const div = document.createElement('div');
            div.className = "list-view-item flex justify-between items-center py-3 px-2 cursor-pointer group";
            div.onclick = () => openModal(p.videoUrl);
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <span class="text-[10px] text-zinc-800 font-mono tracking-tighter w-8">${(data.indexOf(p) + 1).toString().padStart(2, '0')}</span>
                    <h3 class="text-[10px] uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">${p.title}</h3>
                </div>
                <div class="flex gap-4 items-center">
                    <span class="text-[8px] text-zinc-700 uppercase">${p.clientTitle || 'Personal'}</span>
                    <span class="text-[8px] text-zinc-800 italic uppercase">/ ${p.categoryTitles?.[0] || 'Work'}</span>
                </div>
            `;
            grid.appendChild(div);
        });
    }
}

function renderFilters() {
    const clientRow = document.getElementById('client-row');
    const catRow = document.getElementById('category-row');
    if (clientRow) {
        clientRow.innerHTML = `<span class="text-zinc-800 pr-2">Client //</span>
            <button onclick="setFilter('client', 'all')" class="tag-btn client-link active-client">All</button>` + 
            allClients.map(c => `<button onclick="setFilter('client', '${c.slug.current}')" class="tag-btn client-link">${c.title}</button>`).join('');
    }
    if (catRow) {
        catRow.innerHTML = `<span class="text-zinc-800 pr-2">Genre //</span>
            <button onclick="setFilter('cat', 'all')" class="tag-btn cat-link active-cat">All</button>` + 
            allCategories.map(c => `<button onclick="setFilter('cat', '${c.slug.current}')" class="tag-btn cat-link">${c.title}</button>`).join('');
    }
}

function setFilter(type, value) {
    activeFilters[type] = value;
    document.querySelectorAll(`.${type}-link`).forEach(b => {
        b.classList.toggle(type === 'client' ? 'active-client' : 'active-cat', b.getAttribute('onclick').includes(`'${value}'`));
    });
    applyFilters();
}

function applyFilters() {
    let filtered = allProjects;
    if (activeFilters.client !== 'all') filtered = filtered.filter(p => p.clientSlug === activeFilters.client);
    if (activeFilters.cat !== 'all') filtered = filtered.filter(p => p.categorySlugs && p.categorySlugs.includes(activeFilters.cat));
    
    // Update the counter on every filter apply
    updateCounter(filtered.length);
    renderGrid(filtered);
}

// Support for the global currentView variable from index.html
window.addEventListener('load', () => {
    initArchive();
});
