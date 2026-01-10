const PROJECT_ID = "gi6q4yr8";
const DATASET = "production";

let allProjects = [];
let allClients = [];
let allCategories = [];
let activeFilters = { client: "all", cat: "all" };

/* ================================
   INIT
================================ */
async function initArchive() {
    const status = document.getElementById("status-tag");

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
        const res = await fetch(API_URL);
        const json = await res.json();

        if (!json.result) throw new Error("No data");

        allProjects = json.result.projects || [];
        allClients = json.result.clients || [];
        allCategories = json.result.categories || [];

        renderFilters();
        applyFilters();

        if (status) {
            status.innerText = "Synchronized";
            status.style.color = "#22c55e";
        }
    } catch (err) {
        console.error("Archive Sync Error:", err);
        if (status) {
            status.innerText = "Offline";
            status.style.color = "#ef4444";
        }
    }
}

/* ================================
   YOUTUBE HELPERS
================================ */
function getYouTubeID(url) {
    if (!url) return null;

    if (url.includes("/shorts/")) {
        return url.split("/shorts/")[1]?.split(/[?#/]/)[0] || null;
    }

    const match = url.match(
        /^.*((youtu.be\/)|(v\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    );

    return match && match[7]?.length === 11 ? match[7] : null;
}

/* ================================
   GRID RENDER
================================ */
function renderGrid(projects) {
    const grid = document.getElementById("portfolio-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const density = document.getElementById("grid-select")?.value || 12;
    grid.style.gridTemplateColumns = `repeat(${density}, minmax(0, 1fr))`;

    projects.forEach(project => {
        const ytId = getYouTubeID(project.videoUrl);

        let thumbSrc =
            project.thumbnail?.url ||
            (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

        if (!thumbSrc) {
            thumbSrc =
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        }

        const card = document.createElement("div");
        card.className =
            "project-card relative aspect-square cursor-pointer bg-zinc-900 overflow-hidden group";

        card.onclick = () => openModal(project.videoUrl);

        card.innerHTML = `
            <img
                src="${thumbSrc}"
                loading="lazy"
                decoding="async"
                class="w-full h-full object-cover grayscale brightness-50 
                       group-hover:grayscale-0 group-hover:brightness-100 
                       transition-all duration-500"
                onerror="handleImageError(this, '${ytId || ""}')"
            />
            <div class="absolute inset-0 flex flex-col justify-end p-2 opacity-0 
                        group-hover:opacity-100 bg-gradient-to-t 
                        from-black/80 to-transparent transition-opacity">
                <h3 class="text-[8px] uppercase tracking-tighter text-white">
                    ${project.title || ""}
                </h3>
            </div>
        `;

        grid.appendChild(card);
    });
}

/* ================================
   IMAGE FAILOVER
================================ */
function handleImageError(img, ytId) {
    if (!ytId) return;

    if (!img.src.includes("youtube.com")) {
        img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (img.src.includes("hqdefault")) {
        img.src = `https://img.youtube.com/vi/${ytId}/0.jpg`;
    }
}

/* ================================
   FILTER UI (UNCHANGED)
================================ */
function renderFilters() {
    const clientRow = document.getElementById("client-row");
    const catRow = document.getElementById("category-row");

    if (clientRow) {
        clientRow.innerHTML =
            `<span class="text-zinc-800 pr-2">Client //</span>
             <button onclick="setFilter('client','all')" 
                     class="tag-btn client-link active-client">All</button>` +
            allClients
                .map(
                    c =>
                        `<button onclick="setFilter('client','${c.slug.current}')" 
                                 class="tag-btn client-link">${c.title}</button>`
                )
                .join("");
    }

    if (catRow) {
        catRow.innerHTML =
            `<span class="text-zinc-800 pr-2">Genre //</span>
             <button onclick="setFilter('cat','all')" 
                     class="tag-btn cat-link active-cat">All</button>` +
            allCategories
                .map(
                    c =>
                        `<button onclick="setFilter('cat','${c.slug.current}')" 
                                 class="tag-btn cat-link hover:text-amber-500">
                            ${c.title}
                         </button>`
                )
                .join("");
    }
}

function setFilter(type, value) {
    activeFilters[type] = value;

    document.querySelectorAll(`.${type}-link`).forEach(btn => {
        btn.classList.toggle(
            type === "client" ? "active-client" : "active-cat",
            btn.getAttribute("onclick")?.includes(`'${value}'`)
        );
    });

    applyFilters();
}

function applyFilters() {
    let filtered = allProjects;

    if (activeFilters.client !== "all") {
        filtered = filtered.filter(
            p => p.clientSlug === activeFilters.client
        );
    }

    if (activeFilters.cat !== "all") {
        filtered = filtered.filter(
            p =>
                p.categorySlugs &&
                p.categorySlugs.includes(activeFilters.cat)
        );
    }

    renderGrid(filtered);
}

/* ================================
   BOOT
================================ */
window.addEventListener("load", initArchive);
