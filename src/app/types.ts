import * as proto from './game';

export type BotConfig = {
  description: string,
  strategy: string,
  config: string
};
export type GameMapRow = {
  id?: number,
  description: string,
  data: string,
}
export type BotRow = {
  id?: number,
  description: string,
  strategy: string,
  config: string
}
