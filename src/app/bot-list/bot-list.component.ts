import { Component } from '@angular/core';
import { BotRow, BotConfig } from '../types';
import { DataService } from '../data.service';

@Component({
  selector: 'app-bot-list',
  templateUrl: './bot-list.component.html',
  styleUrls: ['./bot-list.component.css']
})
export class BotListComponent {
  bots: BotRow[] = [];
  botConfig: BotConfig = {
    description: '',
    strategy: '',
    config: '',
  }
  constructor(private data: DataService) {
    this.loadBots();
  }

  public saveBot() {
    if (this.botConfig) {
      this.data.saveBot(this.botConfig).subscribe(() => {
        this.loadBots();
      });
    }
  }

  private loadBots() {
    this.data.getBots()
      .subscribe((rows: BotRow[]) => {
        this.bots = rows;
      });
  }

  public deleteBot(id: number) {
    this.data.deleteBot(id).subscribe(() => {
      this.loadBots();
    });
  }

}
