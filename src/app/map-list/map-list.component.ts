import { Component } from '@angular/core';
import { BG_COLORS } from '../constants';
import { GameGenerator } from '../game/game_generator';
import * as proto from '../game';
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
    units: '4',
    haveChest: false,
    numWoodType: '2',
    pressurePlateDensity: '80',
    doorDensity: '70',
    minChestReward: '25',
    maxChestReward: '50',
    stoneLife: '15',
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

  public usePreset(stage: string) {
    /*
    2-3 players: 3 units
    4+ players: 4 units, density = 40, 20
    */
    this.generatorConfig.numPlayers = 2;
    this.generatorConfig.haveChest = stage == 'final';
    this.generatorConfig.numWoodType = stage == 'heat' ? '2' : '3';
    this.generatorConfig.units = stage == 'heat' ? '4' : '5';
    this.generatorConfig.pressurePlateDensity = stage == 'heat' ? '80' : '75';
    this.generatorConfig.doorDensity = stage == 'heat' ? '70' : '80';
  }
}
