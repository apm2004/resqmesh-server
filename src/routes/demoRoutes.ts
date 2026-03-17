/**
 * demoRoutes.ts
 *
 * Replaces Reddit polling entirely — Reddit blocks all unauthenticated requests (403).
 *
 * Routes:
 *   GET  /api/demo/post-form        → Simple HTML form to submit alerts from any browser
 *   POST /api/demo/post             → Submit a custom alert (title, location, message, urgency)
 *   POST /api/demo/trigger          → Auto-fire next rotating scenario (for quick demos)
 */

import { Router, Request, Response } from 'express';
import { io } from '../server';
import RedditAlert from '../models/RedditAlert';

const router = Router();

// ── Urgency / alertType mapping ───────────────────────────────────────────────
const URGENCY_TYPE: Record<string, string> = {
    MEDICAL: 'Medical', RESCUE: 'Rescue',
    FOOD:    'Food & Water', TRAPPED: 'Trapped',
    GENERAL: 'General',
};

// ── Helper ─────────────────────────────────────────────────────────────────────
async function saveAndBroadcast(data: {
    title: string; location: string; message: string;
    urgency: string; username?: string;
}) {
    const { title, location, message, urgency, username = 'resqmesh_user' } = data;
    const now     = Date.now();
    const id      = `post_${now}`;
    const aType   = URGENCY_TYPE[urgency] ?? 'General';
    // simple geocode stub — India centre; good enough for demo
    const lat = 20.5937, lng = 78.9629;
    const coords = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

    const alert = {
        redditId:      id,
        urgency,
        sourceDetails: 'r/ResQMesh',
        title:         title.trim(),
        time:          'just now',
        location:      location.trim() || 'Unknown Location',
        lat, lng,
        need:          aType,
        fullMessage:   message.trim() || title.trim(),
        userId:        `u/${username}`,
        alertType:     aType,
        message:       (message.trim() || title.trim()).slice(0, 200),
        coordinates:   coords,
        createdAt:     now,
    };

    await RedditAlert.create(alert);
    io.emit('new_reddit_alert', { id: `REDDIT-${id}`, source: 'social', ...alert });
    console.log(`[Demo] ✅ New alert posted → "${title}" [${urgency}]`);
    return alert;
}

