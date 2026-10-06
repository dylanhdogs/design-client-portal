import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_RESPONSE_BYTES = 1_200_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'ReceptionComplianceResearch/1.0';
const robotsCache = new Map<string, Promise<boolean>>();
const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

export type ComplianceAuthorityType = 'CITY' | 'COUNTY' | 'STATE' | 'HOA';

export interface ComplianceResearchLocation {
  address: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  jurisdiction?: string | null;
  hoaName?: string | null;
  municipality?: string | null;
  communityDevelopment?: string | null;
  communitySubcommunity?: string | null;
  complianceLinks?: string | null;
  hoaArcContact?: string | null;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  excerpt: string | null;
  authorityType: ComplianceAuthorityType;
  authorityName: string;
}

export interface ComplianceResearchResult {
  queries: string[];
  sources: ResearchSource[];
  categories: string[];
  notes: string;
  errorMessage: string | null;
}

const categoryRules: Array<[RegExp, string]> = [
  [/\bpermit\b|building department|inspection|contractor license/i, 'Municipal permits and inspections'],
  [/\bhoa\b|homeowners association|architectural review|\barc\b|community association/i, 'HOA / ARC and community approval'],
  [/pool barrier|barrier requirements|fence|enclosure|self.closing gate|safety cover/i, 'Pool barrier and safety requirements'],
  [/setback|zoning|land use|lot coverage/i, 'Zoning, setbacks, and land use'],
  [/drainage|stormwater|runoff|grading/i, 'Grading and drainage'],
  [/utility|easement|right.of.way/i, 'Utilities and easements'],
  [/design guideline|design standard|covenant|architectural standard/i, 'Community design standards'],
];

export function isArizonaState(state?: string | null): boolean {
  const normalized = state?.trim().toLowerCase().replace(/\./g, '');
  return normalized === 'az' || normalized === 'arizona';
}

export function assertArizonaResearchLocation(location: ComplianceResearchLocation): void {
  if (!isArizonaState(location.state)) {
    throw new Error('Automated compliance research currently supports Arizona properties only. Set the property state to AZ and try again.');
  }
}

export function buildComplianceSearchQueries(location: ComplianceResearchLocation): string[] {
  assertArizonaResearchLocation(location);
  const municipality = location.municipality || location.city || location.address;
  const city = [municipality, location.city, 'Arizona'].filter(Boolean).join(' ');
  const county = [location.jurisdiction, location.city, 'Arizona'].filter(Boolean).join(' ');
  const community = [location.hoaName, location.communityDevelopment, location.communitySubcommunity, location.city, 'Arizona'].filter(Boolean).join(' ');
  const queries = [
    `[CITY] ${city} official city of ${municipality} swimming pool permit zoning barrier inspection -builder -contractor -installation`,
    `[COUNTY] ${county} county government pool permit drainage zoning Arizona -builder -contractor`,
    `[STATE] Arizona state government residential swimming pool barrier code -builder -contractor`,
  ];
  if (location.hoaName || location.communityDevelopment || location.communitySubcommunity) {
    queries.push(`[HOA] ${community} HOA official pool architectural review ARC guidelines Arizona -builder -contractor`);
  }
  return queries;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#x([\da-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, decimal: string) => String.fromCodePoint(Number(decimal)));
}

function htmlToText(html: string): string {
  return decodeHtml(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' '))
    .replace(/[\t\r\n ]+/g, ' ').trim();
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

function parseQuery(query: string): { authorityType: ComplianceAuthorityType; terms: string } {
  const match = query.match(/^\[(CITY|COUNTY|STATE|HOA)\]\s*/);
  return {
    authorityType: (match?.[1] || 'CITY') as ComplianceAuthorityType,
    terms: query.replace(/^\[(CITY|COUNTY|STATE|HOA)\]\s*/, ''),
  };
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) throw new Error('Automated public-web search is not configured. Add BRAVE_SEARCH_API_KEY to the application environment.');
  const requestUrl = new URL(BRAVE_SEARCH_URL);
  requestUrl.searchParams.set('q', query);
  requestUrl.searchParams.set('count', '10');
  requestUrl.searchParams.set('country', 'US');
  const url = await assertPublicHttps(requestUrl.href);
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
      'x-subscription-token': apiKey,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Automated search provider rejected its API key. Check BRAVE_SEARCH_API_KEY.');
    if (response.status === 429) throw new Error('Automated search provider rate limit reached. Retry later.');
    throw new Error(`Automated search provider returned HTTP ${response.status}.`);
  }
  const payload = JSON.parse(await readLimited(response)) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
  return (payload.web?.results || []).flatMap((item) => {
    if (!item.url || !item.title) return [];
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) return [];
      return [{ title: item.title, url: parsed.href, description: item.description || '' }];
    } catch { return []; }
  });
}

