import {
    Component, OnInit, inject, signal, ViewEncapsulation
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { MatIconModule }       from '@angular/material/icon';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
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
      <span *ngIf="item.enLaboratorio"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[7px] font-black uppercase border-2 rounded bg-purple-100 text-purple-800 border-purple-300">
        <mat-icon class="!text-[9px] !w-2.5 !h-2.5">science</mat-icon>
        EN LAB
      </span>
    </div>
  </div>

  <!-- ══ BODY ══ -->
  <div class="flex-1 overflow-hidden px-4 py-3 min-h-0">
    <div class="fi-body-grid h-full grid gap-4" style="grid-template-columns:180px 1fr">

      <!-- ─ IZQUIERDA ─ -->
      <div class="fi-left-col flex flex-col items-center justify-center min-h-0">

        <!-- Zona imagen cuadrada centrada (foto real: ttools.images o he.ttool_files) -->
        <div class="border-2 border-dashed border-stone-300 dark:border-slate-600 rounded-xl bg-stone-50 dark:bg-slate-800 flex flex-col items-center justify-center overflow-hidden"
             style="width:160px; height:160px">
          <img *ngIf="imagenSrc()" [src]="imagenSrc()" [alt]="item.nombre"
               class="w-full h-full object-contain p-3 opacity-90">
          <ng-container *ngIf="!imagenSrc()">
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

              <!-- Fila 3b: Modelo (2) | Activo Fijo (2) | Garantía (2) — solo si hay datos -->
              <ng-container *ngIf="item.modelo || item.activoFijo || item.garantia">
                <div class="col-span-2">
                  <p class="fi-lbl">Modelo</p>
                  <div class="fi-fld">{{ item.modelo || '—' }}</div>
                </div>
                <div class="col-span-2">
                  <p class="fi-lbl">Cód. Activo Fijo</p>
                  <div class="fi-fld font-mono">{{ item.activoFijo || '—' }}</div>
                </div>
                <div class="col-span-2">
                  <p class="fi-lbl">Garantía</p>
                  <div class="fi-fld text-[9px]">
                    <span class="flex-1 truncate">{{ item.garantia || '—' }}</span>
                    <span *ngIf="item.garantiaVence" class="text-[8px] font-black shrink-0 ml-1"
                          [class]="garantiaVencida() ? 'text-red-600' : 'text-green-700'">
                      {{ item.garantiaVence | date:'dd/MM/yy' }}
                    </span>
                  </div>
                </div>
              </ng-container>

              <!-- Fila 4: Almacén (2) | Ubicación (2) | Stock (1) | Últ.mov (1) -->
              <div class="col-span-2">
                <p class="fi-lbl">Almacén</p>
                <div class="fi-fld">{{ item.almacen || '—' }}</div>
              </div>
              <div class="col-span-2">
                <p class="fi-lbl">Ubicación</p>
                <div class="fi-fld cursor-pointer group hover:!border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
                     (click)="abrirPanel('ubicacion')">
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
                  <div class="fi-fld font-black text-[9px] gap-1"
                       [class]="isCalibrationExpired(item) ? 'bg-red-50 !border-red-300 !text-red-700'
                                : isCalibrationSoon(item) ? 'bg-amber-50 !border-amber-300 !text-amber-800'
                                : ''">
                    <span>{{ (item.proximaCalibracion | date:'dd/MM/yyyy') || '—' }}</span>
                    <span *ngIf="item.proximaCalibracion" class="text-[7px] font-bold opacity-75 shrink-0">
                      {{ diasParaCalibracion() >= 0 ? '· faltan ' + diasParaCalibracion() + 'd' : '· hace ' + (-diasParaCalibracion()) + 'd' }}
                    </span>
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

          <!-- ── Botones acción: cada uno abre su miniventana independiente ── -->
          <div class="flex items-center gap-2 pt-1 pb-0.5 mt-auto flex-wrap">
            <button type="button" (click)="abrirPanel('specs')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150 border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:border-black hover:bg-amber-400 hover:text-black hover:shadow-[2px_2px_0_#000]">
              <mat-icon class="!text-xs">{{ item.tipo === 'KIT' ? 'inventory' : 'list_alt' }}</mat-icon>
              {{ item.tipo === 'KIT' ? 'Componentes' : 'Especificaciones' }}
              <mat-icon class="!text-[9px] !w-2.5 !h-2.5 opacity-50">open_in_new</mat-icon>
            </button>
            <button type="button" (click)="abrirPanel('movimientos')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150 border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:border-black hover:bg-amber-400 hover:text-black hover:shadow-[2px_2px_0_#000]">
              <mat-icon class="!text-xs">{{ item.tipo === 'KIT' ? 'swap_horiz' : 'history' }}</mat-icon>
              {{ item.tipo === 'KIT' ? 'Préstamos' : 'Movimientos' }}
              <mat-icon class="!text-[9px] !w-2.5 !h-2.5 opacity-50">open_in_new</mat-icon>
            </button>
            <button *ngIf="item.tipo === 'HERRAMIENTA'" type="button" (click)="abrirPanel('ubicacion')"
                    class="flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150 border-stone-300 bg-white text-stone-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:border-black hover:bg-amber-400 hover:text-black hover:shadow-[2px_2px_0_#000]">
              <mat-icon class="!text-xs">shelves</mat-icon>
              Estante / Nivel
              <mat-icon class="!text-[9px] !w-2.5 !h-2.5 opacity-50">open_in_new</mat-icon>
            </button>
            <div *ngIf="isLoadingDetail()" class="ml-auto flex items-center gap-1">
              <div class="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full spin"></div>
              <span class="text-[7px] text-stone-400 font-black uppercase tracking-wide">Cargando…</span>
            </div>
          </div>

        </div><!-- /scroll campos -->


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
    private dialog             = inject(MatDialog);
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
    locationData      = signal<LevelTool | null>(null);
    isLoadingLocation = signal(false);

    /** Miniventanas de panel abiertas (evita duplicar la misma) */
    private panelesAbiertos = new Set<string>();

    ngOnInit(): void {
        this.item = this.data.item;
        this.loadDetail();
        if (this.item.tipo === 'HERRAMIENTA') this.loadLocationData();
    }

    cerrar(): void { this.dialogRef.close(); }

    /**
     * Abre el panel en una miniventana independiente (sin backdrop, arrastrable).
     * Los signals se pasan por referencia: si los datos aún están cargando, la
     * miniventana se actualiza sola al llegar.
     */
    async abrirPanel(panel: 'specs' | 'movimientos' | 'ubicacion'): Promise<void> {
        if (this.panelesAbiertos.has(panel)) return;
        this.panelesAbiertos.add(panel);

        // Cascada hacia el lado derecho para no tapar la ficha (siguen siendo arrastrables)
        const orden = this.panelesAbiertos.size;
        const { FichaPanelDialogComponent } = await import('./ficha-panel-dialog.component');
        const ref = this.dialog.open(FichaPanelDialogComponent, {
            width: '340px', maxWidth: '95vw',
            panelClass: 'no-padding-dialog',
            hasBackdrop: false,
            autoFocus: false,
            restoreFocus: false,
            position: { top: `${6 + (orden - 1) * 7}vh`, right: '3vw' },
            data: {
                item:              this.item,
                panel,
                detailMovements:   this.detailMovements,
                detailComponents:  this.detailComponents,
                detailLoans:       this.detailLoans,
                locationData:      this.locationData,
                isLoadingDetail:   this.isLoadingDetail,
                isLoadingLocation: this.isLoadingLocation,
            },
        });
        ref.afterClosed().subscribe(() => this.panelesAbiertos.delete(panel));
    }

    // ── Stock helpers ─────────────────────────────────────────────────────
    stockBajo(): boolean {
        return (this.item.stockMinimo ?? 0) > 0 && this.item.stockActual <= (this.item.stockMinimo ?? 0);
    }

    // ── Imagen ────────────────────────────────────────────────────────────
    /**
     * Fuente real de la foto: ttools.images si vino en listTools; si no, la foto
     * de ubicación guardada en he.ttool_files (llega en locationData vía
     * ft_level_tools_sel, que la ficha ya consulta para el estante/nivel).
     */
    imagenSrc(): string | null {
        if (this.item.imagen) return this.item.imagen;
        const b64 = this.locationData()?.imagenBase64;
        if (!b64) return null;
        return (b64.startsWith('data:') || b64.startsWith('http'))
            ? b64
            : `data:image/jpeg;base64,${b64}`;
    }

    // ── Garantía ──────────────────────────────────────────────────────────
    garantiaVencida(): boolean {
        return !!this.item.garantiaVence && this.item.garantiaVence < new Date();
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

    // ── Badge classes ─────────────────────────────────────────────────────
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
                .subscribe((movs: any[]) => {
                    this.detailMovements.set(movs.slice(0, 6));
                    // "Últ. mov." real: la fecha del movimiento más reciente en he.tmovements
                    // (item.ultimoMovimiento venía de fecha_mod, que es la última edición del registro)
                    const fechaUlt = movs[0]?.fecha;
                    if (fechaUlt) this.item.ultimoMovimiento = new Date(fechaUlt);
                });

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
