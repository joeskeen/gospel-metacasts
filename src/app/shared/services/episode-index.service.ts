import { HttpClient } from '@angular/common/http';
import { inject, Injectable, APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Episode } from '../models/episode.model';

export interface Feed {
  path: string;
  type: string;
  name: string;
  image: string;
}

export interface EpisodesIndex {
  episodes: Episode[];
  feeds: Feed[];
}

@Injectable({
  providedIn: 'root'
})
export class EpisodeIndexService {
  private httpClient = inject(HttpClient);
  private episodes: Episode[] | null = null;
  private feeds: Feed[] | null = null;
  private loading: Promise<{ episodes: Episode[]; feeds: Feed[] }> | null = null;

  async getEpisodes(): Promise<Episode[]> {
    const data = await this.loadAll();
    return data.episodes;
  }

  async getFeeds(): Promise<Feed[]> {
    const data = await this.loadAll();
    return data.feeds;
  }

  getFeedsForEpisode(episode: Episode): Feed[] {
    if (!this.feeds) return [];
    
    const source = episode.source;
    return this.feeds.filter(feed => {
      if (feed.type === source) return true;
      return false;
    });
  }

  private async loadAll(): Promise<{ episodes: Episode[]; feeds: Feed[] }> {
    if (this.episodes && this.feeds) {
      return { episodes: this.episodes, feeds: this.feeds };
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = this.loadData();
    const data = await this.loading;
    this.episodes = data.episodes;
    this.feeds = data.feeds;
    return data;
  }

  private async loadData(): Promise<{ episodes: Episode[]; feeds: Feed[] }> {
    const data = await firstValueFrom(
      this.httpClient.get<EpisodesIndex>('episodes-index.json')
    );
    return { episodes: data.episodes, feeds: data.feeds || [] };
  }
}

export function initializeEpisodeIndex(service: EpisodeIndexService) {
  return () => service.getEpisodes();
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_INITIALIZER, useFactory: initializeEpisodeIndex, deps: [EpisodeIndexService], multi: true }
  ]
};