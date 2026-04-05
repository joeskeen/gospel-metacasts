export interface Speaker {
  id: string;
  title?: {
    full?: string;
    short?: string;
  };
}

export interface Metadata {
  artist: {
    name?: string;
    logo?: string;
    website?: string;
    copyright?: string;
    [key: string]: unknown;
  };
  album: {
    label?: string;
    [key: string]: unknown;
  };
  season: {
    label?: string;
    season?: string | number;
    sessions?: Record<number, string>;
    icon?: string;
    description?: string;
    [key: string]: unknown;
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
  speaker?: Speaker;
  topics: string[];
  duration: number;
  metadata: Metadata;
}

export interface SearchResult {
  episode: Episode;
  matchedIn: 'title' | 'speaker' | 'topics' | 'summary';
  score?: number;
  expanded?: boolean;
}