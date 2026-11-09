import { parseStringPromise } from 'xml2js';

/**
 * Date handling for General Conference sessions.
 *
 * General Conference is normally held on the Saturday and Sunday of the first
 * full weekend of April and October.  The Saturday of that weekend is the
 * "anchor" date.  Most sessions can be derived from the anchor plus an offset
 * based on the session label (Sunday = +1, Friday = -1, etc.).
 *
 * A small number of conferences are exceptions to the first-weekend rule, and
 * a few auxiliary broadcasts are not part of the regular conference weekend.
 * Those dates are curated below.
 */

export interface ConferenceSessionInput {
  label: string;
  texts: string[];
  alts: string[];
}

export interface ResolvedSessionDate {
  label: string;
  date: string;
  source: 'special' | 'explicit' | 'alt' | 'label' | 'fallback';
  detail?: string;
}

export interface ConferenceDates {
  anchor: string;
  sessions: ResolvedSessionDate[];
  startDate: string;
  endDate: string;
  warnings: string[];
}

export interface ParsedNavSession {
  label: string;
  texts: string[];
  alts: string[];
  links: string[];
}

/**
 * Conferences that do not follow the usual "Saturday before the first Sunday"
 * rule.  Values are the Saturday anchor for the conference weekend.
 */
const CURATED_ANCHORS: Record<string, string> = {
  '1972-04': '1972-04-08',
  '1973-04': '1973-04-07',
  '1972-10': '1972-10-07',
};

/**
 * Sessions that are not part of the regular Saturday/Sunday conference
 * weekend.  Keys are `YYYY-MM|normalized session label`.
 */
