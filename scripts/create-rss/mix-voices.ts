#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRssFeed } from './scriptures.ts';

async function loadM3U(path: string) {
  const raw = await fs.readFile(path, "utf8");
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}

async function main() {
  const female = await loadM3U(process.argv[2]);
  const male   = await loadM3U(process.argv[3]);

  const mixed = interleavePlaylists(female, male);

  const rss = createRssFeed(mixed);

  console.log(rss);
}

main();

function interleavePlaylists(femaleList: string[], maleList: string[]) {
  const result = [];
  const max = Math.max(femaleList.length, maleList.length);

  for (let i = 0; i < max; i++) {
    if (i < femaleList.length && i % 2 === 0) result.push(femaleList[i]);
    if (i < maleList.length && i % 2 === 1) result.push(maleList[i]);
  }

  return result;
}
