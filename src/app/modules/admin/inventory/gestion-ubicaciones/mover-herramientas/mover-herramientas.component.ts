import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Warehouse, Rack, Level } from '../interfaces';
import { GestionUbicacionesService } from '../gestion-ubicaciones.service';

interface DialogData {
    count:           number;
    almacenes:       Warehouse[];
    racksByAlmacen:  Record<number, Rack[]>;
    currentLevelId:  number;
    currentRackCode: string;
}

export interface MoverResult {
    warehouseId: number;
    rackId:      number;
    levelId:     number;
    levelCodigo: string;
    rackCodigo:  string;
}

@Component({
    selector: 'app-mover-herramientas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        DragDropModule,
    ],
    templateUrl: './mover-herramientas.component.html',
    styles: [`
        :host { display: block; }
    `]
})
export class MoverHerramientasComponent implements OnInit {

    public dialogRef = inject(MatDialogRef<MoverHerramientasComponent>);
    private fb       = inject(FormBuilder);
    private svc      = inject(GestionUbicacionesService);
    private data     = inject<DialogData>(MAT_DIALOG_DATA);

    count          = this.data.count;
    almacenes      = this.data.almacenes;
    racksByAlm     = signal<Record<number, Rack[]>>({ ...(this.data.racksByAlmacen ?? {}) });
    currentLevelId = this.data.currentLevelId;
    currentRackCode = this.data.currentRackCode;
    loadingRacks   = signal(false);

    selectedAlmacen = signal<number | null>(null);
    selectedRack    = signal<number | null>(null);

    racks = computed<Rack[]>(() => {
        const a = this.selectedAlmacen();
        return a == null ? [] : (this.racksByAlm()[a] ?? []);
    });

    niveles = computed<Level[]>(() => {
        const rId = this.selectedRack();
        if (rId == null) return [];
        const r = this.racks().find(x => x.id === rId);
        return r?.niveles ?? [];
    });

    form!: FormGroup;

    ngOnInit() {
        this.form = this.fb.group({
            warehouseId: [null, Validators.required],
            rackId:      [null, Validators.required],
            levelId:     [null, Validators.required],
        });

        this.form.get('warehouseId')!.valueChanges.subscribe(v => {
            this.selectedAlmacen.set(v);
            this.form.patchValue({ rackId: null, levelId: null }, { emitEvent: false });
            this.selectedRack.set(null);
            if (v != null && !this.racksByAlm()[v]) {
                this.loadingRacks.set(true);
                this.svc.getRacks(v).subscribe(racks => {
                    if (!racks || racks.length === 0) {
                        this.racksByAlm.update(m => ({ ...m, [v]: [] }));
                        this.loadingRacks.set(false);
                        return;
                    }
                    forkJoin(racks.map(r =>
                        this.svc.getLevels(r.id).pipe(
                            map(levels => ({ ...r, niveles: levels })),
                            catchError(() => of({ ...r, niveles: [] as Level[] })),
                        )
                    )).subscribe(racksFull => {
                        this.racksByAlm.update(m => ({ ...m, [v]: racksFull }));
                        this.loadingRacks.set(false);
                    });
                });
            }
        });
        this.form.get('rackId')!.valueChanges.subscribe(v => {
            this.selectedRack.set(v);
            this.form.patchValue({ levelId: null }, { emitEvent: false });
        });
    }

    isCurrentLevel(): boolean {
        return this.form.value.levelId === this.currentLevelId;
    }

    confirmar() {
        if (this.form.invalid || this.isCurrentLevel()) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const lvl = this.niveles().find(l => l.id === v.levelId)!;
        const rack = this.racks().find(r => r.id === v.rackId)!;
        const out: MoverResult = {
            warehouseId: v.warehouseId,
            rackId:      v.rackId,
            levelId:     v.levelId,
            levelCodigo: lvl.codigo,
            rackCodigo:  rack.codigo,
        };
        this.dialogRef.close(out);
    }

    cerrar() { this.dialogRef.close(); }
}
