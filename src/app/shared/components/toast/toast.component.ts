import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss'
})
export class ToastContainerComponent {
  readonly toastService = input.required<ToastService>();
  readonly toasts = input.required<Toast[]>();

  dismiss(id: string) {
    this.toastService().dismiss(id);
  }
}