import { Component, inject, signal, effect, HostListener, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { form, FormField, debounce } from '@angular/forms/signals';
import { capitalCase } from 'change-case';
import { SearchService } from './search.service';
import { EpisodeIndexService, Feed } from '../../shared/services/episode-index.service';
import { SearchResult, Episode } from '../../shared/models/episode.model';

@Component({
  selector: 'app-search',
  imports: [FormField],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class SearchPage {
  private searchService = inject(SearchService);
  private episodeIndex = inject(EpisodeIndexService);

  readonly searchForm = form(signal({ query: '' }), (schemaPath) => {
    debounce(schemaPath.query, 300);
  });

  readonly results = signal<SearchResult[]>([]);
  readonly loading = signal(false);
  readonly hasSearched = signal(false);
  readonly feeds = signal<Feed[]>([]);
  readonly openDropdown = signal<string | null>(null);

  constructor() {
    this.episodeIndex.getFeeds().then(feeds => this.feeds.set(feeds));

    effect(() => {
      const value = this.searchForm.query().value();
      if (!value || value.length === 0) {
        this.results.set([]);
        this.hasSearched.set(false);
        return;
      }
      this.loading.set(true);
      this.hasSearched.set(true);
      this.searchService.search(value).subscribe({
        next: (results) => {
          this.results.set(results);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.openDropdown.set(null);
  }

  getSpeakerName(speakerId: string | undefined): string {
    if (!speakerId) return 'Unknown Speaker';
    return capitalCase(speakerId.replace(/-/g, ' '));
  }

  getFeedsForEpisode(episode: Episode): Feed[] {
    const matchingFeeds: Feed[] = [];
    const months = ['', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (const feed of this.feeds()) {
      if (feed.type === 'general-conference' && episode.source === 'general-conference') {
        const [year, month] = episode.date.split('-');
        const confName = `${year}-${months[parseInt(month, 10)]}`;
        if (feed.name === confName || feed.name === 'all') {
          matchingFeeds.push(feed);
        }
      } else if (feed.type === 'people' && episode.speaker?.id) {
        if (feed.name === episode.speaker.id) {
          matchingFeeds.push(feed);
        }
      } else if (feed.type === episode.source) {
        matchingFeeds.push(feed);
      }
    }
    
    return matchingFeeds;
  }

  getConferenceName(date: string): string {
    const months: Record<string, string> = {
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June', '07': 'July', '08': 'August',
      '09': 'September', '10': 'October', '11': 'November', '12': 'December'
    };
    const [year, month] = date.split('-');
    return `${months[month] || month} ${year}`;
  }

  getFeedDisplayName(feed: Feed): string {
    if (feed.name === 'all' && feed.type === 'general-conference') {
      return 'All General Conference Addresses';
    }
    if (feed.type === 'people') {
      return capitalCase(feed.name.replace(/-/g, ' '));
    }
    if (feed.type === 'general-conference') {
      const months: Record<string, string> = {
        'january': 'January', 'february': 'February', 'march': 'March', 'april': 'April',
        'may': 'May', 'june': 'June', 'july': 'July', 'august': 'August',
        'september': 'September', 'october': 'October', 'november': 'November', 'december': 'December'
      };
      const [year, month] = feed.name.split('-');
      return `${months[month] || month} ${year} General Conference`;
    }
    return feed.name;
  }

  toggleDropdown(episodeId: string) {
    if (this.openDropdown() === episodeId) {
      this.openDropdown.set(null);
    } else {
      this.openDropdown.set(episodeId);
    }
  }

  closeDropdown() {
    this.openDropdown.set(null);
  }

  async copyFeedUrl(feedPath: string, episodeId: string) {
    try {
      const baseUrl = document.head.baseURI;
      const fullUrl = `${baseUrl}${feedPath}`;
      await navigator.clipboard.writeText(fullUrl);
      this.openDropdown.set(null);
      alert(`Podcast feed URL copied to your clipboard: ${fullUrl}`);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  }

  openAudioLink(mp3Url: string) {
    window.open(mp3Url, '_blank');
  }
}