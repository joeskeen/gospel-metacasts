import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLinkWithHref, RouterLinkActive } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ThemeToggleComponent } from './shared/components/theme-toggle/theme-toggle.component';
import { ToastService } from './shared/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLinkWithHref, RouterLinkActive, ToastContainerComponent, ThemeToggleComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('client');
  readonly toastService = inject(ToastService);
}
