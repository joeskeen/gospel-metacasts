import { convert, create } from "xmlbuilder2";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const BASE_URL = 'https://joeskeen.github.io/gospel-metacasts';

function validateDate(dateStr: string): string {
  // If the date is already valid RFC-822, return it
  if (/^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} [A-Z]{3,4}$/.test(dateStr)) {
    return dateStr;
  }

  // Parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // If parsing failed, return current date as fallback
    return new Date().toUTCString();
  }

  // Format to RFC-822
  return date.toUTCString();
}
export const OUT_DIR = join(import.meta.dirname, "../../out/");
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR);
}

export interface RssFeedOptions {
  title: string;
  description: string;
  image: string;
  link: string;
  feedPath: string;
  author: string;
  copyright: string;
}

export interface RssEpisode {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  image?: string;
  duration?: string;
  author: string;
  links?: {
    mp3?: string;
  };
  season?: {
    season?: string;
  };
}

export function buildRssFeed(
  episodes: RssEpisode[],
  options: RssFeedOptions,
): string {
  const feed = create({ version: "1.0", encoding: "UTF-8" })
    .ele("rss", {
      version: "2.0",
      "xmlns:itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
      "xmlns:atom": "http://www.w3.org/2005/Atom",
    })
    .ele("channel")
    .ele("title")
    .txt(options.title)
    .up()
    .ele("itunes:image", {
      href: options.image,
    })
    .up()
    .ele("description")
    .txt(options.description)
    .up()
    .ele("link")
    .txt(options.link)
    .up()
    .ele("atom:link", {
      href: `${BASE_URL}/${options.feedPath}`,
      rel: "self",
      type: "application/rss+xml",
    })
    .up()
    .ele("itunes:owner")
    .ele("itunes:name")
    .txt(options.author)
    .up()
    .ele("itunes:email")
    .txt("no-reply@example.com")
    .up()
    .up()
    .ele("itunes:category", { text: "Religion & Spirituality" })
    .up()
    .ele("itunes:explicit")
    .txt("false")
    .up()
    .ele("language")
    .txt("en")
    .up()
    .ele("itunes:author")
    .txt(options.author)
    .up()
    .ele("copyright")
    .txt(options.copyright)
    .up();

  for (const ep of episodes) {
    const item = feed.ele("item");

    item
      .ele("title")
      .txt(ep.title)
      .up()
      .ele("itunes:image", {
        href: ep.image ?? options.image,
      })
      .up()
      .ele("itunes:duration")
      .txt(ep.duration ?? '')
      .up()
      .ele("description")
      .txt(ep.description)
      .up()
      .ele("pubDate")
      .txt(validateDate(ep.pubDate))
      .up()
      .ele("guid", { isPermaLink: "false" })
      .txt(ep.id)
      .up()
      .ele("itunes:author")
      .txt(ep.author)
      .up();

    if (ep.season?.season) {
      item.ele("itunes:season")
        .txt(ep.season.season)
        .up();
    }

    if (ep.links?.mp3) {
      item.ele("enclosure", {
        url: ep.links.mp3,
        type: "audio/mpeg",
        length: 0,
      })
        .up();
    }

    item.up();
  }

  return feed.end({ prettyPrint: true });
}

export function updateAvailableFeeds() {
  const feeds = (readdirSync(OUT_DIR, { recursive: true }) as string[])
    .filter(p => p.endsWith('.rss'))
    .map(p => {
      const [type, name] = p.replace('.rss', '').split('/');
      const fileContents = readFileSync(join(OUT_DIR, p)).toString();
      const feed = (convert(fileContents, { format: "object" }) as any);

      return {
        path: p,
        type,
        name,
        image: feed.rss?.channel?.['itunes:image']?.['@href']
      };
    });

  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ availableFeeds: feeds }));
  return feeds.length;
}
