/**
 * Workspace index: what the reviewer can look up outside the current thread.
 *
 * Built once from a Slack export in the fixture message shape and queried by
 * identifier, never by similarity: a document name, a unit, the words of a
 * quantity, a keyword, an author. A query returns every matching message up
 * to the cutoff, in ts order, so a correction cannot be dropped by a ranking.
 * Pure functions; the tool in reviewer-tools.tsx does the loading and the
 * evidence recording.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { CHANGE_PATTERN, tsNum } from "./revision";

export const workspaceMessage = z.object({
  ts: z.string().min(1),
  channel: z.string().min(1),
  channel_name: z.string().min(1),
  user: z.string().min(1),
  user_name: z.string().min(1),
  thread_ts: z.string().nullable().optional(),
  text: z.string(),
  files: z.array(z.string()).default([]),
});
export type WorkspaceMessage = z.infer<typeof workspaceMessage>;

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

  // Spelled out. An engineer typing "bus is 820 microfarad" or "closes at 2.5
  // sec" is stating the same quantity as "820 uF" and "2.5 s", and the index is
  // the only thing standing between that message and a review that needs it.
  // Exact match, not fuzzy: these are spellings of a unit, not similar words.
  microfarad: "uF", microfarads: "uF", "micro-farad": "uF", "micro-farads": "uF",
  millifarad: "mF", millifarads: "mF", nanofarad: "nF", nanofarads: "nF",
  farad: "F", farads: "F",
  kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  "kilowatt-hour": "kWh", "kilowatt-hours": "kWh", "kilowatt hour": "kWh", "kilowatt hours": "kWh",
  "watt-hour": "Wh", "watt-hours": "Wh",
  volt: "V", volts: "V", millivolt: "mV", millivolts: "mV",
  ampere: "A", amperes: "A", amp: "A", amps: "A",
  milliampere: "mA", milliamperes: "mA", milliamp: "mA", milliamps: "mA",
  millisecond: "ms", milliseconds: "ms", msec: "ms", msecs: "ms",
  second: "s", seconds: "s", sec: "s", secs: "s",
  kilometre: "km", kilometres: "km", kilometer: "km", kilometers: "km",
  millimetre: "mm", millimetres: "mm", millimeter: "mm", millimeters: "mm",
  watt: "W", watts: "W", kilowatt: "kW", kilowatts: "kW",
  dollar: "USD", dollars: "USD",
};

/**
 * Number followed by a unit, in two passes.
 *
 * Symbols stay case-sensitive, because single letters are ambiguous in prose:
 * with a case-insensitive match "5 a.m." reads as 5 amperes and "part 3 v2" as
 * 3 volts. Spelled-out units have no such collision, so those match in any
 * case — someone starting a sentence with "Microfarads..." still counts.
 *
 * Within each alternation, every spelling sits before any spelling it is a
 * prefix of: milli- before its bare unit, kilowatt-hour before watt-hour, mA
 * before A. The trailing lookahead stops "3 sections" reading as 3 seconds.
 */
const SYMBOL_RE =
  /(\d+(?:\.\d+)?)\s*(µF|uF|mF|nF|kWh|Wh|kW|kg|km|mm|mA|ms|m\/s|ohms?|Ω|percent|%|USD|V|A|W|s)(?![A-Za-z0-9/])/g;

const WORD_RE =
  /(\d+(?:\.\d+)?)\s*(micro-?farads?|millifarads?|nanofarads?|farads?|kilowatt[- ]hours?|watt[- ]hours?|kilowatts?|milliamperes?|milliamps?|amperes?|amps?|millivolts?|volts?|milliseconds?|msecs?|seconds?|secs?|kilograms?|kilometres?|kilometers?|millimetres?|millimeters?|watts?|dollars?|ohms?)(?![A-Za-z0-9/])/gi;

const DOC_RE = /\b([A-Za-z0-9._-]+\.(?:docx|xlsx|pdf))\b/g;

export function normalizeUnit(raw: string): string {
  return UNIT_ALIASES[raw.toLowerCase()] ?? raw;
}

