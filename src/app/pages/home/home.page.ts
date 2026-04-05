import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLinkWithHref } from '@angular/router';
import { FeedsService, Feed } from '../browse/feeds.service';
import { EpisodeIndexService } from '../../shared/services/episode-index.service';
import { capitalCase } from 'change-case';

interface FeaturedContent {
  type: 'scripture' | 'conference';
  badge: string;
  title: string;
  description: string;
  path: string;
  buttonText: string;
}

interface FeedWithDate extends Feed {
  sortKey: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLinkWithHref],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage implements OnInit {
  private feedsService = inject(FeedsService);
  private episodeIndex = inject(EpisodeIndexService);
  readonly recentFeeds = signal<Feed[]>([]);
  readonly loading = signal<boolean>(true);
  readonly currentYear = new Date().getFullYear();
  readonly featuredContent = this.getFeaturedContent();

  private getFeaturedContent(): FeaturedContent {
    const month = new Date().getMonth();
    
    if (month >= 0 && month <= 3) {
      return this.getCurrentScriptureFeed();
    } else if (month >= 4 && month <= 8) {
      return {
        type: 'conference',
        badge: `April ${this.currentYear} General Conference`,
        title: 'April General Conference',
        description: 'Listen to the most recent messages from Church leadership.',
        path: `general-conference/${this.currentYear}-04.rss`,
        buttonText: 'Copy Podcast Feed'
      };
    } else {
      return {
        type: 'conference',
        badge: `October ${this.currentYear} General Conference`,
        title: 'October General Conference',
        description: 'Hear the teachings from the latest general conference.',
        path: `general-conference/${this.currentYear}-10.rss`,
        buttonText: 'Copy Podcast Feed'
      };
    }
  }

  private getCurrentScriptureFeed(): FeaturedContent {
    const feeds: Record<number, FeaturedContent> = {
      0: { 
        type: 'scripture', 
        badge: `${this.currentYear} Sunday School`, 
        title: '📜 Book of Mormon', 
        description: 'Gain additional witnesses of Christ and His covenant promises to all nations',
        path: 'scriptures/book-of-mormon.rss',
        buttonText: 'Copy Podcast Feed'
      },
      1: { 
        type: 'scripture', 
        badge: `${this.currentYear} Sunday School`, 
        title: '📜 Doctrine and Covenants', 
        description: 'Learn of Christ\'s modern revelation and how He continues to guide His Church today',
        path: 'scriptures/doctrine-and-covenants.rss',
        buttonText: 'Copy Podcast Feed'
      },
      2: { 
        type: 'scripture', 
        badge: `${this.currentYear} Sunday School`, 
        title: '📜 Old Testament', 
        description: 'Deepen your commitment to Christ as you learn about His covenants with the House of Israel',
        path: 'scriptures/old-testament.rss',
        buttonText: 'Copy Podcast Feed'
      },
      3: { 
        type: 'scripture', 
        badge: `${this.currentYear} Sunday School`, 
        title: '📜 New Testament', 
        description: 'Follow the life, ministry, and teachings of Christ through the Gospels and Epistles',
        path: 'scriptures/new-testament.rss',
        buttonText: 'Copy Podcast Feed'
      }
    };

    const index = this.currentYear % 4;
    return feeds[index];
  }

  private getFeedDisplayName(name: string): string {
    if (name === 'all') return 'All General Conference';
    const match = name.match(/(\d{4})-(04|10)/);
    if (match) {
      const year = match[1];
      const session = match[2] === '04' ? 'April' : 'October';
      return `${session} ${year}`;
    }
    return capitalCase(name);
  }

  private dateToTimestamp(date: string): number {
    if (!date) return 0;
    const match = date.match(/(\d{4})-(\d{2})/);
    if (match) {
      return parseInt(match[1]) * 100 + parseInt(match[2]);
    }
    return 0;
  }

  async ngOnInit() {
    let feeds = this.feedsService.feeds();
    if (!feeds) {
      await new Promise(resolve => setTimeout(resolve, 100));
      feeds = this.feedsService.feeds();
    }
    
    if (feeds) {
      const conferenceFeeds = feeds.filter(f => /^\d{4}/.test(f.name));
      const allFeed = feeds.filter(f => f.name === 'all');
      const otherFeeds = feeds.filter(f => !/^\d{4}/.test(f.name) && f.name !== 'all');
      
      const sortedConference = conferenceFeeds
        .map(f => ({
          displayName: this.getFeedDisplayName(f.name),
          path: f.path,
          imageUrl: f.image,
          sortKey: f.name
        } as FeedWithDate))
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      
      const sortedOther = otherFeeds
        .map(f => ({
          displayName: this.getFeedDisplayName(f.name),
          path: f.path,
          imageUrl: f.image,
          sortKey: f.name
        } as FeedWithDate))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      this.recentFeeds.set([...allFeed.map(f => ({
          displayName: this.getFeedDisplayName(f.name),
          path: f.path,
          imageUrl: f.image,
          sortKey: f.name
        } as FeedWithDate)), ...sortedConference, ...sortedOther].slice(0, 6));
    }
    this.loading.set(false);
  }

  async copyFeedUrl(path: string, event: MouseEvent) {
    try {
      const baseUrl = document.head.baseURI;
      const fullUrl = baseUrl + path;
      navigator.clipboard.writeText(fullUrl);
      event.preventDefault();
      event.stopPropagation();
    } catch {
      console.error('Failed to copy link');
    }
  }
}