const CURATED_SESSION_DATES: Record<string, string> = {
  "1978-10|general women's meeting": '1978-09-16',
  "1979-10|women's fireside addresses": '1979-09-15',
  '1990-04|member finances fireside': '1990-02-18',
  '1992-04|relief society sesquicentennial satellite broadcast': '1992-03-14',
  '1999-04|february 1999 conversion and retention broadcast': '1999-02-21',
  '2003-04|special satellite broadcast for children': '2003-02-08',
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join('|');

const POSITIVE_CONTEXT_PATTERNS: RegExp[] = [
  /\b(address(?:es)?|message|talk|sermon)\s+(?:was|were)?\s*(?:delivered|given)\b/i,
  /\bprepared for delivery\b/i,
  /\b(?:held|given)\b[^.]{0,120}\b(?:saturday|sunday|friday|thursday|tuesday|wednesday|monday)\b/i,
  /\bsession of general conference\b/i,
  /\bgeneral conference\b[^.]{0,80}\b(?:saturday|sunday|friday|thursday|tuesday|wednesday|monday)\b/i,
  /\bmeeting\s+held\b/i,
];

const NEGATIVE_CONTEXT_PATTERNS: RegExp[] = [
  /\b(?:tomorrow|yesterday)\b/i,
  /\bdied\b/i,
  /\bpassed away\b/i,
  /\bfiscal year\b/i,
  /\bas of\b/i,
  /\banniversary of\b/i,
];

const WEEKDAY_PATTERNS: Array<[RegExp, number]> = [
  [/^Sunday\b/i, 0],
  [/^Monday\b/i, 1],
  [/^Tuesday\b/i, 2],
  [/^Wednesday\b/i, 3],
  [/^Thursday\b/i, 4],
  [/^Friday\b/i, 5],
  [/^Saturday\b/i, 6],
];

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseISO(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: string, days: number): string {
  const parsed = parseISO(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toISO(parsed);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / DAY_MS);
}

export function weekdayOf(date: string): number {
  return parseISO(date).getUTCDay();
}

/**
 * The Saturday before the first Sunday of the conference month.  If the month
 * starts on a Sunday, the anchor falls in the previous month.
 */
export function getConferenceAnchor(year: number, month: number): string {
  const key = `${year}-${pad(month)}`;
  if (CURATED_ANCHORS[key]) return CURATED_ANCHORS[key];

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstSundayDay = 1 + ((7 - firstOfMonth.getUTCDay()) % 7);
  const firstSunday = new Date(Date.UTC(year, month - 1, firstSundayDay));
  return toISO(new Date(firstSunday.getTime() - DAY_MS));
}

export function normalizeLabel(label: string): string {
  return label
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function expectedWeekday(label: string): number | null {
  for (const [pattern, weekday] of WEEKDAY_PATTERNS) {
    if (pattern.test(label)) return weekday;
  }
  return null;
}

/**
 * Offset (in days) from the conference Saturday anchor for a session label.
 * Returns null when the label is not recognized.
 */
export function sessionOffset(label: string, year?: number): number | null {
  const normalized = normalizeLabel(label);

  if (/^saturday\b/.test(normalized)) return 0;
  if (/^sunday\b/.test(normalized)) return 1;
  if (/^friday\b/.test(normalized)) return -1;
  if (/^thursday\b/.test(normalized)) return -2;
  if (/^wednesday\b/.test(normalized)) return -3;
  if (/^tuesday\b/.test(normalized)) return 3;
  if (/^monday\b/.test(normalized)) return 2;

  if (/\bpriesthood leadership\b/.test(normalized)) return -1;
  if (/\bpriesthood\b/.test(normalized)) return 0;
  if (/\bwelfare\b/.test(normalized)) return 0;

  if (/\bgeneral relief society\b/.test(normalized)) return -7;
  if (/\bgeneral young women\b/.test(normalized)) return -7;
  if (
    /^general women's$/.test(normalized) ||
    /\bgeneral women's (?:meeting|session)\b/.test(normalized)
  ) {
    // The women's session moved into the regular conference weekend in 2018.
    return year !== undefined && year >= 2018 ? 0 : -7;
  }
  if (/^women's$/.test(normalized) || /^women's session\b/.test(normalized)) return 0;

  return null;
}

interface DateCandidate {
  date: string;
  index: number;
  length: number;
  context: string;
}

function makeDate(monthName: string, day: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  const dayNumber = Number(day);
  const yearNumber = Number(year);
  if (!month || !Number.isInteger(dayNumber) || !Number.isInteger(yearNumber)) return null;

  const date = new Date(Date.UTC(yearNumber, month - 1, dayNumber));
  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== dayNumber
  ) {
    return null;
  }
  return toISO(date);
}

function findDateCandidates(text: string, fallbackYear: number): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const covered: Array<[number, number]> = [];

  const monthDayYear = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?!\\d)(?:,\\s*|\\s+)(\\d{4})\\b`,
    'gi'
  );
  for (const match of text.matchAll(monthDayYear)) {
    const date = makeDate(match[1], match[2], match[3]);
    if (!date) continue;
    const index = match.index!;
    const length = match[0].length;
    candidates.push({ date, index, length, context: '' });
    covered.push([index, index + length]);
  }

  const dayMonthYear = new RegExp(
    `\\b(\\d{1,2})(?!\\d)\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`,
    'gi'
  );
  for (const match of text.matchAll(dayMonthYear)) {
    const date = makeDate(match[2], match[1], match[3]);
    if (!date) continue;
    const index = match.index!;
    const length = match[0].length;
    candidates.push({ date, index, length, context: '' });
    covered.push([index, index + length]);
  }

  const monthDay = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?!\\d)\\b`, 'gi');
  for (const match of text.matchAll(monthDay)) {
    const index = match.index!;
    const length = match[0].length;
    if (covered.some(([start, end]) => index < end && index + length > start)) continue;

    const date = makeDate(match[1], match[2], String(fallbackYear));
    if (date) candidates.push({ date, index, length, context: '' });
  }

  for (const candidate of candidates) {
    candidate.context = text.slice(
      Math.max(0, candidate.index - 160),
      candidate.index + candidate.length + 60
    );
  }

  return candidates.sort((a, b) => a.index - b.index);
}

function isReliableContext(context: string): boolean {
  if (NEGATIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(context))) return false;
  return POSITIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(context));
}

function findExplicitDate(
  texts: string[],
  fallbackYear: number,
  anchor: string,
  label: string
): { date: string; context: string } | null {
  const expected = expectedWeekday(label);

  for (const text of texts) {
    for (const candidate of findDateCandidates(text, fallbackYear)) {
      if (!isReliableContext(candidate.context)) continue;
      if (Math.abs(diffDays(candidate.date, anchor)) > 21) continue;
      if (expected !== null && weekdayOf(candidate.date) !== expected) continue;
      return { date: candidate.date, context: candidate.context.trim() };
    }
  }

  return null;
}

function findAltDate(
  alts: string[],
  anchor: string,
  label: string
): { date: string; alt: string } | null {
  const expected = expectedWeekday(label);
  const counts = new Map<string, { count: number; alt: string }>();

  for (const alt of alts) {
    // Modern talk images use YYYYMMDD_...  Older images use YYYY-MM-<session>
    // where the last component is the session number, not the day.
    const match = /^(\d{4})(\d{2})(\d{2})_/.exec(alt);
    if (!match) continue;

    const date = makeDate(
      Object.keys(MONTHS).find((name) => MONTHS[name] === Number(match[2])) ?? '',
      String(Number(match[3])),
      match[1]
    );
    if (!date) continue;
    if (Math.abs(diffDays(date, anchor)) > 3) continue;
    if (expected !== null && weekdayOf(date) !== expected) continue;

    const existing = counts.get(date);
    counts.set(date, { count: (existing?.count ?? 0) + 1, alt });
  }

  let best: { date: string; count: number; alt: string } | null = null;
  for (const [date, value] of counts) {
    if (!best || value.count > best.count) best = { date, ...value };
  }
  return best ? { date: best.date, alt: best.alt } : null;
}

