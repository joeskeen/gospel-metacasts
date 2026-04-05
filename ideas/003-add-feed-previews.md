# Implementation Plan: Add Feed Previews

## Overview
Add the ability to preview the latest episodes from a podcast feed before importing it, improving user decision-making.

## Background
Currently, users must import a feed to see what's in it. This creates friction - users should see a preview of recent episodes before committing to a podcast app subscription.

## Files to Create/Modify

### New Files
- `src/app/shared/components/feed-preview/feed-preview.component.ts`
- `src/app/shared/components/feed-preview/feed-preview.html`
- `src/app/shared/components/feed-preview/feed-preview.scss`

### Modified Files
- `src/app/pages/browse/browse.html` - Add preview on hover/click
- `src/app/pages/browse/browse.ts` - Handle hover state

## Implementation Steps

### Step 1: Define Preview Data Structure
```typescript
interface FeedPreview {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  episodes: PreviewEpisode[];
}

interface PreviewEpisode {
  title: string;
  pubDate: string;
  duration: string;
  enclosureUrl: string;
}
```

### Step 2: Create Feed Preview Component
- Accepts feed URL/path as input
- Fetches and parses RSS feed on init
- Displays:
  - Feed artwork (from RSS)
  - Feed title
  - Latest 5-10 episodes as a list
- Each episode shows: title, date, duration
- "Add to Podcast App" button

### Step 3: Implement Feed Fetching
Since CORS may block direct RSS fetching, options:
1. **Server endpoint** (recommended): `/api/feed-preview?url=...`
2. **CORS proxy**: Use a public CORS proxy (less reliable)
3. **Build-time generation**: Add preview data to index.json

Recommendation: Add SSR endpoint in Express server.

### Step 4: Add to Browse Page
- On hover over feed item, show preview in tooltip/popover
- On click (without copy), open full preview modal
- Lazy-load previews (don't fetch all on page load)

### Step 5: Add Modal for Full Preview
- Large modal showing full feed info
- "Add to Podcast App" buttons for major platforms
- Episode list with play links

## UI/UX Design

### Hover Tooltip
- Shows next to cursor
- Contains: Feed title, latest episode title, date
- Appears after 300ms hover delay

### Preview Modal
- Centered modal (max-width: 600px)
- Close button (X) and click-outside-to-close
- Feed artwork (128x128)
- Episode list with:
  - Episode title
  - Publish date
  - Duration
  - Play button (opens audio URL)

## Acceptance Criteria
1. Hovering over a feed shows tooltip with latest episode
2. Clicking a feed opens modal with 5+ episodes
3. Each episode shows title, date, duration
4. Modal can be closed by X button or clicking outside
5. "Add to Podcast App" buttons in modal
6. Loading state while fetching feed data
7. Error state if feed cannot be fetched