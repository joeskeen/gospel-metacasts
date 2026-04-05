import { Injectable, inject } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { EpisodeIndexService, Feed } from '../../shared/services/episode-index.service';
import { Episode, SearchResult } from '../../shared/models/episode.model';

export interface FeedSearchResult {
  feed: Feed;
  matchedIn: 'name' | 'type';
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private episodeIndex = inject(EpisodeIndexService);

  search(query: string): Observable<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      return of([]);
    }

    return timer(300).pipe(
      switchMap(() => this.performSearch(query.trim()))
    );
  }

  searchFeeds(query: string): Observable<FeedSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return of([]);
    }

    return timer(300).pipe(
      switchMap(() => this.performFeedSearch(query.trim()))
    );
  }

  private async performSearch(query: string): Promise<SearchResult[]> {
    const episodes = await this.episodeIndex.getEpisodes();
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const episode of episodes) {
      const matchScore = this.getMatchScore(episode, lowerQuery);
      if (matchScore) {
        results.push({ episode, matchedIn: matchScore.matchedIn, score: matchScore.score });
      }
    }

    results.sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return b.episode.date.localeCompare(a.episode.date);
    });

    return results;
  }

  private async performFeedSearch(query: string): Promise<FeedSearchResult[]> {
    const feeds = await this.episodeIndex.getFeeds();
    const lowerQuery = query.toLowerCase();
    const results: FeedSearchResult[] = [];

    for (const feed of feeds) {
      const matchScore = this.getFeedMatchScore(feed, lowerQuery);
      if (matchScore) {
        results.push({ feed, matchedIn: matchScore.matchedIn, score: matchScore.score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results;
  }

  private getMatchScore(episode: Episode, query: string): { matchedIn: 'title' | 'speaker' | 'topics', score: number } | null {
    if (episode.title.toLowerCase().includes(query)) {
      return { matchedIn: 'title', score: 100 };
    }

    if (episode.speaker?.id && episode.speaker.id.toLowerCase().includes(query)) {
      return { matchedIn: 'speaker', score: 50 };
    }

    for (const topic of episode.topics) {
      if (topic.toLowerCase().includes(query)) {
        return { matchedIn: 'topics', score: 75 };
      }
    }

    return null;
  }

  private getFeedMatchScore(feed: Feed, query: string): { matchedIn: 'name' | 'type', score: number } | null {
    if (feed.name.toLowerCase().includes(query)) {
      return { matchedIn: 'name', score: 100 };
    }

    if (feed.type.toLowerCase().includes(query)) {
      return { matchedIn: 'type', score: 50 };
    }

    return null;
  }
}