import { Component } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-getting-started',
  imports: [MarkdownComponent],
  templateUrl: './getting-started.page.html',
  styleUrl: './getting-started.page.scss'
})
export class GettingStartedPage {}