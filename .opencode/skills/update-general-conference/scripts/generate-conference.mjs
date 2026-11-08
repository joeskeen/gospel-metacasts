#!/usr/bin/env node
//
// Generate General Conference episode YAML from the JSON produced by
// gather-conference.js.
//
// Usage:
//   node generate-conference.mjs --input <gather.json> --year 2026 --month 4
//   node generate-conference.mjs --input <gather.json> --year 2026 --month 4 --dry-run
//
// --force overwrites files in an existing conference folder. It does not delete
// stale files.

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const SCRIPT_DIR = import.meta.dirname;
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const EPISODE_DIR = path.join(ROOT, 'data/episodes/general-conference');
const PEOPLE_DIR = path.join(ROOT, 'data/people');

const HONORIFICS = new Set([
  'Elder',
  'President',
  'Sister',
  'Brother',
  'Bishop',
]);

function usage() {
  console.error(
    'Usage: node generate-conference.mjs --input <gather.json> --year <year> --month <4|10> [--dry-run] [--force]'
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, force: false };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--year') args.year = Number(argv[++i]);
    else if (arg === '--month') args.month = Number(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') usage();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.input || !args.year || !args.month) usage();
  if (![4, 10].includes(args.month)) {
    throw new Error('--month must be 4 or 10');
  }

  return args;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-zéñíó]+/gi, '-');
}

function slugifyTitle(title) {
  return title.toLowerCase().replace(/\W+/g, '-');
}

function parseAuthor(authorName, authorRole) {
  const raw = (authorName || '')
    .replace(/^(Presented\s+)?By\s+/i, '')
    .trim();

  if (!raw) throw new Error('Empty author name');

  const tokens = raw.split(/\s+/);
  let short = '';
  let name = raw;

  if (tokens.length > 1 && HONORIFICS.has(tokens[0])) {
    short = tokens[0];
    name = tokens.slice(1).join(' ');
  }

  return {
    id: slugifyName(name),
    name,
    title: {
      ...(authorRole ? { full: authorRole } : {}),
      short,
    },
  };
}

function normalizeInput(input) {
  const sessions = (input.sessions || []).map((session, index) => ({
    index: session.index ?? index + 1,
    label: (session.label || session.text || `Session ${index + 1}`).replace(
      /\s+Session$/i,
      ''
    ),
    description: session.description || '',
  }));

  const talks = (input.talks || []).map((talk) => ({
    href: talk.href || talk.rel || '(unknown)',
    title: talk.title,
    authorName: talk.authorName || talk.authorPs?.[0] || '',
    authorRole: talk.authorRole || talk.authorPs?.[1] || '',
    summary: talk.summary || '',
    audio: talk.audio,
    datePublished: talk.datePublished,
    duration: talk.duration,
    session: talk.session,
    sequence: talk.sequence,
  }));

  return {
    title: input.title || input.confTitle || '',
    sessions,
    talks,
  };
}

function inferConference(input, year, month) {
  const description =
    input.sessions?.find((session) => session.description)?.description || '';
  const match = description.match(/(\d+)(?:st|nd|rd|th)\s+(annual|semiannual)/i);

  if (match) {
    return {
      confNumber: Number(match[1]),
      confType:
        match[2][0].toUpperCase() + match[2].slice(1).toLowerCase(),
    };
  }

  // Repo convention for conferences without a parsed description.
  const confNumber = 195 - (2025 - year);
  return {
    confNumber,
    confType: month === 4 ? 'Annual' : 'Semiannual',
  };
}

