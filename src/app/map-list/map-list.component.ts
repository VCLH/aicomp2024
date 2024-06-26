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
    pressurePlateDensity: '70',
    doorDensity: '35',
    minChestReward: '25',
    maxChestReward: '50',
    stoneLife: '10',
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
      lengthUnits: parseInt(this.generatorConfig.units),
    }),
      parseInt(this.generatorConfig.stoneLife),
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
    2-3 players: 3 units
    4+ players: 4 units, density = 40, 20
    */
    this.generatorConfig.numPlayers = numPlayers;
    this.generatorConfig.units = numPlayers <= 3 ? '3' : '4';
    this.generatorConfig.pressurePlateDensity = numPlayers <= 3 ? '70' : '50';
    this.generatorConfig.doorDensity = numPlayers <= 3 ? '35' : '25';
  }
}
