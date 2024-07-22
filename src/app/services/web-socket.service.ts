import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws!: WebSocket;

  connect(): Observable<any> {
    this.ws = new WebSocket('ws://localhost:3001');

    return new Observable(observer => {
      this.ws.onmessage = (event) => observer.next(event);
      this.ws.onerror = (event) => observer.error(event);
      this.ws.onclose = () => observer.complete();
    });
  }

  sendMessage(message: any): void {
    this.ws.send(JSON.stringify(message));
  }
}
