import { QueryList } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { CanDeactivateFn } from '@angular/router';

/**
 * Componente que puede tener datos sin guardar y quiere avisar antes de que el
 * usuario salga de la ruta (cambia de módulo principal en la barra lateral).
 */
export interface ConfirmarSalida {
    /** true = hay un formulario/lista en curso que se perdería al salir. */
    tieneCambiosPendientes(): boolean;
    /** Mensaje a mostrar en el confirm (opcional; hay uno por defecto). */
    mensajeSalida?(): string;
}

const MENSAJE_DEFECTO =
    'Hay datos sin guardar en este módulo. Si sales se perderán. ¿Deseas salir de todas formas?';

/**
 * Para los shells que abren submódulos con `NgComponentOutlet` (Movimientos,
 * Calibraciones, Inventario, Administración): recorre las instancias vivas de
 * las pestañas abiertas y les pregunta su propio `tieneCambiosPendientes()`.
 */
export function outletsTienenCambios(outlets: QueryList<NgComponentOutlet> | undefined | null): boolean {
    const list = outlets ? outlets.toArray() : [];
    for (const outlet of list) {
        const inst: any = (outlet as any)?.componentInstance;
        if (inst && typeof inst.tieneCambiosPendientes === 'function' && inst.tieneCambiosPendientes()) {
            return true;
        }
    }
    return false;
}

/**
 * Guarda de ruta: si el componente implementa `tieneCambiosPendientes()` y
 * devuelve true, pide confirmación antes de abandonar la ruta.
 */
export const pendingChangesGuard: CanDeactivateFn<Partial<ConfirmarSalida>> = (component) => {
    if (!component || typeof component.tieneCambiosPendientes !== 'function') {
        return true;
    }
    if (!component.tieneCambiosPendientes()) {
        return true;
    }
    const mensaje = typeof component.mensajeSalida === 'function'
        ? component.mensajeSalida()
        : MENSAJE_DEFECTO;
    return confirm(mensaje);
};
