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

@Component({
  selector: 'app-componente-kit-form',
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
    MatCardModule
  ],
  templateUrl: './componente-kit-form.component.html',
  styleUrl: './componente-kit-form.component.scss'
})
export class ComponenteKitFormComponent implements OnInit {
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  componenteForm!: FormGroup;
  isEditMode: boolean = false;
  componenteId: number | null = null;

  kitsDisponibles = [
    { value: 1, label: 'Kit Eléctrico Básico' },
    { value: 2, label: 'Kit Mecánico Avanzado' },
    { value: 3, label: 'Kit de Medición' },
    { value: 4, label: 'Kit de Soldadura' }
  ];

  herramientasDisponibles = [
    { value: 'HER-001', label: 'Destornillador Phillips #2' },
    { value: 'HER-023', label: 'Alicate Universal 8"' },
    { value: 'INS-012', label: 'Multímetro Digital' },
    { value: 'HER-045', label: 'Llave Ajustable 12"' }
  ];

  estadosComponente = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'en_uso', label: 'En uso' },
    { value: 'mantenimiento', label: 'En mantenimiento' },
    { value: 'baja', label: 'De baja' }
  ];

  ngOnInit(): void {
    this.componenteId = Number(this._activatedRoute.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.componenteId;

    this.componenteForm = this._formBuilder.group({
      kit_id: ['', [Validators.required]],
      herramienta_codigo: ['', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      estado: ['disponible', [Validators.required]],
      observaciones: ['']
    });

    if (this.isEditMode) {
      this.loadComponente();
    }
  }

  loadComponente(): void {
    // Mock data loading - replace with actual service call
    setTimeout(() => {
      const mockData = {
        kit_id: 1,
        herramienta_codigo: 'HER-001',
        cantidad: 2,
        estado: 'disponible',
        observaciones: 'Componente principal del kit'
      };
      this.componenteForm.patchValue(mockData);
    }, 500);
  }

  onSubmit(): void {
    if (this.componenteForm.valid) {
      const formData = this.componenteForm.value;
      console.log('Guardando componente:', formData);
      
      // TODO: Call service to save data
      // this.componenteKitService.save(formData).subscribe(...)
      
      this._router.navigate(['/kits/componente-kit']);
    } else {
      this.componenteForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this._router.navigate(['/kits/componente-kit']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.componenteForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('min')) {
      return 'La cantidad debe ser mayor a 0';
    }
    return '';
  }
}
