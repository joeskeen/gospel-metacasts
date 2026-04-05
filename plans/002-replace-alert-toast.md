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
- `src/app/pages/browse/browse.ts` - Remove alert() call
- `src/app/shared/components/toast/toast.service.ts` - New toast service
- `src/app/shared/components/toast/toast.component.ts` - New toast component
- `src/app/shared/components/toast/toast.html` - Template
- `src/app/shared/components/toast/toast.scss` - Styles
- `src/app/app.ts` - Add toast component to root

## Implementation Steps

### Step 1: Create Toast Service
```typescript
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts = signal<Toast[]>([]);
  
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
- Fixed position (bottom-right or top-center)
- Auto-dismiss after 3 seconds
- Dismiss button
- Slide-in animation
- Color-coded by type (green success, red error, blue info)

### Step 3: Add Toast to App Root
Add toast container to `app.html`:
```html
<app-toast-container />
<router-outlet />
```

### Step 4: Update Browse Page
Replace `alert()` call with toast service:
```typescript
onFeedClick(event: MouseEvent, feed: Feed) {
  // ... existing clipboard logic ...
  this.toastService.success(`Podcast link to "${feed.displayName}" copied!`);
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
}

.toast {
  padding: 1rem 1.5rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease;
  
  &.success { border-left: 4px solid #22c55e; }
  &.error { border-left: 4px solid #ef4444; }
  &.info { border-left: 4px solid #3b82f6; }
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

## Acceptance Criteria
1. Toast appears at bottom-right of screen
2. Toast auto-dismisses after 3 seconds
3. User can click X to dismiss immediately
4. Shows green border for success (clipboard copy)
5. Slide-in animation plays
6. Multiple toasts stack vertically