const authorityWords: Record<ComplianceAuthorityType, RegExp> = {
  CITY: /\b(city|town|village|municipality|planning and development|development services|building safety|permit services)\b/i,
  COUNTY: /\b(county|county government|county services|county planning|county development)\b/i,
  STATE: /\b(state|department of|building code|residential code|state agency)\b/i,
  HOA: /\b(hoa|homeowners association|community association|architectural review|\barc\b|community guidelines)\b/i,
};

const commercialResult = /\b(pool builder|pool builders|pool contractor|pool contractors|pool installation|pool company|free estimate|request a quote|our services)\b/i;
const civicPage = /\b(city of|town of|county of|municipal|government|planning and development|development services|building safety|community development|department of)\b/i;

function normalizedPlace(value: string): string {
  return value.toLowerCase().replace(/^(city|town|village|county) of\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function classifyAuthority(
  type: ComplianceAuthorityType,
  result: SearchResult,
  pageText: string,
  location: ComplianceResearchLocation,
): { authorityType: ComplianceAuthorityType; authorityName: string } | null {
  const hostname = new URL(result.url).hostname.toLowerCase();
  const evidence = `${result.title} ${result.description} ${pageText.slice(0, 30_000)}`;
  const arizonaEvidence = /\bArizona\b|\bAZ\b|Arizona Revised Statutes|\bA\.R\.S\./i.test(evidence)
    || hostname.endsWith('.az.gov') || hostname.endsWith('.az.us');
  if (!isArizonaState(location.state) || !arizonaEvidence) return null;
  const governmentHost = hostname.endsWith('.gov') || hostname.endsWith('.mil');
  const countyMatch = evidence.match(/\b(?:([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2})\s+County|County\s+of\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2}))/i);
  const authorityName = type === 'CITY'
    ? location.municipality || location.city || 'Municipality'
    : type === 'COUNTY'
      ? countyMatch ? `${countyMatch[1] || countyMatch[2]} County` : 'County authority'
      : type === 'STATE'
        ? `${location.state || 'State'} agency`
        : location.hoaName || location.communityDevelopment || location.communitySubcommunity || 'Community association';
  const place = type === 'CITY'
    ? normalizedPlace(location.municipality || location.city || '')
    : type === 'HOA'
      ? normalizedPlace(location.hoaName || location.communityDevelopment || location.communitySubcommunity || '')
      : '';
  const placeConfirmed = !place || evidence.toLowerCase().includes(place);
  const civicIdentity = civicPage.test(evidence) && authorityWords[type].test(evidence);
  const officialGovernmentIdentity = governmentHost && authorityWords[type].test(evidence);
  const hoaIdentity = type === 'HOA' && authorityWords.HOA.test(evidence);
  if (commercialResult.test(`${result.title} ${result.description}`) && !officialGovernmentIdentity && !civicIdentity) return null;
  if (type === 'HOA' ? !(hoaIdentity && placeConfirmed) : !((officialGovernmentIdentity || civicIdentity) && placeConfirmed)) return null;
  return { authorityType: type, authorityName };
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const normalized = address.toLowerCase().split('%')[0];
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff') || normalized.startsWith('2001:db8:');
}

async function assertPublicHttps(urlValue: string): Promise<URL> {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Only public HTTPS sources are allowed.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) throw new Error('Private and local source hosts are not allowed.');
  if (isIP(host)) throw new Error('IP-address source URLs are not allowed.');
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('Source host does not resolve exclusively to public addresses.');
  return url;
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Source page exceeded the size limit.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

async function fetchPublicText(startUrl: string, accept: string): Promise<{ url: string; status: number; text: string; contentType: string }> {
  let current = startUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const url = await assertPublicHttps(current);
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('Source redirected too many times.');
      current = new URL(location, url).href;
      continue;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) throw new Error('Source is not an HTML or text page.');
    return { url: url.href, status: response.status, text: await readLimited(response), contentType };
  }
  throw new Error('Source redirect could not be followed.');
}

