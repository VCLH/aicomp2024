import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapListComponent } from './map-list.component';
import { FormsModule } from '@angular/forms';

describe('MapListComponent', () => {
  let component: MapListComponent;
  let fixture: ComponentFixture<MapListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [MapListComponent]
    });
    fixture = TestBed.createComponent(MapListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
