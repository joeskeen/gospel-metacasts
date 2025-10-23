import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { BrowsePage } from './pages/browse/browse';
import { SearchPage } from './pages/search/search';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomePage },
  { path: 'browse', component: BrowsePage },
  { path: 'search', component: SearchPage },
];
