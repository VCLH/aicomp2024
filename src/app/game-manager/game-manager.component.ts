import { Component, Input } from '@angular/core';
import * as proto from '../game';
import { BG_COLORS } from '../constants';
import { Strategy } from '../strategy/strategy';
import { BotConfig } from '../types';
import { GameRunner } from '../game/game_runner';
import { MessageService } from '../message.service';
import { timer } from 'rxjs';

const TIME_LIMIT = 20000;

@Component({
  selector: 'app-game-manager',
  templateUrl: './game-manager.component.html',
  styleUrls: ['./game-manager.component.scss']
})
export class GameManagerComponent {
  @Input() gameConfig: proto.GameConfig | null = null;

  bots: Map<proto.Player, Strategy> = new Map;
  game: proto.Game | null = null;
  isValidPlayer: boolean[] = [false, false, false, false, false, false, false, false];
  numVisitedCells: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  botConfigs: Map<proto.Player, BotConfig> = new Map;
  remainingTimes: number[] = [0, 0, 0, 0, 0, 0, 0, 0];

  isPlaying: boolean = false;
  gameRunner: GameRunner | null = null;
  locked: boolean = false;
  speed: number = 10;
  lastAutoPlay: number = Date.now();
  score: number = 0;

  readonly BG_COLORS = BG_COLORS;

  constructor(private message: MessageService) {
    const timerSource = timer(0, 1);
    timerSource.subscribe(() => {
      this.autoplay();
    });
  }
  ngOnChanges() {
    this.setupGame();
  }

  async setupGame() {
    if (!this.gameConfig) {
      return;
    }
    this.botConfigs = new Map<proto.Player, BotConfig>;
    for (const { player, description, strategy, config } of this.gameConfig.players) {
      this.botConfigs.set(player, { description, strategy, config });
    }
    this.bots = await this.getBots(this.botConfigs);
    this.game = this.convertToMap(this.gameConfig);
    for (let i = 0; i < 8; ++i) {
      this.isValidPlayer[i] = this.botConfigs.has(proto.playerFromJSON(i + 1));
    }
    this.gameRunner = new GameRunner(this.game, this.bots);
    this.updateStatistics();
  }

  async getBots(botConfigs: Map<proto.Player, BotConfig>) {
    const entries = Array.from(botConfigs);
    const bots = await Promise.all(entries.map(async ([player, botConfig]) => {
      const importPromise = import(/* webpackChunkName: "strategies" */ `../strategy/${botConfig.strategy}`);
      try {
        const module = await importPromise;
        const strategy = module.create(botConfig.config);
        return [player, strategy] as [proto.Player, Strategy];
      } catch (e) {
        console.log(e);
        this.message.addMessage("Error creating bot for player " + proto.playerFromJSON(player));
        throw e;
      }
    }));
    return new Map<proto.Player, Strategy>(bots);
  }

  private convertToMap(gameConfig: proto.GameConfig): proto.Game {
    const allPlayers = gameConfig.players.map((playerConfig) => playerConfig.player);
    const game = proto.Game.create({
      players: allPlayers,
      gameLength: gameConfig.gameLength,
      currentTick: 0,
      height: gameConfig.gameMap!.grid?.rows.length,
      width: gameConfig.gameMap!.grid?.rows.length,
      grid: gameConfig.gameMap!.grid,
    })
    for (const i in gameConfig.players) {
      const playerInfo = game.grid!.playerInfos[i];
      playerInfo.player = gameConfig.players[i].player;
      playerInfo.remainingTimeMs = TIME_LIMIT;
    }
    return game;
  }

  trackByIndex(index: number, el: any): number {
    return index
  }

  gameResume() {
    this.isPlaying = true;
  }
  gameTick() {
    do {
      if (this.gameStep()) {
        break;
      }
    } while (true);
  }
  gameStep() {
    if (!this.gameRunner) {
      return;
    }
    if (!this.gameConfig) {
      return;
    }
    if (this.locked) {
      return;
    }
    this.locked = true;
    const ret = this.gameRunner.step();
    this.updateStatistics();
    this.locked = false;
    return ret;
  }
  gamePause() {
    this.isPlaying = false;
  }

  autoplay() {
    if (!this.isPlaying) {
      return;
    }
    if (!this.game) {
      return;
    }
    if (this.game.currentTick == this.gameConfig?.gameLength) {
      this.isPlaying = false;
      return;
    }
    if (this.lastAutoPlay > Date.now() - this.speed) {
      return;
    }
    this.lastAutoPlay = Date.now();
    this.gameStep();
  }

  gameDebug(player: proto.Player) {
    this.gameRunner?.debug(player);
  }

  private updateStatistics() {
    this.score = this.gameRunner!.computeScore();
    this.numVisitedCells = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.game!.height; ++i) {
      for (let j = 0; j < this.game!.width; ++j) {
        const cell = this.game!.grid!.rows[i].cells[j];
        if (cell.firstVisitPlayer != proto.Player.INVALID) {
          this.numVisitedCells[cell.firstVisitPlayer - 1]++;
        }
      }
    }
    this.game!.grid!.playerInfos.forEach(({ player, remainingTimeMs }) => {
      this.remainingTimes[player - 1] = remainingTimeMs;
    });
  }
}
