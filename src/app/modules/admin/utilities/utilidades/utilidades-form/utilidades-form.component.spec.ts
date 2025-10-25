import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilidadesFormComponent } from './utilidades-form.component';

describe('UtilidadesFormComponent', () => {
  let component: UtilidadesFormComponent;
  let fixture: ComponentFixture<UtilidadesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilidadesFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UtilidadesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
