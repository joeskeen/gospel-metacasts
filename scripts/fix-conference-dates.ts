import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import {
  normalizeLabel,
  parseConferenceNav,
  resolveConferenceDates,
  type ConferenceSessionInput,
  type ParsedNavSession,
  type ResolvedSessionDate,
} from './collect-media/conference-dates.ts';

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, '..');
const confDir = join(ROOT, 'data/episodes/general-conference');

const baseUrl =
  'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';

interface SeasonFile {
  season: number;
  label: string;
  startDate: string;
  endDate: string;
  sessions: Record<string, string>;
  [key: string]: unknown;
}

interface RepairStats {
  conferences: number;
  sessions: number;
  talksUpdated: number;
  talksUnchanged: number;
  sourceCounts: Record<ResolvedSessionDate['source'], number>;
  warnings: string[];
  fallbacks: string[];
}

const stats: RepairStats = {
  conferences: 0,
  sessions: 0,
  talksUpdated: 0,
  talksUnchanged: 0,
  sourceCounts: { special: 0, explicit: 0, alt: 0, label: 0, fallback: 0 },
  warnings: [],
  fallbacks: [],
};

function replaceYamlLine(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`Missing "${key}" line`);
  }
  return content.replace(pattern, `${key}: ${value}`);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function navLabel(label: string): string {
  return normalizeLabel(label.replace(/\s*Session$/i, '').trim());
}

function parseConferenceFolder(folderName: string): { year: number; month: number } {
  const match = /^(\d{4})-(april|october)$/.exec(folderName);
  if (!match) {
    throw new Error(`Unexpected conference folder name: ${folderName}`);
  }
  return {
    year: Number(match[1]),
    month: match[2] === 'april' ? 4 : 10,
  };
}

async function repairConference(
  folderName: string,
  cachedPages: Array<{ year: number; month: number; sessions: ParsedNavSession[] }> | null
): Promise<Array<{ path: string; content: string }>> {
  const { year, month } = parseConferenceFolder(folderName);
  const conferenceKey = `${year}-${String(month).padStart(2, '0')}`;
  const folderPath = join(confDir, folderName);

  const seasonPath = join(folderPath, '_season.yml');
  if (!existsSync(seasonPath)) {
    throw new Error(`${conferenceKey}: missing _season.yml`);
  }

  const seasonContent = readFileSync(seasonPath, 'utf8');
  const season = YAML.parse(seasonContent) as SeasonFile;
  if (!season.sessions) {
    throw new Error(`${conferenceKey}: _season.yml has no sessions mapping`);
  }

  let navSessions: ParsedNavSession[];
  const cachedPage = cachedPages?.find((page) => page.year === year && page.month === month);
  if (cachedPage) {
    navSessions = cachedPage.sessions;
  } else {
    const conferenceUri = `/general-conference/${year}/${String(month).padStart(2, '0')}`;
    const pageData = await fetchJson(`${baseUrl}${conferenceUri}`);
    const rawHtml = pageData?.content?.body;
    if (!rawHtml) {
      throw new Error(`${conferenceKey}: missing HTML content`);
    }
    navSessions = await parseConferenceNav(rawHtml);
  }
  const sessionKeys = Object.keys(season.sessions).sort((a, b) => Number(a) - Number(b));

  if (sessionKeys.length !== navSessions.length) {
    stats.warnings.push(
      `${conferenceKey}: _season.yml has ${sessionKeys.length} sessions but the conference page has ${navSessions.length}`
    );
  }

  const sessionInputs: ConferenceSessionInput[] = sessionKeys.map((key, index) => {
    const seasonLabel = season.sessions[key];
    const candidates = navSessions.filter(
      (navSession) => navLabel(navSession.label) === navLabel(seasonLabel)
    );
    const navSession = candidates.length === 1 ? candidates[0] : navSessions[index];
    if (candidates.length !== 1) {
      stats.warnings.push(
        `${conferenceKey}: could not uniquely match session ${key} "${seasonLabel}" to the conference page; using position ${index + 1}`
      );
    }
    return {
      label: seasonLabel,
      texts: navSession?.texts ?? [],
      alts: navSession?.alts ?? [],
    };
  });

  const dates = resolveConferenceDates(year, month, sessionInputs);
  stats.warnings.push(...dates.warnings);

  for (const session of dates.sessions) {
    stats.sourceCounts[session.source]++;
    if (session.source === 'fallback') {
      stats.fallbacks.push(`${conferenceKey} session "${session.label}"`);
    }
  }

  console.log(
    `\n${conferenceKey} (anchor ${dates.anchor}, ${dates.startDate}..${dates.endDate})`
  );
  for (const session of dates.sessions) {
    console.log(`  ${session.date} [${session.source}] ${session.label}`);
  }

  stats.conferences++;
  stats.sessions += dates.sessions.length;

  const pendingWrites: Array<{ path: string; content: string }> = [];

  const updatedSeasonContent = replaceYamlLine(
    replaceYamlLine(seasonContent, 'startDate', dates.startDate),
    'endDate',
    dates.endDate
  );
  if (updatedSeasonContent !== seasonContent) {
    pendingWrites.push({ path: seasonPath, content: updatedSeasonContent });
  }

  const talkFiles = readdirSync(folderPath).filter(
    (file) => file.endsWith('.yml') && !file.startsWith('_')
  );

  for (const talkFile of talkFiles) {
    const talkPath = join(folderPath, talkFile);
    const talkContent = readFileSync(talkPath, 'utf8');
    const talk = YAML.parse(talkContent) as { session?: number };

    if (typeof talk.session !== 'number') {
      throw new Error(`${conferenceKey}/${talkFile}: missing numeric session`);
    }

    const sessionDate = dates.sessions[talk.session - 1]?.date;
    if (!sessionDate) {
      throw new Error(
        `${conferenceKey}/${talkFile}: session ${talk.session} has no resolved date`
      );
    }

    const updatedTalkContent = replaceYamlLine(talkContent, 'date', sessionDate);
    if (updatedTalkContent === talkContent) {
      stats.talksUnchanged++;
    } else {
      pendingWrites.push({ path: talkPath, content: updatedTalkContent });
      stats.talksUpdated++;
    }
  }

  return pendingWrites;
}

