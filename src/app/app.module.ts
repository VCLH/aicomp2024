import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { BotListComponent } from './bot-list/bot-list.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { MapListComponent } from './map-list/map-list.component';
import { FormsModule } from '@angular/forms';
import { GridRendererComponent } from './grid-renderer/grid-renderer.component';
import { HttpClientModule } from '@angular/common/http';
import { PlayComponent } from './play/play.component';
import { GameManagerComponent } from './game-manager/game-manager.component';

@NgModule({
  declarations: [
    AppComponent,
    BotListComponent,
    MapListComponent,
    PageNotFoundComponent,
    MapListComponent,
    GridRendererComponent,
    PlayComponent,
    GameManagerComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot([
      { path: 'play', component: PlayComponent },
      { path: 'map-list', component: MapListComponent },
      { path: 'bot-list', component: BotListComponent },
      { path: '', redirectTo: '/game-list', pathMatch: 'full' },
      { path: '**', component: PageNotFoundComponent }
    ]),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
