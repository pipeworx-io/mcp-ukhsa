interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * UK Health Security Agency (UKHSA) data dashboard MCP — keyless.
 *
 * Infectious-disease & public-health surveillance for the UK (COVID-19, Influenza,
 * RSV, Measles, vaccine uptake, antimicrobial resistance, etc.) for UK geographies
 * (Nation, NHS Region/Trust, Local Authority, Government Office Region, UKHSA Region).
 *
 * The data model is a fixed 6-level hierarchy you walk down before pulling a series:
 *   theme → sub_theme → topic → geography_type → geography → metric
 * e.g. infectious_disease → respiratory → COVID-19 → Nation → England → COVID-19_cases_casesByDay
 *
 * Metric names are dotted/underscored and topic-prefixed, e.g.
 *   COVID-19_cases_casesByDay, COVID-19_deaths_ONSByDay, influenza_healthcare_ICUHDUadmissionRateByWeek.
 * Use `navigate` to discover the valid value at each level, then `get_metric_data` to
 * pull the time series (date / metric_value observations).
 */


const BASE = 'https://api.ukhsa-dashboard.data.gov.uk';
const UA = 'pipeworx-mcp-ukhsa/1.0 (+https://pipeworx.io)';

// The ordered hierarchy levels and the URL segment that lists each one.
const LEVELS = [
  { arg: 'theme', segment: 'themes' },
  { arg: 'sub_theme', segment: 'sub_themes' },
  { arg: 'topic', segment: 'topics' },
  { arg: 'geography_type', segment: 'geography_types' },
  { arg: 'geography', segment: 'geographies' },
  { arg: 'metric', segment: 'metrics' },
] as const;

