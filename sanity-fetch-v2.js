const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid'; 

/**
 * HELPER: Basic Block Content to HTML
 */
function blocksToHtml(blocks) {
    if (!blocks) return "";
    return blocks.map(block => {
        if (block._type !== 'block' || !block.children) return '';
        const text = block.children.map(child => child.text).join('');
        if (block.style === 'h1') return `<h1 class="text-2xl font-light mb-4">${text}</h1>`;
        return `<p class="mb-4 text-zinc-400">${text}</p>`;
    }).join('');
}

async function initArchive() {
    const status = document.getElementById('status-tag');
    // We explicitly request a resized width for the sanityThumbUrl to save bandwidth
    const QUERY = encodeURIComponent(`{
        "projects": *[_type == "project"] | order(order asc) {
            ...,
            "clientSlug": clientTag->slug.current,
            "clientTitle": clientTag->title,
            "categorySlugs": categoryTags[]->slug.current,
            "categoryTitles": categoryTags[]->title,
            "sanityThumbUrl": thumbnail.asset->url + "?w=600&auto=format",
            "sanityAssetRef": thumbnail.asset._ref
        },
        "clients": *[_type == "client"] | order(title asc),
        "categories": *[_type == "category"] | order(title asc)
    }`);
    
    const API_URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (!data.result) throw new Error("No result");

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
    }
}

async function fetchBlog() {
    const container = document.getElementById('blog-posts');
    container.innerHTML = `<p class="text-[10px] uppercase tracking-widest text-zinc-500">Retrieving Journal...</p>`;
    
    const QUERY = encodeURIComponent(`*[_type == "post"] | order(publishedAt desc) {
        ...,
        "imageUrl": mainImage.asset->url + "?w=1200&auto=format"
    }`);
    const URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const res = await fetch(URL);
        const { result } = await res.json();
        
        container.innerHTML = result.map(post => `
            <article class="group border-b border-zinc-900 pb-24 last:border-0">
                <header class="mb-8">
                    <span class="text-[10px] text-zinc-500 uppercase tracking-widest">${new Date(post.publishedAt).toLocaleDateString()}</span>
                    <h1 class="text-3xl font-light uppercase tracking-widest group-hover:text-amber-500 transition-colors mt-4">${post.title}</h1>
                </header>
                ${post.imageUrl ? `<img src="${post.imageUrl}" class="w-full grayscale brightness-75 mb-10 border border-zinc-900">` : ''}
                <div class="prose max-w-2xl">${blocksToHtml(post.body)}</div>
                <div class="mt-12 space-y-6">
                    ${(post.body || []).filter(b => b._type === 'videoEmbed').map(vid => `
                        <div class="aspect-video bg-zinc-900 border border-zinc-800">
                             <iframe src="${vid.url.replace('watch?v=', 'embed/')}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                        </div>
                    `).join('')}
                </div>
            </article>
        `).join('');
    } catch (e) { console.error(e); }
}

async function fetchAbout() {
    const QUERY = encodeURIComponent(`*[_type == "aboutPage"][0] {
        ...,
        "qrUrl": qrCode.asset->url + "?w=400&auto=format"
    }`);
    const URL = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`;
    
    try {
        const res = await fetch(URL);
        const { result } = await res.json();
        if (!result) return;

        document.getElementById('about-content').innerHTML = `
            <h1 class="text-3xl font-light uppercase tracking-widest mb-12">${result.title || 'About'}</h1>
            <div class="prose">${blocksToHtml(result.bio)}</div>
        `;

        if (result.qrUrl) {
            document.getElementById('qr-container').innerHTML = `<img src="${result.qrUrl}" class="w-full h-full object-contain">`;
        }

        document.getElementById('contact-list').innerHTML = (result.contactInfo || []).map(c => `
            <div class="mb-4">
                <span class="text-[9px] text-zinc-500 uppercase block tracking-tighter mb-1">${c.label}</span>
                <span class="text-xs text-zinc-200 font-mono tracking-wide">${c.value}</span>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

function updateCounter(count) {
    const el = document.getElementById('project-counter');
    if (el) el.innerText = count.toString().padStart(3, '0');
}

function getYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7] && match[7].length === 11) ? match[7] : null;
}

function buildSanityUrl(ref) {
    if (!ref) return null;
    const parts = ref.split('-');
    if (parts.length < 4) return null;
    // Optimized resizing for the grid
    return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${parts[1]}-${parts[2]}.${parts[3]}?w=600&auto=format`;
}

window.handleImageError = function(img, ytId, videoUrl) {
    if (!ytId) ytId = getYouTubeID(videoUrl);
    if (!ytId) return;
    // Using mqdefault (Medium Quality) for grid thumbnails to save performance
    img.src = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
}

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
            // mqdefault is used for initial load if sanity thumb is missing
            let thumbSrc = p.sanityThumbUrl || buildSanityUrl(p.sanityAssetRef) || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
            
            const div = document.createElement('div');
            div.className = "project-card relative aspect-square cursor-pointer bg-zinc-950 overflow-hidden group";
            div.onclick = () => openModal(p.videoUrl);
            div.innerHTML = `
                <img src="${thumbSrc || ''}" 
                     loading="lazy"
                     decoding="async"
                     class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500"
                     onerror="window.handleImageError(this, '${ytId || ''}', '${(p.videoUrl || '').replace(/'/g, "\\'")}')">
                <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                    <h3 class="text-[10px] uppercase tracking-tighter text-white font-mono">${p.title}</h3>
                </div>`;
            grid.appendChild(div);
        });
    } else {
        grid.className = "flex flex-col border-t border-zinc-900";
        data.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = "list-view-item flex justify-between items-center py-4 px-2 cursor-pointer group";
            div.onclick = () => openModal(p.videoUrl);
            div.innerHTML = `
                <div class="flex items-center gap-6">
                    <span class="text-[11px] text-zinc-700 font-mono tracking-tighter w-8">${(i + 1).toString().padStart(2, '0')}</span>
                    <h3 class="text-[11px] uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">${p.title}</h3>
                </div>
                <div class="flex gap-6 items-center">
                    <span class="text-[10px] text-zinc-500 uppercase tracking-widest">${p.clientTitle || 'Project'}</span>
                    <span class="text-[10px] text-zinc-700 italic uppercase">/ ${p.categoryTitles?.[0] || 'Archive'}</span>
                </div>`;
            grid.appendChild(div);
        });
    }
}

function renderFilters() {
    const clientRow = document.getElementById('client-row');
    const catRow = document.getElementById('category-row');
    if (clientRow) {
        clientRow.innerHTML = `<span class="text-zinc-700 pr-2">Client //</span>
            <button onclick="setFilter('client', 'all')" class="tag-btn client-link active-client">All</button>` + 
            allClients.map(c => `<button onclick="setFilter('client', '${c.slug.current}')" class="tag-btn client-link">${c.title}</button>`).join('');
    }
    if (catRow) {
        catRow.innerHTML = `<span class="text-zinc-700 pr-2">Genre //</span>
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
    updateCounter(filtered.length);
    renderGrid(filtered);
}

window.onload = initArchive;
