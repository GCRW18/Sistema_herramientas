import { Component, Inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { LevelTool }   from 'app/modules/admin/inventory/gestion-ubicaciones/interfaces';
import { UnifiedItem } from '../consultar-inventario.component';

export type FichaPanel = 'specs' | 'movimientos' | 'ubicacion';

/**
 * Miniventana independiente de la ficha de inventario (una por panel:
 * Especificaciones · Movimientos · Estante/Nivel). Se abre sin backdrop y es
 * arrastrable, así se pueden tener varias abiertas junto a la ficha.
 * Los datos llegan como signals del padre (ya cargados o en curso): la
 * miniventana se actualiza sola cuando terminan de cargar.
 */
export interface FichaPanelData {
    item:              UnifiedItem;
    panel:             FichaPanel;
    detailMovements:   Signal<any[]>;
    detailComponents:  Signal<any[]>;
    detailLoans:       Signal<any[]>;
    locationData:      Signal<LevelTool | null>;
    isLoadingDetail:   Signal<boolean>;
    isLoadingLocation: Signal<boolean>;
}

@Component({
    selector:   'app-ficha-panel-dialog',
    standalone: true,
    imports:    [CommonModule, MatIconModule, MatDialogModule, DragDropModule],
    styles: [`
        :host { display: block; }
        .neo-scroll::-webkit-scrollbar { width: 4px; }
        .neo-scroll::-webkit-scrollbar-track { background: transparent; }
        .neo-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .fp-spin { animation: _fp_spin 0.9s linear infinite; }
        @keyframes _fp_spin { to { transform: rotate(360deg); } }
    `],
    template: `
<div class="bg-stone-50 dark:bg-slate-900 border-2 border-black rounded-2xl overflow-hidden flex flex-col"
     style="width:100%; max-height:80vh; box-shadow:6px 6px 0 #000">

  <!-- Header (arrastrable) -->
  <div class="bg-[#0F172A] px-3 py-2 flex items-center gap-2 shrink-0 select-none"
       cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
    <div class="w-6 h-6 rounded bg-amber-400 border-2 border-black flex items-center justify-center shrink-0">
      <mat-icon class="!text-xs text-black">
        {{ panel === 'ubicacion' ? 'shelves' : panel === 'specs' ? (item.tipo === 'KIT' ? 'inventory' : 'list_alt') : (item.tipo === 'KIT' ? 'swap_horiz' : 'history') }}
      </mat-icon>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[6px] text-slate-500 font-black uppercase tracking-[0.16em] leading-none mb-0.5">{{ item.codigo }}</p>
      <h3 class="text-[10px] text-white font-black uppercase tracking-tight leading-none truncate">
        {{ panel === 'ubicacion' ? 'Estante · Nivel' : panel === 'specs' ? (item.tipo === 'KIT' ? 'Componentes del kit' : 'Especificaciones técnicas') : (item.tipo === 'KIT' ? 'Historial de préstamos' : 'Movimientos') }}
      </h3>
    </div>
    <button type="button" (click)="cerrar()" (mousedown)="$event.stopPropagation()"
            class="w-6 h-6 border-2 border-slate-600 rounded flex items-center justify-center hover:border-red-500 hover:bg-red-900/40 transition-all shrink-0">
      <mat-icon class="!text-xs text-slate-400">close</mat-icon>
    </button>
  </div>

  <!-- Contenido scroll -->
  <div class="overflow-y-auto neo-scroll flex-1">

    <!-- ══ UBICACIÓN ══ -->
    <ng-container *ngIf="panel === 'ubicacion'">
      <div class="p-3 flex flex-col gap-2">

        <div *ngIf="isLoadingLocation()" class="flex flex-col items-center justify-center p-6 gap-2">
          <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full fp-spin"></div>
          <span class="text-[8px] font-black uppercase text-stone-400 tracking-wider">Consultando ubicación…</span>
        </div>

        <ng-container *ngIf="!isLoadingLocation()">

          <!-- Almacén -->
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Almacén</div>
            <div class="text-[10px] font-black text-black dark:text-white">{{ item.almacen || item.ubicacion || '—' }}</div>
          </div>

          <!-- Con estante asignado -->
          <ng-container *ngIf="locationData() as loc">

            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1.5">Estante (Rack)</div>
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 bg-[#0F172A] border-2 border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                  <mat-icon class="!text-base text-amber-400">shelves</mat-icon>
                </div>
                <div class="min-w-0">
                  <div class="text-[12px] font-black text-black dark:text-white font-mono leading-tight break-all">{{ loc.rackCodigo }}</div>
                  <div class="text-[8px] text-stone-400 uppercase tracking-wider">Código de estante</div>
                </div>
              </div>
            </div>

            <div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-2.5 shadow-[2px_2px_0_#000]">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-amber-600 mb-1.5">Nivel asignado</div>
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 bg-[#0F172A] border-2 border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                  <span class="text-amber-400 font-black text-[11px]">{{ loc.levelNumero !== null ? 'N' + loc.levelNumero : '≡' }}</span>
                </div>
                <div class="min-w-0">
                  <div class="text-[12px] font-black text-amber-800 dark:text-amber-300 font-mono leading-tight break-all">{{ loc.levelCodigo }}</div>
                  <div class="text-[8px] text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                    {{ loc.levelNumero !== null ? 'Nivel ' + loc.levelNumero : 'Nivel piso / suelo' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-[#0F172A] rounded-xl p-2.5 flex items-center gap-2">
              <mat-icon class="!text-sm text-amber-400 shrink-0">place</mat-icon>
              <span class="text-[9px] font-black text-white font-mono break-all">
                {{ item.almacen || 'Almacén' }} → {{ loc.rackCodigo }} → {{ loc.levelCodigo }}
              </span>
            </div>

          </ng-container>

          <!-- Sin estante -->
          <div *ngIf="!locationData()" class="flex flex-col items-center justify-center p-6 gap-2 bg-white dark:bg-slate-800 border-2 border-dashed border-stone-200 dark:border-slate-700 rounded-xl">
            <mat-icon class="!text-3xl text-stone-300 dark:text-slate-600">location_off</mat-icon>
            <span class="text-[9px] font-black uppercase tracking-wide text-stone-400">Sin estante asignado</span>
            <span class="text-[8px] text-stone-300 dark:text-slate-500 text-center">Esta herramienta no tiene una posición de estante registrada en el sistema de ubicaciones.</span>
          </div>

        </ng-container>

      </div>
    </ng-container>

    <!-- ══ SPECS ══ -->
    <ng-container *ngIf="panel === 'specs'">

      <!-- HERRAMIENTA -->
      <ng-container *ngIf="item.tipo === 'HERRAMIENTA'">
        <div class="p-3 flex flex-col gap-1.5">
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Descripción</div>
            <div class="text-[10px] font-bold text-black dark:text-white leading-tight">{{ item.descripcion || '—' }}</div>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Proveedor</div>
              <div class="text-[10px] font-black text-black dark:text-white truncate">{{ item.proveedor || '—' }}</div>
            </div>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Fecha de compra</div>
              <div class="text-[10px] font-black text-black dark:text-white font-mono">{{ item.fechaCompra ? (item.fechaCompra | date:'dd/MM/yyyy') : '—' }}</div>
            </div>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Garantía</div>
              <div class="text-[10px] font-black text-black dark:text-white truncate">
                {{ item.garantia || '—' }}
                <span *ngIf="item.garantiaVence" class="text-[8px]"
                      [class]="garantiaVencida() ? 'text-red-600' : 'text-green-700'">
                  ({{ garantiaVencida() ? 'venció' : 'vence' }} {{ item.garantiaVence | date:'dd/MM/yyyy' }})
                </span>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
              <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Registrado por</div>
              <div class="text-[10px] font-black text-black dark:text-white truncate font-mono">{{ item.registradoPor || '—' }}</div>
            </div>
          </div>
          <div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-amber-600 mb-1">Valor unitario</div>
            <div class="text-base font-black text-amber-800 dark:text-amber-300 leading-none">
              {{ item.valorUnitario != null ? ('Bs. ' + (item.valorUnitario | number:'1.2-2')) : '—' }}
            </div>
          </div>
          <div *ngIf="item.notas" class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Notas</div>
            <div class="text-[10px] font-bold text-black dark:text-white leading-tight">{{ item.notas }}</div>
          </div>
        </div>
      </ng-container>

      <!-- KIT componentes -->
      <ng-container *ngIf="item.tipo === 'KIT'">
        <div class="p-3">
          <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div *ngIf="isLoadingDetail()" class="flex flex-col items-center justify-center p-6 gap-1.5 bg-white dark:bg-slate-800">
              <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full fp-spin"></div>
            </div>
            <div *ngIf="!isLoadingDetail() && detailComponents().length === 0" class="flex flex-col items-center justify-center p-6 gap-1.5 bg-white dark:bg-slate-800">
              <mat-icon class="text-stone-200" style="font-size:24px;width:24px;height:24px">inventory</mat-icon>
              <span class="text-[9px] font-black uppercase tracking-wide text-stone-300">Sin componentes</span>
            </div>
            <ng-container *ngIf="!isLoadingDetail() && detailComponents().length > 0">
              <div class="bg-[#0F172A] px-3 py-1.5 grid gap-2" style="grid-template-columns:18px 44px 1fr 54px">
                <span class="text-[7px] font-black uppercase text-slate-400 text-center">#</span>
                <span class="text-[7px] font-black uppercase text-slate-400">Cód.</span>
                <span class="text-[7px] font-black uppercase text-slate-400">Herramienta</span>
                <span class="text-[7px] font-black uppercase text-slate-400 text-center">Estado</span>
              </div>
              <div *ngFor="let comp of detailComponents(); let i = index"
                   class="grid gap-2 items-center px-3 py-1.5 border-t border-stone-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-amber-50 transition-colors"
                   style="grid-template-columns:18px 44px 1fr 54px">
                <div class="w-[16px] h-[16px] bg-[#0f172a] text-white font-black border border-black rounded flex items-center justify-center text-[7px] mx-auto">{{ i+1 }}</div>
                <span class="font-mono text-[8px] text-stone-400 truncate">{{ getCompCode(comp) }}</span>
                <span class="text-[9px] font-black text-black dark:text-white truncate">{{ getCompName(comp) }}</span>
                <div class="text-center">
                  <span class="inline-flex items-center px-1 py-0.5 text-[6px] font-black border-2 rounded {{ getCompStatusClass(getCompStatus(comp)) }}">{{ getCompStatus(comp) || '—' }}</span>
                </div>
              </div>
            </ng-container>
          </div>
        </div>
      </ng-container>

      <!-- MISC -->
      <ng-container *ngIf="item.tipo === 'MISCELANEO'">
        <div class="p-3 grid grid-cols-2 gap-1.5">
          <div *ngIf="item.tipoItem" class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Tipo</div>
            <span class="inline-flex px-1.5 py-0.5 text-[8px] font-black uppercase border-2 border-black rounded"
                  [style.background]="item.tipoItem === 'CONSUMIBLE' ? '#1e3a8a' : item.tipoItem === 'MATERIAL' ? '#14532d' : '#e7e5e4'"
                  [style.color]="(item.tipoItem === 'CONSUMIBLE' || item.tipoItem === 'MATERIAL') ? '#fff' : '#57534e'">{{ item.tipoItem }}</span>
          </div>
          <div *ngIf="item.marca" class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Marca</div>
            <div class="text-[10px] font-black text-black dark:text-white truncate">{{ item.marca }}</div>
          </div>
          <div *ngIf="item.partNumber" class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Part N°</div>
            <div class="text-[10px] font-black text-black dark:text-white font-mono truncate">{{ item.partNumber }}</div>
          </div>
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Unidad</div>
            <div class="text-[10px] font-black text-black dark:text-white truncate">{{ item.unidad || '—' }}</div>
          </div>
          <div class="col-span-2 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
            <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1">Ubicación</div>
            <div class="text-[10px] font-black text-black dark:text-white truncate">{{ item.ubicacion || '—' }}</div>
          </div>
        </div>
      </ng-container>

    </ng-container>

    <!-- ══ MOVIMIENTOS ══ -->
    <ng-container *ngIf="panel === 'movimientos'">

      <!-- HERR / MISC -->
      <ng-container *ngIf="item.tipo !== 'KIT'">
        <div *ngIf="isLoadingDetail()" class="flex flex-col items-center justify-center p-8 gap-1.5">
          <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full fp-spin"></div>
        </div>
        <div *ngIf="!isLoadingDetail() && detailMovements().length === 0" class="flex flex-col items-center justify-center p-8 gap-1.5">
          <mat-icon class="text-stone-200" style="font-size:24px;width:24px;height:24px">history</mat-icon>
          <span class="text-[9px] font-black uppercase tracking-wide text-stone-300">Sin movimientos</span>
        </div>
        <div *ngFor="let mov of detailMovements(); let last = last"
             class="grid gap-2 px-3 py-2.5 border-b border-stone-200 dark:border-slate-700 items-stretch"
             style="grid-template-columns:44px 12px 1fr">
          <div class="flex flex-col gap-0.5 pt-0.5">
            <span class="text-[10px] font-black text-black dark:text-white">{{ getMovFechaDia(mov) }}</span>
            <span class="text-[7px] text-stone-400">{{ getMovFechaAnio(mov) }}</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 mt-0.5"
                 [class.bg-green-400]="getMovTipo(mov) === 'ENTRADA'"
                 [class.border-green-700]="getMovTipo(mov) === 'ENTRADA'"
                 [class.bg-red-400]="getMovTipo(mov) !== 'ENTRADA'"
                 [class.border-red-700]="getMovTipo(mov) !== 'ENTRADA'"></div>
            <div *ngIf="!last" class="w-0.5 bg-stone-200 dark:bg-slate-700 flex-1 min-h-[8px] mt-0.5"></div>
          </div>
          <div class="pb-1">
            <span class="inline-flex px-1.5 py-0.5 text-[7px] font-black border-2 rounded uppercase mb-1"
                  [class.bg-green-50]="getMovTipo(mov) === 'ENTRADA'"
                  [class.text-green-800]="getMovTipo(mov) === 'ENTRADA'"
                  [class.border-green-200]="getMovTipo(mov) === 'ENTRADA'"
                  [class.bg-red-50]="getMovTipo(mov) !== 'ENTRADA'"
                  [class.text-red-800]="getMovTipo(mov) !== 'ENTRADA'"
                  [class.border-red-200]="getMovTipo(mov) !== 'ENTRADA'">{{ getMovTipo(mov) }}</span>
            <div class="text-[9px] font-black text-black dark:text-white leading-snug">{{ getMovDescripcion(mov) }}</div>
            <div class="text-[8px] text-stone-400 mt-0.5">{{ getMovResponsable(mov) }}</div>
          </div>
        </div>
      </ng-container>

      <!-- KIT préstamos -->
      <ng-container *ngIf="item.tipo === 'KIT'">
        <div *ngIf="isLoadingDetail()" class="flex flex-col items-center justify-center p-8 gap-1.5">
          <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full fp-spin"></div>
        </div>
        <div *ngIf="!isLoadingDetail() && detailLoans().length === 0" class="flex flex-col items-center justify-center p-8 gap-1.5">
          <mat-icon class="text-stone-200" style="font-size:24px;width:24px;height:24px">swap_horiz</mat-icon>
          <span class="text-[9px] font-black uppercase tracking-wide text-stone-300">Sin préstamos</span>
        </div>
        <div *ngFor="let loan of detailLoans(); let last = last"
             class="grid gap-2 px-3 py-2.5 border-b border-stone-200 dark:border-slate-700 items-stretch"
             style="grid-template-columns:44px 12px 1fr">
          <div class="flex flex-col gap-0.5 pt-0.5">
            <span class="text-[10px] font-black text-black dark:text-white">{{ formatDateShort(getLoanDate(loan)) }}</span>
            <span class="text-[7px] text-stone-400">{{ formatYear(getLoanDate(loan)) }}</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-2.5 h-2.5 rounded-full border-2 border-indigo-700 bg-indigo-400 flex-shrink-0 mt-0.5"></div>
            <div *ngIf="!last" class="w-0.5 bg-stone-200 dark:bg-slate-700 flex-1 min-h-[8px] mt-0.5"></div>
          </div>
          <div class="pb-1">
            <span class="inline-flex px-1.5 py-0.5 text-[7px] font-black border-2 border-indigo-200 rounded uppercase mb-1 bg-indigo-50 text-indigo-800">PRÉSTAMO</span>
            <div class="text-[9px] font-black text-black dark:text-white leading-snug">{{ getLoanWO(loan) }}</div>
            <div class="text-[8px] text-stone-400 mt-0.5">
              {{ getLoanBorrower(loan) }}
              <ng-container *ngIf="getLoanReturnDate(loan)">&nbsp;→&nbsp;Dev. {{ getLoanReturnDate(loan) }}</ng-container>
            </div>
          </div>
        </div>
      </ng-container>

    </ng-container>

  </div><!-- /scroll -->
</div>
    `,
})
export class FichaPanelDialogComponent {

    item:  UnifiedItem;
    panel: FichaPanel;

    detailMovements:   Signal<any[]>;
    detailComponents:  Signal<any[]>;
    detailLoans:       Signal<any[]>;
    locationData:      Signal<LevelTool | null>;
    isLoadingDetail:   Signal<boolean>;
    isLoadingLocation: Signal<boolean>;

    constructor(
        private dialogRef: MatDialogRef<FichaPanelDialogComponent>,
        @Inject(MAT_DIALOG_DATA) data: FichaPanelData
    ) {
        this.item              = data.item;
        this.panel             = data.panel;
        this.detailMovements   = data.detailMovements;
        this.detailComponents  = data.detailComponents;
        this.detailLoans       = data.detailLoans;
        this.locationData      = data.locationData;
        this.isLoadingDetail   = data.isLoadingDetail;
        this.isLoadingLocation = data.isLoadingLocation;
    }

    cerrar(): void { this.dialogRef.close(); }

    // ── Garantía ──────────────────────────────────────────────────────────
    garantiaVencida(): boolean {
        return !!this.item.garantiaVence && this.item.garantiaVence < new Date();
    }

    // ── Date helpers ──────────────────────────────────────────────────────
    formatDateShort(dateStr: string): string {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    }
    formatYear(dateStr: string): string {
        if (!dateStr) return '';
        return String(new Date(dateStr).getFullYear());
    }
    getMovFechaDia(mov: any): string  { return this.formatDateShort(mov.fecha || mov.loan_date || ''); }
    getMovFechaAnio(mov: any): string { return this.formatYear(mov.fecha || mov.loan_date || ''); }

    // ── Movement helpers ──────────────────────────────────────────────────
    getMovTipo(mov: any): string {
        if (mov._tipoMov) return mov._tipoMov;
        const t = mov.movement_type || mov.tipo || '';
        if (t === 'entry'  || t === 'ENTRADA') return 'ENTRADA';
        if (t === 'exit'   || t === 'SALIDA')  return 'SALIDA';
        return t || '—';
    }
    getMovDescripcion(mov: any): string {
        return mov.description || mov.subtipo || mov.loan_number || mov.nroNota || mov.movement_number || mov.notes || '—';
    }
    getMovResponsable(mov: any): string {
        return mov.borrower_name || mov.responsable || mov.name || mov.recibidoPor || mov.authorized_by || '—';
    }

    // ── Kit helpers ───────────────────────────────────────────────────────
    getCompStatus(comp: any): string     { return comp.tool_status || comp.status || ''; }
    getCompName(comp: any): string       { return comp.tool_name || comp.name || comp.herramienta_nombre || '—'; }
    getCompCode(comp: any): string       { return comp.tool_code || comp.code || '—'; }
    getLoanBorrower(loan: any): string   { return loan.borrower_name || loan.responsable || '—'; }
    getLoanDate(loan: any): string       { return loan.loan_date || loan.fecha || ''; }
    getLoanReturnDate(loan: any): string { return loan.expected_return_date || loan.return_date || ''; }
    getLoanWO(loan: any): string         { return loan.work_order_number || loan.loan_number || '—'; }

    getCompStatusClass(s: string): string {
        if (s === 'available' || s === 'DISPONIBLE') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (s === 'in_use'    || s === 'EN USO')     return 'bg-blue-100 text-blue-800 border-blue-300';
        return 'bg-stone-100 text-stone-600 border-stone-300';
    }
}
