const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

/**
 * APPLICATION STATE
 * Storing data locally after fetch to allow for instant filtering
 */
let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };

/**
 * INITIALIZE ARCHIVE
 * Fetches projects, clients, and categories in a single round-trip
 */
async function initArchive() {
    const status = document.getElementById('status-tag');
    
    // THE QUERY: Normalized to fetch URL and Metadata (LQIP)
    // We use a Template Literal string to ensure encodeURIComponent works correctly
    const QUERY = encodeURIComponent(`{
        "projects": *[_type == "project"] | order(order asc) {
            _id,
            title,
            videoUrl,
            "clientSlug": clientTag->slug.current,
            "clientTitle": clientTag->title,
            "categorySlugs": categoryTags[]->slug.current,
            "categoryTitles": categoryTags[]->title,
            "thumbnail": {
                "url": thumbnail.asset->url,
                "lqip": thumbnail.asset->metadata.lqip
            }
        },
        "clients": *[_type == "client"] | order(title asc),
        "categories": *[_type == "category"] | order(title asc)
    }`);
    
    const API_URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Debugging logs to verify structure in console
        console.log("Archive Sync Successful:", data.result);

        if (!data.result) throw new Error("Sanity returned an empty result set.");

        allProjects = data.result.projects || [];
        allClients = data.result.clients || [];
        allCategories = data.result.categories || [];

        // Build UI
        renderFilters();
        applyFilters();

        if (status) {
            status.innerText = "Synchronized";
            status.style.color = "#22c55e"; 
        }
    } catch (e) {
        console.error("Critical Sync Error:", e);
        if (status) {
            status.innerText = "Offline / Connection Error";
            status.style.color = "#ef4444";
        }
    }
}

/**
 * YOUTUBE ID EXTRACTOR
 * Supports standard URLs, Shorts, and Embed links
 */
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
 * RENDER GRID
 * Generates the HTML for the portfolio archive
 */
function renderGrid(data) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    // Responsive density check
    const density = document.getElementById('grid-select')?.value || 12;
    grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;

    data.forEach(p => {
        const ytId = getYouTubeID(p.videoUrl);
        
        // NORMALIZED THUMBNAIL LOGIC
        // 1. Check if Sanity URL exists
        // 2. If not, generate YouTube HQ thumbnail
        // 3. Last resort: transparent pixel
        let thumbSrc = p.thumbnail?.url;
        
        if (!thumbSrc && ytId) {
            thumbSrc = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        } else if (!thumbSrc) {
            thumbSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        }

        const div = document.createElement('div');
        div.className = "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden group border-[0.5px] border-zinc-800/50";
        
        // Assuming openModal is defined in index.html or another script
        div.onclick = () => typeof openModal === 'function' ? openModal(p.videoUrl) : console.log("Video:", p.videoUrl);
        
        div.innerHTML = `
            <img src="${thumbSrc}" 
                 loading="lazy"
                 class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700 ease-in-out"
                 onerror="handleImageError(this, '${ytId || ""}')">
            <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300">
                <h3 class="text-[8px] uppercase tracking-widest text-white font-medium">${p.title}</h3>
                ${p.clientTitle ? `<p class="text-[6px] text-zinc-400 uppercase tracking-tighter">${p.clientTitle}</p>` : ''}
            </div>
        `;
        grid.appendChild(div);
    });
}

/**
 * IMAGE ERROR HANDLER
 * If a Sanity image fails (e.g. deleted asset), try YouTube
 */
function handleImageError(img, ytId) {
    if (!ytId) return;
    
    // If it wasn't a YouTube image, switch to YouTube
    if (!img.src.includes('youtube.com')) {
        img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } 
    // If HQ failed, try the standard fallback
    else if (img.src.includes('hqdefault')) {
        img.src = `https://img.youtube.com/vi/${ytId}/0.jpg`;
    } else {
        img.onerror = null; // Prevent infinite loops
    }
}

/**
 * FILTER RENDERING
 */
function renderFilters() {
    const clientRow = document.getElementById('client-row');
    const catRow = document.getElementById('category-row');
    
    if (clientRow) {
        clientRow.innerHTML = `<span class="text-zinc-800 pr-2 select-none">Client //</span>
            <button onclick="setFilter('client', 'all')" class="tag-btn client-link active-client">All</button>` + 
            allClients.map(c => `<button onclick="setFilter('client', '${c.slug.current}')" class="tag-btn client-link">${c.title}</button>`).join('');
    }
    
    if (catRow) {
        catRow.innerHTML = `<span class="text-zinc-800 pr-2 select-none">Genre //</span>
            <button onclick="setFilter('cat', 'all')" class="tag-btn cat-link active-cat">All</button>` + 
            allCategories.map(c => `<button onclick="setFilter('cat', '${c.slug.current}')" class="tag-btn cat-link hover:text-amber-500">${c.title}</button>`).join('');
    }
}

/**
 * FILTER LOGIC
 */
function setFilter(type, value) {
    activeFilters[type] = value;
    
    // Update UI states
    document.querySelectorAll(`.${type}-link`).forEach(b => {
        const isActive = b.getAttribute('onclick').includes(`'${value}'`);
        b.classList.toggle(type === 'client' ? 'active-client' : 'active-cat', isActive);
    });
    
    applyFilters();
}

function applyFilters() {
    let filtered = allProjects;
    
    if (activeFilters.client !== 'all') {
        filtered = filtered.filter(p => p.clientSlug === activeFilters.client);
    }
    
    if (activeFilters.cat !== 'all') {
        filtered = filtered.filter(p => p.categorySlugs && p.categorySlugs.includes(activeFilters.cat));
    }
    
    renderGrid(filtered);
}

// Start on Load
window.addEventListener('DOMContentLoaded', initArchive);
