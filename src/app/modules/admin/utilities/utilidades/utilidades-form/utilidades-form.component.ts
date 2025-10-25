import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-utilidades-form',
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
    MatCardModule,
    MatSlideToggleModule
  ],
  templateUrl: './utilidades-form.component.html',
  styleUrl: './utilidades-form.component.scss'
})
export class UtilidadesFormComponent implements OnInit {
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  utilidadForm!: FormGroup;
  isEditMode: boolean = false;
  utilidadId: number | null = null;

  tiposUtilidad = [
    { value: 'calculo', label: 'Herramienta de Cálculo' },
    { value: 'conversion', label: 'Herramienta de Conversión' },
    { value: 'plantilla', label: 'Plantilla' },
    { value: 'generador', label: 'Generador' },
    { value: 'otro', label: 'Otro' }
  ];

  estadosUtilidad = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'mantenimiento', label: 'En mantenimiento' }
  ];

  ngOnInit(): void {
    this.utilidadId = Number(this._activatedRoute.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.utilidadId;

    this.utilidadForm = this._formBuilder.group({
      nombre: ['', [Validators.required]],
      tipo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      estado: ['activo', [Validators.required]],
      icono: ['calculate'],
      url_acceso: [''],
      requiere_permisos: [false],
      observaciones: ['']
    });

    if (this.isEditMode) {
      this.loadUtilidad();
    }
  }

  loadUtilidad(): void {
    // Mock data loading - replace with actual service call
    setTimeout(() => {
      const mockData = {
        nombre: 'Calculadora de Tolerancias',
        tipo: 'calculo',
        descripcion: 'Calcula tolerancias según normas ISO',
        estado: 'activo',
        icono: 'calculate',
        url_acceso: '/utilities/calculadora-tolerancias',
        requiere_permisos: true,
        observaciones: 'Actualizada según normas ISO 2025'
      };
      this.utilidadForm.patchValue(mockData);
    }, 500);
  }

  onSubmit(): void {
    if (this.utilidadForm.valid) {
      const formData = this.utilidadForm.value;
      console.log('Guardando utilidad:', formData);
      
      // TODO: Call service to save data
      // this.utilidadesService.save(formData).subscribe(...)
      
      this._router.navigate(['/utilities/utilidades']);
    } else {
      this.utilidadForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this._router.navigate(['/utilities/utilidades']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.utilidadForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    return '';
  }
}
