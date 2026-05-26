import {
    Component, OnInit, inject, signal, ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ToolService }         from 'app/core/services/tool.service';
import { KitsService }         from 'app/core/services/kits.service';
import { MiscelaneosService }  from 'app/core/services/miscelaneos.service';
import { MovementService }     from 'app/core/services/movement.service';
import { UnifiedItem }         from '../consultar-inventario.component';

@Component({
    selector:      'app-ficha-inventario-dialog',
    standalone:    true,
    imports:       [CommonModule, MatIconModule, DragDropModule],
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .neo-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `],
    template: `
<div class="bg-stone-100 dark:bg-slate-900 border-2 border-black overflow-hidden flex flex-col w-full"
     style="max-width:95vw; width:760px; max-height:88vh; box-shadow:6px 6px 0 #000">

  <!-- ── HEADER (drag handle) ── -->
  <div class="bg-[#0F172A] px-3 py-2.5 sm:px-5 sm:py-3 flex items-center gap-3 shrink-0 select-none"
       cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
    <div class="w-9 h-9 rounded bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#000] shrink-0">
      <mat-icon class="!text-lg text-black">{{ getTipoIcon(item.tipo) }}</mat-icon>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Ficha Técnica · Inventario</p>
      <h2 class="text-sm text-white font-black uppercase tracking-tight leading-none truncate">{{ item.nombre }}</h2>
    </div>
  </div>

  <!-- ── BANNER: código · tipo · estado ── -->
  <div class="bg-[#0F172A]/5 dark:bg-slate-800 border-b-2 border-black px-3 py-2 sm:px-5 flex items-center gap-2 shrink-0 flex-wrap">
    <span class="text-[9px] font-mono font-black text-stone-400 dark:text-slate-400">{{ item.codigo }}</span>
    <ng-container *ngIf="item.partNumber">
      <span class="text-stone-300 dark:text-slate-600">·</span>
      <span class="text-[9px] font-mono text-stone-400 dark:text-slate-400">P/N {{ item.partNumber }}</span>
    </ng-container>
    <div class="ml-auto flex items-center gap-1.5 flex-wrap">
      <span class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded {{ getTipoBadgeClass(item.tipo) }}">
        {{ item.tipo === 'HERRAMIENTA' ? 'HERR.' : item.tipo === 'MISCELANEO' ? 'MISC.' : item.tipo }}
      </span>
      <span class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded inline-flex items-center gap-1 {{ getStatusBadgeClass(item.estado) }}">
        <span *ngIf="item.estado !== 'DISPONIBLE'" class="w-1.5 h-1.5 rounded-full {{ getStatusDotClass(item.estado) }}"></span>
        {{ item.estado }}
      </span>
    </div>
  </div>

  <!-- ── BODY ── -->
  <div class="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4 flex flex-col gap-4 neo-scrollbar">

    <!-- ══════════════ HERRAMIENTA ══════════════ -->
    <ng-container *ngIf="item.tipo === 'HERRAMIENTA'">

      <!-- Datos técnicos -->
      <div class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Datos técnicos</span>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">

          <div *ngIf="item.marca" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Marca</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <mat-icon class="!text-xs text-amber-500 shrink-0">label</mat-icon>
              <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.marca }}</span>
            </div>
          </div>

          <div *ngIf="item.partNumber" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Part N°</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <mat-icon class="!text-xs text-stone-400 shrink-0">tag</mat-icon>
              <span class="text-[11px] font-mono font-black text-black dark:text-white truncate">{{ item.partNumber }}</span>
            </div>
          </div>

          <div *ngIf="item.serialNumber" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Serial N°</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <mat-icon class="!text-xs text-stone-400 shrink-0">qr_code</mat-icon>
              <span class="text-[11px] font-mono font-black text-black dark:text-white truncate">{{ item.serialNumber }}</span>
            </div>
          </div>

          <div *ngIf="item.categoria" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Categoría</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <mat-icon class="!text-xs text-stone-400 shrink-0">folder</mat-icon>
              <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.categoria }}</span>
            </div>
          </div>

          <div *ngIf="item.condicion" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Condición</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <span class="px-1.5 py-0.5 text-[9px] font-black border-2 border-black rounded uppercase {{ getCondicionBadgeClass(item.condicion!) }}">{{ item.condicion }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Unidad</span>
            <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
              <span class="text-[11px] font-black text-black dark:text-white">{{ item.unidad || '—' }}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Ubicación + Stock -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Ubicación</span>
          <div class="flex items-start gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <mat-icon class="!text-xs text-stone-400 shrink-0 mt-px">warehouse</mat-icon>
            <div class="min-w-0">
              <p class="text-[11px] font-black text-black dark:text-white truncate">{{ item.ubicacion }}</p>
              <p *ngIf="item.almacen" class="text-[9px] text-stone-400 dark:text-slate-400 mt-px truncate">{{ item.almacen }}</p>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Stock disponible</span>
          <div class="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <span class="text-xl font-black leading-none"
                  [class.text-red-600]="item.stockActual === 0"
                  [class.text-black]="item.stockActual > 0"
                  [class.dark:text-white]="item.stockActual > 0">{{ item.stockActual }}</span>
            <span class="text-[9px] text-stone-400 dark:text-slate-400 font-bold">{{ item.unidad }}</span>
          </div>
        </div>
      </div>

      <!-- Calibración (solo si aplica) -->
      <div *ngIf="item.requiresCalibration" class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400 flex items-center gap-1.5">
          <mat-icon class="!text-[10px] !w-3 !h-3"
                    [class.text-red-500]="isCalibrationExpired(item)"
                    [class.text-yellow-500]="!isCalibrationExpired(item) && isCalibrationSoon(item)"
                    [class.text-amber-500]="!isCalibrationExpired(item) && !isCalibrationSoon(item)">science</mat-icon>
          Calibración
          <span *ngIf="isCalibrationExpired(item)" class="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded uppercase">VENCIDA</span>
          <span *ngIf="!isCalibrationExpired(item) && isCalibrationSoon(item)" class="px-1.5 py-0.5 bg-yellow-400 text-black text-[8px] font-black rounded uppercase">PRÓXIMA</span>
        </span>
        <div class="grid grid-cols-2 gap-2">
          <div *ngIf="item.fechaCalibracion" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Última</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-[11px] font-black text-black dark:text-white">{{ item.fechaCalibracion | date:'dd/MM/yyyy' }}</span>
            </div>
          </div>
          <div *ngIf="item.proximaCalibracion" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Próxima</span>
            <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center"
                 [ngClass]="{
                   'bg-red-50 dark:bg-red-950/30':    isCalibrationExpired(item),
                   'bg-yellow-50 dark:bg-yellow-950/30': !isCalibrationExpired(item) && isCalibrationSoon(item),
                   'bg-white dark:bg-slate-800':      !isCalibrationExpired(item) && !isCalibrationSoon(item)
                 }">
              <span class="text-[11px] font-black"
                    [class.text-red-600]="isCalibrationExpired(item)"
                    [class.text-yellow-600]="!isCalibrationExpired(item) && isCalibrationSoon(item)"
                    [class.text-black]="!isCalibrationExpired(item) && !isCalibrationSoon(item)">{{ item.proximaCalibracion | date:'dd/MM/yyyy' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Adquisición / Notas -->
      <div *ngIf="item.proveedor || item.valorUnitario || item.fechaCompra || item.notas" class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Adquisición / Notas</span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div *ngIf="item.proveedor" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Proveedor</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.proveedor }}</span>
            </div>
          </div>
          <div *ngIf="item.valorUnitario" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Precio</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-[11px] font-black text-black dark:text-white">BOB {{ item.valorUnitario | number:'1.2-2' }}</span>
            </div>
          </div>
          <div *ngIf="item.fechaCompra" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Fecha compra</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-[11px] font-black text-black dark:text-white">{{ item.fechaCompra | date:'dd/MM/yyyy' }}</span>
            </div>
          </div>
        </div>
        <div *ngIf="item.notas" class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
          <p class="text-xs text-black dark:text-white leading-relaxed">{{ item.notas }}</p>
        </div>
      </div>

      <!-- Foto + Últimos movimientos — 50/50 en sm+, apilado en móvil -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">

        <!-- Foto (mitad izquierda) -->
        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Foto</span>
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden flex items-center justify-center p-3" style="min-height:140px">
            <ng-container *ngIf="item.imagen; else sinFoto">
              <img [src]="item.imagen" [alt]="item.nombre" class="max-h-32 w-full object-contain" />
            </ng-container>
            <ng-template #sinFoto>
              <div class="flex flex-col items-center gap-1.5">
                <mat-icon class="!text-3xl text-stone-300 dark:text-slate-600">image_not_supported</mat-icon>
                <span class="text-[9px] text-stone-400 dark:text-slate-500 font-black uppercase tracking-[0.1em]">Sin imagen</span>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Últimos movimientos (mitad derecha) -->
        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Últimos movimientos</span>
          <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden" style="min-height:140px">

            <div *ngIf="isLoadingDetail()" class="flex items-center justify-center h-full py-6 bg-white dark:bg-slate-800">
              <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
            </div>

            <div *ngIf="!isLoadingDetail() && detailMovements().length === 0"
                 class="flex flex-col items-center justify-center h-full py-6 gap-2 bg-white dark:bg-slate-800">
              <mat-icon class="!text-2xl text-stone-300 dark:text-slate-600">history</mat-icon>
              <p class="text-[10px] font-black uppercase text-stone-400 dark:text-slate-500">Sin movimientos</p>
            </div>

            <ng-container *ngIf="!isLoadingDetail() && detailMovements().length > 0">
              <div class="bg-[#0F172A] px-3 py-1.5 grid grid-cols-[4rem_1fr] gap-2 border-b-2 border-black">
                <span class="text-[8px] font-black uppercase text-slate-400">Tipo</span>
                <span class="text-[8px] font-black uppercase text-slate-400">Detalle</span>
              </div>
              <div *ngFor="let mov of detailMovements()"
                   class="grid grid-cols-[4rem_1fr] gap-2 items-start px-3 py-2 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800">
                <span class="px-1 py-0.5 text-[7px] font-black border-2 border-black rounded uppercase w-fit {{ getMovBadgeClass(getMovTipo(mov)) }}">{{ getMovTipo(mov) }}</span>
                <div class="min-w-0">
                  <p class="text-[9px] font-black text-black dark:text-white truncate leading-tight">{{ getMovDescripcion(mov) }}</p>
                  <p class="text-[8px] text-stone-400 dark:text-slate-400 leading-tight">{{ getMovFecha(mov) }}</p>
                  <p class="text-[8px] text-stone-400 dark:text-slate-400 truncate leading-tight">{{ getMovResponsable(mov) }}</p>
                </div>
              </div>
            </ng-container>

          </div>
        </div>

      </div>

    </ng-container>

    <!-- ══════════════ KIT ══════════════ -->
    <ng-container *ngIf="item.tipo === 'KIT'">

      <!-- Info del kit -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">

        <div *ngIf="item.responsable" class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Responsable</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <mat-icon class="!text-xs text-amber-500 shrink-0">person</mat-icon>
            <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.responsable }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Ubicación</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <mat-icon class="!text-xs text-stone-400 shrink-0">place</mat-icon>
            <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.ubicacion || 'Sin asignar' }}</span>
          </div>
        </div>

        <div *ngIf="item.categoria" class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Categoría</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <span class="text-[11px] font-black text-black dark:text-white">{{ item.categoria }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Componentes</span>
          <div class="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <span class="text-xl font-black text-black dark:text-white leading-none">{{ item.totalComponentes ?? 0 }}</span>
            <span class="text-[9px] text-stone-400 font-bold">herramientas</span>
          </div>
        </div>

      </div>

      <div *ngIf="item.descripcion" class="flex flex-col gap-1">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Descripción</span>
        <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
          <p class="text-xs text-black dark:text-white leading-relaxed">{{ item.descripcion }}</p>
        </div>
      </div>

      <!-- Componentes -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Herramientas del kit</span>
          <span *ngIf="detailComponents().length > 0"
                class="px-2 py-0.5 text-[9px] font-black uppercase border-2 border-black rounded bg-amber-400 text-black shadow-[1px_1px_0_#000]">
            {{ detailComponents().length }} ítem{{ detailComponents().length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden">

          <div *ngIf="isLoadingDetail()" class="flex items-center justify-center py-6 bg-white dark:bg-slate-800">
            <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
          </div>

          <div *ngIf="!isLoadingDetail() && detailComponents().length === 0"
               class="flex flex-col items-center py-6 gap-2 bg-white dark:bg-slate-800">
            <mat-icon class="!text-2xl text-stone-300 dark:text-slate-600">inventory</mat-icon>
            <p class="text-[10px] font-black uppercase text-stone-400 dark:text-slate-500">Sin componentes registrados</p>
          </div>

          <ng-container *ngIf="!isLoadingDetail() && detailComponents().length > 0">
            <div class="bg-[#0F172A] px-4 py-2 grid grid-cols-[2rem_4rem_1fr_5rem] gap-3 border-b-2 border-black">
              <span class="text-[8px] font-black uppercase text-slate-400 text-center">#</span>
              <span class="text-[8px] font-black uppercase text-slate-400">Cód.</span>
              <span class="text-[8px] font-black uppercase text-slate-400">Herramienta</span>
              <span class="text-[8px] font-black uppercase text-slate-400 text-center">Estado</span>
            </div>
            <div *ngFor="let comp of detailComponents(); let i = index"
                 class="grid grid-cols-[2rem_4rem_1fr_5rem] gap-3 items-center px-4 py-2.5 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-750 transition-colors">
              <div class="w-6 h-6 bg-[#0F172A] text-white font-black rounded border-2 border-black flex items-center justify-center text-[9px] mx-auto">{{ i + 1 }}</div>
              <span class="font-mono text-[9px] text-stone-400 dark:text-slate-400 truncate">{{ getCompCode(comp) }}</span>
              <span class="text-[11px] font-black text-black dark:text-white truncate">{{ getCompName(comp) }}</span>
              <div class="text-center">
                <span class="px-1 py-0.5 text-[8px] font-black border-2 border-black rounded uppercase {{ getCompStatusClass(getCompStatus(comp)) }}">{{ getCompStatus(comp) || '—' }}</span>
              </div>
            </div>
          </ng-container>

        </div>
      </div>

      <!-- Préstamos -->
      <div class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Historial de préstamos</span>
        <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden">

          <div *ngIf="isLoadingDetail()" class="flex items-center justify-center py-6 bg-white dark:bg-slate-800">
            <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
          </div>

          <div *ngIf="!isLoadingDetail() && detailLoans().length === 0"
               class="flex flex-col items-center py-6 gap-2 bg-white dark:bg-slate-800">
            <mat-icon class="!text-2xl text-stone-300 dark:text-slate-600">swap_horiz</mat-icon>
            <p class="text-[10px] font-black uppercase text-stone-400 dark:text-slate-500">Sin préstamos registrados</p>
          </div>

          <div *ngFor="let loan of detailLoans()"
               class="flex items-center gap-3 px-4 py-2.5 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800 hover:bg-stone-50 dark:hover:bg-slate-700/50 transition-colors">
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-black text-black dark:text-white truncate">{{ getLoanBorrower(loan) }}</p>
              <p class="text-[9px] text-stone-400 dark:text-slate-400 mt-px">{{ getLoanDate(loan) }}<span *ngIf="getLoanReturnDate(loan)"> → {{ getLoanReturnDate(loan) }}</span></p>
            </div>
            <span class="inline-block bg-stone-100 dark:bg-slate-700 px-2 py-0.5 border-2 border-black rounded font-mono font-black text-[10px] text-black dark:text-white shadow-[1px_1px_0_#000] shrink-0">{{ getLoanWO(loan) }}</span>
          </div>

        </div>
      </div>

    </ng-container>

    <!-- ══════════════ MISCELÁNEO ══════════════ -->
    <ng-container *ngIf="item.tipo === 'MISCELANEO'">

      <!-- Datos del material -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">

        <div *ngIf="item.tipoItem" class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Tipo material</span>
          <div class="flex items-center bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <span class="px-1.5 py-0.5 text-[9px] font-black border-2 border-black rounded uppercase"
                  [ngClass]="{
                    'bg-blue-900 text-white':     item.tipoItem === 'CONSUMIBLE',
                    'bg-green-700 text-white':    item.tipoItem === 'MATERIAL',
                    'bg-stone-200 text-gray-700': item.tipoItem !== 'CONSUMIBLE' && item.tipoItem !== 'MATERIAL'
                  }">{{ item.tipoItem }}</span>
          </div>
        </div>

        <div *ngIf="item.marca" class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Marca</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <mat-icon class="!text-xs text-amber-500 shrink-0">label</mat-icon>
            <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.marca }}</span>
          </div>
        </div>

        <div *ngIf="item.partNumber" class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Part N°</span>
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
            <span class="text-[11px] font-mono font-black text-black dark:text-white">{{ item.partNumber }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Unidad</span>
          <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
            <span class="text-[11px] font-black text-black dark:text-white">{{ item.unidad || '—' }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Ubicación</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px]">
            <mat-icon class="!text-xs text-stone-400 shrink-0">place</mat-icon>
            <span class="text-[11px] font-black text-black dark:text-white truncate">{{ item.ubicacion }}</span>
          </div>
        </div>

      </div>

      <!-- Notas -->
      <div *ngIf="item.descripcion" class="flex flex-col gap-1">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Notas</span>
        <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
          <p class="text-xs text-black dark:text-white leading-relaxed">{{ item.descripcion }}</p>
        </div>
      </div>

      <!-- Stock -->
      <div class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Stock</span>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Actual</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center gap-2">
              <span class="text-xl font-black leading-none"
                    [class.text-red-600]="item.stockActual === 0"
                    [class.text-yellow-600]="item.stockActual > 0 && (item.stockMinimo ?? 0) > 0 && item.stockActual <= (item.stockMinimo ?? 0)"
                    [class.text-black]="item.stockActual > 0 && !((item.stockMinimo ?? 0) > 0 && item.stockActual <= (item.stockMinimo ?? 0))"
                    [class.dark:text-white]="item.stockActual > 0">{{ item.stockActual }}</span>
              <span class="text-[9px] text-stone-400 font-bold">{{ item.unidad }}</span>
            </div>
          </div>
          <div *ngIf="(item.stockMinimo ?? 0) > 0" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Mínimo</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-xl font-black text-stone-400 dark:text-slate-500 leading-none">{{ item.stockMinimo }}</span>
            </div>
          </div>
          <div *ngIf="(item.stockMaximo ?? 0) > 0" class="flex flex-col gap-1">
            <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Máximo</span>
            <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[36px] flex items-center">
              <span class="text-xl font-black text-stone-400 dark:text-slate-500 leading-none">{{ item.stockMaximo }}</span>
            </div>
          </div>
        </div>
        <ng-container *ngIf="(item.stockMaximo ?? 0) > 0">
          <div class="h-1.5 bg-stone-100 dark:bg-slate-700 border border-stone-200 dark:border-slate-600 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all"
                 [ngClass]="{
                   'bg-red-500':    (item.stockActual / item.stockMaximo!) < 0.3,
                   'bg-yellow-500': (item.stockActual / item.stockMaximo!) >= 0.3 && (item.stockActual / item.stockMaximo!) < 0.7,
                   'bg-green-500':  (item.stockActual / item.stockMaximo!) >= 0.7
                 }"
                 [style.width.%]="(item.stockActual / item.stockMaximo!) * 100">
            </div>
          </div>
          <p class="text-[9px] text-stone-400 text-right">{{ ((item.stockActual / item.stockMaximo!) * 100) | number:'1.0-0' }}%</p>
        </ng-container>
      </div>

      <!-- Movimientos -->
      <div class="flex flex-col gap-2">
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-400">Últimos movimientos</span>
        <div class="border-2 border-stone-200 dark:border-slate-700 rounded-xl overflow-hidden">

          <div *ngIf="isLoadingDetail()" class="flex items-center justify-center py-6 bg-white dark:bg-slate-800">
            <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
          </div>

          <div *ngIf="!isLoadingDetail() && detailMovements().length === 0"
               class="flex flex-col items-center py-6 gap-2 bg-white dark:bg-slate-800">
            <mat-icon class="!text-2xl text-stone-300 dark:text-slate-600">history</mat-icon>
            <p class="text-[10px] font-black uppercase text-stone-400 dark:text-slate-500">Sin movimientos registrados</p>
          </div>

          <ng-container *ngIf="!isLoadingDetail() && detailMovements().length > 0">
            <div class="bg-[#0F172A] px-4 py-2 grid grid-cols-[4rem_5rem_3rem_1fr] gap-3 border-b-2 border-black">
              <span class="text-[8px] font-black uppercase text-slate-400">Fecha</span>
              <span class="text-[8px] font-black uppercase text-slate-400 text-center">Tipo</span>
              <span class="text-[8px] font-black uppercase text-slate-400 text-right">Cant.</span>
              <span class="text-[8px] font-black uppercase text-slate-400">Responsable</span>
            </div>
            <div *ngFor="let mov of detailMovements()"
                 class="grid grid-cols-[4rem_5rem_3rem_1fr] gap-3 items-center px-4 py-2.5 border-b-2 border-stone-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800">
              <span class="text-[9px] text-stone-500 dark:text-slate-400 whitespace-nowrap">{{ getMovFecha(mov) }}</span>
              <div class="text-center">
                <span class="px-1 py-0.5 text-[8px] font-black border-2 border-black rounded uppercase {{ getMovBadgeClass(getMovTipo(mov)) }}">{{ getMovTipo(mov) }}</span>
              </div>
              <span class="text-right font-black text-xs text-black dark:text-white">{{ getMovCantidad(mov) }}</span>
              <span class="text-[10px] text-stone-500 dark:text-slate-400 truncate">{{ getMovResponsable(mov) }}</span>
            </div>
          </ng-container>

        </div>
      </div>

    </ng-container>

    <!-- Metadatos -->
    <div class="flex items-center gap-1.5 pt-1 border-t border-stone-200 dark:border-slate-700">
      <mat-icon class="!text-xs text-stone-400 dark:text-slate-500">schedule</mat-icon>
      <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">Registrado:</span>
      <span class="text-[9px] font-black text-black dark:text-white">{{ item.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</span>
      <ng-container *ngIf="item.ultimoMovimiento">
        <span class="text-stone-300 dark:text-slate-600">·</span>
        <span class="text-[8px] font-black uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">Últ. mov.:</span>
        <span class="text-[9px] font-black text-black dark:text-white">{{ item.ultimoMovimiento | date:'dd/MM/yyyy' }}</span>
      </ng-container>
    </div>

  </div><!-- /body -->

  <!-- ── FOOTER ── -->
  <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-3 py-2.5 sm:px-5 sm:py-3 flex justify-between items-center shrink-0">
    <div class="flex items-center gap-1.5">
      <mat-icon class="!text-xs text-stone-400">lock</mat-icon>
      <span class="text-[8px] font-black uppercase tracking-widest text-stone-500 dark:text-slate-400">Solo lectura</span>
    </div>
    <button type="button" (click)="cerrar()"
            class="px-4 py-2 bg-[#FF1414] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
      Cerrar
    </button>
  </div>

</div>
    `
})
export class FichaInventarioDialogComponent implements OnInit {

    private dialogRef          = inject(MatDialogRef<FichaInventarioDialogComponent>);
    private data               = inject<{ item: UnifiedItem }>(MAT_DIALOG_DATA);
    private toolService        = inject(ToolService);
    private kitsService        = inject(KitsService);
    private miscelaneosService = inject(MiscelaneosService);
    private movementService    = inject(MovementService);

    item!: UnifiedItem;

    isLoadingDetail  = signal(false);
    detailMovements  = signal<any[]>([]);
    detailComponents = signal<any[]>([]);
    detailLoans      = signal<any[]>([]);

    ngOnInit(): void {
        this.item = this.data.item;
        this.loadDetail();
    }

    cerrar(): void { this.dialogRef.close(); }

    private loadDetail(): void {
        this.isLoadingDetail.set(true);
        const item = this.item;

        if (item.tipo === 'HERRAMIENTA') {
            this.movementService.getMovementsByTool(String(item.id))
                .pipe(catchError(() => of([])), finalize(() => this.isLoadingDetail.set(false)))
                .subscribe((movs: any[]) => this.detailMovements.set(movs.slice(0, 5)));

        } else if (item.tipo === 'KIT') {
            forkJoin({
                components: this.kitsService.getKitComponents(item.id).pipe(catchError(() => of([]))),
                loans:      this.kitsService.getKitLoans(item.id).pipe(catchError(() => of([]))),
            }).pipe(finalize(() => this.isLoadingDetail.set(false)))
              .subscribe(({ components, loans }) => {
                  this.detailComponents.set(components as any[]);
                  this.detailLoans.set((loans as any[]).slice(0, 5));
              });

        } else {
            forkJoin({
                entradas: this.miscelaneosService.getEntradas(item.id).pipe(catchError(() => of([]))),
                salidas:  this.miscelaneosService.getSalidas(item.id).pipe(catchError(() => of([]))),
            }).pipe(finalize(() => this.isLoadingDetail.set(false)))
              .subscribe(({ entradas, salidas }) => {
                  const combined = [
                      ...(entradas as any[]).map((e: any) => ({ ...e, _tipoMov: 'ENTRADA' })),
                      ...(salidas  as any[]).map((s: any) => ({ ...s, _tipoMov: 'SALIDA'  })),
                  ].sort((a, b) => {
                      const fa = new Date(`${a.fecha}T${a.hora || '00:00'}`).getTime();
                      const fb = new Date(`${b.fecha}T${b.hora || '00:00'}`).getTime();
                      return fb - fa;
                  }).slice(0, 5);
                  this.detailMovements.set(combined);
              });
        }
    }

    // ── Helpers de estilo ─────────────────────────────────────────────────────

    getTipoIcon(tipo: string): string {
        return ({ HERRAMIENTA: 'construction', KIT: 'cases', MISCELANEO: 'category' } as any)[tipo] || 'help';
    }

    getTipoBadgeClass(tipo: string): string {
        const m: Record<string, string> = {
            HERRAMIENTA: 'bg-amber-400 text-black border-black',
            KIT:         'bg-blue-600 text-white border-black',
            MISCELANEO:  'bg-orange-500 text-white border-black',
        };
        return m[tipo] || 'bg-stone-200 text-black border-black';
    }

    getStatusBadgeClass(estado: string): string {
        const m: Record<string, string> = {
            'DISPONIBLE':     'bg-green-700   text-white        border-green-900',
            'BAJO STOCK':     'bg-yellow-100  text-yellow-800   border-yellow-300',
            'SIN STOCK':      'bg-red-100     text-red-800      border-red-300',
            'EN CALIBRACION': 'bg-purple-100  text-purple-800   border-purple-300',
            'EN PRESTAMO':    'bg-blue-100    text-blue-800     border-blue-300',
            'CUARENTENA':     'bg-orange-100  text-orange-800   border-orange-300',
            'EN USO':         'bg-blue-100    text-blue-800     border-blue-300',
            'COMPLETO':       'bg-green-700   text-white        border-green-900',
            'INCOMPLETO':     'bg-yellow-100  text-yellow-800   border-yellow-300',
            'BAJA':           'bg-stone-200   text-stone-600    border-stone-400',
        };
        return m[estado] || 'bg-stone-100 text-stone-600 border-stone-300';
    }

    getStatusDotClass(estado: string): string {
        const m: Record<string, string> = {
            'DISPONIBLE': 'bg-emerald-500', 'BAJO STOCK': 'bg-yellow-500',
            'SIN STOCK':  'bg-red-500',     'EN CALIBRACION': 'bg-purple-500',
            'EN PRESTAMO':'bg-blue-500',    'CUARENTENA': 'bg-orange-500',
            'EN USO':     'bg-blue-500',    'COMPLETO':   'bg-emerald-500',
            'INCOMPLETO': 'bg-yellow-500',  'BAJA':       'bg-stone-400',
        };
        return m[estado] || 'bg-stone-400';
    }

    getCondicionBadgeClass(condicion: string): string {
        const m: Record<string, string> = {
            'EXCELENTE': 'bg-green-100  text-green-800  border-green-300',
            'BUENO':     'bg-blue-100   text-blue-800   border-blue-300',
            'REGULAR':   'bg-yellow-100 text-yellow-800 border-yellow-300',
            'MALO':      'bg-red-100    text-red-800    border-red-300',
        };
        return m[condicion] || 'bg-stone-100 text-stone-600 border-stone-300';
    }

    getMovBadgeClass(tipo: string): string {
        return tipo === 'ENTRADA'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-red-100     text-red-700     border-red-200';
    }

    isCalibrationExpired(item: UnifiedItem): boolean {
        return !!item.proximaCalibracion && item.proximaCalibracion < new Date();
    }

    isCalibrationSoon(item: UnifiedItem): boolean {
        if (!item.proximaCalibracion) return false;
        const limit = new Date();
        limit.setDate(limit.getDate() + 30);
        return item.proximaCalibracion >= new Date() && item.proximaCalibracion <= limit;
    }

    getMovFecha(mov: any): string        { return mov.fecha || mov.loan_date || ''; }
    getMovTipo(mov: any): string {
        if (mov._tipoMov) return mov._tipoMov;
        const t = mov.movement_type || mov.tipo || '';
        if (t === 'entry' || t === 'ENTRADA') return 'ENTRADA';
        if (t === 'exit'  || t === 'SALIDA')  return 'SALIDA';
        return t || '—';
    }
    getMovDescripcion(mov: any): string  { return mov.description || mov.subtipo || mov.loan_number || mov.nroNota || mov.movement_number || mov.notes || '—'; }
    getMovResponsable(mov: any): string  { return mov.borrower_name || mov.responsable || mov.name || mov.recibidoPor || mov.authorized_by || '—'; }
    getMovCantidad(mov: any): string     { const q = mov.quantity ?? mov.cantidad ?? mov.quantity_out ?? mov.quantity_in; return q != null ? String(q) : '—'; }
    getCompStatus(comp: any): string     { return comp.tool_status || comp.status || ''; }
    getCompStatusClass(s: string): string {
        if (s === 'available' || s === 'DISPONIBLE') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (s === 'in_use'    || s === 'EN USO')     return 'bg-blue-100    text-blue-800    border-blue-300';
        return 'bg-stone-100 text-stone-600 border-stone-300';
    }
    getCompName(comp: any): string       { return comp.tool_name || comp.name || comp.herramienta_nombre || '—'; }
    getCompCode(comp: any): string       { return comp.tool_code || comp.code || '—'; }
    getCompQty(comp: any): number        { return comp.quantity ?? comp.cantidad ?? 1; }
    getLoanBorrower(loan: any): string   { return loan.borrower_name || loan.responsable || '—'; }
    getLoanDate(loan: any): string       { return loan.loan_date || loan.fecha || ''; }
    getLoanReturnDate(loan: any): string { return loan.expected_return_date || loan.return_date || ''; }
    getLoanWO(loan: any): string         { return loan.work_order_number || loan.loan_number || '—'; }
}
