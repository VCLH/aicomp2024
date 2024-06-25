import { Component } from '@angular/core';
import * as proto from '../game';
import { DataService, encode } from '../data.service';
import { GameMapRow, BotRow } from '../types';
import { Buffer } from 'buffer';
import { BG_COLORS, FG_COLORS } from '../constants';
import { MessageService } from '../message.service';
@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.scss']
})
export class PlayComponent {
  gameMaps: { id: number, description: string, gameMap: proto.GameMap }[] = [];
  bots: BotRow[] = [];
  selectedMap: number = 0;
  selectedBots: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  selectedLength: number = 200;
  gameConfig: proto.GameConfig | null = null;

  readonly getPlayerName = proto.playerFromJSON;
  readonly BG_COLORS = BG_COLORS;
  readonly FG_COLORS = FG_COLORS;

  constructor(private data: DataService, private message: MessageService) {
    this.loadGameMaps();
    this.loadBots();
  }

  private loadGameMaps() {
    this.data.getGameMaps()
      .subscribe((rows: GameMapRow[]) => {
        const gameMaps = [];
        for (const { id, description, data } of rows) {
          gameMaps.push({
            id: id!,
            description,
            gameMap: proto.GameMap.decode(new Uint8Array(Buffer.from(data, 'base64')))
          })
        }
        this.gameMaps = gameMaps;
      });
  }

  private loadBots() {
    this.data.getBots()
      .subscribe((rows: BotRow[]) => {
        this.bots = rows;
      });
  }

  trackByIndex(index: number, el: any): number {
    return index
  }

  playGame() {
    this.gameConfig = this.getGameConfig();
    window.localStorage.setItem('game_config', encode(proto.GameConfig.encode(this.gameConfig).finish()));
  }

  loadLastConfig() {
    const data = window.localStorage.getItem('game_config');
    if (!data) {
      this.message.addMessage("No game config data saved in local storage.");
      return;
    }
    try {
      this.gameConfig = proto.GameConfig.decode(new Uint8Array(Buffer.from(data, 'base64')));
    } catch (e) {
      this.message.addMessage("Error decoding game config data in local storage.");
      return;
    }
  }

  private getGameConfig() {
    const gameMap = this.gameMaps.find(({ id }) => id == this.selectedMap)!.gameMap;
    const numPlayers = this.selectedBots.filter((id) => id != 0).length;
    if (gameMap.players.length != numPlayers) {
      this.message.addMessage("Number of bots should match the number of players in the Map.");
    }
    const playerConfigs = [];
    for (let i = 0; i < 8; ++i) {
      if (this.selectedBots[i]) {
        const bot = this.bots.find((botRow) => botRow.id == this.selectedBots[i])!;
        const playerConfig = proto.GameConfig_PlayerConfig.create({
          player: proto.playerFromJSON(i + 1),
          description: bot.description,
          strategy: bot.strategy,
          config: bot.config
        });
        playerConfigs.push(playerConfig)
      }
    }
    const gameConfig = proto.GameConfig.create({
      gameLength: this.selectedLength,
      gameMap,
      players: playerConfigs
    });
    return gameConfig;
  }
}
