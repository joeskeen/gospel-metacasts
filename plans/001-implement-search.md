# Implementation Plan: Implement Search Feature

## Overview
Implement a full-text search functionality that allows users to search across episode titles, speakers, and topics.

## Background
The search page currently shows "Coming soon!" placeholder. Users need to be able to find specific talks by title, speaker name, or topic keywords.

## Files to Create/Modify

### New Files
- `src/app/pages/search/search.service.ts` - Search logic service
- `src/app/pages/search/search.component.ts` - Reusable search component
- `src/app/shared/models/episode.model.ts` - Reuse Episode interface from `scripts/episodes.ts`
- `src/app/shared/services/episode-index.service.ts` - Builds searchable episode index

### Modified Files
- `src/app/pages/search/search.ts` - Component logic
- `src/app/pages/search/search.html` - Template
- `src/app/pages/search/search.scss` - Styles

## Implementation Steps

### Step 1: Create Episode Model
Define the Episode interface matching the YAML metadata structure:
- id, title, date, session, sequence
- speaker: { id, title, name }
- links: Audio URL array
- summary: string
- topics: string[]
- duration: number

### Step 2: Build Search Index Service
Create a service that:
- Loads episode metadata from YAML files (or generates a JSON index during build)
- Builds an inverted index for fast text search
- Supports fuzzy matching for typos
- Indexes: title, speaker name, topics, summary

### Step 3: Create Search Service
- `search(query: string): Observable<SearchResult[]>`
- Debounce input (300ms)
- Basic text matching (case-insensitive substring match on title, speaker name, topics, summary)
- (Fuzzy matching and relevance scoring moved to future enhancement task)

### Step 4: Update Search Component
- Add search input with debounced input
- Display results in a list with:
  - Episode title
  - Speaker name
  - Date
  - Topics tags
  - Click to copy the RSS feed URL for that episode's category (e.g., `general-conference/all.rss`)
- Add loading state
- Add "no results" state

### Step 5: Add Routing (if needed)
Ensure `/search` route loads the search page.

## Technical Considerations

### Search Index Generation
Option A: Generate a JSON index file during build (`npm run build`)
- Pro: No server-side processing needed
- Con: Large JSON file (all episode metadata)

Option B: Server-side search with API
- Pro: Smaller client bundle
- Con: Requires SSR endpoint

Option C: Client-side lazy loading
- Pro: Progressive enhancement
- Con: Initial load may be slow

Recommendation: Option C - Lazy load search index on first search query.

### Search Library
MVP uses native JavaScript string methods for basic filtering.
- `fuse.js` - Reserved for future fuzzy search enhancement
- `flexsearch` - Not needed for MVP

## Acceptance Criteria (MVP)
1. User can type in search input and see results after 300ms debounce
2. Results show title, speaker, date, and topics
3. Clicking a result copies the podcast feed URL to clipboard
4. "No results found" message displays for empty queries
5. Loading indicator shows while searching
6. Search works offline if index is cached
7. Basic text matching (case-insensitive substring match)

## Future Enhancements
- Task TBD: Add fuzzy matching with Fuse.js for typo tolerance
- Task TBD: Add relevance scoring and result ranking
- Task TBD: Add search term highlighting in results