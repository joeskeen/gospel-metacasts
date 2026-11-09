import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import YAML from 'yaml';
import { parseStringPromise } from 'xml2js';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';
import { parseStream } from 'music-metadata';
import { parseConferenceNav, resolveConferenceDates } from './conference-dates.ts';

interface Author {
  id: string;
  name?: string;
  title: {
    full?: string;
    short?: string;
  };
}

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, '../..');
const dataDir = join(ROOT, 'data');
const peopleDir = join(dataDir, 'people');
const confDir = join(dataDir, 'episodes/general-conference');

const baseUrl = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';

const args = process.argv.slice(2);
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

const yearArg = readArg('--year');
const fromYear = Number(readArg('--from') ?? yearArg ?? currentYear);
const toYear = Number(readArg('--to') ?? yearArg ?? currentYear);
const force = args.includes('--force');

if (
  !Number.isInteger(fromYear) ||
  !Number.isInteger(toYear) ||
  fromYear < 1971 ||
  toYear < fromYear
) {
  console.error(`Invalid year range: ${fromYear}..${toYear}`);
  printUsage();
  process.exit(1);
}

let failures = 0;

(async () => {
  for (let year = toYear; year >= fromYear; year--) {
    for (const month of [10, 4]) {
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        console.log(`Skipping future conference ${year}-${_2(month)}`);
        continue;
      }

      console.log(`Collecting General Conference for ${year}-${_2(month)}`);
      try {
        await collectConference(year, month, force);
      } catch (error) {
        failures++;
        console.error(
          `Failed to collect ${year}-${_2(month)}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  if (failures > 0) {
    console.error(`${failures} conference(s) failed; rerun the command to retry.`);
    process.exitCode = 1;
  }
})();

function printUsage() {
  console.log(`Usage: node scripts/collect-media/general-conference.ts [options]

Options:
  --year YEAR   Collect only this year (same as --from YEAR --to YEAR)
  --from YEAR   Oldest year to collect (default: current year)
  --to YEAR     Newest year to collect (default: current year)
  --force       Replace an existing conference folder instead of skipping it
  -h, --help    Show this help

Existing conference folders are skipped by default so a full-archive run cannot
create duplicate talk IDs. Use --force only when you intend to rewrite a folder.`);
}

function readArg(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function collectConference(year: number, month: number, force: boolean) {
  let confNumber = 195 - (2025 - year);
  let confNumberSuffix: string;
  if (confNumber % 10 === 1) {
    confNumberSuffix = 'st';
  } else if (confNumber % 10 === 2) {
    confNumberSuffix = 'nd';
  } else if (confNumber % 10 === 3) {
    confNumberSuffix = 'rd';
  } else {
    confNumberSuffix = 'th';
  }
  let seasonNumber = 2 * confNumber - (month === 4 ? 1 : 0);
  let confType = month === 4 ? 'Annual' : 'Semiannual';
  const conferenceUri = `/general-conference/${year}/${_2(month)}`;
  const fullUrl = `${baseUrl}${conferenceUri}`;
  const monthName = month === 10 ? 'october' : 'april';
  const talkDir = join(confDir, `${year}-${monthName}`);

  if (!force && existsSync(talkDir)) {
    console.log(`Skipping ${year}-${monthName}; ${talkDir} already exists (use --force to overwrite)`);
    return;
  }

  // Step 1: Fetch the conference page JSON
  const pageData = await fetchJson(fullUrl);
  const rawHtml = pageData?.content?.body;
  if (!rawHtml) throw new Error('Missing HTML content');

  // Step 2: Extract the sessions, talk links, and date hints from the page.
  const navSessions = await parseConferenceNav(rawHtml);
  const conferenceDates = resolveConferenceDates(year, month, navSessions);

  for (const warning of conferenceDates.warnings) {
    console.warn(`⚠️  ${warning}`);
  }
  console.log(
    `Session dates: ${conferenceDates.sessions
      .map((session) => `${session.label}=${session.date} (${session.source})`)
      .join(', ')}`
  );

  // Derive session labels from the source page so every session gets a label.
  const sessions = Object.fromEntries(
    navSessions.map((session, index) => [
      index + 1,
      session.label.replace(/\s*Session$/i, '').trim(),
    ])
  );

  const season = {
    season: seasonNumber,
    label: `${confNumber}${confNumberSuffix} ${confType} General Conference`,
    startDate: conferenceDates.startDate,
    endDate: conferenceDates.endDate,
    sessions
  };

  const talkWrites: Array<{ path: string; content: string }> = [];

  for (let sessionIndex = 1; sessionIndex <= navSessions.length; sessionIndex++) {
    const session = navSessions[sessionIndex - 1];
    const sessionDate = conferenceDates.sessions[sessionIndex - 1]?.date;
    if (!sessionDate) {
      throw new Error(
        `Missing date for ${year}-${_2(month)} session ${sessionIndex} (${session.label})`
      );
    }
    let sequence = 1;

    for (const link of session.links) {
      // Step 5: Fetch metadata for the talk
      const talkUrl = `${baseUrl}${link}`;
      const talkData = await fetchJson(talkUrl);

      const talkContent = await parseStringPromise(`<x>${talkData.content.body}</x>`);
      const talkTitle = talkContent.x.header?.[0]?.h1?.[0]?._;
      const normalizedTalkTitle = talkTitle.toLowerCase().replace(/\W+/g, '-');
      const authorArray = talkContent.x.header?.[0]?.div?.[0]?.p;
      const author = {
        id: undefined as unknown as string,
        name: authorArray?.[0]?._?.trim().replace(/^(Presented )?By /i, ''),
        title: {
          full: authorArray?.[1]?._,
          short: undefined as unknown as string
        }
      };

      // Session landing pages, music, prayers, business items, etc. have no author.
      // Skip them without advancing the session index.
      // TODO: collect longform episodes of full sessions
      if (!author.name) {
        continue;
      }

      const shortTitle = author.name?.split(/\s+/g)[0];
      author.title.short = shortTitle;
      author.name = author.name?.split(/\s+/g).slice(1).join(' ');
      author.id = author.name?.toLowerCase().replace(/[^a-zéñíó]+/gi, '-');
      if (author.id) {
        saveAuthor(author);
      }

      const summary = talkContent.x.header?.[0]?.p?.[0]?._;
      const audioUrl = talkData?.meta?.audio?.[0]?.mediaUrl;

      const talk = {
        id: `gc-${year}-${_2(month)}-${_2(sessionIndex)}-${_2(sequence)}-${author.id}-${normalizedTalkTitle}`,
        title: talkTitle,
        date: sessionDate,
        session: sessionIndex,
        sequence,
        links: {
          mp3: audioUrl
        },
        speaker: {
          id: author.id,
          title: author.title
        },
        summary,
        topics: [],
        duration: await getMp3DurationFromUrl(audioUrl)
      };
      talkWrites.push({
        path: join(talkDir, `${talk.id}.yml`),
        content: YAML.stringify(talk)
      });
      sequence++;

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Write only after every talk has been fetched so a failed run cannot leave a
  // partial conference folder behind.
  if (talkWrites.length === 0) {
    throw new Error(`No talks collected for ${year}-${monthName}; refusing to write an empty conference`);
  }

  if (force && existsSync(talkDir)) {
    const existingTalkCount = readdirSync(talkDir).filter(
      (file) => file.endsWith('.yml') && !file.startsWith('_')
    ).length;
    if (existingTalkCount > 0 && talkWrites.length < existingTalkCount) {
      throw new Error(
        `Refusing to replace ${talkDir}: collected ${talkWrites.length} talk(s), existing folder has ${existingTalkCount}`
      );
    }
    rmSync(talkDir, { recursive: true, force: true });
  }
  mkdirSync(talkDir, { recursive: true });

  for (const write of talkWrites) {
    writeFileSync(write.path, write.content);
    console.log(`wrote ${write.path}`);
  }
  writeFileSync(join(talkDir, '_season.yml'), YAML.stringify(season));
}

function saveAuthor(author: Author) {
  const authorPath = join(peopleDir, `${author.id}.yml`);
  const existingAuthor = existsSync(authorPath)
    ? YAML.parse(readFileSync(authorPath).toString())
    : {};

  writeFileSync(authorPath, YAML.stringify({
    ...existingAuthor,
    id: author.id,
    name: author.name
  }));
}

export async function getMp3DurationFromUrl(url: string) {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch MP3: ${response.statusText}`);
    }

    const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
    const metadata = await parseStream(nodeStream, undefined, { duration: true });

    const durationInSeconds = metadata.format.duration;
    return durationInSeconds ? Math.floor(durationInSeconds) : null;
  } catch (error: any) {
    console.error('Error:', error['message'], error);
    return null;
  }
}

function _2(n: number): string {
  return n.toString().padStart(2, '0');
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}
