import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprobanteFormComponent } from './comprobante-form.component';

describe('ComprobanteFormComponent', () => {
  let component: ComprobanteFormComponent;
  let fixture: ComponentFixture<ComprobanteFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprobanteFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComprobanteFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
