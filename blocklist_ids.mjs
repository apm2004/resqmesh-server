/**
 * blocklist_ids.mjs
 * Run once to permanently blocklist the 3 problem Reddit post IDs.
 * Usage: node blocklist_ids.mjs
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('No MONGO_URI in .env'); process.exit(1); }

// ── Schemas (inline, no TS needed) ──────────────────────────────────────────
const DeletedRedditIdSchema = new mongoose.Schema({
    redditId:  { type: String, required: true, unique: true, index: true },
    deletedAt: { type: Date, default: Date.now },
});
const RedditAlertSchema = new mongoose.Schema({}, { strict: false });

const DeletedRedditId = mongoose.model('DeletedRedditId', DeletedRedditIdSchema);
const RedditAlert     = mongoose.model('RedditAlert',     RedditAlertSchema);

// ── IDs to permanently block ─────────────────────────────────────────────────
const IDS_TO_BLOCK = ['1rvj73h', '1rvj2fk', '1rviyq1'];

await mongoose.connect(MONGO_URI);
console.log('Connected to MongoDB');

for (const redditId of IDS_TO_BLOCK) {
    // 1. Add to blocklist collection
    await DeletedRedditId.updateOne({ redditId }, { redditId }, { upsert: true });
    // 2. Remove from active alerts
    const result = await RedditAlert.deleteOne({ redditId });
    console.log(`✅ Blocklisted ${redditId} | removed from alerts: ${result.deletedCount}`);
}

await mongoose.disconnect();
console.log('Done — these 3 posts will never re-appear.');