async function main(): Promise<void> {
  if (!existsSync(confDir)) {
    throw new Error(`Conference data directory not found: ${confDir}`);
  }

  const cliArgs = process.argv.slice(2);
  if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
    console.log(`Usage: node scripts/fix-conference-dates.ts [options] [cache.json]

Options:
  --dry-run     Resolve and report changes without writing files
  -h, --help    Show this help

If cache.json is omitted, conference pages are fetched from the Church website.`);
    return;
  }

  const dryRun = cliArgs.includes('--dry-run');
  const cachePath = cliArgs.find((arg) => !arg.startsWith('--'));
  const cachedPages = cachePath
    ? (JSON.parse(readFileSync(cachePath, 'utf8')) as Array<{
        year: number;
        month: number;
        sessions: ParsedNavSession[];
      }>)
    : null;
  if (cachePath) {
    console.log(`Using cached conference pages from ${cachePath}`);
  }
  if (dryRun) {
    console.log('Dry run: no files will be written');
  }

  const folders = readdirSync(confDir)
    .filter((entry) => /^\d{4}-(april|october)$/.test(entry))
    .sort();

  const errors: string[] = [];
  for (const folder of folders) {
    try {
      const pendingWrites = await repairConference(folder, cachedPages);
      if (dryRun) {
        console.log(`[dry-run] ${folder}: would write ${pendingWrites.length} file(s)`);
      } else {
        for (const write of pendingWrites) {
          writeFileSync(write.path, write.content);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${folder}: ${message}`);
      console.error(`\n${folder}: ${message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Conferences: ${stats.conferences}`);
  console.log(`Sessions: ${stats.sessions}`);
  console.log(`Talks updated: ${stats.talksUpdated}`);
  console.log(`Talks unchanged: ${stats.talksUnchanged}`);
  console.log(
    `Date sources: ${Object.entries(stats.sourceCounts)
      .map(([source, count]) => `${source}=${count}`)
      .join(', ')}`
  );

  if (stats.warnings.length) {
    console.warn(`\nWarnings (${stats.warnings.length}):`);
    for (const warning of stats.warnings) console.warn(`  - ${warning}`);
  }

  if (stats.fallbacks.length) {
    console.error(`\nUnresolved sessions (${stats.fallbacks.length}):`);
    for (const fallback of stats.fallbacks) console.error(`  - ${fallback}`);
  }

  if (errors.length) {
    console.error(`\nErrors (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
  }

  if (stats.fallbacks.length || errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
