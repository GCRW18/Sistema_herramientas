import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { KitService, ToolService, CategoryService, NotificationService } from 'app/core/services';
import { Tool, Category } from 'app/core/models';

@Component({
    selector: 'app-kit-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatAutocompleteModule,
    ],
    templateUrl: './kit-form.component.html',
    styleUrl: './kit-form.component.scss'
})
export default class KitFormComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _kitService = inject(KitService);
    private _toolService = inject(ToolService);
    private _categoryService = inject(CategoryService);
    private _notificationService = inject(NotificationService);

    form!: FormGroup;
    isEditMode = false;
    kitId: string | null = null;
    loading = false;

    tools: Tool[] = [];
    categories: Category[] = [];

    ngOnInit(): void {
        this.initForm();
        this.loadData();
        this.checkEditMode();
    }

    initForm(): void {
        this.form = this._fb.group({
            code: ['', Validators.required],
            name: ['', Validators.required],
            description: [''],
            categoryId: [''],
            tools: this._fb.array([]),
        });
    }

    get toolsArray(): FormArray {
        return this.form.get('tools') as FormArray;
    }

    addTool(): void {
        this.toolsArray.push(this._fb.group({
            toolId: ['', Validators.required],
            required: [false],
        }));
    }

    removeTool(index: number): void {
        this.toolsArray.removeAt(index);
    }

    loadData(): void {
        this._toolService.getTools().subscribe({
            next: (tools) => {
                this.tools = tools;
            },
        });

        this._categoryService.getCategories().subscribe({
            next: (categories) => {
                this.categories = categories;
            },
        });
    }

    checkEditMode(): void {
        this.kitId = this._route.snapshot.paramMap.get('id');
        if (this.kitId) {
            this.isEditMode = true;
            this.loadKit();
        }
    }

    loadKit(): void {
        if (!this.kitId) return;

        this.loading = true;
        this._kitService.getKitById(this.kitId).subscribe({
            next: (kit) => {
                this.form.patchValue(kit);
                kit.items?.forEach(item => {
                    this.toolsArray.push(this._fb.group({
                        toolId: [item.toolId, Validators.required],
                        required: [item.required],
                    }));
                });
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    save(): void {
        if (this.form.invalid) {
            this._notificationService.warning('Por favor complete todos los campos requeridos');
            return;
        }

        this.loading = true;
        const kitData = this.form.value;

        const operation = this.isEditMode && this.kitId
            ? this._kitService.updateKit(this.kitId, kitData)
            : this._kitService.createKit(kitData);

        operation.subscribe({
            next: () => {
                const message = this.isEditMode
                    ? `Kit ${kitData.code} actualizado correctamente`
                    : `Kit ${kitData.code} creado correctamente`;
                this._notificationService.success(message);
                this._router.navigate(['/kits']);
            },
            error: (error) => {
                this.loading = false;
                const message = this.isEditMode
                    ? 'Error al actualizar el kit'
                    : 'Error al crear el kit';
                this._notificationService.error(message);
                console.error('Error saving kit:', error);
            },
        });
    }

    cancel(): void {
        this._router.navigate(['/kits']);
    }
}
