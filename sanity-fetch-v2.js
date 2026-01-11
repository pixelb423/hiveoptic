console.log("🚀 SANITY SCRIPT STARTED");

const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid'; 

/**
 * PORTABLE TEXT RENDERER
 * Handles Text, Images, and Video Embeds from Sanity
 */
function renderPortableText(blocks) {
    if (!blocks || !Array.isArray(blocks)) {
        console.warn("renderPortableText received invalid blocks:", blocks);
        return "";
    }
    
    return blocks.map(block => {
        // 1. Text Blocks
        if (block._type === 'block') {
            const text = block.children ? block.children.map(c => c.text).join('') : '';
            if (!text.trim()) return '';
            
            if (block.style === 'h1') return `<h1 class="text-2xl font-light mb-6 text-white uppercase tracking-widest">${text}</h1>`;
            if (block.style === 'h2') return `<h2 class="text-xl font-light mb-4 text-white uppercase tracking-wider">${text}</h2>`;
            return `<p class="mb-6 text-zinc-400 text-lg leading-relaxed font-light">${text}</p>`;
        }
        
        // 2. Images
        if (block._type === 'image' && block.asset) {
            const ref = block.asset._ref;
            if (!ref) return '';
            const parts = ref.split('-'); // image-id-dimensions-ext
            if (parts.length < 4) return '';
            const url = `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${parts[1]}-${parts[2]}.${parts[3]}?w=1000&auto=format`;
            return `<img src="${url}" class="w-full grayscale brightness-75 mb-12 border border-zinc-900 shadow-2xl block">`;
        }

        // 3. Video Embeds
        if (block._type === 'videoEmbed' && block.url) {
            let embedUrl = block.url;
            if (embedUrl.includes('watch?v=')) embedUrl = embedUrl.replace('watch?v=', 'embed/');
            else if (embedUrl.includes('youtu.be/')) embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
            
            return `
                <div class="aspect-video bg-zinc-950 border border-zinc-900 mb-12 shadow-inner">
                    <iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                </div>
            `;
        }
        return '';
    }).join('');
}

/**
 * INITIAL ARCHIVE LOAD
 */
async function initArchive() {
    console.log("📥 initArchive: Fetching projects...");
    const status = document.getElementById('status-tag');
    
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
    
    try {
        const response = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await response.json();
        
        if (!data.result) throw new Error("Sanity Result is empty (Check CORS or Published state)");

        console.log(`✅ initArchive: Loaded ${data.result.projects.length} projects`);

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
        console.error("❌ initArchive Error:", e);
        if (status) status.innerText = "Sync Error";
    }
}

/**
 * FETCH BLOG POSTS
 */
async function fetchBlog() {
    console.log("📥 fetchBlog: Starting...");
    const container = document.getElementById('blog-posts');
    if (!container) return console.error("Element #blog-posts not found!");

    container.innerHTML = `<p class="text-[10px] uppercase tracking-widest text-zinc-500 animate-pulse">Loading Journal...</p>`;
    
    const QUERY = encodeURIComponent(`*[_type == "post"] | order(publishedAt desc) {
        ...,
        "imageUrl": mainImage.asset->url + "?w=1200&auto=format"
    }`);
    
    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const { result } = await res.json();
        
        console.log("✅ fetchBlog: Data received:", result);

        if (!result || result.length === 0) {
            container.innerHTML = `
                <div class="p-10 border border-dashed border-zinc-900 text-center">
                    <p class="text-zinc-600 uppercase text-[10px] tracking-widest mb-2 font-bold">Journal is Empty</p>
                    <p class="text-zinc-700 text-[9px] uppercase">Please publish a 'post' document in Sanity Studio.</p>
                </div>`;
            return;
        }

        container.innerHTML = result.map(post => `
            <article class="group border-b border-zinc-900 pb-24 mb-24 last:border-0 last:mb-0">
                <header class="mb-12">
                    <span class="text-[10px] text-zinc-600 uppercase tracking-widest">
                        ${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft / Recent'}
                    </span>
                    <h1 class="text-3xl font-light uppercase tracking-widest group-hover:text-amber-500 transition-colors mt-4 leading-tight">
                        ${post.title}
                    </h1>
                </header>
                ${post.imageUrl ? `<img src="${post.imageUrl}" class="w-full grayscale brightness-75 mb-14 border border-zinc-900 shadow-2xl transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-100">` : ''}
                <div class="prose max-w-2xl">
                    ${renderPortableText(post.body)}
                </div>
            </article>
        `).join('');
        
    } catch (e) { 
        console.error("❌ fetchBlog Error:", e);
        container.innerHTML = `<p class="text-red-500 text-[10px] uppercase tracking-widest">Error loading posts. Check Console.</p>`;
    }
}

