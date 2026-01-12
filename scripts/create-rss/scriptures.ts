#!/usr/bin/env node

import fs from "fs";
import fsp from "fs/promises";
import path, { basename } from "path";
import { buildRssFeed, updateAvailableFeeds, BASE_URL, OUT_DIR } from "./rss-utils.ts";
import type { RssEpisode } from "./rss-utils.ts";
import { capitalCase } from 'change-case';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const SCRIPTURE_DIR = path.join(import.meta.dirname, "../../data/scriptures");
const OUT = path.join(OUT_DIR, "scriptures");

const FEED_AUTHOR = "The Church of Jesus Christ of Latter-Day Saints";
const FEED_COPYRIGHT = "© Intellectual Reserve, Inc. (where applicable)";
const FEED_LINK = "https://joe.skeen.rocks/gospel-metacasts/scriptures";

const DISCLAIMER = `This meta-podcast is not published, maintained, or endorsed by The Church of Jesus Christ of Latter-Day Saints, but instead by a faithful member of the Church who is seeking ways to make consuming Gospel content easier for everyone. If there are any mistakes, please report them on GitHub and we'll try to get them fixed.`;

// Map abbreviations → full names
const NAME_MAP: Record<string, string> = {
  ot: "old-testament",
  nt: "new-testament",
  bom: "book-of-mormon",
  dc: "doctrine-and-covenants",
  pgp: "pearl-of-great-price",
  bible: "bible",
  triple: "triple",
  allscriptures: "all-scriptures",
  allbutbom: "all-but-book-of-mormon",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadM3U(filePath: string): Promise<string[]> {
  const raw = await fsp.readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function parseFeedFilename(filename: string) {
  const base = filename.replace(/\.m3u$/, "");
  const [rawGroup, rawVoice] = base.split("_");

  const group = NAME_MAP[rawGroup] ?? rawGroup;
  const voice = rawVoice as "male" | "female" | "both";

  return { group, voice, rawGroup };
}

function parseScriptureFilename(url: string) {
  const filename = path.basename(url);
  const base = filename.replace(/\.[^.]+$/, "");
  const pattern = /^\d+-\d+-\d+-((?:\d+-)?(?:[A-Za-z]+(?:-[A-Za-z]+)*))-?(\d*)-(male|female)-voice-(64)k-(eng).mp3$/g;
  const match = pattern.exec(filename);
  
  if (!match) {
    throw new Error('Name of file not in expected format: ' + filename);
  }
  
  const book = match[1];
  const chapter = +match[2];
  const voice = match[3];
  const bitrate = +match[4];
  const language = match[5];

  return {
    bookId: book,
    bookTitle: capitalCase(book),
    chapter,
    voice,
    language,
    bitrateKbps: bitrate,
  };
}

function scriptureToRssEpisode(
  src: ReturnType<typeof parseScriptureFilename>,
  url: string,
  index: number,
  group: string,
  voice: string
): RssEpisode {
  const chapterNum = parseInt(src.chapter, 10);
  const title = `${src.bookTitle} ${chapterNum}`;

  const description = `${title} (${src.voice} voice, ${src.language}, ${src.bitrateKbps}kbps)

Volume: ${group}
Book: ${src.bookTitle}
Chapter: ${chapterNum}
Voice: ${src.voice}
Language: ${src.language}

${DISCLAIMER}`;

  const pubDate = new Date(
    new Date("2000-01-01T00:00:00Z").getTime() + index * 86400000
  ).toUTCString();

  return {
    id: `${group}-${src.bookId}-${src.chapter}-${voice}`,
    title,
    description,
    pubDate,
    image: `${BASE_URL}/assets/logo.png`,
    duration: "0",
    author: FEED_AUTHOR,
    links: { mp3: url },
    season: { season: "1" },
  };
}

// ---------------------------------------------------------------------------
// Interleaving logic for BOTH feeds
// ---------------------------------------------------------------------------

function interleave(male: string[], female: string[]): string[] {
  const result: string[] = [];
  const max = Math.max(male.length, female.length);

  for (let i = 0; i < max; i++) {
    if (i % 2 === 0 && i < male.length) result.push(male[i]);
    if (i % 2 === 1 && i < female.length) result.push(female[i]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main feed builder
// ---------------------------------------------------------------------------

async function buildScriptureFeed(m3uPath: string) {
  const filename = path.basename(m3uPath);
  const { group, voice, rawGroup } = parseFeedFilename(filename);

  let urls: string[] = [];

  if (voice === "both") {
    const malePath = path.join(SCRIPTURE_DIR, `${rawGroup}_male.m3u`);
    const femalePath = path.join(SCRIPTURE_DIR, `${rawGroup}_female.m3u`);

    const male = fs.existsSync(malePath) ? await loadM3U(malePath) : [];
    const female = fs.existsSync(femalePath) ? await loadM3U(femalePath) : [];

    urls = interleave(male, female);
  } else {
    urls = await loadM3U(m3uPath);
  }

  const episodes: RssEpisode[] = urls.map((url, index) => {
    const meta = parseScriptureFilename(url);
    return scriptureToRssEpisode(meta, url, index, group, voice);
  });

  const feedTitle = `${group.replace(/-/g, " ")} (${voice})`;
  const feedPath = voice === 'both' ? `scriptures/${group}.rss` : `scriptures/${group}_${voice}.rss`;

  const meta = {
    title: feedTitle,
    description: feedTitle,
    image: `${BASE_URL}/assets/logo.png`,
    link: FEED_LINK,
    feedPath,
    author: FEED_AUTHOR,
    copyright: FEED_COPYRIGHT,
  };

  return {meta, rss: buildRssFeed(episodes, meta)};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const files = fs
    .readdirSync(SCRIPTURE_DIR)
    .filter((f) => f.endsWith(".m3u"));

  for (const file of files) {
    const fullPath = path.join(SCRIPTURE_DIR, file);
    const {meta, rss} = await buildScriptureFeed(fullPath);

    const outName = basename(meta.feedPath);
    const outPath = path.join(OUT, outName);

    fs.writeFileSync(outPath, rss);
    console.log(`✅ Generated ${outPath}`);
  }

  const count = updateAvailableFeeds();
  console.log(`${count} available feeds`);
}

main();
