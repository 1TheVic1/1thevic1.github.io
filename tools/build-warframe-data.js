// Builds scripts/warframe_data.js for the Warframe page.
//
// Sources:
//   - Item totals: every `masterable` item in the WFCD warframe-items data (data/json).
//   - Mastered per category: Warframe's public profile ("View Profile" data, XP per item),
//     only fetched when run with --profile (the weekly GitHub job does this). An item counts as
//     mastered once its XP reaches its max rank: 1000 x rank^2 for Warframes, companions, archwings,
//     necramechs and K-drives; 500 x rank^2 for weapons (warframe.wiki "Affinity" > Level Requirements).
//     Max rank is the item's maxLevelCap (40 for Kuva/Tenet/Coda/Paracesis) or 30.
//   - Mastery Rank, progress to next rank, Platinum, Credits, Endo: AlecaFrame public stats API.
//
// Credentials (never written to the site):
//   - GitHub job: env ALECAFRAME_PUBLIC_TOKEN and WARFRAME_ACCOUNT_ID (repository secrets).
//   - On the PC: read from the vault secrets note named in tools/local-paths.json.
//
// Usage (from the site folder):
//   node tools/build-warframe-data.js                     AlecaFrame only; keeps the last mastered counts
//   node tools/build-warframe-data.js --profile           also fetch the Warframe profile (ONE request)
//   node tools/build-warframe-data.js --profile-file=x    use a saved profile JSON instead of fetching
// Env ITEMS_DIR overrides where the WFCD data/json files are read from.
//
// If a source fails, its previous values in scripts/warframe_data.js are kept, so a bad run never
// wipes the page.
const fs = require('fs');
const path = require('path');

// Local paths (PC only) live in tools/local-paths.json, which is never uploaded:
//   { "itemsDir": "<WFCD data/json folder>", "secretsFile": "<vault API Keys note>" }
let LOCAL = {};
try { LOCAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'local-paths.json'), 'utf8')); } catch (e) { /* not on this machine */ }
const ITEMS_DIR = process.env.ITEMS_DIR || LOCAL.itemsDir;
const SECRETS = LOCAL.secretsFile; // PC only
if (!ITEMS_DIR) { console.error('Set ITEMS_DIR or create tools/local-paths.json'); process.exit(1); }
const OUT = path.join(__dirname, '..', 'scripts', 'warframe_data.js');
const PROFILE_URL = 'https://api.warframe.com/cdn/getProfileViewingData.php?playerId=';

const args = process.argv.slice(2);
const wantProfile = args.includes('--profile');
const profileFileArg = args.find((a) => a.startsWith('--profile-file='));

// ---------- helpers ----------
const readItems = (f) => JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, f + '.json'), 'utf8')).filter((x) => x.masterable);

function readPrevious() {
    try {
        const txt = fs.readFileSync(OUT, 'utf8');
        return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    } catch (e) {
        return null;
    }
}

