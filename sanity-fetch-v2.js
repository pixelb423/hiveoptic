console.log("🚀 SANITY SCRIPT INITIALIZING...");

const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

// --- STATE MANAGEMENT ---
let allProjects = [];
let vaultProjects = [];
let allClients = [];
let allCategories = [];

// Filter State
let activeFilters = { client: 'all', cat: 'all' };

// Pagination State
const PAGE_SIZE = 12;
let projectCursor = 0;
let isLoading = false;
let endOfList = false;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Ensure window globals exist if index.html hasn't run yet
    if (typeof window.currentView === 'undefined') window.currentView = 'grid';
    if (typeof window.currentPage === 'undefined') window.currentPage = 'archive';
    
    initArchive();
});

// --- HELPER: THUMBNAIL GENERATOR ---
function getThumbnail(sanityUrl, videoUrl) {
    if (sanityUrl) return sanityUrl; // Manual overrides first

    if (videoUrl) {
        let videoId = null;
        // YouTube Shorts & Standard
        if (videoUrl.includes('youtube.com/shorts/')) {
            videoId = videoUrl.split('shorts/')[1]?.split('?')[0];
        } else if (videoUrl.includes('youtube.com/watch')) {
            videoId = videoUrl.split('v=')[1]?.split('&')[0];
        } else if (videoUrl.includes('youtu.be/')) {
            videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        }

        if (videoId) {
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }
    return null;
}

/**
 * FETCH: ARCHIVE
 */
window.initArchive = async function() {
    await fetchFilters(); 
    resetAndLoadProjects();
}

async function fetchFilters() {
    const QUERY = encodeURIComponent(`{
        "clients": *[_type == "client"] | order(title asc),
        "categories": *[_type == "category"] | order(title asc)
    }`);
    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        allClients = data.result.clients || [];
        allCategories = data.result.categories || [];
        renderFilterButtons();
    } catch(e) { console.error("Filter Fetch Error", e); }
}

function renderFilterButtons() {
    const clientRow = document.getElementById('client-row');
    const catRow = document.getElementById('category-row');

    if (clientRow) {
        clientRow.innerHTML = `<span class="text-zinc-600 pr-2">Client //</span>
            <button onclick="setFilter('client', 'all')" class="tag-btn client-link active-client">All</button>` + 
            allClients.map(c => `<button onclick="setFilter('client', '${c.slug.current}')" class="tag-btn client-link">${c.title}</button>`).join('');
    }
    if (catRow) {
        catRow.innerHTML = `<span class="text-zinc-600 pr-2">Genre //</span>
            <button onclick="setFilter('cat', 'all')" class="tag-btn cat-link active-cat">All</button>` + 
            allCategories.map(c => `<button onclick="setFilter('cat', '${c.slug.current}')" class="tag-btn cat-link hover:text-amber-500">${c.title}</button>`).join('');
    }
}

window.setFilter = function(type, value) {
    activeFilters[type] = value;
    
    // Update visual state of buttons
    document.querySelectorAll(`.${type}-link`).forEach(b => {
        // Check if the button's onclick string contains the value we just selected
        const isMatch = b.getAttribute('onclick').includes(`'${value}'`);
        b.classList.toggle(type === 'client' ? 'active-client' : 'active-cat', isMatch);
    });
    
    resetAndLoadProjects();
}

// Exposed for index.html to call if needed
window.applyFilters = function() {
    resetAndLoadProjects();
}

function resetAndLoadProjects() {
    projectCursor = 0;
    allProjects = []; 
    endOfList = false;
    const grid = document.getElementById('portfolio-grid');
    if(grid) grid.innerHTML = ''; 
    window.loadMoreProjects();
}

