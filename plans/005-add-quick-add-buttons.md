# Implementation Plan: Add Quick-Add Buttons

## Overview
Add direct links to add podcast feeds to major podcast apps (Apple Podcasts, Spotify, Google Podcasts, etc.) directly from the UI.

## Background
Users currently copy the RSS URL and manually add it to their podcast app. Direct "Add to Apple Podcasts" buttons would streamline this significantly.

## Files to Modify
- `src/app/shared/components/add-to-app/add-to-app.component.ts` - New component
- `src/app/shared/components/add-to-app/add-to-app.html`
- `src/app/shared/components/add-to-app/add-to-app.scss`
- `src/app/pages/browse/browse.html` - Add to feed cards/modals
- `src/app/pages/browse/browse.ts` - Pass feed URL to component

## Implementation Steps

### Step 1: Understand Podcast App URL Schemes

#### Apple Podcasts
- Web: `https://podcasts.apple.com/us/podcast/[name]/id[app-specific-id]`
- Deep link: `podcasts://feed=https://example.com/feed.rss`

#### Spotify
- Web: `https://open.spotify.com/search/[feed-url]`
- Note: Spotify doesn't have a direct "subscribe" deep link

#### Google Podcasts (deprecated but some use)
- Deep link: `googles podcasts://subscribe?feed=https://example.com/feed.rss`

#### Overcast (iOS)
- `overcast://+https://example.com/feed.rss`

#### Pocket Casts
- `pktc://subscribe?url=https://example.com/feed.rss`

### Step 2: Create Add-to-App Component
```typescript
@Component({
  selector: 'app-add-to-app',
  templateUrl: './add-to-app.html',
  styleUrl: './add-to-app.scss'
})
export class AddToAppComponent {
  @Input() feedUrl: string = '';
  
  readonly apps = [
    { 
      name: 'Apple Podcasts', 
      icon: 'apple-podcasts.svg',
      action: () => this.addToApplePodcasts() 
    },
    { 
      name: 'Spotify', 
      icon: 'spotify.svg',
      action: () => this.addToSpotify() 
    },
    { 
      name: 'Pocket Casts', 
      icon: 'pocket-casts.svg',
      action: () => this.addToPocketCasts() 
    },
    // ...
  ];
}
```

### Step 3: Implement App-Specific Actions
```typescript
addToApplePodcasts() {
  const url = `podcasts://+${this.feedUrl}`;
  window.location.href = url;
}

addToSpotify() {
  // Open Spotify web player with search
  const encoded = encodeURIComponent(this.feedUrl);
  window.open(`https://open.spotify.com/search/${encoded}`, '_blank');
}

addToPocketCasts() {
  const url = `pktc://subscribe?url=${encodeURIComponent(this.feedUrl)}`;
  window.location.href = url;
}
```

### Step 4: Create Dropdown/Modal UI
Instead of many buttons, use a dropdown:
```html
<div class="add-to-app-dropdown">
  <button class="add-button">Add to Podcast App ▾</button>
  <div class="dropdown-menu">
    @for (app of apps; track app.name) {
      <button (click)="app.action()">
        <img [src]="app.icon" />
        {{ app.name }}
      </button>
    }
    <hr />
    <button (click)="copyUrl()">Copy RSS URL</button>
  </div>
</div>
```

### Step 5: Add Icons
Create or source SVG icons for:
- Apple Podcasts
- Spotify
- Pocket Casts
- Overcast
- Castro
- Amazon Music
- RSS/Copy (fallback)

Store in: `public/assets/icons/`

### Step 6: Integrate with Browse/Preview
- Add "Add to" dropdown on each feed card
- Add to feed preview modal
- Show on hover or always visible

## Fallback Handling
- If deep link fails (app not installed), show copy option
- Detect mobile OS and show relevant apps first

## Acceptance Criteria
1. "Add to Podcast App" dropdown appears on feed cards
2. Clicking opens appropriate app/deep-link
3. Falls back to copy URL if app not available
4. Icons clearly identify each app
5. Works on mobile (iOS/Android)
6. Desktop users can copy URL easily