async function robotsAllows(url: URL): Promise<boolean> {
  const key = url.origin;
  let cached = robotsCache.get(key);
  if (!cached) {
    cached = (async () => {
      try {
        const robots = await fetchPublicText(`${url.origin}/robots.txt`, 'text/plain');
        const lines = robots.text.split(/\r?\n/);
        let applies = false;
        let sawRule = false;
        const rules: Array<{ allow: boolean; path: string }> = [];
        for (const raw of lines) {
          const [name, ...rest] = raw.split(':');
          const value = rest.join(':').trim();
          if (!name || !rest.length) continue;
          if (/^user-agent$/i.test(name.trim())) {
            if (sawRule) { applies = false; sawRule = false; }
            if (value === '*') applies = true;
          } else if (/^(allow|disallow)$/i.test(name.trim()) && applies) {
            sawRule = true;
            if (value) rules.push({ allow: /^allow$/i.test(name.trim()), path: value });
          }
        }
        const path = `${url.pathname}${url.search}`;
        const matching = rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
        return matching.length === 0 || matching[0].allow;
      } catch (error) {
        if (error instanceof Error && /HTTP 404/.test(error.message)) return true;
        return false;
      }
    })();
    robotsCache.set(key, cached);
  }
  return cached;
}

function extractRelevantExcerpt(html: string): { excerpt: string | null; categories: string[] } {
  const text = htmlToText(html);
  const categories = categoryRules.filter(([rule]) => rule.test(text)).map(([, category]) => category);
  const relevant = /pool|permit|inspection|zoning|setback|barrier|fence|enclosure|hoa|homeowners|architectural|\barc\b|drainage|stormwater|runoff|easement|utility|covenant|design guideline|community standard/i;
  const sentenceList = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((sentence) => sentence.trim());
  const summary = sentenceList.find((sentence) => sentence.length >= 45 && relevant.test(sentence))
    || sentenceList.find((sentence) => sentence.length >= 45);
  return { excerpt: summary ? `${summary.slice(0, 277).trim()}${summary.length > 277 ? '…' : ''}` : null, categories };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function researchPublicCompliance(location: ComplianceResearchLocation): Promise<ComplianceResearchResult> {
  if (!location.address.trim()) throw new Error('Add a property address before starting compliance research.');
  assertArizonaResearchLocation(location);
  const queries = buildComplianceSearchQueries(location);
  const suppliedLinks = [location.complianceLinks, location.hoaArcContact].filter(Boolean).flatMap((value) => [...String(value).matchAll(/https:\/\/[^\s<>()"']+/gi)].map((match) => match[0].replace(/[.,;]+$/, '')));
  const candidates = new Map<string, SearchResult & { authorityType: ComplianceAuthorityType }>();
  for (const url of suppliedLinks) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') candidates.set(parsed.href, { title: 'Inquiry-provided source', description: '', url: parsed.href, authorityType: 'HOA' });
    } catch { /* Ignore malformed inquiry-provided links. */ }
  }
  const searchErrors: string[] = [];
  const runQueries = async (searchQueries: string[]) => {
    for (const query of searchQueries) {
    const { authorityType, terms } = parseQuery(query);
    try {
      const results = await searchWeb(terms);
      for (const result of results) {
        if (!candidates.has(result.url)) candidates.set(result.url, { ...result, authorityType });
      }
    } catch (error) {
      searchErrors.push(error instanceof Error ? error.message : 'Search request failed.');
    }
    await wait(200);
    }
  };
  await runQueries(queries);

  const sources: ResearchSource[] = [];
  const categories = new Set<string>();
  const processedUrls = new Set<string>();
  const fetchCandidates = async (candidateList: Array<SearchResult & { authorityType: ComplianceAuthorityType }>, perAuthorityLimit: number) => {
    const groupCounts = new Map<ComplianceAuthorityType, number>();
    const attemptCounts = new Map<ComplianceAuthorityType, number>();
    const rankedCandidates = candidateList.sort((left, right) => {
      const rank = (item: typeof left) => item.authorityType === 'CITY' ? 0 : item.authorityType === 'COUNTY' ? 1 : item.authorityType === 'STATE' ? 2 : 3;
      return rank(left) - rank(right);
    });
    for (const candidate of rankedCandidates) {
      if (processedUrls.has(candidate.url) || (groupCounts.get(candidate.authorityType) || 0) >= perAuthorityLimit || (attemptCounts.get(candidate.authorityType) || 0) >= perAuthorityLimit * 3) continue;
      processedUrls.add(candidate.url);
      attemptCounts.set(candidate.authorityType, (attemptCounts.get(candidate.authorityType) || 0) + 1);
      try {
        const parsed = await assertPublicHttps(candidate.url);
        if (!(await robotsAllows(parsed))) continue;
        const page = await fetchPublicText(parsed.href, 'text/html,application/xhtml+xml,text/plain');
        const pageText = htmlToText(page.text);
        const authority = classifyAuthority(candidate.authorityType, { ...candidate, url: page.url }, pageText, location);
        if (!authority) continue;
        const extracted = extractRelevantExcerpt(page.text);
        extracted.categories.forEach((category) => categories.add(category));
        const finalUrl = new URL(page.url).href;
        if (!sources.some((source) => source.url === finalUrl)) {
          sources.push({
            title: candidate.title.slice(0, 300),
            url: finalUrl,
            domain: new URL(finalUrl).hostname,
            excerpt: extracted.excerpt,
            authorityType: authority.authorityType,
            authorityName: authority.authorityName,
          });
          groupCounts.set(candidate.authorityType, (groupCounts.get(candidate.authorityType) || 0) + 1);
        }
        await wait(150);
      } catch {
        // A single inaccessible, blocked, or non-text result should not fail the whole inquiry.
      }
    }
  };

  await fetchCandidates([...candidates.values()], 4);

  // Once the first pass confirms official domains, search within those sites for deeper pages.
  const scopedQueries: string[] = [];
  const trustedDomains = new Set<string>();
  const scopedCounts = new Map<ComplianceAuthorityType, number>();
  for (const source of sources) {
    const key = `${source.authorityType}:${source.domain}`;
    if (trustedDomains.has(key) || (scopedCounts.get(source.authorityType) || 0) >= 2) continue;
    trustedDomains.add(key);
    scopedCounts.set(source.authorityType, (scopedCounts.get(source.authorityType) || 0) + 1);
    const terms = source.authorityType === 'HOA'
      ? `pool architectural review ARC guidelines permits Arizona`
      : `swimming pool permit barrier setback inspection drainage zoning Arizona`;
    scopedQueries.push(`[${source.authorityType}] site:${source.domain} ${terms}`);
  }
  queries.push(...scopedQueries);
  if (scopedQueries.length) {
    const before = new Set(candidates.keys());
    await runQueries(scopedQueries);
    await fetchCandidates([...candidates.entries()].filter(([url]) => !before.has(url)).map(([, candidate]) => candidate), 3);
  }
  const notes = [
    `Automated preliminary public-web research for ${[location.address, location.city, location.state, location.postalCode].filter(Boolean).join(', ')}.`,
    `Automated source groups searched: ${queries.map((query) => query.match(/^\[([^\]]+)\]/)?.[1] || 'CITY').join(', ')}.`,
    categories.size ? `Potential topics found in source text: ${[...categories].join('; ')}.` : 'No matching compliance terms were extracted from accessible sources; review the links manually and contact the jurisdiction/community if needed.',
    `Verified authority-group pages retained: ${sources.length} (${sources.filter((source) => source.authorityType === 'CITY').length} city, ${sources.filter((source) => source.authorityType === 'COUNTY').length} county, ${sources.filter((source) => source.authorityType === 'STATE').length} state, ${sources.filter((source) => source.authorityType === 'HOA').length} HOA/community). Commercial builder pages are excluded.`,
    searchErrors.length ? `Some searches were unavailable (${[...new Set(searchErrors)].join('; ')}).` : '',
    'Automated preliminary research only. A representative must confirm that each source and requirement is current and applies to this property before relying on it.',
  ].filter(Boolean).join('\n\n').slice(0, 4900);
  const errorMessage = !sources.length && searchErrors.length
    ? [...new Set(searchErrors)].join(' ')
    : null;
  return { queries, sources, categories: [...categories], notes, errorMessage };
}
