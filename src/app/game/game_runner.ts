import { Strategy } from "../strategy/strategy";
import * as proto from "../game";

const UNIT_LENGTH = 7;
const STONE_HP = 5;

function offset(direction: proto.Direction) {
  switch (direction) {
    case proto.Direction.NO_DIRECTION:
      return [0, 0];
    case proto.Direction.RIGHT:
      return [0, 1];
    case proto.Direction.UP:
      return [-1, 0];
    case proto.Direction.LEFT:
      return [0, -1];
    case proto.Direction.DOWN:
      return [1, 0];
    case proto.Direction.UNRECOGNIZED:
      return [0, 0];
  }
}
export class GameRunner {

  private game: proto.Game;
  private players: proto.Player[];
  private playerStrategies: Map<proto.Player, Strategy>;

  private playerInfos: Map<proto.Player, proto.PlayerInfo>;
  private playerView: proto.Row[];
  private stoneDamage: number[][];
  private lastMined: number[][];
  private activePressurePlates: Map<proto.WoodType, number>;

  private hasInitializedGame: boolean = false;

  // In each tick, each player takes one action
  private tickNumber: number = 0;
  private tickSequence: proto.Player[] = [];


  // updates to be flushed
  private gridUpdate: proto.GridUpdate;

  constructor(game: proto.Game, players: Map<proto.Player, Strategy>) {
    this.game = game;
    this.players = [];
    this.playerStrategies = new Map;
    this.playerInfos = new Map;
    for (const [player, strategy] of players) {
      this.players.push(player);
      this.playerStrategies.set(player, strategy);
    }
    for (const playerInfo of game.grid!.playerInfos) {
      this.playerInfos.set(playerInfo.player, playerInfo);
    }
  }

  step(): boolean {
    // return value indicating if the game has ended
    if (!this.hasInitializedGame) {
      this.sendInitializeGame();
      this.hasInitializedGame = true;
      this.tickNumber = 0;
      return false;
    }

    if (this.tickNumber >= this.game.gameLength) {
      // game has ended
      return true;
    }

    if (this.tickSequence.length === 0) {
      this.tickNumber++;
      this.tickSequence = this.players;
    }

    // get current player and act
    const player = this.tickSequence.shift();
    if (!player) {
      // player list empty, game ends
      return true;
    }

    this.gridUpdate = proto.GridUpdate.create({
      cellUpdates: [],
      playerInfoUpdates: [],
    })
    const action = this.playerStrategies.get(player)?.performAction();
    if (action?.move) {
      this.handleMove(player, action.move);
    }
    if (action?.mine) {
      this.handleMine(player, action.mine);
    }

    if (this.gridUpdate.cellUpdates.length > 0 || this.gridUpdate.playerInfoUpdates.length > 0) {
      for (const player of this.players) {
        this.playerStrategies.get(player)?.handleGridUpdate(this.gridUpdate);
      }
    }
    
    return false;
  }

  debug(player: proto.Player) {
    try {
      this.playerStrategies.get(player)?.debug();
    } catch (e) {

    }
  }

  private isCell(x: number, y: number) {
    return 0 <= x && x < this.game.height && 0 <= y && y < this.game.width;
  }


  private makeVisible(x: number, y: number) {
    if (this.playerView[x].cells[y].cellType?.invisibleCell) {
      this.playerView[x].cells[y] = this.game!.grid!.rows[x].cells[y];
      this.gridUpdate.cellUpdates.push(proto.GridUpdate_CellUpdate.create({
        cell: this.game!.grid!.rows[x].cells[y],
        coordinates: { x, y }
      }))
    }
  }

