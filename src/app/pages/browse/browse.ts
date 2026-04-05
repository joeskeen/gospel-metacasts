import { Component, inject, signal } from '@angular/core';
import { Feed, FeedsService } from './feeds.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-browse',
  imports: [],
  templateUrl: './browse.html',
  styleUrl: './browse.scss'
})
export class BrowsePage {
  readonly feedsService = inject(FeedsService);
  readonly toastService = inject(ToastService);
  readonly feedCategories = this.feedsService.feedsByCategory;
  readonly showAllCategories = signal<string[]>([]);
  readonly defaultItems = 25;

  onFeedClick(event: MouseEvent, feed: Feed) {
    try {
      const baseUrl = document.head.baseURI;
      const fullUrl = baseUrl + feed.path;
      navigator.clipboard.writeText(fullUrl);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.toastService.success(`Podcast link to "${feed.displayName}" copied!`);
    } catch { 
      this.toastService.error('Failed to copy link. Please try again.');
    }
  }

  showAll(categoryId: string) {
    this.showAllCategories.update(arr => [...arr, categoryId]);
  }
}
