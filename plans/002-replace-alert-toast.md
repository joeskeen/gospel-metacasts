# Implementation Plan: Replace alert() with Toast Notifications

## Overview
Replace the browser-native `alert()` calls with custom toast notifications for better user experience.

## Background
The current implementation uses `alert()` for clipboard copy confirmation, which:
- Blocks the UI thread
- Is intrusive and bad UX
- Varies across browsers
- Cannot be styled

## Files to Modify
- `src/app/pages/browse/browse.ts` - Remove alert() call, inject ToastService
- `src/app/shared/components/toast/toast.service.ts` - New toast service
- `src/app/shared/components/toast/toast.component.ts` - New toast component
- `src/app/shared/components/toast/toast.html` - Template
- `src/app/shared/components/toast/toast.scss` - Styles
- `src/app/app.ts` - Add toast component to root

## Implementation Steps

### Step 1: Create Toast Service
```typescript
import { Injectable, signal, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts = signal<Toast[]>([]);
  readonly toasts$ = this.toasts.asReadonly();
  
  show(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000) {
    const id = crypto.randomUUID();
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }
  
  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error'); }
  info(message: string) { this.show(message, 'info'); }
  
  dismiss(id: string) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
```

### Step 2: Create Toast Component
- Use Angular CDK Overlay for positioning (bottom-right anchor)
- Use native CSS animations (NOT `@angular/animations`) with `animate.enter`/`animate.leave`
- Auto-dismiss after 3 seconds
- Dismiss button
- Color-coded by type (green success, red error, blue info)
- Use `input()` for signal-based inputs (Angular 17+)
- Container includes `role="alert"` and `aria-live="polite"` for accessibility

### Step 3: Add Toast to App Root
Add toast container to `app.html`:
```html
<app-toast-container />
<router-outlet />
```

### Step 4: Update Browse Page
Inject the ToastService and replace `alert()` calls:
```typescript
export class BrowsePage {
  readonly toastService = inject(ToastService);
  // ... existing code ...

  onFeedClick(event: MouseEvent, feed: Feed) {
    try {
      const baseUrl = document.head.baseURI;
      const fullUrl = baseUrl + feed.path;
      navigator.clipboard.writeText(fullUrl);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.toastService.success(`Podcast link to "${feed.displayName}" copied!`);
    } catch { 
      this.toastService.error('Failed to copy link. Please try again.');
    }
  }
}
```

## Styles
```scss
.toast-container {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 300px;
}

.toast {
  padding: 1rem 1.5rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  
  &.success { border-left: 4px solid #22c55e; }
  &.error { border-left: 4px solid #ef4444; }
  &.info { border-left: 4px solid #3b82f6; }
}
```

**Note:** Use native CSS animations (Angular v20.2+). Do NOT use `@angular/animations` - it's deprecated.
- Use `animate.enter` directive for enter animations
- Use `animate.leave` with CSS keyframes for exit animations  
- Use `@starting-style` for initial state on enter
- Example: `<div class="toast" animate.enter="slide-in" animate.leave="slide-out">`

## Acceptance Criteria
1. Toast appears at bottom-right of screen (via CDK Overlay)
2. Toast auto-dismisses after 3 seconds
3. User can click X to dismiss immediately
4. Shows green border for success (clipboard copy)
5. Smooth animation using native CSS (via `animate.enter`/`animate.leave`)
6. Multiple toasts stack vertically
7. Uses Angular signals with `input()` API
8. Does NOT use `@angular/animations` package (deprecated)
9. Toast container has `role="alert"` and `aria-live="polite"` for accessibility
10. Error toast shown when clipboard copy fails