const PROJECT_ID = "gi6q4yr8"; 
const DATASET = "production"; // Change to "hiveoptic_dataset" if that's your actual dataset

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: 'all', cat: 'all' };
let currentView = 'grid';

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
        
        console.log("=== FULL API RESPONSE ===");
        console.log(JSON.stringify(data.result, null, 2));

        if (!data.result) throw new Error("No result in response");

        allProjects = data.result.projects || [];
        allClients = data.result.clients || [];
        allCategories = data.result.categories || [];

        // Debug: Log first project in detail
        if (allProjects.length > 0) {
            console.log("=== FIRST PROJECT DETAILS ===");
            console.log("Title:", allProjects[0].title);
            console.log("Video URL:", allProjects[0].videoUrl);
            console.log("Sanity Thumb URL:", allProjects[0].sanityThumbUrl);
            console.log("Sanity Asset Ref:", allProjects[0].sanityAssetRef);
            console.log("All fields:", Object.keys(allProjects[0]));
        }

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
    if (!url) {
        console.log('getYouTubeID: No URL provided');
        return null;
    }
    
    console.log('getYouTubeID: Processing URL:', url);
    
    let id = null;
    
    // Handle youtube.com/shorts/ format
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
        console.log('Detected shorts format, ID:', id);
        return id;
    }
    
    // Handle youtu.be/ format
    if (url.includes('youtu.be/')) {
        const parts = url.split('youtu.be/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
        console.log('Detected youtu.be format, ID:', id);
        return id;
    }
    
    // Handle youtube.com/watch?v= format
    if (url.includes('youtube.com/watch')) {
        try {
            const urlObj = new URL(url);
            id = urlObj.searchParams.get('v');
            console.log('Detected watch format, ID:', id);
            return id;
        } catch (e) {
            console.error('Error parsing watch URL:', e);
        }
    }
    
    // Handle youtube.com/embed/ format
    if (url.includes('/embed/')) {
        const parts = url.split('/embed/');
        id = parts[1] ? parts[1].split(/[?#\/]/)[0] : null;
        console.log('Detected embed format, ID:', id);
        return id;
    }
    
    // Fallback to regex
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    id = (match && match[7] && match[7].length === 11) ? match[7] : null;
    console.log('Regex fallback, ID:', id);
    
    return id;
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
    console.log('=== IMAGE ERROR ===');
    console.log('Failed src:', img.src);
    console.log('YouTube ID passed:', ytId);
    console.log('Video URL passed:', videoUrl);
    
    if (!ytId) {
        ytId = getYouTubeID(videoUrl);
        console.log('Re-extracted YouTube ID:', ytId);
    }
    
    if (!ytId) {
        console.log('No YouTube ID available, using placeholder');
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Ctext x='50' y='50' text-anchor='middle' fill='white' font-size='12'%3ENo Video%3C/text%3E%3C/svg%3E";
        return;
    }
    
    // If the current source was from Sanity, try YouTube maxresdefault first
    if (!img.src.includes('youtube.com') && !img.src.includes('ytimg.com')) {
        const newSrc = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        console.log('Trying maxresdefault:', newSrc);
        img.src = newSrc;
    } 
    // If maxresdefault failed, try hqdefault
    else if (img.src.includes('maxresdefault')) {
        const newSrc = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        console.log('Trying hqdefault:', newSrc);
        img.src = newSrc;
    }
    // If hqdefault failed, try standard quality
    else if (img.src.includes('hqdefault')) {
        const newSrc = `https://img.youtube.com/vi/${ytId}/0.jpg`;
        console.log('Trying 0.jpg:', newSrc);
        img.src = newSrc;
    }
    // All YouTube options exhausted, use placeholder
    else {
        console.log('All options exhausted, using placeholder');
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Ctext x='50' y='50' text-anchor='middle' fill='white' font-size='12'%3ENo Thumb%3C/text%3E%3C/svg%3E";
    }
}

function renderGrid(data) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const density = document.getElementById('grid-select')?.value || 12;
    grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;

    console.log('=== RENDERING GRID ===');
    console.log('Projects to render:', data.length);

    data.forEach((p, index) => {
        console.log(`\n--- Project ${index + 1}: ${p.title} ---`);
        console.log('Raw videoUrl:', p.videoUrl);
        console.log('Sanity thumb URL:', p.sanityThumbUrl);
        console.log('Sanity asset ref:', p.sanityAssetRef);
        
        const ytId = getYouTubeID(p.videoUrl);
        console.log('Extracted YouTube ID:', ytId);
        
        // Priority order for thumbnails
        let thumbSrc = p.sanityThumbUrl || buildSanityUrl(p.sanityAssetRef);
        
        if (!thumbSrc && ytId) {
            thumbSrc = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
            console.log('Using YouTube thumbnail:', thumbSrc);
        }
        
        if (!thumbSrc) {
            thumbSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23666'/%3E%3Ctext x='50' y='50' text-anchor='middle' fill='white' font-size='10'%3ENo Source%3C/text%3E%3C/svg%3E";
            console.log('No thumbnail source available, using placeholder');
        } else {
            console.log('Final thumbnail source:', thumbSrc);
        }

        const div = document.createElement('div');
        div.className = "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden group";
        div.onclick = () => openModal(p.videoUrl);
        
        // Escape single quotes in video URL for inline handler
        const escapedVideoUrl = (p.videoUrl || '').replace(/'/g, "\\'");
        
        div.innerHTML = `
            <img src="${thumbSrc}" 
                 class="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500"
                 onerror="window.handleImageError(this, '${ytId || ''}', '${escapedVideoUrl}')">
            <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 to-transparent transition-opacity">
                <h3 class="text-[8px] uppercase tracking-tighter text-white">${p.title}</h3>
            </div>
        `;
        grid.appendChild(div);
    });
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
