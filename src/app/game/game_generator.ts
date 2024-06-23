import * as proto from "../game";

function r(x: number): number {
  return Math.floor(Math.random() * x);
}

// https://stackoverflow.com/a/12646864/12901331
function shuffleArray(array: any[]) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function permutation(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; ++i) {
    res.push(i);
  }
  shuffleArray(res);
  return res;
}

export class GameGenerator {
  // helper functions to create default cells
  createCell(cellType: proto.CellType): proto.Cell {
    return proto.Cell.create({
      cellType: cellType
    });
  }
  createBedrockCell(): proto.Cell {
    return this.createCell(proto.CellType.create({ bedrockCell: proto.CellType_BedrockCell.create({}) }));
  }
  createStoneCell(): proto.Cell {
    return this.createCell(proto.CellType.create({ stoneCell: proto.CellType_StoneCell.create({ lastMineTick: 0, mineCount: 0 }) }));
  }
  createEmptyCell(): proto.Cell {
    return this.createCell(proto.CellType.create({ emptyCell: proto.CellType_EmptyCell.create({}) }));
  }
  createPressurePlateCell(woodType: proto.WoodType): proto.Cell {
    return this.createCell(proto.CellType.create({ pressurePlateCell: proto.CellType_PressurePlateCell.create({ woodType: woodType }) }));
  }
  createChestCell(score: number): proto.Cell {
    return this.createCell(proto.CellType.create({ chestCell: proto.CellType_ChestCell.create({ score: score }) }));
  }

  // function to generate a 7x7 unit surrounded by stone cells with special middle cells
  generate_unit(middle: proto.Cell): proto.Grid {
    const grid = proto.Grid.create();
    for (let i = 0; i < 7; ++i) {
      const row: proto.Cell[] = [];
      for (let j = 0; j < 7; ++j) {
        if (i == 0 || i == 6 || j == 0 || j == 6) { // edges
          row.push(this.createStoneCell());
        } else if (i == 3 && j == 3) { // middle
          row.push(middle);
        } else {
          row.push(this.createEmptyCell());
        }
      }
      grid.rows.push({ cells: row });
    }
    return grid;
  }

  // Generates the map. Visibility is not set here.
  generate(config: proto.GameMap, haveChest: boolean, numWoodType: number, pressurePlateDensity: number, doorDensity: number, chestDistribution: () => number): proto.GameMap {
    const grid: proto.Cell[][] = [];
    const game = proto.GameMap.create(config);
    const nPlayers = config.players.length;
    console.assert(nPlayers == 2, "Only 2 players are supported");

    // create the grid with a border of bedrock cells 
    const unitSize = 7;
    for (let i = 0; i < config.lengthUnits * unitSize + 2; ++i) {
      const row: proto.Cell[] = [];
      for (let j = 0; j < config.lengthUnits * unitSize + 2; ++j) {
        row.push(this.createBedrockCell());
      }
      grid.push(row);
    }

    // generate the units
    for (let i = 0; i < config.lengthUnits; ++i) {
      for (let j = 0; j < config.lengthUnits; ++j) {
        const middle = r(100) <= pressurePlateDensity ?
          this.createPressurePlateCell(proto.woodTypeFromJSON(r(numWoodType))) :
          this.createEmptyCell();
        const unit = this.generate_unit(middle);
        for (let ii = 0; ii < unitSize; ++ii) {
          for (let jj = 0; jj < unitSize; ++jj) {
            grid[i * unitSize + ii + 1][j * unitSize + jj + 1] = unit.rows[ii].cells[jj];
          }
        }
      }
    }

    // generate chests
    if (haveChest) {
      const perm = permutation(config.lengthUnits);
      for (let i = 0; i < config.lengthUnits; ++i) {
        const row = i;
        const col = perm[i];
        grid[row * unitSize + 1][col * unitSize + 1] = this.createChestCell(chestDistribution());
      }
    }

    // generate doors
    let possibleDoors: { x1: number, y1: number, x2: number, y2: number }[] = [];
    for (let i = 0; i < config.lengthUnits; ++i) {
      for (let j = 0; j < config.lengthUnits; ++j) {
        if (i < config.lengthUnits - 1) { // down
          possibleDoors.push({
            x1: i * unitSize + 1 + unitSize - 1,
            y1: j * unitSize + 1 + unitSize / 2,
            x2: (i + 1) * unitSize + 1,
            y2: j * unitSize + 1 + unitSize / 2,
          });
        }
        if (j < config.lengthUnits - 1) { // right
          possibleDoors.push({
            x1: i * unitSize + 1 + unitSize / 2,
            y1: j * unitSize + 1 + unitSize - 1,
            x2: i * unitSize + 1 + unitSize / 2,
            y2: (j + 1) * unitSize + 1,
          });
        }
      }
    }
    shuffleArray(possibleDoors);
    const nDoors = Math.floor(possibleDoors.length * doorDensity);
    for (let i = 0; i < nDoors; ++i) {
      const door = possibleDoors[i];
      const doorDirection = door.x1 == door.x2 ? proto.Direction.DOWN : proto.Direction.RIGHT;
      const woodType = proto.woodTypeFromJSON(r(numWoodType));
      grid[door.x1][door.y1].cellType = proto.CellType.create({
        emptyCell: proto.CellType_EmptyCell.create({
          door: proto.Door.create({
            direction: doorDirection,
            woodType: woodType,
            isOpen: false,
          }),
        }),
      });
      grid[door.x2][door.y2].cellType = proto.CellType.create({
        emptyCell: proto.CellType_EmptyCell.create({
          door: proto.Door.create({
            direction: doorDirection ^ 1,
            woodType: woodType,
            isOpen: false,
          }),
        }),
      });
    }

    // copy the grid over to game
    game.grid = proto.Grid.create();
    for (let i = 0; i < grid.length; ++i) {
      const row = proto.Row.create({ cells: grid[i] });
      game.grid.rows.push(row);
    }

    // Add the players to random locations
    const playerUnitRow = r(config.lengthUnits);
    const playerUnitCol = r(config.lengthUnits);
    for (let i = 0; i < 2; ++i) {
      const playerRow = playerUnitRow * unitSize + r(unitSize - 2) + 1;
      const playerCol = playerUnitCol * unitSize + r(unitSize - 2) + 1;
      const playerInfo = proto.PlayerInfo.create({ 
        player: config.players[i],
        position: proto.Coordinates.create({ x: playerRow, y: playerCol })
      });
      game.grid.playerInfos.push(playerInfo);
    }
    
    console.log(game);
    return game;
  }
}