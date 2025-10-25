import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprobanteListComponent } from './comprobante-list.component';

describe('ComprobanteListComponent', () => {
  let component: ComprobanteListComponent;
  let fixture: ComponentFixture<ComprobanteListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprobanteListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComprobanteListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
