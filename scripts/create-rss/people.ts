import fs from "fs";
import path, { join } from "path";
import { getPeople } from "../people.ts";
import type { Person } from '../people.ts'
import { getEpisodes } from "../episodes.ts";
import type { Episode } from '../episodes.ts';
import { buildRssFeed, updateAvailableFeeds, BASE_URL, OUT_DIR } from "./rss-utils.ts";
import type { RssEpisode } from './rss-utils.ts';

const PEOPLE_OUT_DIR = join(OUT_DIR, "people");

const people = getPeople();
const episodes = getEpisodes();

// Create output directory if it doesn't exist
if (!fs.existsSync(PEOPLE_OUT_DIR)) {
  fs.mkdirSync(PEOPLE_OUT_DIR, { recursive: true });
}

interface PersonWithEpisodes extends Person {
  episodes: Episode[];
}

const peopleEpisodes = [...people.values()]
  .map(p => ({ 
    ...p,
    episodes: [...episodes.values()]
      .filter(e => e.speaker?.id === p.id)
  }))
  .filter((p): p is PersonWithEpisodes => p.episodes.length > 0); // Only include people with episodes

for(let person of peopleEpisodes) {
  const feedTitle = `Talks by ${person.name}`;
  
  const formattedEpisodes = person.episodes.map(ep => {
    const speakerName = person.name;
    const fullSpeakerName = `${ep.speaker?.title?.short} ${speakerName}, ${ep.speaker?.title?.full}`.trim();
    const sessionLabel = ep.metadata.season.sessions?.[ep.session] ?? `Session ${ep.session}`;
    const description = `${ep.title} by ${fullSpeakerName}
given in ${sessionLabel} of ${ep.metadata.season.label} on ${new Date(ep.date).toDateString()}

${ep.metadata.season.description ?? ''}

This meta-podcast is not published, maintained, or endorsed by The Church of Jesus Christ of Latter-Day Saints, but instead by a faithful member of the Church who is seeking ways to make consuming Gospel content easier for everyone. If there are any mistakes, please report them on GitHub and we'll try to get them fixed.`;

    return {
      id: ep.id,
      title: ep.title,
      description,
      pubDate: new Date(ep.date).toUTCString(),
      duration: (ep.duration ?? NaN).toString(),
      author: fullSpeakerName,
      links: ep.links
    } satisfies RssEpisode;
  });

  const rss = buildRssFeed(
    formattedEpisodes,
    {
      title: feedTitle,
      description: `Talks and messages by ${person.name}`,
      image: person.photo ?? `${BASE_URL}/assets/logo.png`,
      link: person.website ?? "https://www.churchofjesuschrist.org",
      feedPath: `people/${person.id}.rss`,
      author: person.name,
      copyright: "© 2024 Intellectual Reserve, Inc. All rights reserved."
    }
  );
  
  const outPath = path.join(PEOPLE_OUT_DIR, `${person.id}.rss`);
  fs.writeFileSync(outPath, rss);
  console.log(`✅ Generated ${outPath}`);
}

// Update the available feeds index
const feedCount = updateAvailableFeeds();
console.log(`${feedCount} available feeds`);