function secretFromVault(re) {
    if (!SECRETS) return null;
    try {
        const m = fs.readFileSync(SECRETS, 'utf8').replace(/\r\n/g, '\n').match(re);
        return m ? m[1].replace(/^[`'"]+|[`'"]+$/g, '') : null;
    } catch (e) {
        return null;
    }
}

const aleToken = () => process.env.ALECAFRAME_PUBLIC_TOKEN || secretFromVault(/^-\s*public\s*token\s*:\s*(\S+)/im);
const accountId = () => process.env.WARFRAME_ACCOUNT_ID || secretFromVault(/^-\s*account\s*id\s*:\s*(\S+)/im);

// ---------- item groups (same six groups as before) ----------
const FRAME = 1000, WEAPON = 500;
const tag = (items, mult) => items.map((x) => ({ uniqueName: x.uniqueName, mult, cap: x.maxLevelCap || 30 }));
const warframes = readItems('Warframes');
const misc = readItems('Misc');
const groups = [
    { name: 'Warframes', items: tag(warframes.filter((x) => x.type === 'Warframe'), FRAME) },
    { name: 'Primaries', items: tag(readItems('Primary'), WEAPON) },
    { name: 'Secondaries', items: tag(readItems('Secondary'), WEAPON) },
    { name: 'Melee', items: tag(readItems('Melee'), WEAPON) },
    { name: 'Companions', items: tag(readItems('Pets').concat(readItems('Sentinels')), FRAME) },
    {
        name: 'Other', // Necramechs, Archwings + their weapons, sentinel weapons, kitguns, K-drives
        items: tag(warframes.filter((x) => x.type !== 'Warframe'), FRAME)
            .concat(tag(readItems('Archwing'), FRAME))
            .concat(tag(misc.filter((x) => x.type === 'K-Drive Component'), FRAME))
            .concat(tag(misc.filter((x) => x.type !== 'K-Drive Component'), WEAPON))
            .concat(tag(readItems('Arch-Gun').concat(readItems('Arch-Melee'), readItems('SentinelWeapons')), WEAPON)),
    },
];

// ---------- sources ----------
async function readAlecaFrame() {
    const token = aleToken();
    if (!token) throw new Error('no AlecaFrame public token');
    const res = await fetch('https://stats.alecaframe.com/api/stats/public?token=' + encodeURIComponent(token));
    if (!res.ok) throw new Error('AlecaFrame API returned HTTP ' + res.status);
    const points = (await res.json()).generalDataPoints || [];
    if (!points.length) throw new Error('AlecaFrame returned no data points');
    const p = points.reduce((a, b) => (a.ts > b.ts ? a : b)); // latest
    return {
        date: p.ts.slice(0, 10),
        masteryRank: p.mr,
        completion: p.percentageCompletion, // progress to the next Mastery Rank
        platinum: p.plat,
        credits: p.credits,
        endo: p.endo,
    };
}

async function readProfileXp() {
    let data;
    if (profileFileArg) {
        data = JSON.parse(fs.readFileSync(profileFileArg.split('=').slice(1).join('='), 'utf8'));
    } else {
        const id = accountId();
        if (!id || !/^[0-9a-f]{24}$/i.test(id)) throw new Error('no valid 24-character account ID');
        const res = await fetch(PROFILE_URL + id, { headers: { 'User-Agent': 'TheVic_1 website (weekly)' } });
        if (!res.ok) throw new Error('Warframe profile returned HTTP ' + res.status);
        const text = await res.text();
        if (!text.trim()) throw new Error('Warframe profile returned an empty response (wrong ID or rate-limited)');
        data = JSON.parse(text);
    }
    const xpInfo = (((data.Results || [])[0] || {}).LoadOutInventory || {}).XPInfo;
    if (!Array.isArray(xpInfo)) throw new Error('profile has no LoadOutInventory.XPInfo');
    return new Map(xpInfo.map((x) => [x.ItemType, x.XP]));
}

// ---------- build ----------
(async () => {
    const prev = readPrevious() || {};
    const prevMastered = new Map((prev.groups || []).map((g) => [g.name, g.mastered]));
    const notes = [];

    let af = prev.alecaframe || null;
    try {
        af = await readAlecaFrame();
    } catch (e) {
        notes.push('AlecaFrame failed, kept previous values: ' + e.message);
    }

    let xp = null;
    if (wantProfile || profileFileArg) {
        try {
            xp = await readProfileXp();
        } catch (e) {
            notes.push('Warframe profile failed, kept previous mastered counts: ' + e.message);
        }
    }

    const out = groups.map((g) => ({
        name: g.name,
        total: g.items.length,
        mastered: xp
            ? g.items.filter((it) => (xp.get(it.uniqueName) || 0) >= it.mult * it.cap * it.cap).length
            : (prevMastered.get(g.name) || 0),
    }));

    const mr = (af && af.masteryRank) || prev.masteryRank || 0;
    const data = {
        masteryRank: mr,
        rankName: mr > 30 ? 'Legendary ' + (mr - 30) : null,
        groups: out,
        alecaframe: af,
        profileDate: xp ? new Date().toISOString().slice(0, 10) : (prev.profileDate || null),
        updated: new Date().toISOString().slice(0, 10),
    };
    fs.writeFileSync(OUT, '// Generated by tools/build-warframe-data.js. Do not edit by hand.\nwindow.WF_DATA = ' + JSON.stringify(data, null, 4) + ';\n');
    notes.forEach((n) => console.warn(n));
    console.log(JSON.stringify({ masteryRank: data.masteryRank, groups: out, alecaframeDate: af && af.date, profileDate: data.profileDate }));
    if (!af && !xp) process.exit(1);
})();
