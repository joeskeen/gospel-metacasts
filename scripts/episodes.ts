import { basename, dirname, join } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import YAML from "yaml";

const __dirname = import.meta.dirname;
const episodesDir = join(__dirname, "../data/episodes");

export type Episodes = Map<string, Episode>;

let episodes: Episodes | null = null;

export function getEpisodes(): Episodes {
  if (!episodes) {
    episodes = loadEpisodes();
  }
  return episodes;
}

function loadYaml<T = any>(filePath: string): T {
  return existsSync(filePath)
    ? (YAML.parse(readFileSync(filePath, "utf8")) as T)
    : ({} as unknown as T);
}

export function loadEpisodes(): Episodes {
  const episodes = new Map<string, Episode>();

  // Load episodes recursively
  for (const file of (readdirSync(episodesDir, {recursive: true}) as string[])) {
    if (file.endsWith(".yml") && !basename(file).startsWith('_')) {
      const fullPath = join(episodesDir, file);
      const episode = YAML.parse(readFileSync(fullPath).toString());
      const source = file.split('/')[0];
      const id = basename(file).replace(/\.yml$/, '');

      // Get the directory containing this episode
      const episodeDir = dirname(fullPath);
      
      // Load metadata files
      const albumData = loadYaml(join(episodeDir, '_album.yml'));
      const artistData = loadYaml(join(episodeDir, '_artist.yml'));
      const seasonData = loadYaml(join(episodeDir, '_season.yml'));

      // Load parent directory metadata (if it exists and wasn't found in current directory)
      const parentDir = dirname(episodeDir);
      const parentAlbumData = loadYaml(join(parentDir, '_album.yml'));
      const parentArtistData = loadYaml(join(parentDir, '_artist.yml'));

      // Combine metadata with episode data
      const metadata = {
        artist: { ...parentArtistData, ...artistData },
        album: { ...parentAlbumData, ...albumData },
        season: seasonData
      };

      episodes.set(id, {
        ...episode,
        source,
        id,
        metadata
      });
    }
  }
  return episodes;
}

export interface Metadata {
  artist: {
    name?: string;
    logo?: string;
    website?: string;
    copyright?: string;
    [key: string]: any;
  };
  album: {
    label?: string;
    [key: string]: any;
  };
  season: {
    label?: string;
    season?: string | number;
    sessions?: Record<number, string>;
    icon?: string;
    [key: string]: any;
  };
}

export interface Episode {
  source: string;
  id: string;
  title: string;
  date: string;
  session: number;
  sequence: number;
  links?: {
    mp3?: string;
  };
  speaker?: {
    id: string;
    title?: {
      full?: string;
      short?: string;
    }
  };
  topics: string[];
  duration: number;
  metadata: Metadata;
}
