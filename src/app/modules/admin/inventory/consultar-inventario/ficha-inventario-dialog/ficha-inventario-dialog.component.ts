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
import { MovementService }     from 'app/core/services/movement.service';
import { UnifiedItem }         from '../consultar-inventario.component';

@Component({
    selector:      'app-ficha-inventario-dialog',
    standalone:    true,
    imports:       [CommonModule, MatIconModule, DragDropModule],
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .mat-mdc-dialog-surface,
        .mat-dialog-container { overflow: hidden !important; padding: 0 !important; }

        .neo-scroll::-webkit-scrollbar { width: 4px; }
        .neo-scroll::-webkit-scrollbar-track { background: transparent; }
        .neo-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
        .neo-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }

        .spin { animation: _fi_spin 0.9s linear infinite; }
        @keyframes _fi_spin { to { transform: rotate(360deg); } }

        .fi-root {
            display: flex;
            flex-direction: column;
            width: min(980px, 96vw);
            max-height: 90vh;
            background: #0f172a;
            border: 2.5px solid #000;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 6px 6px 0 #000;
        }

        /* HERO */
        .fi-hero {
            background: #0f172a;
            display: grid;
            grid-template-columns: 260px 1fr;
            flex-shrink: 0;
        }
        .fi-hero-img {
            background: #080e1a;
            border-right: 2px solid #1e293b;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px 16px 14px;
            gap: 12px;
        }
        .fi-img-box {
            width: 150px;
            height: 150px;
            background: #1e293b;
            border: 2px dashed #334155;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            overflow: hidden;
        }
        .fi-img-box img          { width: 100%; height: 100%; object-fit: contain; opacity: .9; }
        .fi-img-box mat-icon     { font-size: 40px; width: 40px; height: 40px; color: #334155; }
        .fi-img-no-label         { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .14em; color: #334155; }
        .fi-code-chip            { background: #ffc501; color: #000; font-family: monospace; font-weight: 900; font-size: 11px; padding: 4px 14px; border: 2px solid #000; border-radius: 5px; box-shadow: 2px 2px 0 #000; display: inline-block; }

        .fi-hero-info            { padding: 18px 20px 0; display: flex; flex-direction: column; gap: 10px; }
        .fi-eyebrow              { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .2em; color: #475569; }
        .fi-hero-title           { font-size: 17px; font-weight: 900; text-transform: uppercase; color: #fff; letter-spacing: .02em; line-height: 1.2; }
        .fi-hero-badges          { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 2px; }

        .fi-badge                { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-size: 8px; font-weight: 900; text-transform: uppercase; border: 1.5px solid #000; border-radius: 4px; letter-spacing: .04em; white-space: nowrap; }
        .fi-badge-dot            { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }

        /* STAT ROW */
        .fi-stat-row             { display: grid; gap: 1px; background: #1e293b; margin-top: auto; }
        .fi-stat                 { background: #0f172a; padding: 9px 14px; display: flex; flex-direction: column; gap: 2px; }
        .fi-stat-label           { font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: .16em; color: #475569; }
        .fi-stat-val             { font-size: 14px; font-weight: 900; line-height: 1; }
        .fi-stat-sub             { font-size: 7px; color: #475569; font-weight: 700; }

        /* BODY */
        .fi-body                 { background: #f8f7f4; display: grid; grid-template-columns: 1fr 1fr; flex: 1; min-height: 0; overflow: hidden; }
        .fi-col-left             { border-right: 2px solid #e7e5e4; display: flex; flex-direction: column; overflow-y: auto; }
        .fi-col-right            { display: flex; flex-direction: column; overflow-y: auto; }

        /* SECTIONS */
        .fi-section              { padding: 13px 15px; border-bottom: 1.5px solid #e7e5e4; }
        .fi-section:last-child   { border-bottom: none; flex: 1; }
        .fi-section-title        { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .18em; color: #a8a29e; display: flex; align-items: center; gap: 5px; margin-bottom: 10px; }
        .fi-section-title mat-icon { font-size: 13px; width: 13px; height: 13px; color: #f59e0b; }

        /* SPEC GRID */
        .fi-spec-grid            { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .fi-spec                 { background: #fff; border: 1px solid #e7e5e4; border-radius: 7px; padding: 6px 9px; }
        .fi-spec.accent          { background: #fefce8; border-color: #fde68a; }
        .fi-spec-key             { font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: #a8a29e; margin-bottom: 2px; }
        .fi-spec-val             { font-size: 10px; font-weight: 900; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fi-spec-val.mono        { font-family: monospace; }
        .fi-spec-val.big         { font-size: 15px; color: #92400e; }

        /* CONDITION */
        .fi-cond-bar             { display: flex; gap: 3px; margin: 8px 0 5px; }
        .fi-cond-seg             { height: 7px; border-radius: 2px; flex: 1; background: #e7e5e4; }
        .fi-cond-labels          { display: flex; justify-content: space-between; font-size: 7px; color: #a8a29e; font-weight: 700; }

        /* CALIBRATION */
        .fi-calib-track          { display: flex; align-items: center; margin: 10px 0 6px; }
        .fi-calib-dot            { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #000; flex-shrink: 0; background: #fff; }
        .fi-calib-dot.done       { background: #22c55e; border-color: #15803d; }
        .fi-calib-dot.ok         { background: #fbbf24; border-color: #d97706; }
        .fi-calib-dot.warn       { background: #f97316; border-color: #c2410c; }
        .fi-calib-dot.danger     { background: #f87171; border-color: #991b1b; }
        .fi-calib-line           { flex: 1; height: 2px; background: #e7e5e4; }
        .fi-calib-line.filled    { background: #22c55e; }
        .fi-calib-labels         { display: flex; justify-content: space-between; align-items: flex-start; }
        .fi-calib-lbl            { display: flex; flex-direction: column; gap: 1px; }
        .fi-calib-lbl span:first-child { font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: #a8a29e; }
        .fi-calib-lbl span:last-child  { font-size: 9px; font-weight: 900; color: #0f172a; }
        .fi-calib-lbl.right      { text-align: right; }
        .fi-calib-chip           { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; font-size: 7px; font-weight: 900; border: 1.5px solid #000; border-radius: 4px; text-transform: uppercase; }

        /* NOTES */
        .fi-notes                { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 7px; padding: 7px 9px; margin-top: 8px; }
        .fi-notes-key            { font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: #60a5fa; margin-bottom: 2px; }
        .fi-notes-val            { font-size: 9px; font-weight: 700; color: #1e40af; line-height: 1.4; margin: 0; }

        /* TIMELINE */
        .fi-tl-item              { display: grid; grid-template-columns: 48px 14px 1fr; gap: 0 10px; padding: 10px 15px; border-bottom: 1px solid #f5f5f4; align-items: stretch; }
        .fi-tl-item:last-child   { border-bottom: none; }
        .fi-tl-date              { display: flex; flex-direction: column; justify-content: flex-start; gap: 1px; padding-top: 2px; }
        .fi-tl-date .day         { font-size: 10px; font-weight: 900; color: #0f172a; }
        .fi-tl-date .year        { font-size: 7px; color: #a8a29e; }
        .fi-tl-spine             { display: flex; flex-direction: column; align-items: center; }
        .fi-tl-bullet            { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #000; flex-shrink: 0; margin-top: 3px; }
        .fi-tl-bullet.entrada    { background: #4ade80; border-color: #15803d; }
        .fi-tl-bullet.salida     { background: #f87171; border-color: #991b1b; }
        .fi-tl-line              { width: 2px; background: #e7e5e4; flex: 1; min-height: 10px; }
        .fi-tl-content           { padding-bottom: 6px; }
        .fi-tl-type              { display: inline-flex; padding: 1px 6px; font-size: 7px; font-weight: 900; border: 1.5px solid; border-radius: 3px; text-transform: uppercase; margin-bottom: 3px; }
        .fi-tl-type.entrada      { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
        .fi-tl-type.salida       { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
        .fi-tl-desc              { font-size: 10px; font-weight: 900; color: #0f172a; line-height: 1.25; }
        .fi-tl-who               { font-size: 8px; color: #a8a29e; margin-top: 2px; }

        /* TABS */
        .fi-tabs                 { display: flex; border-bottom: 2px solid #e7e5e4; background: #fff; flex-shrink: 0; }
        .fi-tab                  { padding: 9px 14px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: #a8a29e; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .fi-tab.active           { color: #0f172a; border-bottom-color: #fbbf24; }

        /* TABLE (kit components) */
        .fi-tbl-wrap             { border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; }
        .fi-tbl-head             { background: #0f172a; padding: 6px 12px; display: grid; gap: 8px; border-bottom: 1px solid #000; }
        .fi-tbl-head span        { font-size: 7px; font-weight: 900; text-transform: uppercase; color: #94a3b8; }
        .fi-tbl-row              { display: grid; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f5f5f4; background: #fff; }
        .fi-tbl-row:last-child   { border-bottom: none; }
        .fi-tbl-row:hover        { background: #fffbeb; }

        /* MISC stock */
        .fi-stock-card           { background: #fefce8; border: 1px solid #fde68a; border-radius: 7px; padding: 6px 9px; }

        /* EMPTY */
        .fi-empty                { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; gap: 6px; background: #fff; }
        .fi-empty mat-icon       { font-size: 28px; width: 28px; height: 28px; color: #e7e5e4; }
        .fi-empty span           { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: #d6d3d1; }

        /* FOOTER */
        .fi-footer               { background: #0f172a; border-top: 2px solid #000; padding: 9px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .fi-footer-meta          { display: flex; align-items: center; gap: 6px; }
        .fi-footer-meta mat-icon { font-size: 12px; width: 12px; height: 12px; color: #334155; }
        .fi-footer-meta span     { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: #475569; }
        .fi-close-btn            { padding: 7px 20px; background: #FF1414; color: #fff; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 2px solid #000; border-radius: 8px; box-shadow: 2px 2px 0 #000; cursor: pointer; letter-spacing: .06em; transition: all .1s; }
        .fi-close-btn:hover      { box-shadow: none; transform: translate(2px, 2px); }

        /* RESPONSIVE */
        @media (max-width: 720px) {
            .fi-root             { width: 100vw !important; max-height: 100dvh; border-radius: 0; border-left: none; border-right: none; box-shadow: none; }
            .fi-hero             { grid-template-columns: 1fr; }
            .fi-hero-img         { flex-direction: row; padding: 12px 16px; justify-content: flex-start; gap: 14px; border-right: none; border-bottom: 2px solid #1e293b; }
            .fi-img-box          { width: 80px; height: 80px; flex-shrink: 0; }
            .fi-body             { grid-template-columns: 1fr; overflow-y: auto; }
            .fi-col-left         { overflow-y: visible; border-right: none; }
            .fi-col-right        { overflow-y: visible; }
        }
        @media (max-width: 500px) {
            .fi-stat-row         { grid-template-columns: 1fr 1fr; }
        }
    `],
    template: `
<div class="fi-root">

  <!-- ══════ HERO ══════ -->
  <div class="fi-hero" cdkDrag cdkDragRootElement=".cdk-overlay-pane" cdkDragHandle style="cursor:grab">

    <div class="fi-hero-img">
      <div class="fi-img-box">
        <img *ngIf="item.imagen" [src]="item.imagen" [alt]="item.nombre">
        <ng-container *ngIf="!item.imagen">
          <mat-icon>image_not_supported</mat-icon>
          <span class="fi-img-no-label">Sin imagen</span>
        </ng-container>
      </div>
      <span class="fi-code-chip">{{ item.codigo }}</span>
    </div>

    <div class="fi-hero-info">
      <div>
        <p class="fi-eyebrow">Ficha técnica · {{ item.tipo | titlecase }}</p>
        <h2 class="fi-hero-title">{{ item.nombre }}</h2>
        <div class="fi-hero-badges">
          <span class="fi-badge {{ getTipoBadgeClass(item.tipo) }}">
            {{ item.tipo === 'HERRAMIENTA' ? 'HERR.' : item.tipo === 'MISCELANEO' ? 'MISC.' : item.tipo }}
          </span>
          <span class="fi-badge {{ getStatusBadgeClass(item.estado) }}">
            <span *ngIf="item.estado !== 'DISPONIBLE' && item.estado !== 'COMPLETO'"
                  class="fi-badge-dot {{ getStatusDotClass(item.estado) }}"></span>
            {{ item.estado }}
          </span>
          <span *ngIf="item.condicion" class="fi-badge {{ getCondicionBadgeClass(item.condicion!) }}">
            {{ item.condicion }}
          </span>
        </div>
      </div>

      <div class="fi-stat-row" [style.gridTemplateColumns]="getStatCols()">

        <!-- Stock (HERR / MISC) -->
        <ng-container *ngIf="item.tipo !== 'KIT'">
          <div class="fi-stat">
            <span class="fi-stat-label">Stock actual</span>
            <span class="fi-stat-val"
                  [style.color]="item.stockActual === 0 ? '#f87171' : stockBajo() ? '#facc15' : '#4ade80'">
              {{ item.stockActual }}<span style="font-size:9px;margin-left:2px">{{ item.unidad }}</span>
            </span>
            <span class="fi-stat-sub">{{ item.stockActual === 0 ? 'Sin stock' : stockBajo() ? 'Bajo mínimo' : 'Disponible' }}</span>
          </div>
        </ng-container>

        <!-- Componentes (KIT) -->
        <ng-container *ngIf="item.tipo === 'KIT'">
          <div class="fi-stat">
            <span class="fi-stat-label">Componentes</span>
            <span class="fi-stat-val" style="color:#fbbf24">{{ item.totalComponentes ?? 0 }}</span>
            <span class="fi-stat-sub">Herramientas</span>
          </div>
        </ng-container>

        <!-- Condición (HERR) -->
        <ng-container *ngIf="item.tipo === 'HERRAMIENTA'">
          <div class="fi-stat">
            <span class="fi-stat-label">Condición</span>
            <span class="fi-stat-val"
                  [style.color]="item.condicion === 'EXCELENTE' ? '#4ade80'
                               : item.condicion === 'BUENO'     ? '#facc15'
                               : item.condicion === 'REGULAR'   ? '#f97316' : '#f87171'">
              {{ item.condicion || '—' }}
            </span>
            <span class="fi-stat-sub">Estado físico</span>
          </div>
        </ng-container>

        <!-- Calibración (HERR con calibración) -->
        <ng-container *ngIf="item.tipo === 'HERRAMIENTA' && item.requiresCalibration && item.proximaCalibracion">
          <div class="fi-stat">
            <span class="fi-stat-label">Próx. calibración</span>
            <span class="fi-stat-val"
                  [style.color]="isCalibrationExpired(item) ? '#f87171'
                               : isCalibrationSoon(item)    ? '#facc15' : '#4ade80'">
              {{ diasParaCalibracion() }} días
            </span>
            <span class="fi-stat-sub">{{ item.proximaCalibracion | date:'dd/MM/yyyy' }}</span>
          </div>
        </ng-container>

        <!-- Categoría -->
        <div class="fi-stat">
          <span class="fi-stat-label">Categoría</span>
          <span class="fi-stat-val" style="color:#94a3b8;font-size:11px">{{ item.categoria || '—' }}</span>
          <span class="fi-stat-sub">{{ item.almacen || item.ubicacion || '—' }}</span>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════ BODY ══════ -->
  <div class="fi-body">

    <!-- ── COL IZQUIERDA ── -->
    <div class="fi-col-left neo-scroll">

      <!-- ══════════ HERRAMIENTA ══════════ -->
      <ng-container *ngIf="item.tipo === 'HERRAMIENTA'">

        <div class="fi-section">
          <div class="fi-section-title"><mat-icon>list_alt</mat-icon>Especificaciones</div>
          <div class="fi-spec-grid">
            <div class="fi-spec">
              <div class="fi-spec-key">Part Number</div>
              <div class="fi-spec-val mono">{{ item.partNumber || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Serial Number</div>
              <div class="fi-spec-val mono">{{ item.serialNumber || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Marca</div>
              <div class="fi-spec-val">{{ item.marca || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Categoría</div>
              <div class="fi-spec-val">{{ item.categoria || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Ubicación</div>
              <div class="fi-spec-val">{{ item.ubicacion || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Almacén</div>
              <div class="fi-spec-val">{{ item.almacen || '—' }}</div>
            </div>
            <div class="fi-spec accent" style="grid-column:1/-1">
              <div class="fi-spec-key" style="color:#d97706">Stock actual</div>
              <div class="fi-spec-val big">
                {{ item.stockActual }}<span style="font-size:9px;color:#b45309;font-weight:700;margin-left:2px">{{ item.unidad }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="fi-section">
          <div class="fi-section-title"><mat-icon>health_and_safety</mat-icon>Condición física</div>
          <div class="fi-cond-bar">
            <div class="fi-cond-seg" [style.background]="condColor('MALO')"></div>
            <div class="fi-cond-seg" [style.background]="condColor('REGULAR')"></div>
            <div class="fi-cond-seg" [style.background]="condColor('BUENO')"
                 [style.border]="item.condicion === 'BUENO' ? '2px solid #15803d' : 'none'"></div>
            <div class="fi-cond-seg" [style.background]="condColor('EXCELENTE')"
                 [style.border]="item.condicion === 'EXCELENTE' ? '2px solid #15803d' : 'none'"></div>
          </div>
          <div class="fi-cond-labels">
            <span [style.color]="item.condicion === 'MALO' ? '#dc2626' : undefined">MALO</span>
            <span [style.color]="item.condicion === 'REGULAR' ? '#d97706' : undefined">REGULAR</span>
            <span [style.color]="item.condicion === 'BUENO' ? '#15803d' : undefined"
                  [style.fontWeight]="item.condicion === 'BUENO' ? '900' : undefined">
              BUENO{{ item.condicion === 'BUENO' ? ' ◀' : '' }}
            </span>
            <span [style.color]="item.condicion === 'EXCELENTE' ? '#15803d' : undefined"
                  [style.fontWeight]="item.condicion === 'EXCELENTE' ? '900' : undefined">
              EXCELENTE{{ item.condicion === 'EXCELENTE' ? ' ◀' : '' }}
            </span>
          </div>
        </div>

        <ng-container *ngIf="item.requiresCalibration">
          <div class="fi-section">
            <div class="fi-section-title">
              <mat-icon>science</mat-icon>Calibración
              <span *ngIf="isCalibrationExpired(item)" class="fi-calib-chip" style="background:#fef2f2;color:#991b1b">
                <mat-icon style="font-size:9px;width:9px;height:9px">warning</mat-icon>VENCIDA
              </span>
              <span *ngIf="!isCalibrationExpired(item) && isCalibrationSoon(item)" class="fi-calib-chip" style="background:#fefce8;color:#92400e">
                <mat-icon style="font-size:9px;width:9px;height:9px">schedule</mat-icon>PRÓXIMA
              </span>
              <span *ngIf="!isCalibrationExpired(item) && !isCalibrationSoon(item)" class="fi-calib-chip" style="background:#f0fdf4;color:#15803d">
                <mat-icon style="font-size:9px;width:9px;height:9px">check_circle</mat-icon>VIGENTE
              </span>
            </div>
            <div class="fi-calib-track">
              <div class="fi-calib-dot done"></div>
              <div class="fi-calib-line filled"></div>
              <div class="fi-calib-dot"
                   [class.ok]="!isCalibrationExpired(item) && !isCalibrationSoon(item)"
                   [class.warn]="!isCalibrationExpired(item) && isCalibrationSoon(item)"
                   [class.danger]="isCalibrationExpired(item)"></div>
            </div>
            <div class="fi-calib-labels">
              <div class="fi-calib-lbl">
                <span>Última</span>
                <span>{{ (item.fechaCalibracion | date:'dd/MM/yyyy') || '—' }}</span>
              </div>
              <div class="fi-calib-lbl right">
                <span>Próxima</span>
                <span [style.color]="isCalibrationExpired(item) ? '#dc2626' : isCalibrationSoon(item) ? '#d97706' : '#0f172a'">
                  {{ (item.proximaCalibracion | date:'dd/MM/yyyy') || '—' }}
                </span>
              </div>
            </div>
          </div>
        </ng-container>

        <div *ngIf="item.notas" class="fi-section" style="flex:1">
          <div class="fi-section-title"><mat-icon>sticky_note_2</mat-icon>Notas</div>
          <div class="fi-notes"><p class="fi-notes-val">{{ item.notas }}</p></div>
        </div>

      </ng-container>

      <!-- ══════════ KIT ══════════ -->
      <ng-container *ngIf="item.tipo === 'KIT'">

        <div class="fi-section">
          <div class="fi-section-title"><mat-icon>cases</mat-icon>Datos del kit</div>
          <div class="fi-spec-grid">
            <div *ngIf="item.responsable" class="fi-spec">
              <div class="fi-spec-key">Responsable</div>
              <div class="fi-spec-val">{{ item.responsable }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Ubicación</div>
              <div class="fi-spec-val">{{ item.ubicacion || '—' }}</div>
            </div>
            <div *ngIf="item.categoria" class="fi-spec">
              <div class="fi-spec-key">Categoría</div>
              <div class="fi-spec-val">{{ item.categoria }}</div>
            </div>
            <div class="fi-spec accent">
              <div class="fi-spec-key" style="color:#d97706">Componentes</div>
              <div class="fi-spec-val big">{{ item.totalComponentes ?? 0 }}</div>
            </div>
          </div>
          <div *ngIf="item.descripcion" class="fi-notes" style="margin-top:8px">
            <div class="fi-notes-key">Descripción</div>
            <p class="fi-notes-val">{{ item.descripcion }}</p>
          </div>
        </div>

        <div class="fi-section" style="flex:1">
          <div class="fi-section-title">
            <mat-icon>inventory</mat-icon>Herramientas del kit
            <span *ngIf="detailComponents().length > 0"
                  style="margin-left:auto;padding:1px 7px;background:#fbbf24;color:#000;
                         font-size:8px;font-weight:900;border:1.5px solid #000;border-radius:4px">
              {{ detailComponents().length }}
            </span>
          </div>
          <div class="fi-tbl-wrap">
            <div *ngIf="isLoadingDetail()" class="fi-empty">
              <div style="width:16px;height:16px;border:2px solid #fbbf24;border-top-color:transparent;border-radius:50%" class="spin"></div>
            </div>
            <div *ngIf="!isLoadingDetail() && detailComponents().length === 0" class="fi-empty">
              <mat-icon>inventory</mat-icon><span>Sin componentes</span>
            </div>
            <ng-container *ngIf="!isLoadingDetail() && detailComponents().length > 0">
              <div class="fi-tbl-head" style="grid-template-columns:20px 50px 1fr 60px">
                <span style="text-align:center">#</span>
                <span>Cód.</span>
                <span>Herramienta</span>
                <span style="text-align:center">Estado</span>
              </div>
              <div *ngFor="let comp of detailComponents(); let i = index"
                   class="fi-tbl-row" style="grid-template-columns:20px 50px 1fr 60px">
                <div style="width:18px;height:18px;background:#0f172a;color:#fff;font-weight:900;
                            border-radius:3px;border:1px solid #000;display:flex;align-items:center;
                            justify-content:center;font-size:8px;margin:auto">{{ i+1 }}</div>
                <span style="font-family:monospace;font-size:8px;color:#a8a29e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ getCompCode(comp) }}</span>
                <span style="font-size:10px;font-weight:900;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ getCompName(comp) }}</span>
                <div style="text-align:center">
                  <span class="fi-badge {{ getCompStatusClass(getCompStatus(comp)) }}" style="font-size:7px">{{ getCompStatus(comp) || '—' }}</span>
                </div>
              </div>
            </ng-container>
          </div>
        </div>

      </ng-container>

      <!-- ══════════ MISCELÁNEO ══════════ -->
      <ng-container *ngIf="item.tipo === 'MISCELANEO'">

        <div class="fi-section">
          <div class="fi-section-title"><mat-icon>category</mat-icon>Especificaciones</div>
          <div class="fi-spec-grid">
            <div *ngIf="item.tipoItem" class="fi-spec">
              <div class="fi-spec-key">Tipo</div>
              <span class="fi-badge"
                    [style.background]="item.tipoItem === 'CONSUMIBLE' ? '#1e3a8a' : item.tipoItem === 'MATERIAL' ? '#14532d' : '#e7e5e4'"
                    [style.color]="(item.tipoItem === 'CONSUMIBLE' || item.tipoItem === 'MATERIAL') ? '#fff' : '#57534e'"
                    style="margin-top:2px;font-size:8px">{{ item.tipoItem }}</span>
            </div>
            <div *ngIf="item.marca" class="fi-spec">
              <div class="fi-spec-key">Marca</div>
              <div class="fi-spec-val">{{ item.marca }}</div>
            </div>
            <div *ngIf="item.partNumber" class="fi-spec">
              <div class="fi-spec-key">Part N°</div>
              <div class="fi-spec-val mono">{{ item.partNumber }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Unidad</div>
              <div class="fi-spec-val">{{ item.unidad || '—' }}</div>
            </div>
            <div class="fi-spec">
              <div class="fi-spec-key">Ubicación</div>
              <div class="fi-spec-val">{{ item.ubicacion || '—' }}</div>
            </div>
          </div>
          <div *ngIf="item.descripcion" class="fi-notes" style="margin-top:8px">
            <div class="fi-notes-key">Notas</div>
            <p class="fi-notes-val">{{ item.descripcion }}</p>
          </div>
        </div>

        <div class="fi-section" style="flex:1">
          <div class="fi-section-title"><mat-icon>inventory_2</mat-icon>Stock</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">
            <div class="fi-stock-card">
              <div class="fi-spec-key" style="color:#d97706">Actual</div>
              <div class="fi-spec-val big"
                   [style.color]="item.stockActual === 0 ? '#dc2626' : stockBajo() ? '#ca8a04' : '#92400e'"
                   style="font-size:15px">
                {{ item.stockActual }}<span style="font-size:8px;font-weight:700;margin-left:2px">{{ item.unidad }}</span>
              </div>
            </div>
            <div *ngIf="(item.stockMinimo ?? 0) > 0" class="fi-spec">
              <div class="fi-spec-key">Mínimo</div>
              <div class="fi-spec-val" style="font-size:13px;color:#78716c">{{ item.stockMinimo }}</div>
            </div>
            <div *ngIf="(item.stockMaximo ?? 0) > 0" class="fi-spec">
              <div class="fi-spec-key">Máximo</div>
              <div class="fi-spec-val" style="font-size:13px;color:#78716c">{{ item.stockMaximo }}</div>
            </div>
          </div>
          <ng-container *ngIf="(item.stockMaximo ?? 0) > 0">
            <div style="height:6px;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:99px;overflow:hidden;margin-top:8px">
              <div style="height:100%;border-radius:99px;transition:width .3s"
                   [style.width.%]="(item.stockActual / item.stockMaximo!) * 100"
                   [style.background]="(item.stockActual / item.stockMaximo!) < 0.3 ? '#ef4444'
                                     : (item.stockActual / item.stockMaximo!) < 0.7 ? '#eab308' : '#22c55e'"></div>
            </div>
            <p style="font-size:9px;color:#a8a29e;text-align:right;margin:3px 0 0">
              {{ ((item.stockActual / item.stockMaximo!) * 100) | number:'1.0-0' }}%
            </p>
          </ng-container>
        </div>

      </ng-container>
    </div>

    <!-- ── COL DERECHA ── -->
    <div class="fi-col-right neo-scroll">
      <div class="fi-tabs">
        <span class="fi-tab active">
          {{ item.tipo === 'KIT' ? 'Historial préstamos' : 'Movimientos' }}
        </span>
      </div>

      <!-- Movimientos (HERR / MISC) -->
      <ng-container *ngIf="item.tipo !== 'KIT'">
        <div *ngIf="isLoadingDetail()" class="fi-empty" style="flex:1">
          <div style="width:16px;height:16px;border:2px solid #fbbf24;border-top-color:transparent;border-radius:50%" class="spin"></div>
        </div>
        <div *ngIf="!isLoadingDetail() && detailMovements().length === 0" class="fi-empty" style="flex:1">
          <mat-icon>history</mat-icon><span>Sin movimientos</span>
        </div>
        <div *ngFor="let mov of detailMovements(); let last = last" class="fi-tl-item">
          <div class="fi-tl-date">
            <span class="day">{{ getMovFechaDia(mov) }}</span>
            <span class="year">{{ getMovFechaAnio(mov) }}</span>
          </div>
          <div class="fi-tl-spine">
            <div class="fi-tl-bullet {{ getMovTipo(mov) === 'ENTRADA' ? 'entrada' : 'salida' }}"></div>
            <div *ngIf="!last" class="fi-tl-line"></div>
          </div>
          <div class="fi-tl-content">
            <span class="fi-tl-type {{ getMovTipo(mov) === 'ENTRADA' ? 'entrada' : 'salida' }}">{{ getMovTipo(mov) }}</span>
            <div class="fi-tl-desc">{{ getMovDescripcion(mov) }}</div>
            <div class="fi-tl-who">{{ getMovResponsable(mov) }}</div>
          </div>
        </div>
      </ng-container>

      <!-- Préstamos (KIT) -->
      <ng-container *ngIf="item.tipo === 'KIT'">
        <div *ngIf="isLoadingDetail()" class="fi-empty" style="flex:1">
          <div style="width:16px;height:16px;border:2px solid #fbbf24;border-top-color:transparent;border-radius:50%" class="spin"></div>
        </div>
        <div *ngIf="!isLoadingDetail() && detailLoans().length === 0" class="fi-empty" style="flex:1">
          <mat-icon>swap_horiz</mat-icon><span>Sin préstamos</span>
        </div>
        <div *ngFor="let loan of detailLoans(); let last = last" class="fi-tl-item">
          <div class="fi-tl-date">
            <span class="day">{{ formatDateShort(getLoanDate(loan)) }}</span>
            <span class="year">{{ formatYear(getLoanDate(loan)) }}</span>
          </div>
          <div class="fi-tl-spine">
            <div class="fi-tl-bullet" style="background:#818cf8;border-color:#3730a3"></div>
            <div *ngIf="!last" class="fi-tl-line"></div>
          </div>
          <div class="fi-tl-content">
            <span class="fi-tl-type" style="background:#eef2ff;color:#3730a3;border-color:#c7d2fe">PRÉSTAMO</span>
            <div class="fi-tl-desc">{{ getLoanWO(loan) }}</div>
            <div class="fi-tl-who">
              {{ getLoanBorrower(loan) }}
              <ng-container *ngIf="getLoanReturnDate(loan)">&nbsp;→&nbsp;Dev. {{ getLoanReturnDate(loan) }}</ng-container>
            </div>
          </div>
        </div>
      </ng-container>
    </div>

  </div><!-- /fi-body -->

  <!-- ══════ FOOTER ══════ -->
  <div class="fi-footer">
    <div class="fi-footer-meta">
      <mat-icon>schedule</mat-icon>
      <span>
        Registrado: {{ item.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}
        <ng-container *ngIf="item.ultimoMovimiento">
          &nbsp;·&nbsp; Últ. mov.: {{ item.ultimoMovimiento | date:'dd/MM/yyyy' }}
        </ng-container>
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="fi-footer-meta">
        <mat-icon>lock</mat-icon>
        <span>Solo lectura</span>
      </div>
      <button class="fi-close-btn" type="button" (click)="cerrar()">Cerrar</button>
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
