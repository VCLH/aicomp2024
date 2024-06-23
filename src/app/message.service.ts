import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private messages = new Subject<string>();
  constructor() {

  }

  getMessages() {
    return this.messages;
  }

  addMessage(message: string) {
    this.messages.next(message);
  }
}
