// Reads the public Google Drive portfolio folder (no API key) via Drive's embedded folder view.
// Shared by scripts/sync-drive.mjs (hourly snapshot) and netlify/functions/drive-work.mjs (live API).
export const ROOT = "1fooEe5ArRjdA7RegVuvokmxkLJLbi41o";
export const LOOSE_NAME = "New Uploads"; // videos dropped straight into the root folder
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const decode = s => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export const iso = d => d.toISOString().slice(0, 10);

// "10:32 AM" (today), "Jul 14" (this year), "Jul 14, 2025"
function parseDate(s, now) {
    s = s.trim();
    if (/^\d{1,2}:\d{2}/.test(s)) return iso(now);
    const m = s.match(/^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?$/);
    if (!m || !(m[1] in MONTHS)) return null;
    let d = new Date(Date.UTC(m[3] ? +m[3] : now.getUTCFullYear(), MONTHS[m[1]], +m[2]));
    if (!m[3] && d > now) d.setUTCFullYear(d.getUTCFullYear() - 1);
    return iso(d);
}

export async function listFolder(id) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`);
        if (res.ok) {
            const html = await res.text();
            // one chunk per entry, so a field missing from one entry can't bleed into the next
            return html.split('<div class="flip-entry" id="entry-').slice(1).map(chunk => {
                const get = re => (chunk.match(re) || [])[1] || "";
                return {
                    id: get(/^([\w-]+)"/),
                    folder: /href="[^"]*\/drive\/folders\//.test(chunk),
                    icon: get(/flip-entry-list-icon"><img src="([^"]*)"/),
                    title: decode(get(/flip-entry-title">([^<]*)</)),
                    modified: get(/flip-entry-last-modified"><div>([^<]*)</)
                };
            }).filter(e => e.id);
        }
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    throw new Error("Could not list folder " + id);
}

const isVideo = e => !e.folder && (e.icon.includes("/type/video/") || VIDEO_EXT.test(e.title));
const toItem = (e, tag, now) => ({ id: e.id, title: e.title.replace(VIDEO_EXT, "").replace(/^Copy of /i, "").replace(/_/g, " ").trim(), tag, date: parseDate(e.modified, now) });

// All videos under a folder, subfolders included (listed in parallel); tag = name of the subfolder it sits in
export async function walk(id, tag, now) {
    const entries = await listFolder(id);
    const nested = await Promise.all(entries.filter(e => e.folder).map(e => walk(e.id, e.title, now)));
    return entries.filter(isVideo).map(e => toItem(e, tag, now)).concat(nested.flat());
}

export const titleCase = s => s.toLowerCase().replace(/(^|[\s+/-])(\w)/g, (a, b, c) => b + c.toUpperCase()).replace(/\b(Ai|3d|Cgi|Ugc)\b/g, w => w.toUpperCase());

// Root listing: { folders: [{id, title}], loose: [videos directly in the root] }
export async function listRoot(now) {
    const entries = await listFolder(ROOT);
    return { folders: entries.filter(e => e.folder), loose: entries.filter(isVideo).map(e => toItem(e, "", now)) };
}