export function resolveConferenceDates(
  year: number,
  month: number,
  sessions: ConferenceSessionInput[]
): ConferenceDates {
  const conferenceKey = `${year}-${pad(month)}`;
  const anchor = getConferenceAnchor(year, month);
  const resolved: ResolvedSessionDate[] = [];
  const warnings: string[] = [];

  for (const session of sessions) {
    const label = session.label.trim();
    const specialKey = `${conferenceKey}|${normalizeLabel(label)}`;

    let date: string | undefined;
    let source: ResolvedSessionDate['source'] = 'fallback';
    let detail: string | undefined;

    if (CURATED_SESSION_DATES[specialKey]) {
      date = CURATED_SESSION_DATES[specialKey];
      source = 'special';
      detail = 'curated session date';
    }

    if (!date) {
      const explicit = findExplicitDate(session.texts, year, anchor, label);
      if (explicit) {
        date = explicit.date;
        source = 'explicit';
        detail = explicit.context;
      }
    }

    if (!date) {
      const alt = findAltDate(session.alts, anchor, label);
      if (alt) {
        date = alt.date;
        source = 'alt';
        detail = alt.alt;
      }
    }

    if (!date) {
      const offset = sessionOffset(label, year);
      if (offset !== null) {
        date = addDays(anchor, offset);
        source = 'label';

        const expected = expectedWeekday(label);
        if (expected !== null && weekdayOf(date) !== expected) {
          warnings.push(
            `${conferenceKey} session "${label}" resolved to ${date} from its label, but that is not the expected weekday`
          );
        }
      }
    }

    if (!date) {
      date = anchor;
      source = 'fallback';
      warnings.push(
        `No date rule for ${conferenceKey} session "${label}"; using conference anchor ${anchor}`
      );
    }

    if (source !== 'special' && Math.abs(diffDays(date, anchor)) > 21) {
      warnings.push(
        `${conferenceKey} session "${label}" resolved to ${date} (${diffDays(
          date,
          anchor
        )} days from anchor ${anchor})`
      );
    }

    resolved.push({ label, date, source, detail });
  }

  if (!resolved.length) {
    throw new Error(`No sessions found for ${conferenceKey}`);
  }

  // Season dates describe the conference itself, not auxiliary broadcasts held
  // weeks earlier. Keep regular sessions (including historical Thursday/Friday
  // and Tuesday sessions) and drop curated/special or week-early meetings.
  const regularSessions = resolved.filter(
    (session) => session.source !== 'special' && Math.abs(diffDays(session.date, anchor)) <= 3
  );
  const spanSessions = regularSessions.length ? regularSessions : resolved;
  const sortedDates = spanSessions.map((session) => session.date).sort();
  return {
    anchor,
    sessions: resolved,
    startDate: sortedDates[0],
    endDate: sortedDates[sortedDates.length - 1],
    warnings,
  };
}

/**
 * Parse the conference page navigation into sessions, talk text snippets, image
 * alt text, and links.  The text and alt data are used for date inference.
 */
export async function parseConferenceNav(rawHtml: string): Promise<ParsedNavSession[]> {
  const parsed = await parseStringPromise(`<x>${rawHtml}</x>`);
  const navItems = parsed?.x?.nav?.[0]?.ul?.[0]?.li || [];

  return navItems.map((li: any) => {
    const label: string = li?.h2?.[0]?.p?.[0]?._ ?? '';
    const subItems = li?.ul?.[0]?.li || [];
    const texts: string[] = [];
    const alts: string[] = [];
    const links: string[] = [];

    for (const subLi of subItems) {
      const anchor = subLi?.a?.[0];
      if (!anchor) continue;

      if (anchor.$?.href) {
        links.push(anchor.$.href.split('?')[0].replace('/study', ''));
      }
      for (const paragraph of anchor.p || []) {
        if (paragraph?._) texts.push(paragraph._);
      }
      for (const image of anchor.img || []) {
        if (image?.$?.alt) alts.push(image.$.alt);
      }
    }

    return { label, texts, alts, links };
  });
}
