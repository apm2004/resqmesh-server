/**
 * seedDemoData.ts
 *
 * Pre-fills MongoDB with realistic disaster alerts for the presentation.
 * Run ONCE before the demo:
 *
 *   npx ts-node src/scripts/seedDemoData.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import RedditAlert from '../models/RedditAlert';

const now = Date.now();
const M = 60_000; // 1 minute in ms

const ALERTS = [
    {
        redditId: 'seed_001', urgency: 'MEDICAL', alertType: 'Medical',
        sourceDetails: 'Flair: Medical', need: 'Medical',
        title:    'Building collapse in Andheri West — 6 people trapped under debris',
        location: 'Andheri West, Mumbai', lat: 19.1369, lng: 72.8287,
        fullMessage: 'A 4-storey residential building collapsed near Lokhandwala at 2 AM. At least 6 people confirmed trapped. Ambulances on site but need more medical teams and heavy machinery. Location: Andheri West, Mumbai.',
        userId: 'u/mumbai_rescue', message: 'Building collapse, 6 trapped, Andheri West Mumbai. Ambulances on site.', time: '3 min ago', createdAt: now - 3 * M,
        coordinates: '19.1369° N, 72.8287° E',
    },
    {
        redditId: 'seed_002', urgency: 'RESCUE', alertType: 'Rescue',
        sourceDetails: 'Flair: Rescue', need: 'Rescue',
        title:    'Flash flood in Koramangala — 15 families stranded on rooftops',
        location: 'Koramangala, Bangalore', lat: 12.9279, lng: 77.6271,
        fullMessage: 'Overnight heavy rain caused severe flooding in Koramangala. 15–20 families stuck on rooftops. Water still rising. No evacuation route. Need rescue boats urgently.',
        userId: 'u/blr_crisis', message: '15 families on rooftops in Koramangala. Flood water rising. Need rescue boats now.', time: '11 min ago', createdAt: now - 11 * M,
        coordinates: '12.9279° N, 77.6271° E',
    },
    {
        redditId: 'seed_003', urgency: 'FOOD', alertType: 'Food & Water',
        sourceDetails: 'Flair: Food & Water', need: 'Food & Water',
        title:    'Velankanni relief camp running critically low on food — 400+ displaced',
        location: 'Velankanni, Tamil Nadu', lat: 10.6866, lng: 79.8550,
        fullMessage: 'Cyclone relief camp near Velankanni Church has 400+ displaced people. Food will run out tonight. Need food packets, drinking water, dry rations, and baby food urgently.',
        userId: 'u/tn_relief', message: '400+ at Velankanni camp. Food runs out tonight. Need supplies urgently.', time: '28 min ago', createdAt: now - 28 * M,
        coordinates: '10.6866° N, 79.8550° E',
    },
    {
        redditId: 'seed_004', urgency: 'TRAPPED', alertType: 'Rescue',
        sourceDetails: 'NLP: 88%', need: 'Rescue',
        title:    'Elderly woman with heart condition trapped after Munnar landslide',
        location: 'Munnar, Kerala', lat: 10.0892, lng: 77.0595,
        fullMessage: 'A 72-year-old woman is trapped inside her home after a landslide blocked the entrance in Munnar hills. Heart condition, medications running out. No mobile signal — neighbours raised the alarm in person.',
        userId: 'u/kerala_sos', message: 'Elderly woman with heart condition trapped by landslide in Munnar. Medications running out.', time: '45 min ago', createdAt: now - 45 * M,
        coordinates: '10.0892° N, 77.0595° E',
    },
    {
        redditId: 'seed_005', urgency: 'MEDICAL', alertType: 'Medical',
        sourceDetails: 'NLP: 76%', need: 'Medical',
        title:    'Gas leak in Manali Industrial Area — 4 workers unconscious',
        location: 'Manali Industrial Area, Chennai', lat: 13.1630, lng: 80.2601,
        fullMessage: 'Gas leak from a chemical storage tank in Manali industrial area. 4 workers unconscious, many showing symptoms. Fire brigade en route. Need hazmat-trained medical response immediately.',
        userId: 'u/chennai_hazmat', message: 'Gas leak in Manali Chennai. 4 unconscious. Hazmat medical team needed.', time: '1 hr ago', createdAt: now - 60 * M,
        coordinates: '13.1630° N, 80.2601° E',
    },
    {
        redditId: 'seed_006', urgency: 'RESCUE', alertType: 'Rescue',
        sourceDetails: 'Flair: Rescue', need: 'Rescue',
        title:    '8 fishermen missing after boat capsized off Rameswaram coast',
        location: 'Rameswaram, Tamil Nadu', lat: 9.2881, lng: 79.3129,
        fullMessage: 'Fishing boat capsized 4 km off Rameswaram coast due to high waves. 11 aboard — 3 rescued, 8 still missing. Coast Guard alerted. More search boats needed immediately.',
        userId: 'u/tn_coast', message: '8 fishermen missing off Rameswaram. 3 rescued so far. More search boats needed.', time: '2 hr ago', createdAt: now - 2 * 60 * M,
        coordinates: '9.2881° N, 79.3129° E',
    },
    {
        redditId: 'seed_007', urgency: 'GENERAL', alertType: 'Rescue',
        sourceDetails: 'Flair: General', need: 'Rescue',
        title:    'NH-16 blocked by fallen trees near Vizag — ambulance stranded with critical patient',
        location: 'Visakhapatnam, Andhra Pradesh', lat: 17.6868, lng: 83.2185,
        fullMessage: 'NH-16 near Vizag is blocked by 3 fallen trees. 30+ vehicles stranded including an ambulance carrying a critical patient. Road clearance needed urgently.',
        userId: 'u/ap_highway', message: 'NH-16 blocked near Vizag. Ambulance with critical patient stranded. Need road clearance.', time: '3 hr ago', createdAt: now - 3 * 60 * M,
        coordinates: '17.6868° N, 83.2185° E',
    },
    {
        redditId: 'seed_008', urgency: 'FOOD', alertType: 'Food & Water',
        sourceDetails: 'NLP: 62%', need: 'Food & Water',
        title:    'Flood survivors without clean drinking water for 2 days — Rajahmundry',
        location: 'Rajahmundry, Andhra Pradesh', lat: 17.0005, lng: 81.8040,
        fullMessage: '200+ flood survivors at Rajahmundry municipal school have had no clean water for 2 days. Children falling ill. ORS packets, water purification tablets, and bottled water needed urgently.',
        userId: 'u/godavari_watch', message: '200+ flood survivors no clean water for 2 days. Children sick. ORS and water tablets needed.', time: '5 hr ago', createdAt: now - 5 * 60 * M,
        coordinates: '17.0005° N, 81.8040° E',
    },
];

async function main() {
    if (!process.env.MONGO_URI) {
        console.error('❌  MONGO_URI not in .env'); process.exit(1);
    }
    console.log('🔌 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected');

    const existIds = new Set(
        (await RedditAlert
            .find({ redditId: { $in: ALERTS.map(a => a.redditId) } })
            .select('redditId').lean()
        ).map(d => d.redditId)
    );

    const fresh = ALERTS.filter(a => !existIds.has(a.redditId));

    if (!fresh.length) {
        console.log('ℹ️  Demo data already in DB — nothing inserted.');
    } else {
        await RedditAlert.insertMany(fresh, { ordered: false });
        console.log(`✅ Inserted ${fresh.length} demo alert(s)`);
    }

    await mongoose.disconnect();
    console.log('🎉 Dashboard is ready for your presentation!');
}

main().catch(e => { console.error(e); process.exit(1); });
