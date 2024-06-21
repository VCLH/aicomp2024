import * as proto from '../game';

export interface Strategy {
  init(game: proto.Game): void;
  tick(tickNumber: number): void;
  handleGridUpdate(gridUpdate: proto.GridUpdate): void;
  performAction(): proto.Action;
  debug(): void;
}
