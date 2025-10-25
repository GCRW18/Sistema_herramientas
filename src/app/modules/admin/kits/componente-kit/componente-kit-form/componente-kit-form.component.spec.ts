import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponenteKitFormComponent } from './componente-kit-form.component';

describe('ComponenteKitFormComponent', () => {
  let component: ComponenteKitFormComponent;
  let fixture: ComponentFixture<ComponenteKitFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponenteKitFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComponenteKitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
