# Implementation Plan: Add Filtering and Sorting

## Overview
Add filtering and sorting options to the browse page, allowing users to find feeds by year, session, speaker, and other criteria.

## Background
The browse page shows all feeds in a simple list. Users with many feeds (e.g., all conference years) need better ways to navigate.

## Files to Modify
- `src/app/pages/browse/browse.ts` - Add filter/sort state
- `src/app/pages/browse/browse.html` - Add filter UI
- `src/app/pages/browse/browse.scss` - Filter styles
- `src/app/shared/components/filter-bar/filter-bar.component.ts` - New reusable filter component (optional)

## Implementation Steps

### Step 1: Define Filter State
```typescript
interface BrowseFilters {
  searchQuery: string;
  year: number | null;
  session: 'april' | 'october' | null;
  speaker: string | null;
  sortBy: 'name' | 'date' | 'newest' | 'oldest';
  sortOrder: 'asc' | 'desc';
}
```

### Step 2: Add Filter UI to Browse Template
```html
<div class="filters">
  <input 
    type="text" 
    placeholder="Search feeds..." 
    [ngModel]="filters().searchQuery"
    (ngModelChange)="updateFilter('searchQuery', $event)" />
  
  <select [ngModel]="filters().year" (ngModelChange)="updateFilter('year', $event)">
    <option [ngValue]="null">All Years</option>
    @for (year of availableYears; track year) {
      <option [value]="year">{{ year }}</option>
    }
  </select>
  
  <select [ngModel]="filters().session" (ngModelChange)="updateFilter('session', $event)">
    <option [ngValue]="null">All Sessions</option>
    <option value="april">April</option>
    <option value="october">October</option>
  </select>
  
  <select [ngModel]="filters().sortBy" (ngModelChange)="updateFilter('sortBy', $event)">
    <option value="name">Name</option>
    <option value="date">Date</option>
    <option value="newest">Newest First</option>
    <option value="oldest">Oldest First</option>
  </select>
</div>
```

### Step 3: Implement Filter Logic
```typescript
readonly filters = signal<BrowseFilters>({
  searchQuery: '',
  year: null,
  session: null,
  speaker: null,
  sortBy: 'name',
  sortOrder: 'asc'
});

readonly filteredFeeds = computed(() => {
  let feeds = this.feedsService.feedsByCategory();
  const f = this.filters();
  
  if (f.searchQuery) {
    const query = f.searchQuery.toLowerCase();
    feeds = feeds.map(cat => ({
      ...cat,
      feeds: cat.feeds.filter(feed => 
        feed.displayName.toLowerCase().includes(query)
      )
    }));
  }
  
  // Apply sorting
  // ...
  
  return feeds;
});
```

### Step 4: Extract Available Filter Options
From feed data, extract:
- Available years (from general-conference feeds)
- Available sessions
- Available speakers (for speaker-specific feeds)

### Step 5: Add Clear Filters Button
- Show "Clear all filters" when any filter is active
- Single button to reset all filters

### Step 6: Style Filters
- Horizontal filter bar above feed grid
- Wrap on mobile
- Active filter tags shown
- Sticky filter bar on scroll

## URL Persistence
Consider syncing filters with URL query params:
- `/browse?year=2023&session=april`
- Allows sharing filtered views

## Acceptance Criteria
1. Search input filters feeds by name
2. Year dropdown shows available years only
3. Session dropdown filters by conference session
4. Sort dropdown reorders feeds
5. Clear filters button resets all filters
6. Filters persist during session
7. Responsive layout on mobile