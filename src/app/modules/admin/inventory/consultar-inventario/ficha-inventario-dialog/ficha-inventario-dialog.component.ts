import {
    Component, OnInit, inject, signal, ViewEncapsulation
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { MatIconModule }       from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule }      from '@angular/cdk/drag-drop';
import { forkJoin, of }        from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ToolService }         from 'app/core/services/tool.service';
import { KitsService }         from 'app/core/services/kits.service';
import { MiscelaneosService }  from 'app/core/services/miscelaneos.service';
import { MovementService }          from 'app/core/services/movement.service';
import { GestionUbicacionesService } from 'app/modules/admin/inventory/gestion-ubicaciones/gestion-ubicaciones.service';
import { LevelTool }                 from 'app/modules/admin/inventory/gestion-ubicaciones/interfaces';
import { UnifiedItem }               from '../consultar-inventario.component';

@Component({
    selector:      'app-ficha-inventario-dialog',
    standalone:    true,
    imports:       [CommonModule, MatIconModule, DragDropModule],
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .neo-scroll::-webkit-scrollbar { width: 4px; }
        .neo-scroll::-webkit-scrollbar-track { background: transparent; }
        .neo-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .neo-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .spin { animation: _fi_spin 0.9s linear infinite; }
        @keyframes _fi_spin { to { transform: rotate(360deg); } }

        /* Utilidades compactas para la ficha */
        .fi-lbl {
            display: block;
            font-size: 6px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #a8a29e;
            line-height: 1.3;
            margin-bottom: 2px;
        }
        :host-context(.dark) .fi-lbl { color: #64748b; }

        .fi-fld {
            width: 100%;
            height: 22px;
            font-size: 10px;
            font-weight: 700;
            background: white;
            border: 2px solid #d6d3d1;
            border-radius: 7px;
            padding: 0 7px;
            display: flex;
            align-items: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #1c1917;
        }
        :host-context(.dark) .fi-fld {
            background: #0f172a;
            border-color: #475569;
            color: #f1f5f9;
        }

        @media (max-width: 600px) {
            .fi-root      { width: 100vw !important; max-height: 100dvh !important; border-left: none !important; border-right: none !important; box-shadow: none !important; }
            .fi-body-grid { grid-template-columns: 1fr !important; }
            .fi-left-col  { display: none !important; }
        }
    `],
    template: `
<div class="fi-root bg-stone-100 dark:bg-slate-900 border-2 border-black overflow-hidden flex flex-col"
     style="width:min(660px,96vw); max-height:90vh; box-shadow:6px 6px 0 #000">

  <!-- ══ HEADER ══ -->
  <div class="bg-[#0F172A] px-4 py-2.5 flex items-center gap-3 shrink-0 select-none"
       cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">
    <div class="w-8 h-8 rounded bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#fbbf24] shrink-0">
      <mat-icon class="!text-base text-black">{{ item.tipo === 'KIT' ? 'cases' : item.tipo === 'MISCELANEO' ? 'category' : 'build' }}</mat-icon>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[8px] text-slate-400 font-bold uppercase tracking-[0.18em] leading-none mb-0.5">Inventario · {{ item.tipo | titlecase }}</p>
      <h2 class="text-xs text-white font-black uppercase tracking-tight leading-none truncate">{{ item.nombre }}</h2>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[7px] font-black uppercase border-2 rounded {{ getStatusBadgeClass(item.estado) }}">
        <span *ngIf="item.estado !== 'DISPONIBLE' && item.estado !== 'COMPLETO'"
              class="w-1 h-1 rounded-full shrink-0 {{ getStatusDotClass(item.estado) }}"></span>
        {{ item.estado }}
      </span>
      <span *ngIf="item.condicion"
            class="inline-flex px-1.5 py-0.5 text-[7px] font-black uppercase border-2 rounded {{ getCondicionBadgeClass(item.condicion!) }}">
        {{ item.condicion }}
      </span>
    </div>
  </div>

  <!-- ══ BODY ══ -->
  <div class="flex-1 overflow-hidden px-4 py-3 min-h-0">
    <div class="fi-body-grid h-full grid gap-4" style="grid-template-columns:180px 1fr">

      <!-- ─ IZQUIERDA ─ -->
      <div class="fi-left-col flex flex-col items-center justify-center min-h-0">

        <!-- Zona imagen cuadrada centrada -->
        <div class="border-2 border-dashed border-stone-300 dark:border-slate-600 rounded-xl bg-stone-50 dark:bg-slate-800 flex flex-col items-center justify-center overflow-hidden"
             style="width:160px; height:160px">
          <img *ngIf="item.imagen" [src]="item.imagen" [alt]="item.nombre"
               class="w-full h-full object-contain p-3 opacity-90">
          <ng-container *ngIf="!item.imagen">
            <mat-icon class="!text-5xl text-stone-300 dark:text-slate-600 mb-2">image_not_supported</mat-icon>
            <span class="text-[9px] font-black uppercase text-stone-400 dark:text-slate-500">Sin imagen</span>
          </ng-container>
        </div>

      </div>

      <!-- ─ DERECHA (campos + mini-ventana) ─ -->
      <div class="relative overflow-hidden min-h-0 flex flex-col">

        <!-- Scroll de campos -->
        <div class="flex-1 overflow-y-auto neo-scroll flex flex-col gap-1.5 pr-0.5">

          <!-- ══ HERRAMIENTA ══ -->
          <ng-container *ngIf="item.tipo === 'HERRAMIENTA'">

            <!-- Grilla densa 6 columnas — todo en una pantalla -->
            <div class="grid gap-1" style="grid-template-columns:repeat(6,1fr)">

              <!-- Fila 1: Código (2) | PN (2) | SN (2) -->
              <div class="col-span-2">
                <p class="fi-lbl">Código BOA</p>
                <div class="fi-fld font-mono font-black">{{ item.codigo }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Part N°</p>
                <div class="fi-fld font-mono">{{ item.partNumber || '—' }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Serial N°</p>
                <div class="fi-fld font-mono">{{ item.serialNumber || '—' }}</div>
              </div>

              <!-- Fila 2: Nombre (4) | Estado físico (2) -->
              <div class="col-span-4">
                <p class="fi-lbl">Nombre</p>
                <div class="fi-fld font-black">{{ item.nombre }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Estado</p>
                <div class="fi-fld justify-center font-black text-[8px] uppercase"
                     [class]="item.estadoFisico === 'NUEVO'           ? 'bg-green-50 !border-green-300 !text-green-700 dark:bg-green-900/20'
                              : item.estadoFisico === 'REACONDICIONADO' ? 'bg-amber-50 !border-amber-300 !text-amber-700 dark:bg-amber-900/20'
                              : 'bg-slate-50 !border-stone-300 dark:bg-slate-800'">
                  {{ item.estadoFisico || '—' }}
                </div>
              </div>

              <!-- Fila 3: Marca (2) | Categoría (2) | Criticidad (1) | Fabricación (1) -->
              <div class="col-span-2">
                <p class="fi-lbl">Marca</p>
                <div class="fi-fld">{{ item.marca || '—' }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Categoría</p>
                <div class="fi-fld">{{ item.categoria || '—' }}</div>
              </div>
              <div class="col-span-1">
                <p class="fi-lbl">Criticidad</p>
                <div class="fi-fld justify-center font-black text-[8px]"
                     [class]="item.nivelCriticidad === 'A' ? 'bg-red-50 !border-red-300 !text-red-700'
                              : item.nivelCriticidad === 'B' ? 'bg-amber-50 !border-amber-300 !text-amber-700'
                              : item.nivelCriticidad === 'C' ? 'bg-green-50 !border-green-300 !text-green-700'
                              : ''">
                  {{ item.nivelCriticidad || '—' }}
                </div>
              </div>
              <div class="col-span-1">
                <p class="fi-lbl">Fabricación</p>
                <div class="fi-fld justify-center font-black text-[7px] uppercase"
                     [class]="item.fabricacion === 'INTERNACIONAL' ? 'bg-blue-50 !border-blue-300 !text-blue-700'
                              : item.fabricacion === 'NACIONAL' ? 'bg-teal-50 !border-teal-300 !text-teal-700'
                              : ''">
                  {{ item.fabricacion === 'INTERNACIONAL' ? 'INTL.' : item.fabricacion === 'NACIONAL' ? 'NACI.' : '—' }}
                </div>
              </div>

              <!-- Fila 4: Almacén (2) | Ubicación (2) | Stock (1) | Últ.mov (1) -->
              <div class="col-span-2">
                <p class="fi-lbl">Almacén</p>
                <div class="fi-fld">{{ item.almacen || '—' }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Ubicación</p>
                <div class="fi-fld cursor-pointer group hover:!border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
                     (click)="togglePanel('ubicacion')">
                  <span class="flex-1 truncate">{{ item.ubicacion || '—' }}</span>
                  <mat-icon class="!text-[9px] shrink-0 text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity ml-1">open_in_new</mat-icon>
                </div>
              </div>
              <div class="col-span-1">
                <p class="fi-lbl">Stock</p>
                <div class="fi-fld justify-center font-black"
                     [class]="item.stockActual === 0 ? 'bg-red-50 !border-red-300 !text-red-700'
                              : stockBajo()          ? 'bg-amber-50 !border-amber-300 !text-amber-800'
                              : 'bg-emerald-50 !border-emerald-300 !text-emerald-700'">
                  {{ item.stockActual }}<span class="text-[7px] ml-0.5 opacity-70">{{ item.unidad }}</span>
                </div>
              </div>
              <div class="col-span-1">
                <p class="fi-lbl">Últ. mov.</p>
                <div class="fi-fld justify-center text-[9px]">{{ (item.ultimoMovimiento | date:'dd/MM/yy') || '—' }}</div>
              </div>

              <!-- Fila 5: Condición física (barra inline, 6 cols) -->
              <div class="col-span-6">
                <p class="fi-lbl">Condición física</p>
                <div class="fi-fld !h-[22px] gap-2 pr-2">
                  <div class="flex gap-1 flex-1 h-3">
                    <div class="rounded flex-1 transition-all" [style.background]="condColor('MALO')"></div>
                    <div class="rounded flex-1 transition-all" [style.background]="condColor('REGULAR')"></div>
                    <div class="rounded flex-1 transition-all" [style.background]="condColor('BUENO')"></div>
                    <div class="rounded flex-1 transition-all" [style.background]="condColor('EXCELENTE')"></div>
                  </div>
                  <span class="text-[8px] font-black uppercase shrink-0"
                        [style.color]="item.condicion === 'MALO' ? '#dc2626' : item.condicion === 'REGULAR' ? '#d97706' : item.condicion === 'BUENO' ? '#16a34a' : item.condicion === 'EXCELENTE' ? '#15803d' : '#9ca3af'">
                    {{ item.condicion || '—' }}
                  </span>
                </div>
              </div>

              <!-- Fila 6: Calibración (solo si aplica) — toda en 1 fila -->
              <ng-container *ngIf="item.requiresCalibration">
                <div class="col-span-1">
                  <p class="fi-lbl">Est. calib.</p>
                  <div class="fi-fld justify-center font-black text-[7px] uppercase"
                       [class]="isCalibrationExpired(item) ? 'bg-red-50 !border-red-300 !text-red-700'
                                : isCalibrationSoon(item) ? 'bg-amber-50 !border-amber-300 !text-amber-800'
                                : 'bg-green-50 !border-green-300 !text-green-800'">
                    {{ isCalibrationExpired(item) ? 'VENCIDA' : isCalibrationSoon(item) ? 'PRÓXIMA' : 'VIGENTE' }}
                  </div>
                </div>
                <div class="col-span-1">
                  <p class="fi-lbl">Últ. calib.</p>
                  <div class="fi-fld text-[9px] justify-center">{{ (item.fechaCalibracion | date:'dd/MM/yy') || '—' }}</div>
                </div>
                <div class="col-span-2">
                  <p class="fi-lbl">Próxima calibración</p>
                  <div class="fi-fld font-black text-[9px]"
                       [class]="isCalibrationExpired(item) ? 'bg-red-50 !border-red-300 !text-red-700'
                                : isCalibrationSoon(item) ? 'bg-amber-50 !border-amber-300 !text-amber-800'
                                : ''">
                    {{ (item.proximaCalibracion | date:'dd/MM/yyyy') || '—' }}
                  </div>
                </div>
                <div class="col-span-1">
                  <p class="fi-lbl">Intervalo</p>
                  <div class="fi-fld justify-center text-[9px]">{{ item.intervaloCalibracion != null ? item.intervaloCalibracion + 'd' : '—' }}</div>
                </div>
                <div class="col-span-1">
                  <p class="fi-lbl">N° cert.</p>
                  <div class="fi-fld font-mono text-[9px]">{{ item.nroCertificado || '—' }}</div>
                </div>
              </ng-container>

              <!-- Fila extra: Observaciones (solo si hay, inline) -->
              <div *ngIf="item.notas" class="col-span-6">
                <p class="fi-lbl">Observaciones</p>
                <div class="fi-fld !h-auto py-1 !whitespace-normal !items-start text-[9px] leading-snug" style="min-height:22px;max-height:36px;overflow:hidden">{{ item.notas }}</div>
              </div>

            </div><!-- /grid-6 -->

          </ng-container>

          <!-- ══ KIT ══ -->
          <ng-container *ngIf="item.tipo === 'KIT'">

            <div class="grid grid-cols-2 gap-1.5">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Código</label>
                <div class="w-full h-7 text-xs font-black bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center font-mono truncate">{{ item.codigo }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Responsable</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.responsable || '—' }}</div>
              </div>
            </div>

            <div>
              <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Nombre del kit</label>
              <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.nombre }}</div>
            </div>

            <div class="grid grid-cols-2 gap-1.5">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Categoría</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.categoria || '—' }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Ubicación</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.ubicacion || '—' }}</div>
              </div>
            </div>

            <div>
              <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Total herramientas</label>
              <div class="w-full h-7 text-xs font-black bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg px-2 flex items-center">
                {{ item.totalComponentes ?? 0 }} herramientas
              </div>
            </div>

            <div *ngIf="item.descripcion">
              <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Descripción</label>
              <div class="text-xs bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 py-2 leading-relaxed" style="min-height:44px">{{ item.descripcion }}</div>
            </div>

          </ng-container>

          <!-- ══ MISCELANEO ══ -->
          <ng-container *ngIf="item.tipo === 'MISCELANEO'">

            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Código</label>
                <div class="w-full h-7 text-xs font-black bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center font-mono truncate">{{ item.codigo }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Part N°</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center font-mono truncate">{{ item.partNumber || '—' }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Unidad</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.unidad || '—' }}</div>
              </div>
            </div>

            <div>
              <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Nombre / Descripción</label>
              <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.nombre }}</div>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Tipo</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.tipoItem || '—' }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Marca</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.marca || '—' }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Ubicación</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center truncate">{{ item.ubicacion || '—' }}</div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Stock actual</label>
                <div class="w-full h-7 text-xs font-black border-2 rounded-lg px-2 flex items-center"
                     [class]="item.stockActual === 0 ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                              : stockBajo() ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                              : 'bg-white dark:bg-slate-900 dark:text-white border-stone-300 dark:border-slate-600'">
                  {{ item.stockActual }} {{ item.unidad }}
                </div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Stock mínimo</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center">{{ item.stockMinimo ?? '—' }}</div>
              </div>
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Stock máximo</label>
                <div class="w-full h-7 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2 flex items-center">{{ item.stockMaximo ?? '—' }}</div>
              </div>
            </div>

            <ng-container *ngIf="(item.stockMaximo ?? 0) > 0">
              <div>
                <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Nivel de stock</label>
                <div class="bg-white dark:bg-slate-900 border-2 border-stone-300 dark:border-slate-600 rounded-lg px-3 py-2">
                  <div class="h-2.5 bg-stone-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-300"
                         [style.width.%]="(item.stockActual / item.stockMaximo!) * 100"
                         [style.background]="(item.stockActual / item.stockMaximo!) < 0.3 ? '#ef4444' : (item.stockActual / item.stockMaximo!) < 0.7 ? '#eab308' : '#22c55e'"></div>
                  </div>
                  <div class="text-right text-[7px] font-bold text-stone-400 mt-0.5">{{ ((item.stockActual / item.stockMaximo!) * 100) | number:'1.0-0' }}% del máximo</div>
                </div>
              </div>
            </ng-container>

            <div *ngIf="item.descripcion">
              <label class="text-[7px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 mb-0.5 block">Descripción</label>
              <div class="text-xs bg-white dark:bg-slate-900 dark:text-white border-2 border-stone-300 dark:border-slate-600 rounded-lg px-2.5 py-2 leading-relaxed" style="min-height:44px">{{ item.descripcion }}</div>
            </div>

          </ng-container>

          <!-- ── Botones acción ── -->
          <div class="flex items-center gap-2 pt-1 pb-0.5 mt-auto flex-wrap">
            <button type="button" (click)="togglePanel('specs')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150"
                    [class]="activePanel() === 'specs'
                        ? 'border-black bg-amber-400 text-black shadow-[2px_2px_0_#000]'
                        : 'border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'">
              <mat-icon class="!text-xs">{{ item.tipo === 'KIT' ? 'inventory' : 'list_alt' }}</mat-icon>
              {{ item.tipo === 'KIT' ? 'Componentes' : 'Especificaciones' }}
            </button>
            <button type="button" (click)="togglePanel('movimientos')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150"
                    [class]="activePanel() === 'movimientos'
                        ? 'border-black bg-amber-400 text-black shadow-[2px_2px_0_#000]'
                        : 'border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'">
              <mat-icon class="!text-xs">{{ item.tipo === 'KIT' ? 'swap_horiz' : 'history' }}</mat-icon>
              {{ item.tipo === 'KIT' ? 'Préstamos' : 'Movimientos' }}
            </button>
            <button *ngIf="item.tipo === 'HERRAMIENTA'" type="button" (click)="togglePanel('ubicacion')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150"
                    [class]="activePanel() === 'ubicacion'
                        ? 'border-black bg-amber-400 text-black shadow-[2px_2px_0_#000]'
                        : 'border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'">
              <mat-icon class="!text-xs">shelves</mat-icon>
              Estante / Nivel
            </button>
            <div *ngIf="isLoadingDetail()" class="ml-auto flex items-center gap-1">
              <div class="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full spin"></div>
              <span class="text-[7px] text-stone-400 font-black uppercase tracking-wide">Cargando…</span>
            </div>
          </div>

        </div><!-- /scroll campos -->

        <!-- ══ MINI-VENTANA ══ -->
        <div *ngIf="activePanel()"
             class="absolute inset-0 z-50 border-2 border-black overflow-hidden flex flex-col bg-stone-50 dark:bg-slate-900"
             style="box-shadow:6px 6px 0 #000">

          <!-- Header mini -->
          <div class="bg-[#0F172A] px-3 py-2 flex items-center gap-2 shrink-0">
            <div class="w-6 h-6 rounded bg-amber-400 border-2 border-black flex items-center justify-center shrink-0">
              <mat-icon class="!text-xs text-black">
                {{ activePanel() === 'ubicacion' ? 'shelves' : activePanel() === 'specs' ? (item.tipo === 'KIT' ? 'inventory' : 'list_alt') : (item.tipo === 'KIT' ? 'swap_horiz' : 'history') }}
              </mat-icon>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[6px] text-slate-500 font-black uppercase tracking-[0.16em] leading-none mb-0.5">{{ item.codigo }}</p>
              <h3 class="text-[10px] text-white font-black uppercase tracking-tight leading-none">
                {{ activePanel() === 'ubicacion' ? 'Estante · Nivel' : activePanel() === 'specs' ? (item.tipo === 'KIT' ? 'Componentes del kit' : 'Especificaciones técnicas') : (item.tipo === 'KIT' ? 'Historial de préstamos' : 'Movimientos') }}
              </h3>
            </div>
            <button type="button" (click)="closePanel()"
                    class="w-6 h-6 border-2 border-slate-600 rounded flex items-center justify-center hover:border-red-500 hover:bg-red-900/40 transition-all shrink-0">
              <mat-icon class="!text-xs text-slate-400">close</mat-icon>
            </button>
          </div>

          <!-- Contenido scroll -->
          <div class="overflow-y-auto neo-scroll flex-1">

            <!-- UBICACIÓN -->
            <ng-container *ngIf="activePanel() === 'ubicacion'">
              <div class="p-3 flex flex-col gap-2">

                <!-- Loading -->
                <div *ngIf="isLoadingLocation()" class="flex flex-col items-center justify-center p-6 gap-2">
                  <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
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

                    <!-- Estante -->
                    <div class="bg-white dark:bg-slate-800 border-2 border-stone-200 dark:border-slate-700 rounded-xl p-2.5">
                      <div class="text-[7px] font-black uppercase tracking-[0.12em] text-stone-400 mb-1.5">Estante (Rack)</div>
                      <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-[#0F172A] border-2 border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                          <mat-icon class="!text-base text-amber-400">shelves</mat-icon>
                        </div>
                        <div>
                          <div class="text-[13px] font-black text-black dark:text-white font-mono leading-tight">{{ loc.rackCodigo }}</div>
                          <div class="text-[8px] text-stone-400 uppercase tracking-wider">Código de estante</div>
                        </div>
                      </div>
                    </div>

                    <!-- Nivel -->
                    <div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-2.5 shadow-[2px_2px_0_#000]">
                      <div class="text-[7px] font-black uppercase tracking-[0.12em] text-amber-600 mb-1.5">Nivel asignado</div>
                      <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-[#0F172A] border-2 border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
                          <span class="text-amber-400 font-black text-[11px]">{{ loc.levelNumero !== null ? 'N' + loc.levelNumero : '≡' }}</span>
                        </div>
                        <div>
                          <div class="text-[13px] font-black text-amber-800 dark:text-amber-300 font-mono leading-tight">{{ loc.levelCodigo }}</div>
                          <div class="text-[8px] text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                            {{ loc.levelNumero !== null ? 'Nivel ' + loc.levelNumero : 'Nivel piso / suelo' }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Resumen ruta -->
                    <div class="bg-[#0F172A] rounded-xl p-2.5 flex items-center gap-2">
                      <mat-icon class="!text-sm text-amber-400 shrink-0">place</mat-icon>
                      <span class="text-[9px] font-black text-white font-mono">
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

            <!-- SPECS -->
            <ng-container *ngIf="activePanel() === 'specs'">

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
                      <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
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

            <!-- MOVIMIENTOS -->
            <ng-container *ngIf="activePanel() === 'movimientos'">

              <!-- HERR / MISC -->
              <ng-container *ngIf="item.tipo !== 'KIT'">
                <div *ngIf="isLoadingDetail()" class="flex flex-col items-center justify-center p-8 gap-1.5">
                  <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
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
                  <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full spin"></div>
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

          </div><!-- /scroll mini -->
        </div><!-- /mini-ventana -->

      </div><!-- /derecha -->
    </div><!-- /fi-body-grid -->
  </div><!-- /body -->

  <!-- ══ FOOTER ══ -->
  <div class="border-t-2 border-black bg-stone-200 dark:bg-slate-800 px-4 py-2 flex justify-between items-center shrink-0">
    <div class="flex items-center gap-1.5">
      <mat-icon class="!text-xs text-stone-400 dark:text-slate-500">schedule</mat-icon>
      <span class="text-[7px] font-black uppercase tracking-[0.1em] text-stone-400 dark:text-slate-500">
        Reg. {{ item.fechaRegistro | date:'dd/MM/yy HH:mm' }}
        <ng-container *ngIf="item.ultimoMovimiento">&nbsp;·&nbsp;Últ. mov: {{ item.ultimoMovimiento | date:'dd/MM/yy' }}</ng-container>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1">
        <mat-icon class="!text-xs text-stone-400 dark:text-slate-500">lock</mat-icon>
        <span class="text-[7px] font-black uppercase tracking-[0.1em] text-stone-400 dark:text-slate-500">Solo lectura</span>
      </div>
      <button type="button" (click)="cerrar()"
              class="px-4 py-1.5 bg-[#FF1414] text-white font-black text-[10px] border-2 border-black rounded-xl shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
        Cerrar
      </button>
    </div>
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
    private gestionUbicSvc     = inject(GestionUbicacionesService);

    item!: UnifiedItem;

    isLoadingDetail   = signal(false);
    detailMovements   = signal<any[]>([]);
    detailComponents  = signal<any[]>([]);
    detailLoans       = signal<any[]>([]);
    activePanel       = signal<'specs' | 'movimientos' | 'ubicacion' | null>(null);
    locationData      = signal<LevelTool | null>(null);
    isLoadingLocation = signal(false);

    ngOnInit(): void {
        this.item = this.data.item;
        this.loadDetail();
        if (this.item.tipo === 'HERRAMIENTA') this.loadLocationData();
    }

    cerrar(): void { this.dialogRef.close(); }

    togglePanel(panel: 'specs' | 'movimientos' | 'ubicacion'): void {
        this.activePanel.update(v => v === panel ? null : panel);
    }

    closePanel(): void { this.activePanel.set(null); }

    // ── Stat columns ──────────────────────────────────────────────────────
    getStatCols(): string {
        if (this.item.tipo === 'HERRAMIENTA' && this.item.requiresCalibration) return 'repeat(4,1fr)';
        if (this.item.tipo === 'HERRAMIENTA') return 'repeat(3,1fr)';
        return 'repeat(2,1fr)';
    }

    // ── Stock helpers ─────────────────────────────────────────────────────
    stockBajo(): boolean {
        return (this.item.stockMinimo ?? 0) > 0 && this.item.stockActual <= (this.item.stockMinimo ?? 0);
    }

    // ── Calibration ───────────────────────────────────────────────────────
    isCalibrationExpired(item: UnifiedItem): boolean {
        return !!item.proximaCalibracion && item.proximaCalibracion < new Date();
    }
    isCalibrationSoon(item: UnifiedItem): boolean {
        if (!item.proximaCalibracion) return false;
        const limit = new Date();
        limit.setDate(limit.getDate() + 30);
        return item.proximaCalibracion >= new Date() && item.proximaCalibracion <= limit;
    }
    diasParaCalibracion(): number {
        if (!this.item.proximaCalibracion) return 0;
        return Math.ceil((this.item.proximaCalibracion.getTime() - Date.now()) / 86_400_000);
    }

    // ── Condition bar ─────────────────────────────────────────────────────
    condColor(nivel: string): string {
        const active = this.item.condicion === nivel;
        const map: Record<string, string> = {
            MALO:      active ? '#ef4444' : '#fecaca',
            REGULAR:   active ? '#f97316' : '#fed7aa',
            BUENO:     active ? '#4ade80' : '#bbf7d0',
            EXCELENTE: active ? '#22c55e' : '#dcfce7',
        };
        return map[nivel] ?? '#e7e5e4';
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

    // ── Badge classes ─────────────────────────────────────────────────────
    getTipoBadgeClass(tipo: string): string {
        const m: Record<string,string> = {
            HERRAMIENTA: 'bg-amber-400 text-black border-black',
            KIT:         'bg-blue-600 text-white border-black',
            MISCELANEO:  'bg-orange-500 text-white border-black',
        };
        return m[tipo] || 'bg-stone-200 text-black border-black';
    }
    getStatusBadgeClass(estado: string): string {
        const m: Record<string,string> = {
            'DISPONIBLE':     'bg-green-700 text-white border-green-900',
            'BAJO STOCK':     'bg-yellow-100 text-yellow-800 border-yellow-300',
            'SIN STOCK':      'bg-red-100 text-red-800 border-red-300',
            'EN CALIBRACION': 'bg-purple-100 text-purple-800 border-purple-300',
            'EN PRESTAMO':    'bg-blue-100 text-blue-800 border-blue-300',
            'CUARENTENA':     'bg-orange-100 text-orange-800 border-orange-300',
            'EN USO':         'bg-blue-100 text-blue-800 border-blue-300',
            'COMPLETO':       'bg-green-700 text-white border-green-900',
            'INCOMPLETO':     'bg-yellow-100 text-yellow-800 border-yellow-300',
            'BAJA':           'bg-stone-200 text-stone-600 border-stone-400',
        };
        return m[estado] || 'bg-stone-100 text-stone-600 border-stone-300';
    }
    getStatusDotClass(estado: string): string {
        const m: Record<string,string> = {
            'BAJO STOCK':     'bg-yellow-500', 'SIN STOCK':      'bg-red-500',
            'EN CALIBRACION': 'bg-purple-500', 'EN PRESTAMO':    'bg-blue-500',
            'CUARENTENA':     'bg-orange-500', 'EN USO':         'bg-blue-500',
            'INCOMPLETO':     'bg-yellow-500', 'BAJA':           'bg-stone-400',
        };
        return m[estado] || 'bg-stone-400';
    }
    getCondicionBadgeClass(condicion: string): string {
        const m: Record<string,string> = {
            EXCELENTE: 'bg-green-100 text-green-800 border-green-300',
            BUENO:     'bg-emerald-100 text-emerald-800 border-emerald-300',
            REGULAR:   'bg-yellow-100 text-yellow-800 border-yellow-300',
            MALO:      'bg-red-100 text-red-800 border-red-300',
        };
        return m[condicion] || 'bg-stone-100 text-stone-600 border-stone-300';
    }
    getCompStatusClass(s: string): string {
        if (s === 'available' || s === 'DISPONIBLE') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (s === 'in_use'    || s === 'EN USO')     return 'bg-blue-100 text-blue-800 border-blue-300';
        return 'bg-stone-100 text-stone-600 border-stone-300';
    }

    // ── Location loading ──────────────────────────────────────────────────
    private loadLocationData(): void {
        this.isLoadingLocation.set(true);
        this.gestionUbicSvc.findToolByCodeAny(this.item.codigo)
            .pipe(catchError(() => of(null)), finalize(() => this.isLoadingLocation.set(false)))
            .subscribe(loc => this.locationData.set(loc));
    }

    // ── Data loading ──────────────────────────────────────────────────────
    private loadDetail(): void {
        this.isLoadingDetail.set(true);
        const item = this.item;

        if (item.tipo === 'HERRAMIENTA') {
            this.movementService.getMovementsByTool(String(item.id))
                .pipe(catchError(() => of([])), finalize(() => this.isLoadingDetail.set(false)))
                .subscribe((movs: any[]) => this.detailMovements.set(movs.slice(0, 6)));

        } else if (item.tipo === 'KIT') {
            forkJoin({
                components: this.kitsService.getKitComponents(item.id).pipe(catchError(() => of([]))),
                loans:      this.kitsService.getKitLoans(item.id).pipe(catchError(() => of([]))),
            }).pipe(finalize(() => this.isLoadingDetail.set(false)))
                .subscribe(({ components, loans }) => {
                    this.detailComponents.set(components as any[]);
                    this.detailLoans.set((loans as any[]).slice(0, 6));
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
                    }).slice(0, 6);
                    this.detailMovements.set(combined);
                });
        }
    }
}
