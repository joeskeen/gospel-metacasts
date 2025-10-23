import { Component } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-home',
  imports: [MarkdownComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage {

}