export function extractQuantities(text: string): QuantityMention[] {
  const found = new Map<number, QuantityMention>();
  for (const re of [SYMBOL_RE, WORD_RE]) {
    for (const m of text.matchAll(re)) {
      // Keyed by offset so a number matched by both passes is counted once.
      if (found.has(m.index)) continue;
      const before = text.slice(0, m.index).trim().split(/\s+/).slice(-4).join(" ").toLowerCase();
      found.set(m.index, { value: Number(m[1]), unit: normalizeUnit(m[2]!), context: before });
    }
  }
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, q]) => q);
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

/**
 * Whether a message is by the person the query named.
 *
 * Exact full-name matching looks strict and correct and is neither: a reviewer
 * naturally searches `from: "Dara"` for Dara Voss, gets nothing back, and has
 * no way to tell "she said nothing" from "you spelled her differently". Empty
 * results that mean the wrong thing are the specific failure this index exists
 * to avoid, so a whole name part counts.
 *
 * Whole parts only. "Dar" is a typo, not a name, and matching it would start
 * returning other people's messages.
 */
function authorMatches(m: IndexedMessage, from: string): boolean {
  const name = m.user_name.toLowerCase();
  if (name === from || m.user.toLowerCase() === from) return true;
  return name.split(/\s+/).includes(from);
}

/**
 * Whether a named document is the one the query means.
 *
 * Third instance of the same shape: the index stores `precharge-review-r2.docx`
 * and a reviewer reasonably asks for `precharge-review-r2`, having read the
 * name off a sentence rather than a filename. Dropping the extension counts;
 * a prefix does not, so r2 never answers for r3.
 */
function documentMatches(indexed: string, query: string): boolean {
  const a = indexed.toLowerCase();
  const b = query.toLowerCase();
  if (a === b) return true;
  const strip = (n: string) => n.replace(/\.(docx|xlsx|pdf)$/, "");
  return strip(a) === strip(b);
}

/**
 * Whether a message is in the channel the query named.
 *
 * Same reasoning as authorMatches: `#ks4-purchasing` is what the channel is
 * called, but "purchasing" is what someone looking for it types, and an exact
 * match answers that with silence. A hyphen-separated part counts, so "ks4"
 * legitimately spans every ks4-* channel — a broad query honestly answered
 * beats a narrow one answered wrongly.
 */
function channelMatches(m: IndexedMessage, channel: string): boolean {
  const name = m.channel_name.toLowerCase();
  return name === channel || name.split("-").includes(channel);
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
    if (doc && !m.documents.some((d) => documentMatches(d, doc))) continue;
    if (unit && !m.quantities.some((x) => x.unit === unit)) continue;
    if (qtoks.length) {
      const have = new Set(tokens(m.text).map(stem));
      if (!qtoks.some((t) => have.has(t))) continue;
    }
    if (keyword && !m.text.toLowerCase().includes(keyword)) continue;
    if (from && !authorMatches(m, from)) continue;
    if (channel && !channelMatches(m, channel)) continue;
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

/* ------------------------------------------------------------- loading */

export const DEFAULT_WORKSPACE_EXPORT = "fixtures/workspace/kestrel-workspace.json";

export function loadWorkspaceExport(path: string): WorkspaceMessage[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const list = Array.isArray(raw) ? raw : (raw as { messages?: unknown[] }).messages ?? [];
  return z.array(workspaceMessage).parse(list);
}

let cached: { path: string; index: WorkspaceIndex } | undefined;

/** The process-wide index. WORKSPACE_EXPORT overrides the path; the fixture export is the default. */
export function workspaceIndex(repoRoot: string): WorkspaceIndex {
  const path = resolve(repoRoot, process.env.WORKSPACE_EXPORT ?? DEFAULT_WORKSPACE_EXPORT);
  if (cached?.path === path) return cached.index;
  const index = buildIndex(loadWorkspaceExport(path));
  cached = { path, index };
  return index;
}

/** Test hook. */
export function resetWorkspaceIndex() {
  cached = undefined;
}