// ── GET /api/demo/post-form — browser-friendly submission form ─────────────────
router.get('/post-form', (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ResQMesh — Submit Alert</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f1a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid #2d2d4e;
      border-radius: 16px;
      padding: 2rem;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; }
    .logo span { font-size: 1.4rem; font-weight: 700; color: #f97316; }
    .logo small { font-size: 0.8rem; color: #64748b; display: block; }
    label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.3rem; font-weight: 500; }
    input, textarea, select {
      width: 100%; padding: 0.7rem 1rem;
      background: #0f0f1a; border: 1px solid #2d2d4e;
      border-radius: 8px; color: #e2e8f0;
      font-size: 0.95rem; margin-bottom: 1rem;
      transition: border-color 0.2s;
      font-family: inherit;
    }
    input:focus, textarea:focus, select:focus {
      outline: none; border-color: #f97316;
    }
    textarea { resize: vertical; min-height: 80px; }
    button {
      width: 100%; padding: 0.85rem;
      background: #f97316; color: #fff;
      border: none; border-radius: 8px;
      font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #ea6c0a; }
    button:disabled { background: #555; cursor: not-allowed; }
    #status {
      margin-top: 1rem; padding: 0.75rem 1rem;
      border-radius: 8px; font-size: 0.9rem;
      display: none;
    }
    #status.ok  { background: #052e16; border: 1px solid #16a34a; color: #4ade80; }
    #status.err { background: #2d0a0a; border: 1px solid #dc2626; color: #f87171; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div>
        <span>🚨 ResQMesh</span>
        <small>Submit a live disaster alert</small>
      </div>
    </div>
    <form id="form">
      <label for="title">Alert Title *</label>
      <input id="title" name="title" placeholder="e.g. Building collapse in Andheri, Mumbai" required>

      <label for="urgency">Category / Urgency *</label>
      <select id="urgency" name="urgency">
        <option value="MEDICAL">🔴 Medical Emergency</option>
        <option value="RESCUE">🟠 Rescue Needed</option>
        <option value="FOOD">🟡 Food & Water</option>
        <option value="TRAPPED">🔴 People Trapped</option>
        <option value="GENERAL">🔵 General Alert</option>
      </select>

      <label for="location">Location</label>
      <input id="location" name="location" placeholder="e.g. Koramangala, Bangalore">

      <label for="message">Description</label>
      <textarea id="message" name="message" placeholder="Describe the situation in detail…"></textarea>

      <label for="username">Your Name / Reddit Username</label>
      <input id="username" name="username" placeholder="e.g. relief_volunteer_raj">

      <button type="submit" id="btn">🚨 Submit Alert</button>
    </form>
    <div id="status"></div>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const status = document.getElementById('status');
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      status.style.display = 'none';

      const body = {
        title:    document.getElementById('title').value,
        urgency:  document.getElementById('urgency').value,
        location: document.getElementById('location').value,
        message:  document.getElementById('message').value,
        username: document.getElementById('username').value || 'resqmesh_user',
      };

      try {
        const res = await fetch('/api/demo/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          status.className = 'ok';
          status.textContent = '✅ Alert submitted! It should appear on the dashboard in seconds.';
          document.getElementById('form').reset();
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        status.className = 'err';
        status.textContent = '❌ Error: ' + err.message;
      } finally {
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '🚨 Submit Alert';
      }
    });
  </script>
</body>
</html>`);
});

// ── POST /api/demo/post — submit a custom alert ────────────────────────────────
router.post('/post', async (req: Request, res: Response) => {
    try {
        const { title, location, message, urgency = 'GENERAL', username } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        const alert = await saveAndBroadcast({ title, location: location ?? '', message: message ?? '', urgency, username });
        res.json({ ok: true, alert });
    } catch (err) {
        console.error('[Demo] Post error:', err);
        res.status(500).json({ error: 'Failed to save alert' });
    }
});

// ── POST /api/demo/trigger — rotating scenario for quick demos ─────────────────
const SCENARIOS = [
    { urgency: 'MEDICAL', title: 'SOS: Person with chest pain, no ambulance reachable in Dharavi', location: 'Dharavi, Mumbai', message: 'Critical: Severe chest pain reported in Dharavi. Roads waterlogged. No ambulance available.' },
    { urgency: 'RESCUE',  title: 'Family of 5 trapped on rooftop — water still rising in Saidapet', location: 'Saidapet, Chennai', message: 'Family of 5 including 2 children trapped on rooftop. Water still rising. Rescue boat needed.' },
    { urgency: 'FOOD',    title: 'Cyclone shelter running out of food — 300 people, Puri, Odisha', location: 'Puri, Odisha', message: '300+ cyclone survivors. Food stocks fully depleted. Need supplies before nightfall.' },
    { urgency: 'MEDICAL', title: 'Pregnant woman in labour, hospital road blocked by flooding — Patna', location: 'Patna, Bihar', message: 'Pregnant woman in active labour. All routes flooded. Urgent evacuation needed.' },
    { urgency: 'RESCUE',  title: '6 trekkers stranded on flooded trail — Hampta Pass, Manali', location: 'Manali, HP', message: '6 trekkers cut off by flash flood on Hampta Pass. Helicopter rescue requested.' },
];
let idx = 0;

router.post('/trigger', async (req: Request, res: Response) => {
    try {
        const s = SCENARIOS[idx % SCENARIOS.length]; idx++;
        const alert = await saveAndBroadcast(s);
        res.json({ ok: true, alert });
    } catch (err) {
        res.status(500).json({ error: 'Failed to trigger' });
    }
});

export default router;
