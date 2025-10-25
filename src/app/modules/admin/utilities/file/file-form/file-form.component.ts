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
  selector: 'app-file-form',
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
  templateUrl: './file-form.component.html',
  styleUrl: './file-form.component.scss'
})
export class FileFormComponent implements OnInit {
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  fileForm!: FormGroup;
  isEditMode: boolean = false;
  fileId: number | null = null;
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  tiposEntidad = [
    { value: 'herramienta', label: 'Herramienta' },
    { value: 'instrumento', label: 'Instrumento' },
    { value: 'equipo', label: 'Equipo' },
    { value: 'kit', label: 'Kit' },
    { value: 'calibracion', label: 'Calibración' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'comprobante', label: 'Comprobante' }
  ];

  tiposArchivo = [
    { value: 'certificado', label: 'Certificado de Calibración' },
    { value: 'manual', label: 'Manual de Instrucciones' },
    { value: 'fotografia', label: 'Fotografía' },
    { value: 'informe', label: 'Informe Técnico' },
    { value: 'otro', label: 'Otro' }
  ];

  ngOnInit(): void {
    this.fileId = Number(this._activatedRoute.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.fileId;

    this.fileForm = this._formBuilder.group({
      tipo_entidad: ['', [Validators.required]],
      entidad_id: ['', [Validators.required]],
      tipo_archivo: ['', [Validators.required]],
      descripcion: [''],
      observaciones: ['']
    });

    if (this.isEditMode) {
      this.loadFile();
    }
  }

  loadFile(): void {
    // Mock data loading - replace with actual service call
    setTimeout(() => {
      const mockData = {
        tipo_entidad: 'herramienta',
        entidad_id: 'HER-001',
        tipo_archivo: 'certificado',
        descripcion: 'Certificado de calibración anual',
        observaciones: 'Vigente hasta diciembre 2026'
      };
      this.fileForm.patchValue(mockData);
    }, 500);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      
      // Generate preview for images
      if (this.selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewUrl = e.target?.result as string;
        };
        reader.readAsDataURL(this.selectedFile);
      } else {
        this.previewUrl = null;
      }
    }
  }

  onSubmit(): void {
    if (this.fileForm.valid && (this.selectedFile || this.isEditMode)) {
      const formData = new FormData();
      
      // Append form fields
      Object.keys(this.fileForm.value).forEach(key => {
        formData.append(key, this.fileForm.value[key]);
      });
      
      // Append file if selected
      if (this.selectedFile) {
        formData.append('file', this.selectedFile);
      }
      
      console.log('Guardando archivo:', this.fileForm.value);
      console.log('Archivo seleccionado:', this.selectedFile?.name);
      
      // TODO: Call service to upload file
      // this.fileService.upload(formData).subscribe(...)
      
      this._router.navigate(['/utilities/file']);
    } else {
      this.fileForm.markAllAsTouched();
      if (!this.selectedFile && !this.isEditMode) {
        alert('Por favor seleccione un archivo');
      }
    }
  }

  onCancel(): void {
    this._router.navigate(['/utilities/file']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.fileForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    return '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
