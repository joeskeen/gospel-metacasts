import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import YAML from 'yaml';
import { parseStringPromise } from 'xml2js';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';
import { parseStream } from 'music-metadata';

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

const startYear = 1972;
const endYear = 1971;

(async () => {
  for (let year = startYear; year >= endYear; year--) {
    for (const month of [10, 4]) {
      console.log(`Collecting General Conference for ${year}-${_2(month)}`);
      await collectConference(year, month);
    }
  }
})();

async function collectConference(year: number, month: number) {
  let day = 1;
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

  // Step 1: Fetch the conference page JSON
  const pageData = await fetchJson(fullUrl);
  const rawHtml = pageData?.content?.body;
  if (!rawHtml) throw new Error('Missing HTML content');

  // Step 2: Wrap and parse the HTML as XML
  const wrappedXml = `<x>${rawHtml}</x>`;
  const parsed = await parseStringPromise(wrappedXml);

  // Step 3: Extract talk links
  const rawLinks: string[] = [];
  const navItems = parsed?.x?.nav?.[0]?.ul?.[0]?.li || [];
  for (const li of navItems) {
    const subItems = li?.ul?.[0]?.li || [];
    for (const subLi of subItems) {
      const href = subLi?.a?.[0]?.$.href;
      if (href) rawLinks.push(href);
    }
  }

  // Step 4: Clean the links
  const talkLinks = rawLinks.map(link => link.split('?')[0].replace('/study', ''));

  let sessionIndex = 0;
  let sequence = 1;

  const season = {
    season: seasonNumber,
    label: `${confNumber}${confNumberSuffix} ${confType} General Conference`,
    startDate: `${year}-${_2(month)}-01`,
    endDate: `${year}-${_2(month)}-01`,
    sessions: {
      1: 'Saturday Morning',
      2: 'Saturday Afternoon',
      3: 'Saturday Evening',
      4: 'Sunday Morning',
      5: 'Sunday Afternoon'
    }
  };

  const monthName = month === 10 ? 'october' : 'april';
  const talkDir = join(confDir, `${year}-${monthName}`);
  if (!existsSync(talkDir)) {
    mkdirSync(talkDir);
  }
  writeFileSync(join(talkDir, `_season.yml`), YAML.stringify(season));

  for (const link of talkLinks) {
    // Step 5: Fetch metadata for the talk
    const talkUrl = `${baseUrl}${link}`;
    const talkData = await fetchJson(talkUrl);

    const talkContent = await parseStringPromise(`<x>${talkData.content.body}</x>`);
    const talkTitle = talkContent.x.header?.[0]?.h1?.[0]?._;
    const normalizedTalkTitle = talkTitle.toLowerCase().replace(/\W+/g, '-');
    const authorArray = talkContent.x.header?.[0]?.div?.[0]?.p;
    const author = {
      id: undefined as unknown as string,
      name: authorArray?.[0]?._.trim().replace(/^(Presented )?By /i, ''),
      title: {
        full: authorArray?.[1]?._,
        short: undefined as unknown as string
      }
    };

    // TODO: collect longform episodes of full sessions
    if (!author.name) {
      sessionIndex++;
      sequence = 1;
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
      date: `${year}-${_2(month)}-${_2(day)}`,
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
    saveTalk(talk, month, year);
    sequence++;

    await new Promise(resolve => setTimeout(resolve, 5000));
  }
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

function saveTalk(talk: Author, month: number, year: number) {
  const monthName = month === 10 ? 'october' : 'april';
  const talkDir = join(confDir, `${year}-${monthName}`);
  if (!existsSync(talkDir)) {
    mkdirSync(talkDir);
  }
  const talkPath = join(talkDir, `${talk.id}.yml`);
  writeFileSync(talkPath, YAML.stringify(talk));
  console.log(`wrote ${talkPath}`);
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
