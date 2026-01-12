#!/usr/bin/env node

import fs from "fs";
import fsp from "fs/promises";
import path, { basename } from "path";
import { buildRssFeed, updateAvailableFeeds, BASE_URL, OUT_DIR } from "./rss-utils.ts";
import type { RssEpisode } from "./rss-utils.ts";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const SCRIPTURE_DIR = path.join(import.meta.dirname, "../../data/scriptures");
const OUT = path.join(OUT_DIR, "scriptures");

const FEED_AUTHOR = "LDS Scripture Audio (unofficial)";
const FEED_COPYRIGHT = "© Intellectual Reserve, Inc. (where applicable)";
const FEED_LINK = "https://joe.skeen.rocks/metacasts/scriptures";

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
  // Example: "ot_male.m3u" or "book-of-mormon_both.m3u"
  const base = filename.replace(/\.m3u$/, "");
  const [rawGroup, rawVoice] = base.split("_");

  const group = NAME_MAP[rawGroup] ?? rawGroup;
  const voice = rawVoice as "male" | "female" | "both";

  return { group, voice };
}

function parseScriptureFilename(url: string) {
  const filename = path.basename(url);
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("-");

  // Expected pattern:
  // 2015-11-0010-genesis-01-female-voice-64k-eng.mp3
  if (parts.length < 9) {
    return {
      bookId: base,
      bookTitle: base,
      chapter: "1",
      voice: "unknown",
      language: "eng",
      bitrateKbps: 64,
    };
  }

  const bookId = parts[3];
  const chapter = parts[4];
  const voice = parts[5]; // male/female
  const bitrate = parseInt(parts[7].replace("k", ""), 10);
  const language = parts[8];

  return {
    bookId,
    bookTitle: bookId.charAt(0).toUpperCase() + bookId.slice(1),
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
    duration: "0", // optional: compute via HEAD or ffprobe
    author: FEED_AUTHOR,
    links: { mp3: url },
    season: { season: "1" },
  };
}

// ---------------------------------------------------------------------------
// Main feed builder
// ---------------------------------------------------------------------------

async function buildScriptureFeed(m3uPath: string) {
  const filename = path.basename(m3uPath);
  const { group, voice } = parseFeedFilename(filename);

  const urls = await loadM3U(m3uPath);

  const episodes: RssEpisode[] = urls.map((url, index) => {
    const meta = parseScriptureFilename(url);
    return scriptureToRssEpisode(meta, url, index, group, voice);
  });

  const feedTitle = `${group.replace(/-/g, " ")} (${voice})`;
  const feedPath = `scriptures/${group}_${voice}.rss`;

  const metadata = {
    title: feedTitle,
    description: feedTitle,
    image: `${BASE_URL}/assets/logo.png`,
    link: FEED_LINK,
    feedPath,
    author: FEED_AUTHOR,
    copyright: FEED_COPYRIGHT,
  };

  return {metadata, rss: buildRssFeed(episodes, metadata)};
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
    const {metadata, rss} = await buildScriptureFeed(fullPath);

    const outName = basename(metadata.feedPath);
    const outPath = path.join(OUT, outName);

    fs.writeFileSync(outPath, rss);
    console.log(`✅ Generated ${outPath}`);
  }

  const count = updateAvailableFeeds();
  console.log(`${count} available feeds`);
}

main();
