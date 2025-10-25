import fs, { existsSync } from "fs";
import path, { join } from "path";
import yaml from "yaml";
import { getPeople } from "../people.ts";
import { buildRssFeed, updateAvailableFeeds, BASE_URL, OUT_DIR } from "./rss-utils.ts";
import type {RssEpisode} from './rss-utils.ts';
import { getEpisodes } from "../episodes.ts";
import type { Episode } from '../episodes.ts';

const __dirname = import.meta.dirname;

const ROOT_DIR = join(__dirname, "../../data/episodes/general-conference");
const GC_OUT_DIR = join(OUT_DIR, "general-conference");

const people = getPeople();
const allEpisodes = getEpisodes();

function loadYaml<T = any>(filePath: string): T {
  return existsSync(filePath)
    ? (yaml.parse(fs.readFileSync(filePath, "utf8")) as T)
    : ({} as unknown as T);
}

function generatePubDate(
  date: string,
  session: number,
  sequence: number
): string {
  const sessionStartHours: Record<number, number> = {
    1: 10,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
  };
  const baseHour = sessionStartHours[session] ?? 10;
  const minute = sequence * 5;
  const localTime = new Date(
    `${date}T${String(baseHour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:00-06:00`
  );
  return localTime.toUTCString();
}

function processConference(
  folderPath: string
): {
  rss: string;
  episodes: RssEpisode[];
} {
  const episodeFiles = fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .map((f) => join(folderPath, f));

  const episodesInFolder = episodeFiles
    .map((file) => {
      const id = path.basename(file).replace(/\.yml$/, '');
      return allEpisodes.get(id);
    })
    .filter((ep): ep is Episode => ep !== undefined);

  if (episodesInFolder.length === 0) return { rss: '', episodes: [] };
  
  // Use metadata from the first episode (they should all have the same metadata in the folder)
  const firstEp = episodesInFolder[0];
  const { metadata: { season, artist } } = firstEp;

  const formattedEpisodes = episodesInFolder.map(ep => {
    const speakerName =
      people.get(ep.speaker?.id ?? '')?.name ??
      ep.speaker?.id?.replace(/-/g, " ") ??
      "Unknown Speaker";
    const fullSpeakerName =
      `${ep.speaker?.title?.short} ${speakerName}, ${ep.speaker?.title?.full}`.trim();
    
    const description = `${ep.title} by ${fullSpeakerName}
given in the ${ep.metadata.season.sessions?.[ep.session]} session of the ${ep.metadata.season.label} on ${new Date(ep.date).toDateString()}

${ep.metadata.season.description ?? ''}

This meta-podcast is not published, maintained, or endorsed by The Church of Jesus Christ of Latter-Day Saints, but instead by a faithful member of the Church who is seeking ways to make consuming Gospel content easier for everyone. If there are any mistakes, please report them on GitHub and we'll try to get them fixed.`;

    return {
      id: ep.id,
      title: ep.title,
      description,
      pubDate: generatePubDate(ep.date, ep.session, ep.sequence),
      image: ep.metadata.season.icon ?? ep.metadata.artist.logo ?? `${BASE_URL}/assets/logo.png`,
      duration: (ep.duration ?? NaN).toString(),
      author: fullSpeakerName,
      links: ep.links,
      season: { season: ep.metadata.season.season?.toString() }
    } satisfies RssEpisode;
  });

  const folderName = path.basename(folderPath);
  const rss = buildRssFeed(
    formattedEpisodes,
    {
      title: season.label || folderName,
      description: season.label || folderName,
      image: season.icon ?? artist.logo ?? '',
      link: artist.website ?? '',
      feedPath: `general-conference/${folderName}.rss`,
      author: artist.name ?? '',
      copyright: artist.copyright ?? ''
    }
  );

  return { rss, episodes: formattedEpisodes };
}

function main() {
  if (!fs.existsSync(GC_OUT_DIR)) fs.mkdirSync(GC_OUT_DIR, { recursive: true });

  const artist = loadYaml(path.join(ROOT_DIR, "_artist.yml"));
  const album = loadYaml(path.join(ROOT_DIR, "_album.yml"));

  const conferenceFolders = fs
    .readdirSync(ROOT_DIR)
    .map((f) => path.join(ROOT_DIR, f))
    .filter((f) => fs.statSync(f).isDirectory());

  const allEpisodes: RssEpisode[] = [];

  for (const folder of conferenceFolders) {
    const { rss, episodes } = processConference(folder);
    const outPath = path.join(GC_OUT_DIR, `${path.basename(folder)}.rss`);
    fs.writeFileSync(outPath, rss);
    console.log(`✅ Generated ${outPath}`);
    allEpisodes.push(...episodes);
  }

  // Build master feed
  const masterRss = buildRssFeed(
    allEpisodes,
    {
      title: album.label,
      description: album.label,
      image: artist.logo,
      link: artist.website,
      feedPath: 'general-conference/all.rss',
      author: artist.name,
      copyright: artist.copyright
    }
  );
  fs.writeFileSync(path.join(GC_OUT_DIR, "all.rss"), masterRss);
  console.log(`✅ Generated master feed: all.rss`);

  // Update the available feeds index
  const feedCount = updateAvailableFeeds();
  console.log(`${feedCount} available feeds`);
}

main();
