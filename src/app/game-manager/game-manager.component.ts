import { Component, Input } from '@angular/core';
import * as proto from '../game';
import { BG_COLORS, FG_COLORS } from '../constants';
import { Strategy } from '../strategy/strategy';
import { BotConfig } from '../types';
import { GameRunner } from '../game/game_runner';
import { MessageService } from '../message.service';
import { timer } from 'rxjs';

const TIME_LIMIT_PER_TICK = 10;

const EVENT_TYPE_TO_SOUND : { [key: string]: string } = {
  CHEST_OPENED : 'Chest_open',
  PLAYER_MOVED : 'Stone_hit',
  DOOR_OPENED : 'Wood_Door_open',
  DOOR_CLOSED : 'Wood_Door_close',
  PRESSURE_PLATE_ACTIVATED : 'P_activate',
  PRESSURE_PLATE_DEACTIVATED : 'P_deactivate',
  BLOCK_DAMAGED : 'Stone_dig',
  BLOCK_MINED: 'Stone_mining'
};

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
  numVisitedCells: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  botConfigs: Map<proto.Player, BotConfig> = new Map;
  
  isPlaying: boolean = false;
  gameRunner: GameRunner | null = null;
  locked: boolean = false;
  speed: number = 20;
  lastAutoPlay: number = Date.now();
  score: number = 0;
  chestScore: number = 0;
  sounds: Map<string, AudioBuffer[]> = new Map;
  audioContext: AudioContext;
  playingSounds: Map<string, AudioBufferSourceNode> = new Map();
  
  readonly BG_COLORS = BG_COLORS;
  readonly FG_COLORS = FG_COLORS;

  constructor(private message: MessageService) {
    const timerSource = timer(0, 1);
    timerSource.subscribe(() => {
      this.autoplay();
    });
    this.audioContext = new AudioContext();
  }

  ngOnChanges() {
    this.setupGame();
  }

  async setupGame() {
    if (!this.gameConfig) {
      return;
    }
    this.loadSounds();
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
      playerInfo.remainingTimeMs = TIME_LIMIT_PER_TICK * gameConfig.gameLength;
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
    this.handleEvents(this.gameRunner.getLastEvents());
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
    this.numVisitedCells = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.chestScore = 0;
    for (let i = 0; i < this.game!.height; ++i) {
      for (let j = 0; j < this.game!.width; ++j) {
        const cell = this.game!.grid!.rows[i].cells[j];
        if (cell.firstVisitPlayer != proto.Player.INVALID) {
          this.numVisitedCells[cell.firstVisitPlayer]++;
        }
        if (cell.cellType?.chestCell?.isOpened) {
          this.chestScore += cell.cellType!.chestCell!.score;
        }
      }
    }
  }

  private loadSounds() {
    if (this.audioContext.state == 'suspended') {
      this.audioContext.resume();
    }
    if (this.sounds.size > 0) {
      return;
    }
    this.loadSound('Chest_open');
    this.loadSound('P_activate');
    this.loadSound('P_deactivate');
    this.loadSound('Stone_dig', '1');
    this.loadSound('Stone_dig', '2');
    this.loadSound('Stone_dig', '3');
    this.loadSound('Stone_dig', '4');
    this.loadSound('Stone_hit', '1');
    this.loadSound('Stone_hit', '2');
    this.loadSound('Stone_hit', '3');
    this.loadSound('Stone_hit', '4');
    this.loadSound('Stone_hit', '5');
    this.loadSound('Stone_hit', '6');
    this.loadSound('Stone_mining', '1');
    this.loadSound('Stone_mining', '2');
    this.loadSound('Stone_mining', '3');
    this.loadSound('Stone_mining', '4');
    this.loadSound('Stone_mining', '5');
    this.loadSound('Stone_mining', '6');
    this.loadSound('Wooden_Door_close', '1');
    this.loadSound('Wooden_Door_close', '2');
    this.loadSound('Wooden_Door_close', '3');
    this.loadSound('Wooden_Door_open', '1');
    this.loadSound('Wooden_Door_open', '2');
  }

  private loadSound(key: string, suffix: string = '') {
    const request = new XMLHttpRequest();
    request.open('GET', '/assets/sounds/' + key + suffix + '.ogg', true);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      this.audioContext.decodeAudioData(request.response, (audioBuffer) => {
        if (audioBuffer)
          if (!this.sounds.has(key)) {
            this.sounds.set(key, []);
          }
          this.sounds.get(key)!.push(audioBuffer);
      });
    };
    request.send();
  }

  private handleEvents(events: proto.GameEvent[]) {
    for (const event of events) {
      if (event.eventType == proto.GameEventType.DOOR_CLOSED || event.eventType == proto.GameEventType.DOOR_OPENED) {
        const key = proto.gameEventTypeFromJSON(event.eventType) + '_' + proto.woodTypeToJSON(event.woodType);
        if (this.playingSounds.has(key)) {
          continue;
        }
        const source = this.audioContext.createBufferSource();
        const filename = event.eventType == proto.GameEventType.DOOR_CLOSED ? 'Wooden_Door_close' : 'Wooden_Door_open';
        source.buffer = this.sounds.get(filename)![Math.floor(Math.random() * this.sounds.get(filename)!.length)];
        // volume 30%
        const volumeNode = this.audioContext.createGain();
        volumeNode.gain.value = 1.0;
        source.connect(volumeNode);
        volumeNode.connect(this.audioContext.destination);
        this.playSound(key, source);
      } else if (event.eventType == proto.GameEventType.PLAYER_MOVED) {
        const key = 'MOVE_' + proto.playerToJSON(event.player);
        if (this.playingSounds.has(key)) {
          continue;
        }
        const source = this.audioContext.createBufferSource();
        const filename = 'Stone_hit';
        source.buffer = this.sounds.get(filename)![Math.floor(Math.random() * this.sounds.get(filename)!.length)];
        const panNode = this.audioContext.createStereoPanner();
        panNode.pan.value = 2.0 * event.position!.y / (this.game!.width - 1) - 1.0;
        source.connect(panNode);
        panNode.connect(this.audioContext.destination);
        this.playSound(key, source);
      } else {
        const key = proto.gameEventTypeFromJSON(event.eventType) + '_' + event.position!.x + '_' + event.position!.y;
        if (this.playingSounds.has(key)) {
          continue;
        }
        const source = this.audioContext.createBufferSource();
        const filename = EVENT_TYPE_TO_SOUND[proto.gameEventTypeToJSON(event.eventType)];
        source.buffer = this.sounds.get(filename)![Math.floor(Math.random() * this.sounds.get(filename)!.length)];
        const panNode = this.audioContext.createStereoPanner();
        panNode.pan.value = 2.0 * event.position!.y / (this.game!.width - 1) - 1.0;
        source.connect(panNode);
        // volume 30% if event type is mine
        const volumeNode = this.audioContext.createGain();
        volumeNode.gain.value = event.eventType == proto.GameEventType.BLOCK_DAMAGED ? 0.2 : 1.0;
        panNode.connect(volumeNode);
        volumeNode.connect(this.audioContext.destination);
        this.playSound(key, source);
      }
    }
  }

  private playSound(key: string, source: AudioBufferSourceNode) {
    setTimeout(() => {
      source.stop();
      source.disconnect();
      this.playingSounds.delete(key);
    }, 210);
    source.start();
    this.playingSounds.set(key, source);
  }
}
