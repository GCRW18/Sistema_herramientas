import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-comprobante-form',
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
    MatCardModule,
    MatTableModule
  ],
  templateUrl: './comprobante-form.component.html',
  styleUrl: './comprobante-form.component.scss'
})
export class ComprobanteFormComponent implements OnInit {
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  comprobanteForm!: FormGroup;
  isEditMode: boolean = false;
  comprobanteId: number | null = null;

  tiposMovimiento = [
    { value: 'entrada', label: 'Entrada' },
    { value: 'salida', label: 'Salida' }
  ];

  estadosComprobante = [
    { value: 'activo', label: 'Activo' },
    { value: 'cerrado', label: 'Cerrado' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'anulado', label: 'Anulado' }
  ];

  herramientasDisponibles = [
    { codigo: 'HER-001', nombre: 'Destornillador Phillips #2' },
    { codigo: 'HER-023', nombre: 'Alicate Universal 8"' },
    { codigo: 'INS-012', nombre: 'Multímetro Digital' }
  ];

  displayedColumns: string[] = ['codigo', 'nombre', 'cantidad', 'acciones'];

  ngOnInit(): void {
    this.comprobanteId = Number(this._activatedRoute.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.comprobanteId;

    this.comprobanteForm = this._formBuilder.group({
      numero: ['', [Validators.required]],
      tipo: ['', [Validators.required]],
      fecha: [new Date(), [Validators.required]],
      responsable: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      estado: ['activo', [Validators.required]],
      observaciones: [''],
      items: this._formBuilder.array([])
    });

    if (this.isEditMode) {
      this.loadComprobante();
    }
  }

  get items(): FormArray {
    return this.comprobanteForm.get('items') as FormArray;
  }

  addItem(): void {
    const itemGroup = this._formBuilder.group({
      herramienta_codigo: ['', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(1)]]
    });
    this.items.push(itemGroup);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  loadComprobante(): void {
    // Mock data loading - replace with actual service call
    setTimeout(() => {
      const mockData = {
        numero: 'COMP-2025-001',
        tipo: 'salida',
        fecha: new Date('2025-10-20'),
        responsable: 'Juan Pérez',
        descripcion: 'Préstamo de herramientas para mantenimiento',
        estado: 'activo',
        observaciones: 'Retorno programado para el 25/10/2025'
      };
      this.comprobanteForm.patchValue(mockData);
      
      // Load items
      const mockItems = [
        { herramienta_codigo: 'HER-001', cantidad: 2 },
        { herramienta_codigo: 'INS-012', cantidad: 1 }
      ];
      mockItems.forEach(item => {
        const itemGroup = this._formBuilder.group({
          herramienta_codigo: [item.herramienta_codigo, [Validators.required]],
          cantidad: [item.cantidad, [Validators.required, Validators.min(1)]]
        });
        this.items.push(itemGroup);
      });
    }, 500);
  }

  onSubmit(): void {
    if (this.comprobanteForm.valid) {
      const formData = this.comprobanteForm.value;
      console.log('Guardando comprobante:', formData);
      
      // TODO: Call service to save data
      // this.comprobanteService.save(formData).subscribe(...)
      
      this._router.navigate(['/movements/comprobante']);
    } else {
      this.comprobanteForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this._router.navigate(['/movements/comprobante']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.comprobanteForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('min')) {
      return 'La cantidad debe ser mayor a 0';
    }
    return '';
  }
}
