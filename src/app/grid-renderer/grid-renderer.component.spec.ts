import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridRendererComponent } from './grid-renderer.component';

describe('GridRendererComponent', () => {
  let component: GridRendererComponent;
  let fixture: ComponentFixture<GridRendererComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GridRendererComponent]
    });
    fixture = TestBed.createComponent(GridRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
