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
  private playerView: proto.Row[] = [];
  private stoneDamage: number[][] = [];
  private lastMined: number[][] = [];
  private activePressurePlates: Map<proto.WoodType, number>;

  private hasInitializedGame: boolean = false;

  // In each tick, each player takes one action
  private tickNumber: number = 0;
  private tickSequence: proto.Player[] = [];

  // updates to be flushed
  private gridUpdateCoordinates: proto.Coordinates[] = [];

  constructor(game: proto.Game, players: Map<proto.Player, Strategy>) {
    this.game = game;
    this.players = [];
    this.playerStrategies = new Map;
    this.playerInfos = new Map;
    this.activePressurePlates = new Map;
    Array(11).forEach((v, k) => {
      this.activePressurePlates.set(proto.woodTypeFromJSON(k), 0);
    });
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
      this.game.currentTick = this.tickNumber;
      this.tickSequence = Array.from(this.players);
    }

    // get current player and act
    const player = this.tickSequence.shift()!;

    this.gridUpdateCoordinates = [];
    const action = this.playerStrategies.get(player)?.performAction();
    if (action?.move) {
      this.handleMove(player, action.move);
    }
    if (action?.mine) {
      this.handleMine(player, action.mine);
    }

    if (this.tickSequence.length == 0) {
      // player list empty, tick ends.
      // reset non-mined stone
      for (let x = 0; x < this.game.height; ++x) {
        for (let y = 0; y < this.game.width; ++y) {
          if (this.game.grid!.rows[x].cells[y].cellType?.stoneCell && this.stoneDamage[x][y] > 0 &&
            this.lastMined[x][y] != this.tickNumber) {
            this.game.grid!.rows[x].cells[y].cellType!.stoneCell!.mineCount = 0;
            this.stoneDamage[x][y] = 0;
            this.gridUpdateCoordinates.push(proto.Coordinates.create({ x, y }));
          }
        }
      }
    }

    // Remove duplicate coordinates from gridUpdateCoordinates.
    const uniqueGridUpdateCoordinates = Array.from(new Set(this.gridUpdateCoordinates));

    // Sync playerView from grid
    for (const c of uniqueGridUpdateCoordinates) {
      this.playerView[c.x].cells[c.y] = this.game.grid!.rows[c.x].cells[c.y];
    }

    const cellUpdates = uniqueGridUpdateCoordinates.map(c => proto.GridUpdate_CellUpdate.create({
      cell: this.game.grid!.rows[c.x].cells[c.y],
      coordinates: c
    }));
    const playerInfoUpdates = [this.playerInfos.get(player)!];

    for (const player of this.players) {
      // We must create a new one for each player.
      this.playerStrategies.get(player)?.handleGridUpdate(proto.GridUpdate.create({
        cellUpdates,
        playerInfoUpdates
      }));
    }

    return this.tickSequence.length == 0;
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
      this.gridUpdateCoordinates.push(proto.Coordinates.create({ x, y }));
    }
  }

  private updatePlayerView(player: proto.Player) {
    const position = this.playerInfos.get(player)!.position!
    const [unit_x, unit_y] = [Math.floor((position.x - 1) / UNIT_LENGTH), Math.floor((position.y - 1) / UNIT_LENGTH)];
    // At Unit 1, we do index 7 .. 16
    for (let x = unit_x * UNIT_LENGTH; x <= (unit_x + 1) * UNIT_LENGTH + 1; ++x) {
      for (let y = unit_y * UNIT_LENGTH; y <= (unit_y + 1) * UNIT_LENGTH + 1; ++y) {
        if (!this.isCell(x, y)) {
          continue;
        }
        // this cell now becomes visible
        this.makeVisible(x, y);
      }
    }
  }

  private sendInitializeGame(): void {
    const template = Array.from(Array(this.game.height).keys());
    this.playerView = template
      .map(_ => proto.Row.create({
        cells: template
          .map(_ => proto.Cell.create({ cellType: proto.CellType.create({ invisibleCell: true }) }))
      }))
    this.stoneDamage = template.map(_ => Array(this.game.width).fill(0));
    this.lastMined = template.map(_ => Array(this.game.width).fill(0));
    for (const player of this.players) {
      this.updatePlayerView(player);
    }
    // Clear the updates generated by updatePlayerView above.
    this.gridUpdateCoordinates = [];

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

  private getAllDoors(woodType: proto.WoodType): proto.Coordinates[] {
    const doors: proto.Coordinates[] = [];
    for (let i = 0; i < this.game.height; ++i) {
      for (let j = 0; j < this.game.width; ++j) {
        if (this.game!.grid!.rows[i].cells[j].cellType?.emptyCell?.door) {
          if (this.game.grid!.rows[i].cells[j].cellType?.emptyCell?.door?.woodType === woodType) {
            doors.push(proto.Coordinates.create({ x: i, y: j }));
          }
        }
      }
    }
    return doors;
  }

  private handleMove(player: proto.Player, direction: proto.Direction): void {
    const info = this.playerInfos.get(player)!;
    const position = info.position;
    const [x, y] = [position!.x, position!.y];
    const cell = this.game!.grid!.rows[x].cells[y];

    if (cell.cellType?.emptyCell?.door) {
      const door = cell.cellType.emptyCell.door;
      if (door.isOpen == false && door.direction == direction) {
        // cannnot walk to new cell
        return;
      }
    }

    const [offset_x, offset_y] = offset(direction);
    const [new_x, new_y] = [x + offset_x, y + offset_y];
    if (!this.isCell(new_x, new_y)) {
      return;
    }

    const new_cell = this.game!.grid!.rows[new_x].cells[new_y];
    if (new_cell.cellType?.bedrockCell || new_cell.cellType?.stoneCell || new_cell.cellType?.chestCell) {
      // cannot walk onto bedrock / stone / chest
      return;
    }

    // handle update
    // leaving pressure plate
    if (cell.cellType?.pressurePlateCell) {
      const woodType = cell.cellType.pressurePlateCell.woodType;
      const newNumPlayersOnPlate = (this.activePressurePlates.get(woodType) ?? 0) - 1;
      this.activePressurePlates.set(woodType, newNumPlayersOnPlate);

      if (newNumPlayersOnPlate == 0) {
        for (const c of this.getAllDoors(woodType)) {
          const doorCell = this.game.grid!.rows[c.x].cells[c.y];
          const door = doorCell.cellType!.emptyCell!.door!;
          door.isOpen = false;
          if (!this.playerView[c.x].cells[c.y].cellType?.invisibleCell) {
            this.gridUpdateCoordinates.push(proto.Coordinates.create({
              x: c.x, y: c.y
            }))
          }
        }
      }
    }

    // update coordinates
    info.position = proto.Coordinates.create({ x: new_x, y: new_y });

    // update visited
    if (new_cell.firstVisitPlayer == proto.Player.INVALID) {
      new_cell.firstVisitPlayer = player;
      this.gridUpdateCoordinates.push(proto.Coordinates.create({
        x: new_x, y: new_y
      }));
      this.updatePlayerView(player);
    }

    // entering pressure plate
    if (new_cell.cellType?.pressurePlateCell) {
      const woodType = new_cell.cellType.pressurePlateCell.woodType;
      this.activePressurePlates.set(woodType, 1 + (this.activePressurePlates.get(woodType) ?? 0));

      for (const c of this.getAllDoors(woodType)) {
        const doorCell = this.game.grid!.rows[c.x].cells[c.y];
        const door = doorCell.cellType!.emptyCell!.door!;
        door.isOpen = false;
        if (!this.playerView[c.x].cells[c.y].cellType?.invisibleCell) {
          this.gridUpdateCoordinates.push(proto.Coordinates.create({
            x: c.x, y: c.y
          }))
        }
      }
    }
  }

  private handleMine(player: proto.Player, direction: proto.Direction) {
    const info = this.playerInfos.get(player)!;
    const position = info.position;
    const [x, y] = [position!.x, position!.y];
    const [offset_x, offset_y] = offset(direction);
    const [new_x, new_y] = [x + offset_x, y + offset_y];
    if (!this.isCell(new_x, new_y)) {
      return;
    }
    const new_cell = this.game!.grid!.rows[new_x].cells[new_y];

    if (new_cell.cellType?.chestCell && !new_cell.cellType.chestCell.isOpened) {
      new_cell.cellType.chestCell.isOpened = true;
      this.gridUpdateCoordinates.push(proto.Coordinates.create({
        x: new_x, y: new_y
      }))
    }
    if (new_cell.cellType?.stoneCell) {
      this.stoneDamage[new_x][new_y]++;
      this.lastMined[new_x][new_y] = this.tickNumber;

      if (this.stoneDamage[new_x][new_y] == STONE_HP) {
        // stone dead
        new_cell.cellType = proto.CellType.create({ emptyCell: {} });
        this.gridUpdateCoordinates.push(proto.Coordinates.create({
          x: new_x, y: new_y
        }))
      }
    }
  }
}