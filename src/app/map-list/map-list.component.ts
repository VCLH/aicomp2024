import { Component } from '@angular/core';
import { BG_COLORS } from '../constants';
import { GameGenerator } from '../game/game_generator';
import * as proto from '../game';
import { GameRunner } from '../game/game_runner';
import { DataService } from '../data.service';
import { GameMapRow } from '../types';
import { Buffer } from 'buffer';
@Component({
  selector: 'app-map-list',
  templateUrl: './map-list.component.html',
  styleUrls: ['./map-list.component.scss']
})
export class MapListComponent {
  generatorConfig = {
    numPlayers: 2,
    units: '3',
    haveChest: true,
    numWoodType: '2',
    pressurePlateDensity: '50',
    doorDensity: '25',
    minChestReward: '25',
    maxChestReward: '50',
  }
  gameMap: proto.GameMap | null = null;
  grid: proto.Grid | null = null;
  gameMaps: { id: number, description: string, gameMap: proto.GameMap }[] = [];
  description: string = '';

  readonly BG_COLORS = BG_COLORS;

  constructor(private data: DataService) {
    this.loadGameMaps();
  }

  private generateChestReward(minReward: number, maxReward: number): number {
    const minLog = Math.log(minReward);
    const maxLog = Math.log(maxReward);
    const log = Math.random() * (maxLog - minLog) + minLog;
    return Math.exp(log);
  }

  public generate() {
    const generator = new GameGenerator;
    const players = [];
    for (let i = 0; i < this.generatorConfig.numPlayers; ++i) {
      players.push(proto.playerFromJSON(i + 1));
    }
    this.gameMap = generator.generate(proto.GameMap.create({
      players,
      lengthUnits: parseInt(this.generatorConfig.units)
    }),
      this.generatorConfig.haveChest,
      parseInt(this.generatorConfig.numWoodType),
      parseInt(this.generatorConfig.pressurePlateDensity),
      parseInt(this.generatorConfig.doorDensity),
      () => this.generateChestReward(parseInt(this.generatorConfig.minChestReward), parseInt(this.generatorConfig.maxChestReward))
    );
    this.grid = this.gameMap.grid!;


  }

  public saveGameMap() {
    if (this.gameMap) {
      this.data.saveGameMap(this.gameMap, this.description).subscribe(() => {
        this.loadGameMaps();
      });
    }
  }

  public deleteGameMap(id: number) {
    this.data.deleteGameMap(id).subscribe(() => {
      this.loadGameMaps();
    });
  }

  private convertToGame(gameConfig: proto.GameConfig): proto.Game {
    const game = proto.Game.create({
      width: gameConfig.gameMap!.lengthUnits * 7 + 2,
      height: gameConfig.gameMap!.lengthUnits * 7 + 2,
      grid: gameConfig.gameMap!.grid,
      players: gameConfig.players.map(playerConfig => playerConfig.player),
      currentTick: 0,
      gameLength: gameConfig.gameLength
    });
    return game;
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

  public viewMap(gameMap: proto.GameMap) {
    this.grid = gameMap.grid!;
  }

  public usePreset(numPlayers: number) {
    /*
    2 players: 14x14, 65%, 10 towers
  3 players: 16x16, 70%, 15 towers [tie breaker only]
  4 players: 18x18, 75%, 20 towers
  6 players: 20x20, 80%, 25 towers
    
    this.generatorConfig.numPlayers = numPlayers;
    this.generatorConfig.width = this.generatorConfig.height =
      [0, 0, 14, 16, 18, 19, 20, 21, 22][numPlayers].toString();
    this.generatorConfig.density = [0, 0, 65, 65, 70, 70, 75, 75, 80][numPlayers].toString();
    this.generatorConfig.numTower = [0, 0, 10, 15, 20, 22, 25, 28, 30][numPlayers].toString();
    */
  }
}
