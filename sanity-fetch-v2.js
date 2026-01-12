console.log("🚀 SANITY SCRIPT INITIALIZING...");

const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production";

// --- STATE MANAGEMENT ---
let allProjects = [];
let allClients = [];
let allCategories = [];

let activeFilters = { client: 'all', cat: 'all' };

// Pagination State
const PAGE_SIZE = 12;
let projectCursor = 0;
let isLoading = false;
let endOfList = false;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initArchive();
});

/**
 * FETCH: ARCHIVE (Infinite Scroll + Server Side Filtering)
 */
window.initArchive = async function() {
    console.log("📥 initArchive: Resetting and fetching...");
    
    // Fetch filter lists (Clients/Categories) only once
    await fetchFilters(); 
    
    // Initial Load of Projects
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

// Called when user clicks a filter button
window.setFilter = function(type, value) {
    activeFilters[type] = value;
    
    // Update visual state of buttons
    document.querySelectorAll(`.${type}-link`).forEach(b => {
        const isMatch = b.getAttribute('onclick').includes(`'${value}'`);
        if (type === 'client') {
            b.classList.toggle('active-client', isMatch);
        } else {
            b.classList.toggle('active-cat', isMatch);
        }
    });

    resetAndLoadProjects();
}

// Resets the list and starts fetching from 0
function resetAndLoadProjects() {
    projectCursor = 0;
    allProjects = []; 
    endOfList = false;
    document.getElementById('portfolio-grid').innerHTML = ''; // Clear Grid
    window.loadMoreProjects();
}

window.loadMoreProjects = async function() {
    if (isLoading || endOfList) return;
    isLoading = true;
    
    const status = document.getElementById('status-tag');
    if(status) status.innerText = "Loading...";

    // Build the Query dynamically based on filters
    let typeFilter = `_type == "project"`;
    if (activeFilters.client !== 'all') typeFilter += ` && clientTag->slug.current == "${activeFilters.client}"`;
    if (activeFilters.cat !== 'all') typeFilter += ` && "${activeFilters.cat}" in categoryTags[]->slug.current`;

    const start = projectCursor;
    const end = projectCursor + PAGE_SIZE;

    const QUERY = encodeURIComponent(`*[${typeFilter}] | order(order asc) [${start}...${end}] {
        title,
        videoUrl,
        "clientTitle": clientTag->title,
        "sanityThumbUrl": thumbnail.asset->url + "?w=800&auto=format"
    }`);

    try {
        const response = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await response.json();
        
        const newProjects = data.result || [];
        
        if (newProjects.length < PAGE_SIZE) {
            endOfList = true; // Server has no more items
        }

        allProjects = [...allProjects, ...newProjects];
        projectCursor += newProjects.length;

        renderGrid(newProjects); // Render only the new batch

        if(status) status.innerText = endOfList ? "End of List" : "Syncing";
        document.getElementById('project-counter').innerText = allProjects.length.toString().padStart(3, '0');

    } catch (e) {
        console.error(e);
        if(status) status.innerText = "Error";
    } finally {
        isLoading = false;
    }
}

// Renders the projects. Note: We append new items to the DOM.
window.renderGrid = function(projectsToRender = []) {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;

    // If no specific batch passed, implies full re-render (rare in this logic, but good safety)
    if (projectsToRender.length === 0 && allProjects.length > 0 && grid.innerHTML === '') {
        projectsToRender = allProjects;
    }

    const html = projectsToRender.map(p => {
        let mediaHtml = '';
        
        // Use uploaded thumbnail if available
        if (p.sanityThumbUrl) {
            mediaHtml = `<img src="${p.sanityThumbUrl}" class="w-full h-full object-cover" loading="lazy">`;
        } else {
            // Fallback to placeholder
            mediaHtml = `<div class="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 text-xs">NO IMG</div>`;
        }

        if (window.currentView === 'list') {
             return `
                <div class="list-view-item p-4 flex justify-between items-center cursor-pointer group" onclick="openModal('${p.videoUrl}')">
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-9 bg-zinc-800 overflow-hidden hidden md:block">
                            ${mediaHtml}
                        </div>
                        <h3 class="text-sm font-light uppercase tracking-widest group-hover:text-amber-500 transition-colors">${p.title}</h3>
                    </div>
                    <span class="text-[10px] text-zinc-500 uppercase tracking-widest">${p.clientTitle || 'Personal'}</span>
                </div>
            `;
        } else {
            return `
                <div class="project-card relative aspect-video bg-zinc-900 cursor-pointer overflow-hidden group" onclick="openModal('${p.videoUrl}')">
                    ${mediaHtml}
                    <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                        <h3 class="text-xs uppercase tracking-widest text-white mb-2">${p.title}</h3>
                        <p class="text-[9px] uppercase tracking-widest text-zinc-400">${p.clientTitle || ''}</p>
                    </div>
                </div>
            `;
        }
    }).join('');

    // If View is Grid, append. If View is List, logic might need to be different, but for now we append.
    grid.insertAdjacentHTML('beforeend', html);
}

// Helper: Re-trigger render when switching views (Grid <-> List)
window.applyFilters = function() {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = ''; // Clear to redraw everything in new view mode
    // In a complex app we'd re-render 'allProjects', but here we just re-render what we have in memory
    renderGrid(allProjects);
}


/**
 * FETCH: BLOG (With Share Buttons)
 */
window.fetchBlog = async function() {
    const container = document.getElementById('blog-posts');
    container.innerHTML = '<p class="text-zinc-500 text-center mt-20">Loading thoughts...</p>';

    const QUERY = encodeURIComponent(`*[_type == "post"] | order(publishedAt desc) {
        title,
        "slug": slug.current,
        publishedAt,
        "mainImageUrl": mainImage.asset->url,
        body
    }`);

    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        
        if(!data.result || data.result.length === 0) {
            container.innerHTML = '<p class="text-zinc-500 text-center mt-20">No posts yet.</p>';
            return;
        }

        container.innerHTML = data.result.map(post => {
            const date = new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            // Share URLs
            // Note: Since this is likely a single page app, exact deep linking requires valid URL routing. 
            // We default to sharing the main site URL + post title.
            const shareUrl = encodeURIComponent(window.location.origin); // or window.location.href
            const shareTitle = encodeURIComponent(post.title);

            return `
            <article class="border-b border-zinc-900 pb-20">
                <div class="text-center mb-12">
                    <p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">${date}</p>
                    <h2 class="text-3xl md:text-4xl font-light uppercase tracking-widest text-white mb-8">${post.title}</h2>
                    ${post.mainImageUrl ? `<img src="${post.mainImageUrl}" class="w-full max-h-[500px] object-cover grayscale hover:grayscale-0 transition-all duration-700">` : ''}
                </div>
                
                <div class="flex justify-center gap-6 mb-10 border-y border-zinc-900/50 py-3">
                    <span class="text-[9px] uppercase tracking-widest text-zinc-600 pt-0.5">Share ::</span>
                    <a href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" class="text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Twitter/X</a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Facebook</a>
                    <a href="mailto:?subject=${shareTitle}&body=${shareUrl}" class="text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Email</a>
                </div>

                <div class="prose prose-invert prose-lg max-w-none mx-auto font-light text-zinc-300">
                    ${renderPortableText(post.body)}
                </div>
            </article>
            `;
        }).join('');
    } catch(e) {
        console.error(e);
    }
}


