import { Component } from '@angular/core';
import { MessageService } from './message.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'angular-router-sample';
  messages: string[] = [];
  constructor(private messageService: MessageService) {
    this.messageService.getMessages().subscribe((message: string) => {
      this.messages.push(message)
      setTimeout(() => {
        if (this.messages.length > 0) {
          this.messages.shift();
        }
      }, 5000);
    });
  }
}
