import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'gospel-metacasts-theme';
  
  readonly theme = signal<Theme>('system');
  
  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.theme.set(saved);
    }
    this.applyTheme();
    this.listenForSystemPreferenceChanges();
  }
  
  private applyTheme() {
    const t = this.theme();
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }
  
  private listenForSystemPreferenceChanges() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme() === 'system') {
        this.applyTheme();
      }
    });
  }
  
  setTheme(t: Theme) {
    this.theme.set(t);
    localStorage.setItem(this.STORAGE_KEY, t);
    this.applyTheme();
  }
  
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }
  
  get isDark(): boolean {
    const t = this.theme();
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return t === 'dark';
  }
}