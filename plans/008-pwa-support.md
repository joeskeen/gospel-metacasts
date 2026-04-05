# Implementation Plan: Add PWA Support

**Status: 🔲 Pending**

## Overview
Add Progressive Web App (PWA) capabilities to allow offline access, home screen installation, and improved performance.

## Background
PWA features provide a more app-like experience with offline capabilities, which is valuable for users who may have limited connectivity when browsing available feeds.

## Files to Create/Modify

### New Files
- `src/manifest.webmanifest` - PWA manifest
- `src/icons/` - App icons (multiple sizes)
- `src/app/app.config.ts` - Add service worker config

### Modified Files
- `angular.json` - Add PWA configuration
- `index.html` - Add manifest link, theme color
- `package.json` - Add @angular/pwa if not present

## Implementation Steps

### Step 1: Add Angular PWA Package
```bash
ng add @angular/pwa
```

This will:
- Install @angular/service-worker
- Create ngsw-config.json
- Update angular.json
- Add service worker module

### Step 2: Configure Manifest
Create/update `src/manifest.webmanifest`:
```json
{
  "name": "Gospel Metacasts",
  "short_name": "Metacasts",
  "description": "Podcast feeds for LDS General Conference and scripture audio",
  "theme_color": "#1a5f7a",
  "background_color": "#f8f9fa",
  "display": "standalone",
  "orientation": "portrait-primary",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Step 3: Update index.html
```html
<head>
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#1a5f7a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Metacasts">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
</head>
```

### Step 4: Configure Service Worker
Update `ngsw-config.json`:
```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/assets/**",
          "/*.(svg|jpg|png|gif)"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-freshness",
      "urls": [
        "/index.json"
      ],
      "cacheConfig": {
        "maxSize": 10,
        "maxAge": "1h",
        "timeout": "10s",
        "strategy": "freshness"
      }
    }
  ]
}
```

### Step 5: Create App Icons
Generate required icons:
- 192x192 (favicon, PWA)
- 512x512 (PWA)
- 180x180 (apple-touch-icon)
- Various Android sizes

Can use: https://realfavicongenerator.net/

### Step 6: Handle Offline State
```typescript
// Check if online
if (!navigator.onLine) {
  // Show offline message or cached content
}
```

### Step 7: Test PWA Features
- [ ] App installable on desktop (Chrome/Edge)
- [ ] App installable on mobile (Chrome/Safari)
- [ ] Works offline (cached views)
- [ ] Updates properly when new version deployed

## Offline Capabilities
The app should work offline for:
- Browsing previously loaded feed index
- Viewing cached pages (Home, Browse)
- Reading cached episode metadata

Note: RSS feeds and audio playback require network.

## Acceptance Criteria
1. PWA manifest present and valid
2. App installable on mobile home screen
3. App installable on desktop
4. Works offline for browsing cached data
5. Updates correctly on new deployments
6. Install prompt appears (or can be triggered)