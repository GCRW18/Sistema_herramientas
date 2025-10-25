import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-baja-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule
  ],
  templateUrl: './baja-form.component.html',
  styleUrl: './baja-form.component.scss'
})
export class BajaFormComponent implements OnInit {
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  bajaForm!: FormGroup;
  isEditMode: boolean = false;
  bajaId: number | null = null;

  motivosBaja = [
    { value: 'dano_irreparable', label: 'Daño irreparable' },
    { value: 'obsoleto', label: 'Obsoleto' },
    { value: 'perdida', label: 'Pérdida' },
    { value: 'robo', label: 'Robo' },
    { value: 'desgaste', label: 'Desgaste natural' },
    { value: 'otro', label: 'Otro' }
  ];

  categorias = [
    { value: 'instrumentos', label: 'Instrumentos' },
    { value: 'herramientas', label: 'Herramientas' },
    { value: 'equipos', label: 'Equipos' },
    { value: 'accesorios', label: 'Accesorios' }
  ];

  ngOnInit(): void {
    this.bajaId = Number(this._activatedRoute.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.bajaId;

    this.bajaForm = this._formBuilder.group({
      codigo: ['', [Validators.required]],
      nombre: ['', [Validators.required]],
      categoria: ['', [Validators.required]],
      motivo: ['', [Validators.required]],
      fecha_baja: [new Date(), [Validators.required]],
      observaciones: [''],
      responsable: ['', [Validators.required]],
      estado: ['pendiente']
    });

    if (this.isEditMode) {
      this.loadBaja();
    }
  }

  loadBaja(): void {
    // Mock data loading - replace with actual service call
    setTimeout(() => {
      const mockData = {
        codigo: 'BOA-001',
        nombre: 'Multímetro Digital',
        categoria: 'instrumentos',
        motivo: 'dano_irreparable',
        fecha_baja: new Date('2025-10-15'),
        observaciones: 'Equipo dañado durante calibración',
        responsable: 'Juan Pérez',
        estado: 'aprobado'
      };
      this.bajaForm.patchValue(mockData);
    }, 500);
  }

  onSubmit(): void {
    if (this.bajaForm.valid) {
      const formData = this.bajaForm.value;
      console.log('Guardando baja:', formData);
      
      // TODO: Call service to save data
      // this.bajaService.save(formData).subscribe(...)
      
      this._router.navigate(['/status-management/baja']);
    } else {
      this.bajaForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this._router.navigate(['/status-management/baja']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.bajaForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    return '';
  }
}
