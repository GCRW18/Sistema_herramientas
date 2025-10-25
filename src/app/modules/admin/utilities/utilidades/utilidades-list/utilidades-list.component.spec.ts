import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilidadesListComponent } from './utilidades-list.component';

describe('UtilidadesListComponent', () => {
  let component: UtilidadesListComponent;
  let fixture: ComponentFixture<UtilidadesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilidadesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UtilidadesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
