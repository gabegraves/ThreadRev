/**
 * Browser-safe port of apps/channel/src/workspace.ts (the reviewer's exact-match
 * workspace index). Pure functions only: the channel module's loader uses
 * node:fs and cannot ship to the client. Keep in sync with the channel copy;
 * the query semantics here are what the Workspace page shows the judge.
 */

export type WorkspaceMessage = {
  ts: string;
  channel: string;
  channel_name: string;
  user: string;
  user_name: string;
  thread_ts?: string | null;
  text: string;
  files: string[];
};

/** Mirrors apps/channel/src/revision.ts. */
export const CHANGE_PATTERN =
  /(?:correction|corrected|instead of|is now|are now|changed?|changing|updated?|revis(?:ed|ion)|supersed\w*|scratch that|actually|bump(?:ed)? to|moving to|allows?|now,? not|not \d|now \d|will be r\d)/i;

export function tsNum(ts: string | undefined) {
  if (!ts) return -1;
  const n = Number(ts);
  if (Number.isFinite(n)) return n;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms / 1000 : -1;
}

export interface QuantityMention {
  value: number;
  unit: string;
  /** The few words before the number, lowercased: "bus is", "relay timer from". */
  context: string;
}

export interface IndexedMessage extends WorkspaceMessage {
  /** Filenames attached to or named in the text, basename only. */
  documents: string[];
  quantities: QuantityMention[];
  is_change: boolean;
}

export interface WorkspaceIndex {
  messages: IndexedMessage[];
  /** document basename → ts of every message that attached or named it. */
  byDocument: Map<string, string[]>;
  /** normalized unit → ts of every message with a value in that unit. */
  byUnit: Map<string, string[]>;
  channels: Map<string, string>;
  people: Map<string, string>;
}

const UNIT_ALIASES: Record<string, string> = {
  "µf": "uF", uf: "uF", mf: "mF", nf: "nF", ohm: "ohm", ohms: "ohm", "ω": "ohm",
  kg: "kg", kwh: "kWh", wh: "Wh", v: "V", a: "A", ma: "mA", ms: "ms", s: "s",
  "m/s": "m/s", km: "km", mm: "mm", percent: "percent", "%": "percent", w: "W", usd: "USD",
};
const UNIT_RE = /(\d+(?:\.\d+)?)\s*(µF|uF|mF|nF|ohms?|Ω|kg|kWh|Wh|V|mA|A|ms|m\/s|s|km|mm|percent|%|W|USD)(?![A-Za-z0-9/])/g;
const DOC_RE = /\b([A-Za-z0-9._-]+\.(?:docx|xlsx|pdf))\b/g;

export function normalizeUnit(raw: string): string {
  return UNIT_ALIASES[raw.toLowerCase()] ?? raw;
}

export function extractQuantities(text: string): QuantityMention[] {
  const out: QuantityMention[] = [];
  for (const m of text.matchAll(UNIT_RE)) {
    const before = text.slice(0, m.index).trim().split(/\s+/).slice(-4).join(" ").toLowerCase();
    out.push({ value: Number(m[1]), unit: normalizeUnit(m[2]!), context: before });
  }
  return out;
}

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

export function indexMessage(m: WorkspaceMessage): IndexedMessage {
  const docs = new Set(m.files.map(basename));
  for (const d of m.text.matchAll(DOC_RE)) docs.add(d[1]!);
  return {
    ...m,
    documents: [...docs],
    quantities: extractQuantities(m.text),
    is_change: CHANGE_PATTERN.test(m.text),
  };
}

export function buildIndex(messages: WorkspaceMessage[]): WorkspaceIndex {
  const indexed = messages.map(indexMessage).sort((a, b) => tsNum(a.ts) - tsNum(b.ts));
  const byDocument = new Map<string, string[]>();
  const byUnit = new Map<string, string[]>();
  const channels = new Map<string, string>();
  const people = new Map<string, string>();
  const push = (map: Map<string, string[]>, key: string, ts: string) => {
    const list = map.get(key) ?? [];
    if (!list.includes(ts)) list.push(ts);
    map.set(key, list);
  };
  for (const m of indexed) {
    for (const d of m.documents) push(byDocument, d.toLowerCase(), m.ts);
    for (const q of m.quantities) push(byUnit, q.unit, m.ts);
    channels.set(m.channel, m.channel_name);
    people.set(m.user, m.user_name);
  }
  return { messages: indexed, byDocument, byUnit, channels, people };
}

