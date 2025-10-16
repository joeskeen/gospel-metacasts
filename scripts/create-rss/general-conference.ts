import fs, { existsSync } from "fs";
import path, { join } from "path";
import yaml from "yaml";
import { create } from "xmlbuilder2";
import { getPeople } from "../people.ts";

const __dirname = import.meta.dirname;

const ROOT_DIR = join(__dirname, "../../data/episodes/general-conference");
const OUT_DIR = join(__dirname, "../../out/general-conference");

const people = getPeople();

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

function buildRssFeed(
  episodes: any[],
  season: any,
  artist: any,
  feedTitle: string
): string {

  const feed = create({ version: "1.0", encoding: "UTF-8" })
    .ele("rss", {
      version: "2.0",
      "xmlns:itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
      "xmlns:atom": "http://www.w3.org/2005/Atom",
    })
    .ele("channel")
    .ele("title")
    .txt(feedTitle)
    .up()
    //////
    .ele("description")
    .txt(feedTitle)
    .up()
    //////
    .ele("link")
    .txt(artist.website)
    .up()
    //////
    .ele("atom:link", {
      href: "http://example.com/url", // TODO: put actual self-referencing URL here
      rel: "self",
      type: "application/rss+xml",
    })
    .up()
    //////
    .ele("itunes:owner")
    .ele("itunes:name")
    .txt(artist.name)
    .up()
    .ele("itunes:email")
    .txt("no-reply@example.com") // TODO: use .env to put in an email address
    .up()
    .up()
    //////
    .ele("itunes:category", { text: "Religion & Spirituality" })
    .up()
    //////
    .ele("itunes:explicit")
    .txt("false")
    .up()
    //////
    .ele("language")
    .txt("en")
    .up()
    //////
    .ele("itunes:author")
    .txt(artist.name)
    .up()
    //////
    .ele("copyright")
    .txt(artist.copyright)
    .up();

  for (const ep of episodes) {
    const pubDate = generatePubDate(ep.date, ep.session, ep.sequence);
    const speakerName =
      people.get(ep.speaker?.id)?.name ??
      ep.speaker?.id?.replace(/-/g, " ") ??
      "Unknown Speaker";
    const fullSpeakerName =
      `${ep.speaker?.title?.short} ${speakerName}, ${ep.speaker?.title?.full}`.trim();
    const description = `${ep.title} by ${fullSpeakerName}
given in the ${
  season.sessions?.[ep.session] ?? ep.season.sessions?.[ep.session]
} session of the ${ep.season?.label ?? season.label} on ${new Date(ep.date).toDateString()}

${ep.summary}

This meta-podcast is not published, maintained, or endorsed by The Church of Jesus Christ of Latter-Day Saints, but instead by a faithful member of the Church who is seeking ways to make consuming Gospel content easier for everyone. If there are any mistakes, please report them on GitHub and we'll try to get them fixed.`;

    feed
      .ele("item")
      .ele("title")
      .txt(ep.title)
      .up()
      //////
      .ele("description")
      .txt(description)
      .up()
      //////
      .ele("pubDate")
      .txt(pubDate)
      .up()
      //////
      .ele("guid", { isPermaLink: "false" })
      .txt(ep.id)
      .up()
      //////
      .ele("itunes:author")
      .txt(fullSpeakerName)
      .up()
      //////
      .ele("itunes:season")
      .txt(season.season ?? ep.season.season)
      .up()
      //////
      .ele("enclosure", {
        url: ep.links?.mp3,
        type: "audio/mpeg",
        length: 0, // TODO: use HTTP HEAD to get content-length
      })
      .up()
      .up();
  }

  return feed.end({ prettyPrint: true });
}

function processConference(
  folderPath: string,
  globalArtist: any,
  globalAlbum: any
): {
  rss: string;
  episodes: any[];
} {
  const season = {
    ...globalAlbum,
    ...loadYaml(path.join(folderPath, "_season.yml")),
  };
  const artist = {
    ...globalArtist,
    ...loadYaml(path.join(folderPath, "_artist.yml")),
  };

  const episodeFiles = fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .map((f) => path.join(folderPath, f));

  const episodes = episodeFiles.map((file) => ({
    ...loadYaml(file),
    season,
    artist,
  }));
  const folderName = path.basename(folderPath);
  const rss = buildRssFeed(
    episodes,
    season,
    artist,
    season.label || folderName
  );

  return { rss, episodes };
}

function main() {
  const allEpisodes: any[] = [];

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const artist = loadYaml(path.join(ROOT_DIR, "_artist.yml"));
  const album = loadYaml(path.join(ROOT_DIR, "_album.yml"));

  const conferenceFolders = fs
    .readdirSync(ROOT_DIR)
    .map((f) => path.join(ROOT_DIR, f))
    .filter((f) => fs.statSync(f).isDirectory());

  for (const folder of conferenceFolders) {
    const { rss, episodes } = processConference(folder, artist, album);
    const outPath = path.join(OUT_DIR, `${path.basename(folder)}.rss`);
    fs.writeFileSync(outPath, rss);
    console.log(`✅ Generated ${outPath}`);
    allEpisodes.push(...episodes);
  }

  const seriesTitle = album.label;
  // Build master feed
  const masterSeason = { label: seriesTitle };
  const masterRss = buildRssFeed(
    allEpisodes,
    masterSeason,
    artist,
    seriesTitle
  );
  fs.writeFileSync(path.join(OUT_DIR, "all.rss"), masterRss);
  console.log(`✅ Generated master feed: all.rss`);
}

main();
