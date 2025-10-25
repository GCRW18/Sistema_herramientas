import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BajaListComponent } from './baja-list.component';

describe('BajaListComponent', () => {
  let component: BajaListComponent;
  let fixture: ComponentFixture<BajaListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BajaListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BajaListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