/**
 * FETCH ABOUT PAGE
 */
async function fetchAbout() {
    console.log("📥 fetchAbout: Starting...");
    const QUERY = encodeURIComponent(`*[_type == "aboutPage"][0] {
        ...,
        "qrUrl": qrCode.asset->url + "?w=400&auto=format"
    }`);
    
    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const { result } = await res.json();
        
        console.log("✅ fetchAbout: Data received:", result);
        
        if (!result) {
            document.getElementById('about-content').innerHTML = `
                <h1 class="text-3xl font-light uppercase tracking-widest mb-12">Bio // 404</h1>
                <p class="text-zinc-600 uppercase text-[10px] tracking-widest">No published 'About Page' found.</p>
            `;
            return;
        }

        document.getElementById('about-content').innerHTML = `
            <h1 class="text-3xl font-light uppercase tracking-widest mb-12">${result.title || 'About'}</h1>
            <div class="prose">${renderPortableText(result.bio)}</div>
        `;

        const qrEl = document.getElementById('qr-container');
        if (result.qrUrl) {
            qrEl.innerHTML = `<img src="${result.qrUrl}" class="w-full h-full object-contain">`;
        } else {
            qrEl.innerHTML = `<p class="text-black text-[10px] uppercase font-bold text-center">No QR<br>Image</p>`;
        }

        document.getElementById('contact-list').innerHTML = (result.contactInfo || []).map(c => `
            <div class="mb-8">
                <span class="text-[10px] text-zinc-500 uppercase block tracking-tighter mb-2">${c.label || 'Contact'}</span>
                <span class="text-sm text-zinc-200 font-mono tracking-wide">${c.value || '—'}</span>
            </div>
        `).join('');
        
    } catch (e) { 
        console.error("❌ fetchAbout Error:", e);
        document.getElementById('about-content').innerHTML = `<p class="text-red-500">Error loading Bio. Check Console.</p>`;
    }
}

/** * UI HELPERS 
 */
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
    return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${parts[1]}-${parts[2]}.${parts[3]}?w=600&auto=format`;
}

window.handleImageError = function(img, ytId, videoUrl) {
    if (!ytId) ytId = getYouTubeID(videoUrl);
    if (!ytId) return;
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
            let thumbSrc = p.sanityThumbUrl || buildSanityUrl(p.sanityAssetRef) || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
            
            const div = document.createElement('div');
            div.className = "project-card relative aspect-square cursor-pointer bg-zinc-950 overflow-hidden group";
            div.onclick = () => openModal(p.videoUrl);
            
            // Escape quotes for safe HTML injection
            const escapedVideoUrl = (p.videoUrl || '').replace(/'/g, "\\'");
            
            div.innerHTML = `
                <img src="${thumbSrc || ''}" 
                     loading="lazy"
                     decoding="async"
                     class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500"
                     onerror="window.handleImageError(this, '${ytId || ''}', '${escapedVideoUrl}')">
                <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                    <h3 class="text-[10px] uppercase tracking-tighter text-white font-mono">${p.title}</h3>
                </div>`;
            grid.appendChild(div);
        });
    } else {
        // LIST VIEW
        grid.className = "flex flex-col border-t border-zinc-900";
        grid.style.gridTemplateColumns = "none";
        
        data.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = "list-view-item flex justify-between items-center py-6 px-2 cursor-pointer group";
            div.onclick = () => openModal(p.videoUrl);
            div.innerHTML = `
                <div class="flex items-center gap-6">
                    <span class="text-[11px] text-zinc-700 font-mono tracking-tighter w-8">${(i + 1).toString().padStart(2, '0')}</span>
                    <h3 class="text-[12px] uppercase tracking-widest text-zinc-300 group-hover:text-amber-500 transition-colors font-light">${p.title}</h3>
                </div>
                <div class="flex gap-10 items-center">
                    <span class="text-[10px] text-zinc-500 uppercase tracking-widest">${p.clientTitle || 'Personal'}</span>
                    <span class="text-[10px] text-zinc-800 italic uppercase">/ ${p.categoryTitles?.[0] || 'Archive'}</span>
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

// Ensure init runs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArchive);
} else {
    initArchive();
}
