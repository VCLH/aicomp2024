import { Strategy } from './strategy'
import * as proto from '../game'
import { GameDebugger } from '../game/game_debugger';

export function create(config: string): Strategy {
  return new NullStrategy();
}

class NullStrategy implements Strategy {
  private game: proto.Game = proto.Game.create();
  private grid: proto.Grid = proto.Grid.create();
  private debugger: GameDebugger = new GameDebugger;

  constructor() {
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
  }

  performAction(): proto.Action | null {
    return null;
  }

  debug() {
    this.debugger.printGame(this.game);
  }
}
