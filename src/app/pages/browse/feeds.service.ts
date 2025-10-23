import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { capitalCase } from 'change-case';

export interface Feed { displayName: string, path: string };
export interface FeedCategory { id: string, displayName: string, feeds: Feed[] };

@Injectable({
  providedIn: 'root'
})
export class FeedsService {
  readonly httpClient = inject(HttpClient);

  readonly orderings: Record<string, (a: Feed, b: Feed) => number> = {
    'general-conference': (a, b) => b.displayName.localeCompare(a.displayName) // "all" first, then reverse chronological order
  }

  readonly feeds = signal<string[] | undefined>(undefined);
  readonly feedsByCategory = computed(() => {
    const feeds = this.feeds();
    if (!feeds) {
      return undefined;
    }

    return feeds.reduce((prev, curr) => {
      const [type, name] = curr.replace(/\.rss$/, '').split('/');
      let category = prev.find(p => p.id === type);
      if (!category) {
        category = { id: type, displayName: capitalCase(type), feeds: [] };
        prev.push(category);
      }
      category.feeds.push({ displayName: capitalCase(name), path: curr });
      return prev;
    }, [] as Array<FeedCategory>)
      .map(c => ({ ...c, feeds: this.orderings[c.id] ? c.feeds.sort(this.orderings[c.id]) : c.feeds }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  constructor() {
    firstValueFrom(this.httpClient.get<{ availableFeeds: string[] }>('index.json'))
      .then(({ availableFeeds }) => this.feeds.set(availableFeeds));
  }
}
