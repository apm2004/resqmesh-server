/**
 * redditService.ts
 *
 * Polls r/ResQMesh via the PUBLIC RSS FEED — no OAuth, no API keys needed.
 * Geocodes new posts via Nominatim, persists to MongoDB, broadcasts via Socket.IO.
 * Called once from server.ts after DB is ready.
 */

import { Server } from 'socket.io';
import RedditAlert from '../models/RedditAlert';
import DeletedRedditId from '../models/DeletedRedditId';

// ── Config ────────────────────────────────────────────────────────────────────
const SUBREDDIT     = 'ResQMesh';
// old.reddit.com + browser UA bypasses the 403 that www.reddit.com returns
const REDDIT_URL    = `https://old.reddit.com/r/${SUBREDDIT}/new.json?limit=25`;
const POLL_INTERVAL = 10_000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Must look like a real browser — old.reddit.com checks User-Agent
const USER_AGENT    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DEFAULT_COORDS = { lat: 20.5937, lng: 78.9629 }; // centre of India

// ── Geocode cache ─────────────────────────────────────────────────────────────
const geocodeCache = new Map<string, { lat: number; lng: number }>();

async function geocode(query: string): Promise<{ lat: number; lng: number }> {
    const key = query.toLowerCase().trim();
    if (geocodeCache.has(key)) return geocodeCache.get(key)!;
    try {
        const url = `${NOMINATIM_URL}?q=${encodeURIComponent(key)}&format=json&limit=1`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5_000);
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data: { lat: string; lon: string }[] = await res.json();
            if (data.length) {
                const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                geocodeCache.set(key, coords);
                return coords;
            }
        }
    } catch { /* non-fatal */ }
    geocodeCache.set(key, DEFAULT_COORDS);
    return DEFAULT_COORDS;
}

// ── NLP helpers ───────────────────────────────────────────────────────────────
const criticalKw = ['trapped','collapse','collapsed','sos','mayday','explosion',
    'gas leak','casualties','critical','urgent rescue','people died',
    'power outage','grid failure','missing','buried','fire spreading'];
const rescueKw   = ['stranded','stuck','flooded','flood','need rescue','cut off',
    'no electricity','road blocked','shelter needed','displaced',
    'evacuating','injured','ambulance','rescue','help needed'];
const alertTypeKw: Record<string,string[]> = {
    Fire:    ['fire','smoke','burning','gas leak','explosion','blaze'],
    Flood:   ['flood','flooding','water rising','submerged','drainage','rain'],
    Medical: ['injured','medical','hospital','ambulance','trauma','unconscious','bleeding'],
    Rescue:  ['trapped','stranded','rescue','collapsed','buried','missing'],
};
const FLAIR_MAP: Record<string,string> = {
    'medical':'MEDICAL','rescue':'RESCUE','food':'FOOD','trapped':'TRAPPED',
    'general':'GENERAL','other':'OTHER','critical':'MEDICAL',
    'food & water':'FOOD','food and water':'FOOD',
};
const FLAIR_LABEL: Record<string,string> = {
    MEDICAL:'Medical',RESCUE:'Rescue',FOOD:'Food & Water',
    TRAPPED:'Trapped',GENERAL:'General',OTHER:'Other',
};

function resolveUrgency(text: string, flair: string) {
    const fk = flair.trim().toLowerCase();
    if (fk && FLAIR_MAP[fk]) {
        const urgency = FLAIR_MAP[fk];
        return { urgency, alertType: FLAIR_LABEL[urgency] ?? flair, sourcedFromFlair: true };
    }
    const l = text.toLowerCase();
    let urgency = 'GENERAL';
    if (criticalKw.some(k => l.includes(k))) urgency = 'MEDICAL';
    else if (rescueKw.some(k => l.includes(k))) urgency = 'RESCUE';
    let alertType = 'Rescue';
    for (const [type, kws] of Object.entries(alertTypeKw))
        if (kws.some(k => l.includes(k))) { alertType = type; break; }
    return { urgency, alertType, sourcedFromFlair: false };
}

function extractLocation(text: string): string | null {
    const m1 = text.match(/location\s*[:\-]\s*([^\n,\.]{2,60})/i);
    if (m1) return m1[1].trim();
    const m2 = text.match(/(?:in|at|near|from)\s+([A-Z][a-zA-Z\s]{2,40})(?:[,\.\n]|$)/);
    if (m2) return m2[1].trim();
    return null;
}

function confidence(text: string, score: number): number {
    const l = text.toLowerCase();
    let c = 40;
    c += Math.min([...criticalKw,...rescueKw].filter(k => l.includes(k)).length * 10, 40);
    if (score > 10) c += 5;
    if (score > 50) c += 5;
    if (score > 100) c += 5;
    return Math.min(c, 97);
}

function timeAgo(utcSec: number): string {
    const min = Math.floor((Date.now() - utcSec * 1000) / 60_000);
    if (min < 1)  return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
}

