// Live view of the Google Drive portfolio folder: GET /api/drive-work
// Returns the same shape as window.WORK_DATA, so uploads and deletions in Drive show on the site
// within about a minute without a redeploy. Items whose date Drive doesn't show come back with date null.
import { ROOT, LOOSE_NAME, walk, listRoot, titleCase } from "../../scripts/drive-list.mjs";

export default async () => {
    const now = new Date();
    try {
        const { folders, loose } = await listRoot(now);
        if (!folders.length && !loose.length) throw new Error("empty root listing");
        const cats = await Promise.all(folders.map(async f => ({ f, items: await walk(f.id, "", now) })));
        if (loose.length) cats.push({ f: { id: ROOT, title: LOOSE_NAME }, items: loose });
        const data = cats.map(({ f, items }) => ({
            name: titleCase(f.title),
            folder: f.id,
            items: items
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .map(it => [it.title, it.id, it.tag && it.tag !== f.title ? it.tag : "", it.date])
        }));
        return Response.json(data, { headers: {
            "Cache-Control": "public, max-age=0, must-revalidate",
            "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
        } });
    } catch (e) {
        return Response.json({ error: String(e.message || e) }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
};

export const config = { path: "/api/drive-work" };