window.loadMoreProjects = async function() {
    if (isLoading || endOfList) return;
    isLoading = true;
    
    const status = document.getElementById('status-tag');
    if(status) status.innerText = "Loading...";

    let typeFilter = `_type == "project"`;
    if (activeFilters.client !== 'all') typeFilter += ` && clientTag->slug.current == "${activeFilters.client}"`;
    if (activeFilters.cat !== 'all') typeFilter += ` && "${activeFilters.cat}" in categoryTags[]->slug.current`;

    const start = projectCursor;
    const end = projectCursor + PAGE_SIZE;

    const QUERY = encodeURIComponent(`*[${typeFilter}] | order(order asc) [${start}...${end}] {
        title,
        videoUrl,
        "clientTitle": clientTag->title,
        "sanityThumbUrl": thumbnail.asset->url
    }`);

    try {
        const response = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await response.json();
        const newProjects = data.result || [];
        
        if (newProjects.length < PAGE_SIZE) endOfList = true;
        
        allProjects = [...allProjects, ...newProjects];
        projectCursor += newProjects.length;

        renderGrid(newProjects);

        if(status) status.innerText = endOfList ? "End of List" : "Syncing";
        
        const counter = document.getElementById('project-counter');
        if(counter) counter.innerText = allProjects.length.toString().padStart(3, '0');
        
    } catch (e) { console.error(e); } finally { isLoading = false; }
}

window.renderGrid = function(projectsToRender = []) {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;
    
    // If called without arguments (e.g., switching views), re-render all current projects
    if (projectsToRender.length === 0 && allProjects.length > 0) projectsToRender = allProjects;
    if (projectsToRender.length === 0 && allProjects.length === 0) return; // Nothing to render

    // Clear grid if we are re-rendering everything (like view switch)
    // NOTE: For infinite scroll (appending), we generally don't clear, 
    // but specific logic is needed to distinguish append vs switch. 
    // Here we strictly append ONLY if arguments were passed. 
    // If no arguments (view switch), we clear first.
    if (arguments.length === 0) grid.innerHTML = '';

    const html = projectsToRender.map(p => {
        const thumb = getThumbnail(p.sanityThumbUrl, p.videoUrl);
        const mediaHtml = thumb 
            ? `<img src="${thumb}" class="w-full h-full object-cover" loading="lazy">`
            : `<div class="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 text-xs">NO IMG</div>`;

        // USE GLOBAL WINDOW VARIABLE HERE
        if (window.currentView === 'list') {
             return `
                <div class="list-view-item p-4 flex justify-between items-center cursor-pointer group" onclick="openModal('${p.videoUrl}')">
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-9 bg-zinc-800 overflow-hidden hidden md:block">${mediaHtml}</div>
                        <h3 class="text-sm font-light uppercase tracking-widest group-hover:text-amber-500 transition-colors">${p.title}</h3>
                    </div>
                    <span class="text-[10px] text-zinc-500 uppercase tracking-widest">${p.clientTitle || 'Personal'}</span>
                </div>`;
        } else {
            return `
                <div class="project-card relative aspect-video bg-zinc-900 cursor-pointer overflow-hidden group" onclick="openModal('${p.videoUrl}')">
                    ${mediaHtml}
                    <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                        <h3 class="text-xs uppercase tracking-widest text-white mb-2">${p.title}</h3>
                        <p class="text-[9px] uppercase tracking-widest text-zinc-400">${p.clientTitle || ''}</p>
                    </div>
                </div>`;
        }
    }).join('');
    
    grid.insertAdjacentHTML('beforeend', html);
}


/**
 * FETCH: VAULT
 */
window.fetchVault = async function() {
    const grid = document.getElementById('vault-grid');
    if(grid) grid.innerHTML = '<p class="text-center text-zinc-600 text-[10px] tracking-widest col-span-full">DECRYPTING...</p>';

    const QUERY = encodeURIComponent(`*[_type == "vaultItem"] | order(publishedAt desc) {
        title,
        videoUrl,
        "sanityThumbUrl": thumbnail.asset->url
    }`);

    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        vaultProjects = data.result || [];
        renderVaultGrid();
    } catch(e) { console.error(e); }
}

