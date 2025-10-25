import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponenteKitListComponent } from './componente-kit-list.component';

describe('ComponenteKitListComponent', () => {
  let component: ComponenteKitListComponent;
  let fixture: ComponentFixture<ComponenteKitListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponenteKitListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComponenteKitListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
