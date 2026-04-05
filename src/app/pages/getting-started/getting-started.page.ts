import { Component, inject, OnInit, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [MarkdownComponent],
  templateUrl: './getting-started.page.html',
  styleUrl: './getting-started.page.scss'
})
export class GettingStartedPage implements OnInit {
  private http = inject(HttpClient);

  currentUrl = '';
  markdownContent = signal('');

  ngOnInit() {
    this.currentUrl = document.head.baseURI.replace(/\/$/, '');
    this.http.get('getting-started-content.md', { responseType: 'text' }).subscribe(data => {
      const processed = data.replace(/\[SITE_URL\]/g, () => {
        return `[${this.currentUrl}](${this.currentUrl})`;
      });
      this.markdownContent.set(processed);
    });
  }
}