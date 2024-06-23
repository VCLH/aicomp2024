import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import * as proto from './game';
import { GameMapRow, BotRow, BotConfig } from './types';
import { Buffer } from 'buffer';

export function encode(x: Uint8Array): string {
  return Buffer.from(x).toString('base64');
}

export function decode(y: string) {
  return "";
}

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private http: HttpClient) { }

  getGameMaps() {
    return this.http.get<GameMapRow[]>('/api/gamemap/list');
  }

  saveGameMap(gameMap: proto.GameMap, description: string) {
    return this.http.post('/api/gamemap/save', {
      description,
      data: encode(proto.GameMap.encode(gameMap).finish())
    });
  }

  deleteGameMap(id: number) {
    return this.http.post('/api/gamemap/delete', {
      id
    });
  }

  getBots() {
    return this.http.get<BotRow[]>('/api/bot/list');
  }

  saveBot(botConfig: BotConfig) {
    return this.http.post('/api/bot/save', botConfig);
  }

  deleteBot(id: number) {
    return this.http.post('/api/bot/delete', {
      id
    });
  }
}
