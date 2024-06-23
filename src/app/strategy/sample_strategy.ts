import { Strategy } from './strategy'
import * as proto from '../game'
import { GameDebugger } from '../game/game_debugger';

export function create(config: string): Strategy {
  let movePriority = MovePriority.RANDOM;
  if (config == "1") {
    movePriority = MovePriority.UNVISITED_THEN_MINE;
  }
  return new SampleStrategy({ movePriority });
}

enum MovePriority {
  RANDOM, UNVISITED_THEN_MINE
}
type SampleStrategyOptions = {
  movePriority?: MovePriority,
};

const DX = [0, 0, -1, 0, 1];
const DY = [0, 1, 0, -1, 0];

class SampleStrategy implements Strategy {
  private game: proto.Game = proto.Game.create();
  private grid: proto.Grid = proto.Grid.create();
  private debugger: GameDebugger = new GameDebugger;
  private options: SampleStrategyOptions;

  constructor(options: SampleStrategyOptions = {
    movePriority: MovePriority.RANDOM,
  }) {
    this.options = options;
  };

  init(game: proto.Game): void {
    this.game = game;
    this.grid = game.grid!;
  }

  handleGridUpdate(gridUpdate: proto.GridUpdate): void {
    for (const cellUpdate of gridUpdate.cellUpdates) {
      // When accessing fields of Message type (sub-messages),
      // using !. will assert that it is not undefined.
      this.grid.rows[cellUpdate!.coordinates!.x].cells[cellUpdate!.coordinates!.y] = cellUpdate!.cell!;
    }
    for (const playerInfoUpdate of gridUpdate.playerInfoUpdates) {
      for (const i in this.grid.playerInfos) {
        if (this.grid.playerInfos[i].player == playerInfoUpdate!.player) {
          this.grid.playerInfos[i] = playerInfoUpdate!;
          break;
        }
      }
    }
  }

  performAction(): proto.Action | null {
    const myPlayerInfo = this.grid.playerInfos.filter(playerInfo => playerInfo.player == this.game.assignedColor)!;
    const x = myPlayerInfo[0].position!.x;
    const y = myPlayerInfo[0].position!.y;
    const currentCell = this.grid.rows[x].cells[y];
    const possibleActions = [];

    let blockedByWoodType = null;
    // Consider moving
    for (let dir = 1; dir <= 4; ++dir) {
      // There is a door and it is not open
      if (currentCell.cellType?.emptyCell?.door?.direction == dir && !currentCell.cellType?.emptyCell?.door.isOpen) {
        blockedByWoodType = currentCell.cellType?.emptyCell?.door.woodType;
        continue;
      }
      const newX = x + DX[dir];
      const newY = y + DY[dir];
      const newCellType = this.grid.rows[newX].cells[newY].cellType;
      if (newCellType?.pressurePlateCell || newCellType?.emptyCell) {
        possibleActions.push(proto.Action.create({ move: proto.directionFromJSON(dir) }));
      }
    }

    // Consider mining
    for (let dir = 1; dir <= 4; ++dir) {
      const newX = x + DX[dir];
      const newY = y + DY[dir];
      const newCellType = this.grid.rows[newX].cells[newY].cellType;
      if (newCellType?.stoneCell) {
        possibleActions.push(proto.Action.create({ mine: proto.directionFromJSON(dir) }));
      }
    }

    if (!possibleActions.length) {
      return null;
    }
    // Score all the actions
    let bestAction = null;
    let bestScore = 0.0;
    for (const candidateAction of possibleActions) {
      const candidateScore = this.scoreAction(candidateAction);
      if (candidateScore > bestScore) {
        bestAction = candidateAction;
        bestScore = candidateScore;
      }
    }
    if (bestAction && blockedByWoodType) {
      bestAction.signal = blockedByWoodType;
    }
    return bestAction;
  }

  debug(): void {
    this.debugger.printGame(this.game);
  }

  private scoreAction(action: proto.Action): number {
    if (this.options.movePriority == MovePriority.RANDOM) {
      return Math.random();
    }
    const myPlayerInfo = this.grid.playerInfos.filter(playerInfo => playerInfo.player == this.game.assignedColor)!;
    const x = myPlayerInfo[0].position!.x;
    const y = myPlayerInfo[0].position!.y;
    if (action.move) {
      const newX = x + DX[action.move];
      const newY = y + DY[action.move];
      return this.grid.rows[newX].cells[newY].firstVisitPlayer == proto.Player.INVALID ? 2.0 : 0.5;
    }
    return 1.0;
  }
}
