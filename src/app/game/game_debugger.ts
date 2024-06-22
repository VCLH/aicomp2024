import * as proto from '../game'
import { BG_COLORS, FG_COLORS, WOOD_COLORS } from '../constants';

const NO_STYLE = 'background: none';
const BORDER_STYLE = 'color: #FFF; background: #000; border: 2px solid transparent';

export class GameDebugger {
  printGame(game: proto.Game) {
    this.printBasicInfo(game);
  }

  private printBasicInfo(game: proto.Game) {
    console.log(`Map Size: ${game.height} rows ${game.width} cols`);
    console.log(`Tick: ${game.currentTick} / ${game.gameLength}`);
    console.log('Assigned player: %c' + proto.playerToJSON(game.assignedColor), this.getPlayerColor(game.assignedColor));
    game.players.sort();
    console.log('Players: %c' +
      game.players.map((player) => "%c" + proto.playerToJSON(player)).join('%c '),
      ...game.players.flatMap((player) => [NO_STYLE, this.getPlayerColor(player)])
    );

    const gridStr: string[] = [];
    const gridStyles: string[] = [];
    gridStr.push('%c  ');
    gridStyles.push(BORDER_STYLE);
    for (let j = 0; j < game.width; ++j) {
      gridStr.push('%c' + this.getFormattedNum(j));
      gridStyles.push(BORDER_STYLE);
    }
    gridStr.push('%c\n');
    gridStyles.push('');

    for (let i = 0; i < game.height; ++i) {
      gridStr.push('%c' + this.getFormattedNum(i));
      gridStyles.push(BORDER_STYLE);
      for (let j = 0; j < game.width; ++j) {
        const cell = game.grid!.rows[i].cells[j];
        if (cell.cellType?.invisibleCell != null) {
          gridStr.push('%c ?');
          gridStyles.push('background: #999; border: 2px solid transparent');
          continue;
        }
        const defaultBorder = ' border: 2px solid #999';
        if (cell.players.length == 1) {
          gridStr.push('%c ');
          gridStyles.push(this.getPlayerColor(cell.players[0]) + defaultBorder); // occupies entire cell
        } else if (cell.players.length == 2) {
          for (let i = 0; i < 2; ++i) {
            gridStr.push('%c' + cell.players[i]);
            gridStyles.push(this.getPlayerColor(cell.players[i]) + defaultBorder);
          }
        } else if (cell.cellType?.bedrockCell != null) {
          gridStr.push('%c  ');
          gridStyles.push('background: #444; ' + defaultBorder);
        } else if (cell.cellType?.emptyCell != null) {
          let background = cell.isVisited ? '#EEE' : '#FFF';
          let border = defaultBorder;
          if (cell.cellType.emptyCell.door != null) {
            let direction = cell.cellType.emptyCell.door.direction;
            let woodType = cell.cellType.emptyCell.door.woodType;
            let doorBorderThickness = cell.cellType.emptyCell.door?.remainingOpenTicks == 0 ? 4 : 0;
            if (direction == proto.Direction.UP) {
              border += `; border-top: ${doorBorderThickness}px solid ${this.getWoodColor(woodType)}`;
            } else if (direction == proto.Direction.DOWN) {
              border += `; border-bottom: ${doorBorderThickness}px solid ${this.getWoodColor(woodType)}`;
            } else if (direction == proto.Direction.LEFT) {
              border += `; border-left: ${doorBorderThickness}px solid ${this.getWoodColor(woodType)}`;
            } else if (direction == proto.Direction.RIGHT) {
              border += `; border-right: ${doorBorderThickness}px solid ${this.getWoodColor(woodType)}`;
            }
          }
          gridStr.push('%c  ');
          gridStyles.push(`background: ${background}; ${border}`);
        } else if (cell.cellType?.stoneCell != null) {
          gridStr.push('%c ' + (cell.cellType.stoneCell.mineCount == 0 ? ' ' : cell.cellType.stoneCell.mineCount));
          gridStyles.push('color: #000; background: #999; ' + defaultBorder);
        } else if (cell.cellType?.pressurePlateCell != null) {
          let woodType = cell.cellType.pressurePlateCell.woodType;
          gridStr.push('%c  ');
          gridStyles.push(`background: ${this.getWoodColor(woodType)}` + defaultBorder);
        } else if (cell.cellType?.chestCell != null) {
          gridStr.push('%c' + this.getFormattedNum(cell.cellType.chestCell.score));
          gridStyles.push('color: #000; background: #0A0; ' + defaultBorder);
        } else { // invisible
          gridStr.push('%c  ');
          gridStyles.push('background: #000; ' + defaultBorder);
        }
      }
      gridStr.push('%c\n');
      gridStyles.push('');
    }
    console.log(gridStr.join(''), ...gridStyles);
  }

  private getPlayerColor(player: proto.Player): string {
    return `color: ${FG_COLORS[player]}; background: ${BG_COLORS[player]};`;
  }

  private getWoodColor(woodType: proto.WoodType): string {
    return WOOD_COLORS[woodType];
  }

  private getFormattedNum(num: number): string {
    if (num >= 99) {
      return "99";
    }
    if (num < 10) {
      return " " + num;
    }
    return num.toString();
  }
}
