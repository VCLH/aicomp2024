import { Component, Input } from '@angular/core';
import * as proto from '../game';
import { BG_COLORS, FG_COLORS } from '../constants';
@Component({
  selector: 'app-grid-renderer',
  templateUrl: './grid-renderer.component.html',
  styleUrls: ['./grid-renderer.component.scss']
})
export class GridRendererComponent {
  @Input() grid: proto.Grid | null = null;
  readonly BG_COLORS = BG_COLORS;
  readonly FG_COLORS = FG_COLORS;

  stoneLifeStyle(cell: proto.Cell, stoneLife: number) {
    if (!cell.cellType?.stoneCell) {
      return '';
    }
    if (cell.cellType.stoneCell.mineCount == 0) {
      return '';
    }
    const stage = Math.ceil(cell.cellType.stoneCell.mineCount * 6.0 / stoneLife);
    return -16 * stage + 'px';
  }
}
