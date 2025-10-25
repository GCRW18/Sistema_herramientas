import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BajaFormComponent } from './baja-form.component';

describe('BajaFormComponent', () => {
  let component: BajaFormComponent;
  let fixture: ComponentFixture<BajaFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BajaFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BajaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