function buildTalk(inputTalk, year, month) {
  const author = parseAuthor(inputTalk.authorName, inputTalk.authorRole);
  const date = (inputTalk.datePublished || '').slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Missing/invalid datePublished for ${inputTalk.href}`);
  }
  if (!inputTalk.audio) {
    throw new Error(`Missing audio for ${inputTalk.href}`);
  }
  if (!inputTalk.title) {
    throw new Error(`Missing title for ${inputTalk.href}`);
  }

  const titleSlug = slugifyTitle(inputTalk.title);
  const id = `gc-${year}-${pad2(month)}-${pad2(inputTalk.session)}-${pad2(
    inputTalk.sequence
  )}-${author.id}-${titleSlug}`;

  const talk = {
    id,
    title: inputTalk.title,
    date,
    session: inputTalk.session,
    sequence: inputTalk.sequence,
    links: {
      mp3: inputTalk.audio,
    },
    speaker: {
      id: author.id,
      title: author.title,
    },
    ...(inputTalk.summary ? { summary: inputTalk.summary } : {}),
    topics: [],
    ...(Number.isFinite(inputTalk.duration)
      ? { duration: inputTalk.duration }
      : {}),
  };

  return { talk, author };
}

function main() {
  const args = parseArgs(process.argv);
  const input = normalizeInput(
    JSON.parse(fs.readFileSync(args.input, 'utf8'))
  );

  if (!Array.isArray(input.sessions) || !Array.isArray(input.talks)) {
    throw new Error('Input must contain sessions[] and talks[]');
  }

  const { confNumber, confType } = inferConference(
    input,
    args.year,
    args.month
  );
  const seasonNumber = 2 * confNumber - (args.month === 4 ? 1 : 0);

  const dates = input.talks
    .map((talk) => (talk.datePublished || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  if (!dates.length) throw new Error('No talk dates found in input');

  const sessions = {};
  for (const session of input.sessions) {
    sessions[session.index] = session.label;
  }

  const season = {
    season: seasonNumber,
    label: `${ordinal(confNumber)} ${confType} General Conference`,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    sessions,
  };

  const monthName = args.month === 10 ? 'october' : 'april';
  const conferenceDir = path.join(
    EPISODE_DIR,
    `${args.year}-${monthName}`
  );

  const built = input.talks.map((talk) =>
    buildTalk(talk, args.year, args.month)
  );

  const ids = new Set();
  for (const { talk } of built) {
    if (ids.has(talk.id)) {
      throw new Error(`Duplicate talk id: ${talk.id}`);
    }
    ids.add(talk.id);
  }

  const peopleToCreate = [];
  for (const { author } of built) {
    const personPath = path.join(PEOPLE_DIR, `${author.id}.yml`);
    if (!fs.existsSync(personPath)) {
      peopleToCreate.push({
        path: personPath,
        data: { id: author.id, name: author.name },
      });
    }
  }

  console.log(`Conference: ${season.label}`);
  console.log(`Season: ${season.season}`);
  console.log(`Dates: ${season.startDate} .. ${season.endDate}`);
  console.log(
    `Sessions: ${Object.entries(sessions)
      .map(([index, label]) => `${index}=${label}`)
      .join(', ')}`
  );
  console.log(`Talks: ${built.length}`);
  console.log(
    `New people: ${peopleToCreate.length}${
      peopleToCreate.length
        ? ` (${peopleToCreate.map((person) => person.data.id).join(', ')})`
        : ''
    }`
  );

  if (args.dryRun) {
    console.log('\nDry run: no files written.');
    for (const { talk } of built) {
      console.log(`  ${talk.id}`);
    }
    return;
  }

  if (fs.existsSync(conferenceDir) && !args.force) {
    throw new Error(
      `${conferenceDir} already exists. Re-run with --force to overwrite, or remove it first.`
    );
  }

  fs.mkdirSync(conferenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(conferenceDir, '_season.yml'),
    YAML.stringify(season)
  );

  for (const { talk } of built) {
    fs.writeFileSync(
      path.join(conferenceDir, `${talk.id}.yml`),
      YAML.stringify(talk)
    );
  }

  for (const person of peopleToCreate) {
    fs.writeFileSync(person.path, YAML.stringify(person.data));
  }

  console.log(
    `\nWrote ${built.length} talks + _season.yml to ${path.relative(
      ROOT,
      conferenceDir
    )}`
  );

  if (peopleToCreate.length) {
    console.log(
      `Created ${peopleToCreate.length} people files. Add website/photo next.`
    );
  }
}

main();