// ── Post shape ────────────────────────────────────────────────────────────────
interface Post {
    id: string; title: string; body: string;
    author: string; created_utc: number; score: number; flair: string | null;
}

// ── Parse old.reddit.com JSON response ───────────────────────────────────────

function parseRedditJSON(json: unknown): Post[] {
    const children = (json as any)?.data?.children ?? [];
    return (children as any[]).map((c: any) => ({
        id:          c.data.id,
        title:       c.data.title ?? '',
        body:        c.data.selftext ?? '',
        author:      c.data.author ?? 'unknown',
        created_utc: c.data.created_utc ?? Math.floor(Date.now() / 1000),
        score:       c.data.score ?? 0,
        flair:       c.data.link_flair_text ?? null,
    }));
}


// ── Convert post → DB/socket shape ───────────────────────────────────────────
async function toAlert(p: Post) {
    const text = `${p.title} ${p.body}`;
    const { urgency, alertType, sourcedFromFlair } = resolveUrgency(text, p.flair ?? '');
    const conf    = confidence(text, p.score);
    const srcDet  = sourcedFromFlair ? `Flair: ${p.flair}` : `NLP: ${conf}%`;
    const locName = extractLocation(text);
    const { lat, lng } = locName ? await geocode(locName) : DEFAULT_COORDS;
    const coords = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
    return {
        redditId:      p.id,
        urgency,       sourceDetails: srcDet,
        title:         p.title.replace(/^\[.*?\]\s*/i, '').trim(),
        time:          timeAgo(p.created_utc),
        location:      locName ?? 'Unknown Location',
        lat,           lng,
        need:          alertType,
        fullMessage:   p.body || p.title,
        userId:        `u/${p.author}`,
        alertType,
        message:       (p.body || p.title).slice(0, 200),
        coordinates:   coords,
        createdAt:     p.created_utc * 1000,
    };
}

// ── Permanently-deleted blocklist ───────────────────────────────────────────
// redditIds manually deleted by the user — never re-insert these
const permanentlyDeleted = new Set<string>();

export async function markDeleted(redditId: string): Promise<void> {
    permanentlyDeleted.add(redditId);
    await DeletedRedditId.updateOne({ redditId }, { redditId }, { upsert: true });
}

async function loadDeletedIds(): Promise<void> {
    const docs = await DeletedRedditId.find({}).select('redditId').lean();
    docs.forEach(d => permanentlyDeleted.add(d.redditId));
    console.log(`[RedditService] Loaded ${permanentlyDeleted.size} permanently-deleted IDs into blocklist`);
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
let pollCount = 0;
async function poll(io: Server): Promise<void> {
    pollCount++;
    const cycle = `[Poll #${pollCount}]`;
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10_000);
        const res = await fetch(REDDIT_URL, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept':     'application/json',
            },
            signal: ctrl.signal,
        });
        clearTimeout(t);

        if (!res.ok) {
            console.warn(`[RedditService]${cycle} Reddit returned HTTP ${res.status} — skipping`);
            return;
        }

        const posts = parseRedditJSON(await res.json());
        console.log(`[RedditService]${cycle} Fetched ${posts.length} posts from Reddit`);
        if (!posts.length) return;

        // Dedup against DB — also skip permanently-deleted posts
        const ids   = posts.map(p => p.id);
        const exist = await RedditAlert.find({ redditId: { $in: ids } }).select('redditId').lean();
        const seen  = new Set(exist.map(d => d.redditId));
        const fresh = posts.filter(p => !seen.has(p.id) && !permanentlyDeleted.has(p.id));
        console.log(`[RedditService]${cycle} In DB already: ${exist.length} | Fresh/new: ${fresh.length}`);

        if (!fresh.length) {
            console.log(`[RedditService]${cycle} No new posts — nothing to save`);
            return;
        }

        console.log(`[RedditService]${cycle} Saving ${fresh.length} new post(s)…`);
        const alerts = await Promise.all(fresh.map(toAlert));

        try {
            await RedditAlert.insertMany(alerts, { ordered: false });
            console.log(`[RedditService]${cycle} Saved to DB successfully`);
        } catch (insertErr: any) {
            console.warn(`[RedditService]${cycle} insertMany warning:`, insertErr.message);
        }

        for (const a of alerts) {
            io.emit('new_reddit_alert', { id: `REDDIT-${a.redditId}`, source: 'social', ...a });
            console.log(`[RedditService]${cycle} emitted: "${a.title}"`);
        }
    } catch (err) {
        console.error(`[RedditService]${cycle} Error:`, err);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function startRedditPoller(io: Server): Promise<void> {
    await loadDeletedIds();   // ← load blocklist BEFORE first poll
    console.log(`[RedditService] Polling r/${SUBREDDIT} every ${POLL_INTERVAL / 1000}s`);
    poll(io);
    setInterval(() => poll(io), POLL_INTERVAL);
}

