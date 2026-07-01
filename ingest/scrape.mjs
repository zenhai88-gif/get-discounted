/* Automated promo ingestion.
 *
 * Runs on a schedule (see .github/workflows/update-promos.yml). Each bank has an
 * "adapter" that fetches its public promotions page and returns normalised promos.
 * Results are merged into ../promos.json:
 *   - manual entries (source: "manual") are always kept
 *   - scraped entries replace previous scraped entries from the same bank
 *   - genuinely new promo ids are printed so the workflow can push a notification
 *
 * IMPORTANT / honest caveats:
 *   - Bank sites change markup often and some block bots; adapters need tuning and
 *     will fail gracefully (that bank is simply skipped, old data retained).
 *   - Prefer official feeds/APIs where a bank offers them. Respect robots.txt and ToS.
 *   - The adapters below are a working framework with two real examples and several
 *     stubs. Fill in selectors per bank as you verify them.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'promos.json');
const UA = 'GetDiscountedBot/1.0 (+https://getdiscounted.my)';

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.text();
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* ---- Adapters: return array of {merchant, cat, bank, card, offer, expiry, link} ----
   Each adapter is wrapped in try/catch by run(), so throwing just skips that bank. */
const ADAPTERS = [
  {
    bank: 'CIMB',
    async run() {
      const html = await fetchHtml('https://www.cimb.com.my/en/personal/promotions/latest-promotions.html');
      const $ = cheerio.load(html);
      const out = [];
      // Example selector pattern — adjust to the live DOM.
      $('.promo-card, .card, article').slice(0, 40).each((_, el) => {
        const title = $(el).find('h2,h3,.title').first().text().trim();
        const link = $(el).find('a').first().attr('href');
        if (!title || !link) return;
        out.push({
          merchant: title, cat: guessCat(title), bank: 'CIMB', card: 'CIMB Credit Cards',
          offer: $(el).find('p,.desc').first().text().trim() || title,
          expiry: extractDate($(el).text()),
          link: absolutise(link, 'https://www.cimb.com.my')
        });
      });
      return out;
    }
  },
  {
    bank: 'RHB',
    async run() {
      const html = await fetchHtml('https://www.rhbgroup.com/cards/promotions-privileges/index.html');
      const $ = cheerio.load(html);
      const out = [];
      $('.promo, .card, article, li').slice(0, 40).each((_, el) => {
        const title = $(el).find('h2,h3,.title,a').first().text().trim();
        const link = $(el).find('a').first().attr('href');
        if (!title || !link || title.length < 4) return;
        out.push({
          merchant: title, cat: guessCat(title), bank: 'RHB', card: 'RHB Credit Cards',
          offer: $(el).find('p,.desc').first().text().trim() || title,
          expiry: extractDate($(el).text()),
          link: absolutise(link, 'https://www.rhbgroup.com')
        });
      });
      return out;
    }
  },
  // Stubs — implement per bank once selectors are verified:
  { bank: 'Maybank',     url: 'https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/promotions/maybank_cards.page' },
  { bank: 'Public Bank', url: 'https://www.pbebank.com/en/promotions/credit-cards-promotions/' },
  { bank: 'Hong Leong',  url: 'https://www.hlb.com.my/en/personal-banking/promotions.html' },
  { bank: 'UOB',         url: 'https://www.uob.com.my/personal/promotions/index.page' },
  { bank: 'AmBank',      url: 'https://www.ambank.com.my/promotions' },
  { bank: 'Alliance Bank', url: 'https://www.alliancebank.com.my/promotions' }
].filter(a => typeof a.run === 'function');

function guessCat(t) {
  t = t.toLowerCase();
  if (/dine|dining|restaurant|food|f&b/.test(t)) return 'Dining';
  if (/hotel|travel|flight|agoda|booking|airline/.test(t)) return 'Travel';
  if (/petrol|fuel|shell|petronas|caltex|bhp/.test(t)) return 'Fuel';
  if (/grocer|utility|e-?wallet|bill/.test(t)) return 'Everyday';
  if (/sign.?up|new card|welcome|apply/.test(t)) return 'Sign-up';
  if (/point|reward|cashback|rebate/.test(t)) return 'Rewards';
  return 'Shopping';
}
function extractDate(text) {
  // Try to find a dd Mon yyyy / yyyy-mm-dd style end date; default to year-end.
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const m = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})/i);
  if (m) {
    const mo = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase()) + 1;
    return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  }
  return `${new Date().getFullYear()}-12-31`;
}
function absolutise(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}

async function run() {
  const raw = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const existing = raw.promos;
  const manual = existing.filter(p => (p.source || 'manual') === 'manual');
  const prevIds = new Set(existing.map(p => p.id));

  let scraped = [];
  for (const a of ADAPTERS) {
    try {
      const rows = await a.run();
      rows.forEach(r => {
        r.id = `${slug(r.bank)}-${slug(r.merchant)}`;
        r.source = 'scraped';
      });
      // de-dupe within a bank
      const seen = new Set();
      scraped.push(...rows.filter(r => !seen.has(r.id) && seen.add(r.id)));
      console.log(`[ok] ${a.bank}: ${rows.length} promos`);
    } catch (e) {
      console.warn(`[skip] ${a.bank}: ${e.message}`);
    }
  }

  // Merge: manual entries win on id collision.
  const manualIds = new Set(manual.map(p => p.id));
  const merged = [...manual, ...scraped.filter(p => !manualIds.has(p.id))];

  const newIds = merged.filter(p => !prevIds.has(p.id)).map(p => p.id);
  const output = {
    lastUpdated: new Date().toISOString(),
    source: raw.source,
    promos: merged
  };
  await writeFile(DATA_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(`\nTotal promos: ${merged.length} (manual ${manual.length}, scraped ${scraped.length})`);
  if (newIds.length) {
    console.log('NEW_PROMOS=' + newIds.join(','));
    // GitHub Actions output for the notify step
    if (process.env.GITHUB_OUTPUT) {
      const { appendFile } = await import('node:fs/promises');
      const first = merged.find(p => p.id === newIds[0]);
      await appendFile(process.env.GITHUB_OUTPUT,
        `new_count=${newIds.length}\n` +
        `notify_title=${newIds.length} new promo${newIds.length>1?'s':''}\n` +
        `notify_body=${first.merchant} · ${first.bank}: ${first.offer}\n`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
