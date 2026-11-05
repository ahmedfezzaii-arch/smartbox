// Refreshes data/news.json from public RSS feeds. Runs in GitHub Actions; no dependencies.
// Stores only headline, link, source, date and category: readers are sent to the publisher.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'data', 'news.json');

const FEEDS = [
  { source: 'investingLive', url: 'https://investinglive.com/feed/' },
  { source: 'FXStreet', url: 'https://www.fxstreet.com/rss/news' },
  { source: 'Investing.com', url: 'https://www.investing.com/rss/news_1.rss' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
];

const MAX_ITEMS = 40;
const MAX_PER_SOURCE = 18;
const MAX_AGE_HOURS = 96; // long enough to keep content over a weekend
const MIN_ITEMS_TO_PUBLISH = 5;

// First match wins, so more specific themes come before broader ones.
const CATEGORIES = [
  ['Central banks', /\b(Fed|FOMC|ECB|BoE|BoJ|BOJ|BOE|RBA|RBNZ|SNB|BoC|BOC|PBoC|PBOC|Powell|Lagarde)\b|central banks?|rate (cut|hike|decision)s?|interest rates?/],
  ['Crypto', /\b(bitcoin|ethereum|crypto|cryptocurrency|BTC|ETH|zcash|solana)\b/i],
  ['Commodities', /\b(gold|silver|XAU\/?USD|XAG\/?USD|crude|oil|WTI|Brent|OPEC|natural gas|copper)\b/i],
  ['Forex', /\b[A-Z]{3}\/[A-Z]{3}\b|\b(dollar|euro|yen|sterling|pound|swiss franc|aussie|loonie|kiwi|forex|DXY)\b/i],
  ['Macro data', /\b(inflation|CPI|PPI|PCE|GDP|PMI|payrolls|NFP|ADP|ISM|unemployment|jobless|retail sales|trade balance|treasury|yields?)\b/i],
  ['Stocks', /\b(stocks?|shares|equit(y|ies)|nasdaq|S&P|Dow|wall street|earnings|IPO|nikkei|DAX|FTSE)\b/i],
];

// Sponsored posts and off-topic items that keyword matching can let through.
const EXCLUDE_TITLE = /sponsored|premier league|youtube views|should i\b|\bi'm \d+/i;
const EXCLUDE_LINK = /\/education\//i;

export function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => named[name]);
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  const cdata = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (cdata ? cdata[1] : decodeEntities(match[1])).trim();
}

export function parseDate(raw) {
  if (!raw) return null;
  // Normalises "2026-10-23 20:31:27" and "Thu, 25 Jun 2026 00:19:52 Z", both read as UTC.
  const value = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw.replace(/\sZ$/, ' GMT');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function categorize(title) {
  for (const [name, pattern] of CATEGORIES) if (pattern.test(title)) return name;
  return null;
}

export function parseFeed(xml, source) {
  const items = [];
  for (const [block] of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const title = decodeEntities(readTag(block, 'title')).replace(/\s+/g, ' ').trim();
    const link = readTag(block, 'link');
    const date = parseDate(readTag(block, 'pubDate'));
    if (title && /^https?:\/\//.test(link) && date) items.push({ title, link, date, source });
  }
  return items;
}

export function selectItems(items, now = new Date()) {
  const oldest = now.getTime() - MAX_AGE_HOURS * 3600e3;
  const seen = new Set();
  const perSource = {};
  const selected = [];

  const sorted = items
    .filter((item) => item.date.getTime() >= oldest && item.date.getTime() <= now.getTime() + 3600e3)
    .sort((a, b) => b.date - a.date);

  for (const item of sorted) {
    if (EXCLUDE_TITLE.test(item.title) || EXCLUDE_LINK.test(item.link)) continue;
    const category = categorize(item.title);
    if (!category) continue;
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    if ((perSource[item.source] ?? 0) >= MAX_PER_SOURCE) continue;
    seen.add(key);
    perSource[item.source] = (perSource[item.source] ?? 0) + 1;
    selected.push({
      title: item.title,
      link: item.link,
      source: item.source,
      category,
      published: item.date.toISOString(),
    });
    if (selected.length === MAX_ITEMS) break;
  }
  return selected;
}

async function fetchFeed({ source, url }) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SmartboxNewsBot/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseFeed(await response.text(), source);
}

export async function writeNews(items, now = new Date()) {
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const sources = [...new Set(items.map((item) => item.source))].sort();
  await writeFile(OUTPUT, `${JSON.stringify({ updated: now.toISOString(), sources, items }, null, 2)}\n`);
}

async function main() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const collected = [];
  results.forEach((result, index) => {
    const { source } = FEEDS[index];
    if (result.status === 'fulfilled') {
      console.log(`${source}: ${result.value.length} items`);
      collected.push(...result.value);
    } else {
      console.warn(`${source}: failed (${result.reason?.message ?? result.reason})`);
    }
  });

  const items = selectItems(collected);
  if (items.length < MIN_ITEMS_TO_PUBLISH) {
    // Keeping the previous file lets the site show its true "last updated" time.
    const previous = await readFile(OUTPUT, 'utf8').catch(() => null);
    console.warn(`Only ${items.length} usable items. Keeping previous news file: ${previous ? 'yes' : 'none exists'}.`);
    return;
  }
  await writeNews(items);
  console.log(`Wrote ${items.length} items.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
