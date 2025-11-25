import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RosterService, ToolService, KitService, NotificationService } from 'app/core/services';
import { Tool, Kit, User, Aircraft, AssignmentType, ShiftType } from 'app/core/models';
import { Observable, of } from 'rxjs';

@Component({
    selector: 'app-roster-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './roster-form.component.html',
    styleUrl: './roster-form.component.scss'
})
export default class RosterFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _rosterService = inject(RosterService);
    private _toolService = inject(ToolService);
    private _kitService = inject(KitService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    assignmentId: string | null = null;
    loading = false;
    loadingData = false;

    // Data sources
    tools: Tool[] = [];
    kits: Kit[] = [];
    employees: User[] = [];
    aircraft: Aircraft[] = [];

    // Options
    assignmentTypeOptions: { value: AssignmentType; label: string; icon: string }[] = [
        { value: 'tool', label: 'Herramienta Individual', icon: 'heroicons_outline:wrench' },
        { value: 'kit', label: 'Kit Completo', icon: 'heroicons_outline:briefcase' }
    ];

    shiftOptions: { value: ShiftType; label: string }[] = [
        { value: 'morning', label: 'Mañana (07:00 - 15:00)' },
        { value: 'afternoon', label: 'Tarde (15:00 - 23:00)' },
        { value: 'night', label: 'Noche (23:00 - 07:00)' },
        { value: 'all_day', label: 'Todo el día' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
        this.loadFormData();
        this.setupFormListeners();
    }

    initForm(): void {
        this.form = this._fb.group({
            assignmentType: ['tool', Validators.required],
            toolId: [''],
            kitId: [''],
            employeeId: ['', Validators.required],
            aircraftId: [''],
            assignmentDate: [new Date(), Validators.required],
            expectedReturnDate: [''],
            shift: ['all_day', Validators.required],
            purpose: [''],
            workOrderNumber: [''],
            notes: [''],
        });
    }

    checkEditMode(): void {
        this.assignmentId = this._route.snapshot.paramMap.get('id');
        if (this.assignmentId) {
            this.isEditMode = true;
            this.loadAssignment();
        }
    }

    loadAssignment(): void {
        if (!this.assignmentId) return;

        this.loadingData = true;
        this._rosterService.getAssignmentById(this.assignmentId).subscribe({
            next: (assignment) => {
                this.form.patchValue({
                    assignmentType: assignment.assignmentType,
                    toolId: assignment.toolId,
                    kitId: assignment.kitId,
                    employeeId: assignment.employeeId,
                    aircraftId: assignment.aircraftId,
                    assignmentDate: assignment.assignmentDate ? new Date(assignment.assignmentDate) : null,
                    expectedReturnDate: assignment.expectedReturnDate ? new Date(assignment.expectedReturnDate) : null,
                    shift: assignment.shift,
                    purpose: assignment.purpose,
                    workOrderNumber: assignment.workOrderNumber,
                    notes: assignment.notes,
                });
                this.loadingData = false;
            },
            error: () => {
                this._notificationService.error('Error al cargar la asignación');
                this.loadingData = false;
                this._router.navigate(['/roster']);
            },
        });
    }

    loadFormData(): void {
        this.loadingData = true;

        // Load tools
        this._toolService.getTools({ status: 'available' }).subscribe({
            next: (tools) => {
                this.tools = tools;
            },
            error: () => {
                console.error('Error loading tools');
            }
        });

        // Load kits
        this._kitService.getKits().subscribe({
            next: (kits) => {
                this.kits = kits;
            },
            error: () => {
                console.error('Error loading kits');
            }
        });

        // Load employees (mock data for now)
        this.employees = this.getMockEmployees();

        // Load aircraft (mock data for now)
        this.aircraft = this.getMockAircraft();

        this.loadingData = false;
    }

    setupFormListeners(): void {
        // When assignment type changes, reset tool/kit selection
        this.form.get('assignmentType')?.valueChanges.subscribe((type: AssignmentType) => {
            if (type === 'tool') {
                this.form.get('toolId')?.setValidators([Validators.required]);
                this.form.get('kitId')?.clearValidators();
                this.form.get('kitId')?.setValue('');
            } else {
                this.form.get('kitId')?.setValidators([Validators.required]);
                this.form.get('toolId')?.clearValidators();
                this.form.get('toolId')?.setValue('');
            }
            this.form.get('toolId')?.updateValueAndValidity();
            this.form.get('kitId')?.updateValueAndValidity();
        });
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            this.form.markAllAsTouched();
            return;
        }

        this.loading = true;
        const formData = {
            ...this.form.value,
            assignmentDate: this.form.value.assignmentDate?.toISOString(),
            expectedReturnDate: this.form.value.expectedReturnDate?.toISOString(),
        };

        const request = this.isEditMode && this.assignmentId
            ? this._rosterService.updateAssignment(this.assignmentId, formData)
            : this._rosterService.createAssignment(formData);

        request.subscribe({
            next: () => {
                this._notificationService.success(
                    `Asignación ${this.isEditMode ? 'actualizada' : 'creada'} correctamente`
                );
                this._router.navigate(['/roster']);
            },
            error: (error) => {
                this._notificationService.error('Error al guardar la asignación');
                console.error('Error saving assignment:', error);
                this.loading = false;
            }
        });
    }

    cancel(): void {
        this._router.navigate(['/roster']);
    }

    getSelectedAssignmentType(): AssignmentType {
        return this.form.get('assignmentType')?.value || 'tool';
    }

    setAssignmentType(type: AssignmentType): void {
        this.form.get('assignmentType')?.setValue(type);
    }

    // Mock data methods (until backend is ready)
    getMockEmployees(): User[] {
        return [
            {
                id: '1',
                username: 'jperez',
                email: 'jperez@example.com',
                firstName: 'Juan',
                lastName: 'Pérez',
                fullName: 'Juan Pérez',
                role: 'technician',
                position: 'Técnico de Mantenimiento',
                department: 'Mantenimiento',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '2',
                username: 'mgonzalez',
                email: 'mgonzalez@example.com',
                firstName: 'María',
                lastName: 'González',
                fullName: 'María González',
                role: 'technician',
                position: 'Técnico Senior',
                department: 'Mantenimiento',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '3',
                username: 'rrodriguez',
                email: 'rrodriguez@example.com',
                firstName: 'Roberto',
                lastName: 'Rodríguez',
                fullName: 'Roberto Rodríguez',
                role: 'technician',
                position: 'Técnico de Instrumentos',
                department: 'Instrumentación',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '4',
                username: 'alopez',
                email: 'alopez@example.com',
                firstName: 'Ana',
                lastName: 'López',
                fullName: 'Ana López',
                role: 'technician',
                position: 'Técnico Eléctrico',
                department: 'Eléctrica',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        ];
    }

    getMockAircraft(): Aircraft[] {
        return [
            {
                id: '1',
                registration: 'N12345',
                manufacturer: 'Boeing',
                model: '737-800',
                type: 'passenger',
                status: 'active',
                baseLocation: 'Miami International',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '2',
                registration: 'N67890',
                manufacturer: 'Airbus',
                model: 'A320neo',
                type: 'passenger',
                status: 'active',
                baseLocation: 'JFK International',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '3',
                registration: 'N24680',
                manufacturer: 'Boeing',
                model: '787-9',
                type: 'passenger',
                status: 'maintenance',
                baseLocation: 'Los Angeles International',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        ];
    }
}
