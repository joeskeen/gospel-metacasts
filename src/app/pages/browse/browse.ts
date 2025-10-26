import { Component, inject } from '@angular/core';
import { Feed, FeedsService } from './feeds.service';

@Component({
  selector: 'app-browse',
  imports: [],
  templateUrl: './browse.html',
  styleUrl: './browse.scss'
})
export class BrowsePage {
  readonly feedsService = inject(FeedsService);
  readonly feedCategories = this.feedsService.feedsByCategory;

  onFeedClick(event: MouseEvent, feed: Feed) {
    try {
      const baseUrl = document.head.baseURI;
      const fullUrl = baseUrl + feed.path;
      navigator.clipboard.writeText(fullUrl);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      alert(`Podcast link to "${feed.displayName}" copied to your clipboard. Paste it into your podcast app to import it.`);
    } catch { 
      console.error(`Couldn't copy link to clipboard. Navigating to feed URL instead`);
    }
  }
}
