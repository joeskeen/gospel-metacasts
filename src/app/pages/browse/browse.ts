import { Component, inject } from '@angular/core';
import { FeedsService } from './feeds.service';

@Component({
  selector: 'app-browse',
  imports: [],
  templateUrl: './browse.html',
  styleUrl: './browse.scss'
})
export class BrowsePage {
  readonly feedsService = inject(FeedsService);
  readonly feedCategories = this.feedsService.feedsByCategory;
}
