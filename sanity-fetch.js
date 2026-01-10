const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid';

async function initArchive() {
    const status = document.getElementById('status-tag');
    
    // FETCH QUERY: We fetch BOTH the reference and the dereferenced URL
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
        
        console.log("Archive Data Load:", data.result);

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

function getYouTubeID(url) {
    if (!url) return null;
    let id = "";
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
    } else {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        id = (match && match[7].length === 11) ? match[7] : null;
    }
    return id;
}

/**
 * Robust Sanity URL Builder fallback
 */
function buildSanityUrl(ref) {
    if (!ref) return null;
    // Format: image-ID-DIMENSIONS-EXT
    const parts = ref.split('-');
    if (parts.length < 4) return null;
    const id = parts[1];
    const dims = parts[2];
    const ext = parts[3];
    return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${id}-${dims}.${ext}?w=800&auto=format`;
}

function renderGrid(data) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const density = document.getElementById('grid-select')?.value || 12;
    grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;

    data.forEach(p => {
        const ytId = getYouTubeID(p.videoUrl);
        
        // 1. Try Expanded URL
        // 2. Try Manual Construction from Ref
        // 3. Fallback to YouTube
        let thumbSrc = p.sanityThumbUrl || buildSanityUrl(p.sanityAssetRef);
        
        if (!thumbSrc && ytId) {
            thumbSrc = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        } else if (!thumbSrc) {
            thumbSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        }

        const div = document.createElement('div');
        div.className = "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden group";
        div.onclick = () => openModal(p.videoUrl);
        
        div.innerHTML = `
            <img src="${thumbSrc}" 
                 class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500"
                 onerror="handleImageError(this, '${ytId}')">
            <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                <h3 class="text-[8px] uppercase tracking-tighter text-white">${p.title}</h3>
            </div>
        `;
        grid.appendChild(div);
    });
}

function handleImageError(img, ytId) {
    if (!ytId) return;
    // If the source was Sanity, move to YouTube HQ
    if (!img.src.includes('youtube.com')) {
        img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } 
    // If YouTube HQ failed, try the standard 0.jpg
    else if (img.src.includes('hqdefault')) {
        img.src = `https://img.youtube.com/vi/${ytId}/0.jpg`;
    }
}

// Keep the rest of the filter logic exactly as is
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
            allCategories.map(c => `<button onclick="setFilter('cat', '${c.slug.current}')" class="tag-btn cat-link hover:text-amber-500">${c.title}</button>`).join('');
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
    renderGrid(filtered);
}

window.onload = initArchive;
