#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { capitalCase } from 'change-case';

// --- CONFIG -------------------------------------------------------------

const INPUT_M3U = process.argv[2];
if (!INPUT_M3U) {
  console.error('Usage: node generate-podcast.mjs <playlist.m3u>');
  process.exit(1);
}

const FEED_TITLE = 'Bible Audio Chapters';
const FEED_DESCRIPTION =
  'A podcast feed generated from an M3U playlist of scripture chapter recordings.';
const FEED_LINK = 'https://example.com/podcast';
const FEED_AUTHOR = 'LDS Scripture Audio';
const FEED_LANGUAGE = 'en-us';
const FEED_COPYRIGHT = '© Intellectual Reserve, Inc. (where applicable)';
const FEED_DISCLAIMER = `This meta-podcast is not published, maintained, or endorsed by The Church of Jesus Christ of Latter-Day Saints, but instead by a faithful member of the Church who is seeking ways to make consuming Gospel content easier for everyone. If there are any mistakes, please report them on GitHub and we'll try to get them fixed.`;

// ------------------------------------------------------------------------

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Example filename:
// 2015-11-0010-genesis-01-female-voice-64k-eng.mp3
function parseFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, ''); // strip extension

  const parts = base.split('-');
  // [0]=2015, [1]=11, [2]=0010, [3]=genesis, [4]=01, [5]=female, [6]=voice, [7]=64k, [8]=eng

  if (parts.length < 9) {
    return {
      book: base,
      chapter: null,
      voice: null,
      bitrate: null,
      language: null,
    };
  }

  const book = parts[3];
  const chapter = parts[4];
  const voice = `${parts[5]} ${parts[6]}`; // "female voice"
  const bitrate = parts[7]; // "64k"
  const language = parts[8]; // "eng"

  return { book, chapter, voice, bitrate, language };
}

async function main() {
  const raw = await fs.readFile(INPUT_M3U, 'utf8');

  const urls = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

    createRssFeed(urls);
}

export function createRssFeed(urls: string[]) {
      // Start all episodes far in the past
  const START_DATE = new Date('2000-01-01T00:00:00Z');

  const items = urls.map((url, index) => {
    const volume = path.basename(path.dirname(url));
    const filename = path.basename(url);
    const meta = parseFromFilename(filename);

    const bookTitle = meta.book ? meta.book.charAt(0).toUpperCase() + meta.book.slice(1) : filename;

    const chapterLabel = meta.chapter ? meta.chapter : '';
    const voiceLabel = meta.voice
      ? ` (${meta.voice.replace(/\b\w/g, (c) => c.toUpperCase())})`
      : '';

    const title = chapterLabel
      ? `${bookTitle} ${chapterLabel}`
      : `${bookTitle}`;

    const guid = uuidv4();

    // Sequential pubDate: oldest episode gets the earliest date
    const pubDate = new Date(START_DATE.getTime() + index * 24 * 60 * 60 * 1000).toUTCString();

    const descriptionParts = [];
    descriptionParts.push(`Volume: ${capitalCase(volume)}`);
    descriptionParts.push(`Book: ${bookTitle}`);
    if (meta.chapter) descriptionParts.push(`Chapter: ${meta.chapter}`);
    if (meta.voice) descriptionParts.push(`Voice: ${meta.voice}`);
    if (meta.language) descriptionParts.push(`Language: ${meta.language}`);

    const description = descriptionParts.join(' • ');

    return { url, title, guid, pubDate, description, volume };
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom">

  <channel>
    <title>${escapeXml(capitalCase(items[0].volume))}</title>
    <link>${escapeXml(FEED_LINK)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>${FEED_LANGUAGE}</language>
    <copyright>${escapeXml(FEED_COPYRIGHT)}</copyright>
    <itunes:author>${escapeXml(FEED_AUTHOR)}</itunes:author>
    <atom:link href="${escapeXml(FEED_LINK)}/feed.xml" rel="self" type="application/rss+xml"/>

${items
  .map(
    (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <guid isPermaLink="false">${item.guid}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
      <enclosure url="${escapeXml(item.url)}" type="audio/mpeg"/>
    </item>
`
  )
  .join('')}
  </channel>
</rss>
`;

  console.log(rss);
}

// main();
