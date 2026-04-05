import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  template: `
    <button 
      class="theme-toggle" 
      (click)="themeService.toggle()"
      [attr.aria-label]="themeService.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      [title]="themeService.isDark ? 'Switch to light mode' : 'Switch to dark mode'">
      @if (themeService.isDark) {
        <span class="icon">☀️</span>
      } @else {
        <span class="icon">🌙</span>
      }
    </button>
  `,
  styles: [`
    .theme-toggle {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
    }
    .theme-toggle:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .icon {
      line-height: 1;
    }
    
    @media (max-width: 768px) {
      .theme-toggle {
        font-size: 1rem;
        padding: 0.25rem;
        min-width: 2rem;
        min-height: 2rem;
      }
    }
  `]
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);
}