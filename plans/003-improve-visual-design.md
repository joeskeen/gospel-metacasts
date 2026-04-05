# Implementation Plan: Improve Visual Design

**Status: ✅ Completed**

## Overview
Upgrade the visual design from basic HTML to a polished, modern UI with consistent styling, card-based layouts, and better typography.

## Background
Current design:
- Plain sans-serif font
- Hardcoded colors
- Simple list layout
- Minimal visual hierarchy

## Files to Modify
- `src/styles.scss` - Global styles, CSS variables
- `src/app/app.scss` - App shell styles
- `src/app/app.html` - Add semantic markup improvements
- `src/app/pages/browse/browse.html` - Card grid layout
- `src/app/pages/browse/browse.scss` - Browse-specific styles
- `src/app/pages/home/home.scss` - Home page styles

## Implementation Steps

### Step 1: Define Design System (CSS Variables)
Add to `src/styles.scss`:
```scss
:root {
  --color-primary: #1a5f7a;
  --color-primary-dark: #0d3d4f;
  --color-secondary: #e8b923;
  --color-background: #f8f9fa;
  --color-surface: #ffffff;
  --color-text: #212529;
  --color-text-muted: #6c757d;
  --color-border: #dee2e6;
  --color-success: #22c55e;
  --color-error: #ef4444;
  
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
}


```

### Step 2: Improve App Shell
- Add max-width container for content
- Improve header with better spacing and logo
- Improve footer with better formatting
- Add subtle background texture

### Step 3: Card-Based Feed Grid (Browse Page)
```scss
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.feed-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  .feed-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  
  .feed-name {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-top: var(--spacing-sm);
  }
}
```

### Step 4: Typography Improvements
- Add proper heading hierarchy
- Add text truncation for long titles (ellipsis)
- Improve link styles with hover states
- Add consistent line-height

### Step 5: Improve Navigation
- Add active state styling
- Add hover effects
- Improve mobile navigation (hamburger menu if needed)

### Step 6: Loading States
- Improve "Loading..." text with spinner

## Acceptance Criteria
1. Design uses CSS variables for theming
2. Feed cards display in responsive grid
3. Hover effects on cards and links
4. Consistent spacing throughout
5. Typography is readable and well-sized