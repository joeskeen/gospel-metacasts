import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { BrowsePage } from './pages/browse/browse';
import { SearchPage } from './pages/search/search';
import { AboutPage } from './pages/about/about.page';
import { GettingStartedPage } from './pages/getting-started/getting-started.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomePage },
  { path: 'browse', component: BrowsePage },
  { path: 'search', component: SearchPage },
  { path: 'about', component: AboutPage },
  { path: 'getting-started', component: GettingStartedPage },
];