/**
 * FETCH: ABOUT
 */
window.fetchAbout = async function() {
    const contentDiv = document.getElementById('about-content');
    const qrDiv = document.getElementById('qr-container');
    const contactDiv = document.getElementById('contact-list');

    const QUERY = encodeURIComponent(`*[_type == "aboutPage"][0]{
        bio,
        "qrUrl": qrCode.asset->url,
        contactInfo
    }`);

    try {
        const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${QUERY}`);
        const data = await res.json();
        const doc = data.result;

        if(!doc) return;

        contentDiv.innerHTML = `<div class="prose prose-invert prose-lg font-light text-zinc-300">${renderPortableText(doc.bio)}</div>`;
        
        if(doc.qrUrl) {
            qrDiv.innerHTML = `<img src="${doc.qrUrl}" class="w-full h-full object-contain mix-blend-multiply">`;
        }

        if(doc.contactInfo) {
            contactDiv.innerHTML = doc.contactInfo.map(c => `
                <div>
                    <span class="block text-[9px] uppercase tracking-widest text-zinc-500">${c.label}</span>
                    <span class="text-lg font-light text-white">${c.value}</span>
                </div>
            `).join('');
        }

    } catch(e) { console.error(e); }
}


// --- UTILS ---
function renderPortableText(blocks) {
    if (!blocks || !Array.isArray(blocks)) return "";
    return blocks.map(block => {
        if (block._type === 'block') {
            const text = block.children ? block.children.map(c => c.text).join('') : '';
            if (!text.trim()) return '';
            if (block.style === 'h3') return `<h3 class="text-xl uppercase tracking-widest mt-8 mb-4 text-white">${text}</h3>`;
            return `<p class="mb-6 leading-relaxed">${text}</p>`;
        }
        if (block._type === 'image' && block.asset) {
            // Very basic image handling for portable text (would need asset URL resolution in real app)
            return `<div class="my-8 bg-zinc-900 p-2 text-center text-xs text-zinc-500">[Image Ref: ${block.asset._ref}]</div>`;
        }
        return '';
    }).join('');
}
