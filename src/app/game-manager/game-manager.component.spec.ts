import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameManagerComponent } from './game-manager.component';

describe('GameManagerComponent', () => {
  let component: GameManagerComponent;
  let fixture: ComponentFixture<GameManagerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameManagerComponent]
    });
    fixture = TestBed.createComponent(GameManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
