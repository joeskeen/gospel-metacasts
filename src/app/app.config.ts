import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';
import { EpisodeIndexService } from './shared/services/episode-index.service';

export function initializeApp() {
  return inject(EpisodeIndexService).getEpisodes();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideMarkdown({ loader: HttpClient }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideClientHydration(withEventReplay()),
    provideAppInitializer(initializeApp)
  ]
};