window.renderVaultGrid = function() {
    const grid = document.getElementById('vault-grid');
    if(!grid) return;
    
    if(vaultProjects.length === 0) {
        grid.innerHTML = '<p class="text-center text-zinc-600 text-[10px] tracking-widest col-span-full">VAULT IS EMPTY</p>';
        return;
    }

    grid.innerHTML = vaultProjects.map(p => {
        const thumb = getThumbnail(p.sanityThumbUrl, p.videoUrl);
        const mediaHtml = thumb 
            ? `<img src="${thumb}" class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" loading="lazy">`
            : `<div class="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 text-xs">NO IMG</div>`;

        return `
            <div class="project-card relative aspect-video bg-zinc-900 cursor-pointer overflow-hidden group border border-zinc-800" onclick="openModal('${p.videoUrl}')">
                ${mediaHtml}
                <div class="absolute inset-0 bg-red-900/20 pointer-events-none mix-blend-overlay"></div>
                <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                    <h3 class="text-xs uppercase tracking-widest text-red-500 mb-2">RESTRICTED</h3>
                    <p class="text-[9px] uppercase tracking-widest text-zinc-400">${p.title}</p>
                </div>
            </div>`;
    }).join('');
}

window.fetchBlog = async function() {
    const container = document.getElementById('blog-posts');
    if(!container) return;
    container.innerHTML = '<p class="text-zinc-500 text-center mt-20">Loading thoughts...</p>';
    const QUERY = encodeURIComponent(`*[_type == "post"] | order(publishedAt desc) { title, "slug": slug.current, publishedAt, "mainImageUrl": mainImage.asset->url, body }`);
    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        if(!data.result || data.result.length === 0) { container.innerHTML = '<p class="text-zinc-500 text-center mt-20">No posts yet.</p>'; return; }
        container.innerHTML = data.result.map(post => {
            const date = new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            return `<article class="border-b border-zinc-900 pb-20"><div class="text-center mb-12"><p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">${date}</p><h2 class="text-3xl md:text-4xl font-light uppercase tracking-widest text-white mb-8">${post.title}</h2>${post.mainImageUrl ? `<img src="${post.mainImageUrl}" class="w-full max-h-[500px] object-cover grayscale hover:grayscale-0 transition-all duration-700">` : ''}</div><div class="prose prose-invert prose-lg max-w-none mx-auto font-light text-zinc-300">${renderPortableText(post.body)}</div></article>`;
        }).join('');
    } catch(e) { console.error(e); }
}

window.fetchAbout = async function() {
    const contentDiv = document.getElementById('about-content');
    const qrDiv = document.getElementById('qr-container');
    const contactDiv = document.getElementById('contact-list');
    const QUERY = encodeURIComponent(`*[_type == "aboutPage"][0]{ bio, "qrUrl": qrCode.asset->url, contactInfo }`);
    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        const doc = data.result;
        if(!doc) return;
        if(contentDiv) contentDiv.innerHTML = `<div class="prose prose-invert prose-lg font-light text-zinc-300">${renderPortableText(doc.bio)}</div>`;
        if(qrDiv && doc.qrUrl) qrDiv.innerHTML = `<img src="${doc.qrUrl}" class="w-full h-full object-contain mix-blend-multiply">`;
        if(contactDiv && doc.contactInfo) contactDiv.innerHTML = doc.contactInfo.map(c => `<div><span class="block text-[9px] uppercase tracking-widest text-zinc-500">${c.label}</span><span class="text-lg font-light text-white">${c.value}</span></div>`).join('');
    } catch(e) { console.error(e); }
}

function renderPortableText(blocks) {
    if (!blocks || !Array.isArray(blocks)) return "";
    return blocks.map(block => {
        if (block._type === 'block') {
            const text = block.children ? block.children.map(c => c.text).join('') : '';
            if (!text.trim()) return '';
            if (block.style === 'h3') return `<h3 class="text-xl uppercase tracking-widest mt-8 mb-4 text-white">${text}</h3>`;
            return `<p class="mb-6 leading-relaxed">${text}</p>`;
        }
        return '';
    }).join('');
}