export interface WorkspaceQuery {
  /** Document filename, e.g. "precharge-review-r2.docx". Matches the basename, case-insensitive. */
  document?: string;
  /** Unit the value is stated in, e.g. "uF", "s", "kg". */
  unit?: string;
  /** Words that name the quantity, e.g. "bus capacitance". Any one word must appear. */
  quantity?: string;
  /** Plain substring, case-insensitive. */
  keyword?: string;
  /** Author display name or id. */
  from?: string;
  /** Channel name with or without '#'. */
  channel?: string;
  /** Only messages at or before this ts. The trigger ts during a review. */
  before_ts?: string;
  /** Only messages that read as a change. */
  changes_only?: boolean;
  limit?: number;
}

export interface WorkspaceHit {
  ts: string;
  channel: string;
  from: string;
  text: string;
  is_change: boolean;
  documents: string[];
  values: Array<{ value: number; unit: string }>;
}

export interface WorkspaceResult {
  hits: WorkspaceHit[];
  total: number;
  truncated: boolean;
  /** ts of the latest hit that reads as a change, if any. */
  latest_change_ts?: string;
  cutoff?: string;
}

const STOP = new Set(["the", "a", "an", "of", "is", "in", "to", "for", "and", "or", "on", "at"]);
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9/]+/).filter((t) => t.length > 1 && !STOP.has(t));
}
/** Cheap stem so "capacitance" matches "capacitances" and "capacitor" matches "capacitors". */
function stem(t: string) {
  return t.replace(/(es|s)$/, "");
}

export function queryIndex(index: WorkspaceIndex, q: WorkspaceQuery): WorkspaceResult {
  const limit = Math.max(1, Math.min(q.limit ?? 40, 100));
  const unit = q.unit ? normalizeUnit(q.unit) : undefined;
  const qtoks = q.quantity ? tokens(q.quantity).map(stem) : [];
  const keyword = q.keyword?.toLowerCase();
  const doc = q.document ? basename(q.document).toLowerCase() : undefined;
  const from = q.from?.toLowerCase();
  const channel = q.channel?.replace(/^#/, "").toLowerCase();
  const cutoff = q.before_ts ? tsNum(q.before_ts) : undefined;

  const matches: IndexedMessage[] = [];
  for (const m of index.messages) {
    if (cutoff !== undefined && tsNum(m.ts) > cutoff) continue;
    if (doc && !m.documents.some((d) => d.toLowerCase() === doc)) continue;
    if (unit && !m.quantities.some((x) => x.unit === unit)) continue;
    if (qtoks.length) {
      const have = new Set(tokens(m.text).map(stem));
      if (!qtoks.some((t) => have.has(t))) continue;
    }
    if (keyword && !m.text.toLowerCase().includes(keyword)) continue;
    if (from && m.user_name.toLowerCase() !== from && m.user.toLowerCase() !== from) continue;
    if (channel && m.channel_name.toLowerCase() !== channel) continue;
    if (q.changes_only && !m.is_change) continue;
    matches.push(m);
  }
  const hits = matches.slice(0, limit).map((m) => ({
    ts: m.ts,
    channel: `#${m.channel_name}`,
    from: m.user_name,
    text: m.text,
    is_change: m.is_change,
    documents: m.documents,
    values: m.quantities.map((x) => ({ value: x.value, unit: x.unit })),
  }));
  const latestChange = matches.filter((m) => m.is_change).at(-1)?.ts;
  return {
    hits,
    total: matches.length,
    truncated: matches.length > limit,
    latest_change_ts: latestChange,
    cutoff: q.before_ts,
  };
}
