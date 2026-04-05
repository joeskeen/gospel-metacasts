# Implementation Plan: Add Dark Mode Support

## Overview
Implement dark mode support that respects system preferences and allows manual toggle, providing a comfortable viewing experience in low-light conditions.

## Background
Current design only supports light mode. Users with dark mode system preference and those browsing at night need a dark option.

## Files to Modify
- `src/styles.scss` - Add dark mode CSS variables
- `src/app/app.ts` - Add theme service
- `src/app/app.html` - Add theme toggle button
- `src/app/shared/components/theme-toggle/theme-toggle.component.ts` - New component

## Implementation Steps

### Step 1: Define Dark Mode Variables
Update `src/styles.scss`:
```scss
:root {
  /* Light mode (default) */
  --color-background: #f8f9fa;
  --color-surface: #ffffff;
  --color-text: #212529;
  --color-text-muted: #6c757d;
  --color-border: #dee2e6;
  --color-primary: #1a5f7a;
  --color-primary-hover: #0d3d4f;
}

[data-theme="dark"] {
  --color-background: #121212;
  --color-surface: #1e1e1e;
  --color-text: #e9ecef;
  --color-text-muted: #adb5bd;
  --color-border: #343a40;
  --color-primary: #4dabf7;
  --color-primary-hover: #74c0fc;
}
```

### Step 2: Create Theme Service
```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'gospel-metacasts-theme';
  
  readonly theme = signal<'light' | 'dark' | 'system'>('system');
  
  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.theme.set(saved);
    }
    this.applyTheme();
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
  
  setTheme(theme: 'light' | 'dark' | 'system') {
    this.theme.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme();
  }
  
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }
}
```

### Step 3: Create Theme Toggle Component
```typescript
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button 
      class="theme-toggle" 
      (click)="themeService.toggle()"
      [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
      @if (themeService.theme() === 'dark') {
        ☀️
      } @else {
        🌙
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
    }
    .theme-toggle:hover {
      background: var(--color-border);
    }
  `]
})
export class ThemeToggleComponent {
  constructor(public themeService: ThemeService) {}
}
```

### Step 4: Add Toggle to Header
In `src/app/app.html`:
```html
<header>
  <!-- existing content -->
  <app-theme-toggle />
</header>
```

### Step 5: Handle System Preference Changes
```typescript
// In ThemeService constructor
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (this.theme() === 'system') {
    this.applyTheme();
  }
});
```

### Step 6: Ensure All Components Use CSS Variables
Audit existing styles and replace hardcoded colors:
```scss
// Before
background: #eee;

// After  
background: var(--color-background);
```

## Acceptance Criteria
1. Theme toggle button appears in header
2. Clicking toggles between light and dark mode
3. Theme preference persists in localStorage
4. Respects system preference on first visit
5. All UI elements use CSS variables (no hardcoded colors)
6. Smooth transition between themes