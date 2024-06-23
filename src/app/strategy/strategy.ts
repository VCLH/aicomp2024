import * as proto from '../game';

export interface Strategy {
  init(game: proto.Game): void;
  handleGridUpdate(gridUpdate: proto.GridUpdate): void;
  performAction(): proto.Action | null;
  debug(): void;
}