const tools: McpToolExport['tools'] = [
  {
    name: 'navigate',
    description:
      'Walk the UKHSA surveillance hierarchy one level at a time to discover valid values. ' +
      'Pass the levels you already know (in order: theme, sub_theme, topic, geography_type, geography) ' +
      'and you get back the list of options for the NEXT level. ' +
      'With no args it lists themes (e.g. infectious_disease, immunisation, climate_and_environment, medicines). ' +
      'With theme="infectious_disease" it lists sub_themes (respiratory, gastrointestinal, vaccine_preventable, ...). ' +
      'Continue down to topics (COVID-19, Influenza, Measles, ...), geography_types (Nation, NHS Region, ...), ' +
      'geographies (England, ...), and finally metrics. ' +
      'Each item has {name, link}. Feed the chosen name into the next-level arg, then call get_metric_data once you have all six.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'e.g. "infectious_disease".' },
        sub_theme: { type: 'string', description: 'e.g. "respiratory". Requires theme.' },
        topic: { type: 'string', description: 'e.g. "COVID-19", "Influenza". Requires theme + sub_theme.' },
        geography_type: { type: 'string', description: 'e.g. "Nation", "NHS Region". Requires the levels above. May contain spaces.' },
        geography: { type: 'string', description: 'e.g. "England". Requires the levels above.' },
      },
    },
  },
  {
    name: 'list_metrics',
    description:
      'Convenience shortcut: list every available metric for a fully-specified location ' +
      '(theme, sub_theme, topic, geography_type, geography), without walking each level. ' +
      'Returns metric names like "COVID-19_cases_casesByDay" or "COVID-19_deaths_ONSByDay" ready to pass to get_metric_data.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'e.g. "infectious_disease".' },
        sub_theme: { type: 'string', description: 'e.g. "respiratory".' },
        topic: { type: 'string', description: 'e.g. "COVID-19".' },
        geography_type: { type: 'string', description: 'e.g. "Nation".' },
        geography: { type: 'string', description: 'e.g. "England".' },
      },
      required: ['theme', 'sub_theme', 'topic', 'geography_type', 'geography'],
    },
  },
  {
    name: 'get_metric_data',
    description:
      'Pull the time series for one fully-specified UKHSA metric. Requires all six levels ' +
      '(theme, sub_theme, topic, geography_type, geography, metric). ' +
      'Returns paginated observations {count, next, previous, results[]} where each result has ' +
      'date, metric_value, year, month, epiweek, sex, age, stratum, geography_code, etc. ' +
      'Optionally filter by year and control page_size / page. ' +
      'Example: infectious_disease / respiratory / COVID-19 / Nation / England / COVID-19_cases_casesByDay.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'e.g. "infectious_disease".' },
        sub_theme: { type: 'string', description: 'e.g. "respiratory".' },
        topic: { type: 'string', description: 'e.g. "COVID-19".' },
        geography_type: { type: 'string', description: 'e.g. "Nation".' },
        geography: { type: 'string', description: 'e.g. "England".' },
        metric: { type: 'string', description: 'Dotted/underscored metric name, e.g. "COVID-19_cases_casesByDay".' },
        year: { type: 'number', description: 'Optional. Filter to a single calendar year, e.g. 2024.' },
        page_size: { type: 'number', description: 'Optional. Observations per page (default 5 here, max ~365).' },
        page: { type: 'number', description: 'Optional. 1-based page number for paging through results.' },
      },
      required: ['theme', 'sub_theme', 'topic', 'geography_type', 'geography', 'metric'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'navigate':
      return navigate(args);
    case 'list_metrics': {
      // All five upper levels required → ask for the metrics list.
      for (const lvl of LEVELS.slice(0, 5)) reqStr(args, lvl.arg, exampleFor(lvl.arg));
      return navigate(args);
    }
    case 'get_metric_data':
      return getMetricData(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Build the hierarchy path from the args supplied so far and fetch the NEXT level's list.
 * Stops at the first missing level and returns that level's options.
 */
async function navigate(args: Record<string, unknown>): Promise<unknown> {
  const segments: string[] = [];
  let nextSegment: string = LEVELS[0].segment; // "themes"

  for (const lvl of LEVELS) {
    const val = args[lvl.arg];
    if (val === undefined || val === null || val === '') break;
    if (typeof val !== 'string') throw new Error(`Argument "${lvl.arg}" must be a string.`);
    segments.push(lvl.segment, val);
    // The level after this one is what we'd list next.
    const idx = LEVELS.indexOf(lvl);
    nextSegment = idx + 1 < LEVELS.length ? LEVELS[idx + 1].segment : '';
  }

  if (!nextSegment) {
    throw new Error('All hierarchy levels supplied; use get_metric_data to pull the time series.');
  }

  const path = '/' + [...segments, nextSegment].map(encodeSegment).join('/');
  return ukhsaGet(path);
}

async function getMetricData(args: Record<string, unknown>): Promise<unknown> {
  const parts: string[] = [];
  for (const lvl of LEVELS) {
    parts.push(lvl.segment, reqStr(args, lvl.arg, exampleFor(lvl.arg)));
  }
  let path = '/' + parts.map(encodeSegment).join('/');

  const qs = new URLSearchParams();
  if (typeof args.year === 'number') qs.set('year', String(args.year));
  qs.set('page_size', typeof args.page_size === 'number' ? String(args.page_size) : '5');
  if (typeof args.page === 'number') qs.set('page', String(args.page));
  path += `?${qs.toString()}`;

  return ukhsaGet(path);
}

async function ukhsaGet(path: string): Promise<unknown> {
  // List endpoints below /themes/ and /sub_themes/ 404 if given a trailing slash,
  // while /themes 301-redirects to add one. We never append a trailing slash and let
  // fetch follow the 301 for the top two levels. Each path segment is URL-encoded
  // (geography_type / geography values can contain spaces, e.g. "NHS Region").
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`UKHSA: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function encodeSegment(s: string): string {
  return encodeURIComponent(s);
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

function exampleFor(key: string): string {
  const ex: Record<string, string> = {
    theme: '"infectious_disease"',
    sub_theme: '"respiratory"',
    topic: '"COVID-19"',
    geography_type: '"Nation"',
    geography: '"England"',
    metric: '"COVID-19_cases_casesByDay"',
  };
  return ex[key] ?? '"value"';
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
