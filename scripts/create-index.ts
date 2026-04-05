import fs from "fs";
import path, { join } from "path";
import { getEpisodes, type Episode } from "./episodes.ts";

const __dirname = import.meta.dirname;
const OUT_DIR = join(__dirname, "../out");

interface Feed {
  path: string;
  type: string;
  name: string;
  image: string;
}

function main() {
  const episodes = getEpisodes();
  const episodeList = Array.from(episodes.values()).map(ep => ({
    source: ep.source,
    id: ep.id,
    title: ep.title,
    date: ep.date,
    session: ep.session,
    sequence: ep.sequence,
    links: ep.links,
    speaker: ep.speaker,
    topics: ep.topics,
    duration: ep.duration,
    metadata: {
      artist: ep.metadata.artist,
      album: ep.metadata.album,
      season: ep.metadata.season
    }
  } satisfies Episode));

  const feeds: Feed[] = [];

  if (fs.existsSync(join(OUT_DIR, 'index.json'))) {
    const indexData = JSON.parse(fs.readFileSync(join(OUT_DIR, 'index.json'), 'utf-8'));
    feeds.push(...(indexData.availableFeeds || []));
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(
    join(OUT_DIR, "episodes-index.json"),
    JSON.stringify({ episodes: episodeList, feeds })
  );
  console.log(`✅ Generated episodes index with ${episodeList.length} episodes and ${feeds.length} feeds`);
}

main();