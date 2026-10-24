#!/usr/bin/env node
/**
 * Builds the local demo photo seed (backend/src/main/resources/db/local/V906__demo_unsplash_photos.sql) from Unsplash.
 *
 *   node scripts/unsplash-demo-photos.mjs           search Unsplash and write the migration
 *   node scripts/unsplash-demo-photos.mjs --track   report photo usage to Unsplash (resumable, see below)
 *
 * Needs UNSPLASH_ACCESS_KEY (from https://unsplash.com/developers) in the environment or in the project's .env.
 * Follows the Unsplash API guidelines: photos are hotlinked from images.unsplash.com, every photo carries its
 * photographer credit with referral links, and each used photo is reported through its download_location.
 * Demo apps are limited to 50 requests an hour, so --track stops when the limit is reached and resumes next run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.STAYEASE_PHOTO_SQL || join(root, 'backend/src/main/resources/db/local/V906__demo_unsplash_photos.sql');
const STATE = process.env.STAYEASE_PHOTO_STATE || join(root, 'scripts/.unsplash-tracking.json');
const APP = 'stayease';
const PER_POOL = 8;

function accessKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY.trim();
  const env = join(root, '.env');
  if (existsSync(env)) for (const line of readFileSync(env, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*UNSPLASH_ACCESS_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  console.error('UNSPLASH_ACCESS_KEY is not set. Create a free app at https://unsplash.com/developers and add the Access Key to .env.');
  process.exit(1);
}
const KEY = accessKey();

async function unsplash(url) {
  const res = await fetch(url.startsWith('http') ? url : `https://api.unsplash.com${url}`, { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' } });
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? '50');
  if (res.status === 401) { console.error('Unsplash rejected the access key (401).'); process.exit(1); }
  if (res.status === 403 && remaining === 0) return { rateLimited: true };
  if (!res.ok) throw new Error(`Unsplash ${res.status} for ${url}`);
  return { body: await res.json(), remaining };
}

// Photo pools. Hotel exteriors and window views follow each province's landscape (see frontend/lib/cambodia.ts themes).
const POOLS = {
  'cover:temple': 'tropical resort pool siem reap',
  'cover:city': 'boutique hotel exterior city',
  'cover:beach': 'beach resort bungalow tropical',
  'cover:river': 'riverside guesthouse tropical',
  'cover:hills': 'jungle lodge bungalow',
  'cover:countryside': 'villa rice field',
  'view:temple': 'angkor wat',
  'view:city': 'phnom penh',
  'view:beach': 'cambodia beach',
  'view:river': 'mekong river cambodia',
  'view:hills': 'mondulkiri cambodia',
  'view:countryside': 'cambodia rice field',
  'room:double': 'hotel room bed interior',
  'room:family': 'hotel room twin beds',
  'bathroom': 'hotel bathroom interior',
};

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const referral = url => `${url}${url.includes('?') ? '&' : '?'}utm_source=${APP}&utm_medium=referral`;

async function build() {
  const rows = [], tracking = [];
  for (const [pool, query] of Object.entries(POOLS)) {
    const { body, rateLimited } = await unsplash(`/search/photos?query=${encodeURIComponent(query)}&per_page=${PER_POOL}&orientation=landscape&content_filter=high`);
    if (rateLimited) { console.error('Rate limit reached while searching. Wait an hour and run again.'); process.exit(1); }
    const photos = body.results.filter(p => p.urls?.raw?.startsWith('https://images.unsplash.com/'));
    if (!photos.length) throw new Error(`No photos found for "${query}"`);
    photos.forEach((p, i) => {
      const alt = (p.alt_description || p.description || query).slice(0, 240);
      rows.push(`(${q(pool)},${i},${q(p.urls.raw)},${q(alt)},${q(p.user.name)},${q(referral(p.user.links.html))})`);
      tracking.push({ id: p.id, download: p.links.download_location });
    });
    console.log(`${pool.padEnd(18)} ${photos.length} photos  ("${query}")`);
  }

  const theme = `('Siem Reap','temple'),('Preah Vihear','temple'),('Kampong Thom (Stung Sen)','temple'),('Takeo (Doun Kaev)','temple'),('Banteay Meanchey (Serei Saophoan)','temple'),('Oddar Meanchey (Samraong)','temple'),
  ('Phnom Penh','city'),
  ('Preah Sihanouk (Kampong Som, Sihanoukville)','beach'),('Kep','beach'),('Koh Kong','beach'),
  ('Kampot','river'),('Kratie','river'),('Stung Treng','river'),('Kampong Cham','river'),('Kampong Chhnang','river'),('Prey Veng','river'),('Battambang','river'),('Kandal (Ta Khmau)','river'),('Svay Rieng','river'),('Pursat','river'),
  ('Mondulkiri (Sen Monorom)','hills'),('Ratanakiri (Banlung)','hills'),('Pailin','hills'),('Kampong Speu (Chbar Mon)','hills'),
  ('Tbong Khmum (Suong)','countryside')`;

  const sql = `-- Local/demo data only. Generated by scripts/unsplash-demo-photos.mjs on ${new Date().toISOString().slice(0, 10)}; do not edit by hand.
-- Sample photos for the fictional demo hotels, hotlinked from Unsplash with photographer credits as the
-- Unsplash API guidelines require. Hotels and room types that already have photos are left untouched.
CREATE TEMP TABLE demo_photo(pool text, idx int, url text, alt text, credit_name text, credit_url text) ON COMMIT DROP;
INSERT INTO demo_photo VALUES
${rows.join(',\n')};

CREATE TEMP TABLE demo_theme(city text PRIMARY KEY, theme text) ON COMMIT DROP;
INSERT INTO demo_theme VALUES ${theme};

CREATE TEMP TABLE demo_pool_size ON COMMIT DROP AS SELECT pool, count(*)::int AS n FROM demo_photo GROUP BY pool;

-- Unsplash serves any size from the raw URL; 1600px wide is plenty for galleries.
CREATE TEMP TABLE demo_target ON COMMIT DROP AS
SELECT h.id AS hotel_id, t.theme, abs(hashtext(h.id::text)) AS seed
FROM hotel h JOIN demo_theme t ON t.city = h.city
WHERE h.id::text LIKE '10000000-0000-4000-8000-%' AND NOT EXISTS (SELECT 1 FROM hotel_image i WHERE i.hotel_id = h.id);

-- Two hotel photos each: a cover and a second view of the property.
INSERT INTO hotel_image(id, hotel_id, source_url, credit_name, credit_url, alt_text, sort_order, content_type)
SELECT gen_random_uuid(), d.hotel_id, p.url || '&w=1600&q=80&auto=format&fit=crop', p.credit_name, p.credit_url, left(p.alt, 250), k.sort, 'image/jpeg'
FROM demo_target d
CROSS JOIN (VALUES (0), (1)) AS k(sort)
JOIN demo_pool_size s ON s.pool = 'cover:' || d.theme
JOIN demo_photo p ON p.pool = s.pool AND p.idx = (d.seed + k.sort * 3) % s.n;

-- Room types: the room, the bathroom, the view (province landscape) and the outside of the building.
INSERT INTO room_type_image(id, room_type_id, source_url, credit_name, credit_url, alt_text, category, sort_order, content_type)
SELECT gen_random_uuid(), rt.id, p.url || '&w=1600&q=80&auto=format&fit=crop', p.credit_name, p.credit_url, left(p.alt, 250), c.category, 0, 'image/jpeg'
FROM room_type rt
JOIN demo_target d ON d.hotel_id = rt.hotel_id
CROSS JOIN LATERAL (VALUES
  ('ROOM', CASE WHEN rt.capacity >= 3 THEN 'room:family' ELSE 'room:double' END),
  ('BATHROOM', 'bathroom'),
  ('VIEW', 'view:' || d.theme),
  ('EXTERIOR', 'cover:' || d.theme)) AS c(category, pool)
JOIN demo_pool_size s ON s.pool = c.pool
JOIN demo_photo p ON p.pool = c.pool AND p.idx = (abs(hashtext(rt.id::text || c.category)) % s.n)
WHERE NOT EXISTS (SELECT 1 FROM room_type_image i WHERE i.room_type_id = rt.id);
`;
  writeFileSync(OUT, sql);
  writeFileSync(STATE, JSON.stringify({ pending: tracking, done: [] }, null, 2));
  console.log(`\nWrote ${OUT}\n${rows.length} photos. Next: node scripts/unsplash-demo-photos.mjs --track`);
}

async function track() {
  if (!existsSync(STATE)) { console.error('Nothing to track yet. Run without --track first.'); process.exit(1); }
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  while (state.pending.length) {
    const next = state.pending[0];
    const res = await unsplash(next.download);
    if (res.rateLimited) break;
    state.done.push(state.pending.shift().id);
    writeFileSync(STATE, JSON.stringify(state, null, 2));
    if (res.remaining <= 1) break;
  }
  console.log(`Reported ${state.done.length} photos to Unsplash, ${state.pending.length} left.${state.pending.length ? ' Run --track again in an hour.' : ' All done.'}`);
}

await (process.argv.includes('--track') ? track() : build());