  private updatePlayerView() {
    // TOOD: review door adjacent cells
    for (const player of this.players) {
      const position = this.playerInfos.get(player)!.position!
      const [unit_x, unit_y] = [position.x / UNIT_LENGTH, position.y / UNIT_LENGTH];
      for (let x = unit_x; x < unit_x + UNIT_LENGTH; ++x) {
        for (let y = unit_y; y < unit_y + UNIT_LENGTH; ++y) {
          // this cell now becomes visible
          this.makeVisible(x, y);

          // check if adjacent cell is a door, these cells should also be visible
          for (const [offset_x, offset_y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const [new_x, new_y] = [x + offset_x, y + offset_y];
            if (!this.isCell(new_x, new_y)) {
              return;
            }
            if (this.game!.grid!.rows[x].cells[y].cellType?.emptyCell?.door) {
              this.makeVisible(x, y);
            }
          }
        }
      }
    }

  }

  private sendInitializeGame(): void {
    this.playerView = Array(this.game.height)
      .map(_ => proto.Row.create({
        cells: Array(this.game.width)
          .map(_ => proto.Cell.create({ cellType: proto.CellType.create({ invisibleCell: {} }), }))
      }))
    this.stoneDamage = Array(this.game.height).map(_ => Array(this.game.width).fill(0));
    this.lastMined = Array(this.game.height).map(_ => Array(this.game.width).fill(-5));
    this.updatePlayerView();

    const grid = proto.Grid.create({
      rows: this.playerView,
      playerInfos: [...this.playerInfos.values()]
    })

    for (const player of this.players) {
      const playerGame = proto.Game.create({
        players: this.game.players,
        gameLength: this.game.gameLength,
        height: this.game.height,
        width: this.game.width,
        grid,
        assignedColor: player
      });
      //TODO: add timer
      this.playerStrategies.get(player)?.init(playerGame);
    }
  }

  private getAllDoors(woodType: proto.WoodType): number[][] {
    const doors: number[][] = [];
    for (let i = 0; i < this.game.height; ++i) {
      for (let j = 0; j < this.game.width; ++j) {
        if (this.game!.grid!.rows[i].cells[j].cellType?.emptyCell?.door) {
          if (this.game.grid!.rows[i].cells[j].cellType?.emptyCell?.door?.woodType === woodType) {
            doors.push([i, j]);
          }
        }
      }
    }
    return doors;
  }

  private handleMove(player: proto.Player, move: proto.Mine): void {
    const info = this.playerInfos.get(player)!;
    const position = info.position;
    const [x, y] = [position!.x, position!.y];
    const cell = this.game!.grid!.rows[x].cells[y];

    if (cell.cellType?.emptyCell?.door) {
      const door = cell.cellType.emptyCell.door;
      if (door.isOpen == false && door.direction == move.direction) {
        // cannnot walk to new cell
        return;
      }
    }

    const [offset_x, offset_y] = offset(move.direction);
    const [new_x, new_y] = [x + offset_x, y + offset_y];
    if (!this.isCell(new_x, new_y)) {
      return;
    }

    const new_cell = this.game!.grid!.rows[new_x].cells[new_y];
    if (new_cell.cellType?.bedrockCell || new_cell.cellType?.stoneCell) {
      // cannot walk onto bedrock / stone / chest
      return;
    }

    // handle update
    // leaving pressure plate
    if (cell.cellType?.pressurePlateCell) {
      const woodType = cell.cellType.pressurePlateCell.woodType;
      this.activePressurePlates[woodType]--;

      if (this.activePressurePlates[woodType] == 0) {
        for (const [door_x, door_y] of this.getAllDoors(woodType)) {
          const doorCell = this.game.grid!.rows[door_x].cells[door_y];
          const door = doorCell.cellType!.emptyCell!.door!;
          door.isOpen = false;
          this.gridUpdate.cellUpdates.push(proto.GridUpdate_CellUpdate.create({
            cell: {
              ...doorCell,
              cellType: proto.CellType.create({
                emptyCell: {
                  door: { ...door, isOpen: false }
                }
              }),
            },
            coordinates: { x: new_x, y: new_y }
          }))
        }
      }
    }

    // update coordinates
    const new_info = proto.PlayerInfo.create({
      ...info,
      position: proto.Coordinates.create({ x: new_x, y: new_y })
    });
    this.playerInfos.set(player, new_info);

    // update visited
    new_cell.firstVisitPlayer = player;

    // entering pressure plate
    if (new_cell.cellType?.pressurePlateCell) {
      const woodType = new_cell.cellType.pressurePlateCell.woodType;
      this.activePressurePlates.set(woodType, 1 + (this.activePressurePlates.get(woodType) ?? 0));

      for (const [door_x, door_y] of this.getAllDoors(woodType)) {
        const doorCell = this.game.grid!.rows[door_x].cells[door_y];
        const door = doorCell.cellType!.emptyCell!.door!;
        door.isOpen = false;
        this.gridUpdate.cellUpdates.push(proto.GridUpdate_CellUpdate.create({
          cell: {
            ...doorCell,
            cellType: proto.CellType.create({
              emptyCell: {
                door: { ...door, isOpen: true }
              }
            }),
          },
          coordinates: { x: new_x, y: new_y }
        }))
      }
    }


    // send updates
    this.gridUpdate.playerInfoUpdates.push(new_info);
    this.gridUpdate.cellUpdates.push(proto.GridUpdate_CellUpdate.create({
      coordinates: { x: new_x, y: new_y },
      cell: { cellType: new_cell.cellType, firstVisitPlayer: new_cell.firstVisitPlayer }
    }));
  }

  private handleMine(player: proto.Player, mine: proto.Mine) {
    const info = this.playerInfos.get(player)!;
    const position = info.position;
    const [x, y] = [position!.x, position!.y];
    const [offset_x, offset_y] = offset(mine.direction);
    const [new_x, new_y] = [x + offset_x, y + offset_y];
    if (!this.isCell(new_x, new_y)) {
      return;
    }
    const new_cell = this.game!.grid!.rows[new_x].cells[new_y];

    if (new_cell.cellType?.stoneCell) {
      // reset damage if not mined in the last 2 ticks
      if (this.tickNumber > this.lastMined[new_x][new_y] + 2) {
        this.stoneDamage[new_x][new_y] = 0
      }

      this.stoneDamage[new_x][new_y]++;
      if (this.stoneDamage[new_x][new_y] == STONE_HP) {
        // stone dead
        new_cell.cellType = proto.CellType.create({ emptyCell: {} });
        this.gridUpdate.cellUpdates.push(proto.GridUpdate_CellUpdate.create({
          coordinates: { x: new_x, y: new_y },
          cell: { ...new_cell }
        }))
      }
    }
  }
}