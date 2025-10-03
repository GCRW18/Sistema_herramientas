# Sistema de Gestión de Herramientas Aeronáutico

## Estructura del Proyecto

### ✅ Completado

#### 1. Modelos y Tipos TypeScript (`src/app/core/models/`)
- **warehouse.types.ts**: Almacenes y ubicaciones
- **category.types.ts**: Categorías y subcategorías
- **tool.types.ts**: Herramientas con todos sus estados y condiciones
- **movement.types.ts**: Movimientos (entradas, salidas, traspasos, préstamos)
- **kit.types.ts**: Kits de herramientas
- **calibration.types.ts**: Calibración y mantenimiento
- **quarantine.types.ts**: Cuarentena y bajas
- **user.types.ts**: Usuarios, proveedores y clientes

#### 2. Servicios (`src/app/core/services/`)
- **warehouse.service.ts**: CRUD de almacenes y ubicaciones
- **category.service.ts**: CRUD de categorías y subcategorías
- **tool.service.ts**: Gestión de herramientas, búsqueda, filtros
- **movement.service.ts**: Gestión de movimientos, entradas, salidas
- **kit.service.ts**: Gestión de kits y asociación de herramientas
- **calibration.service.ts**: Calibración, mantenimiento y alertas
- **quarantine.service.ts**: Cuarentena y bajas
- **admin.service.ts**: Usuarios, proveedores y clientes

#### 3. Navegación
- **app.routes.ts**: Configurado con todas las rutas principales
- **navigation/data.ts**: Menú de navegación completo con todos los módulos

#### 4. Dashboard
- **dashboard.component.ts/html**: Panel principal con estadísticas
  - Total de herramientas
  - Herramientas disponibles
  - Herramientas en uso
  - Alertas críticas
  - Estado de calibración
  - Herramientas en cuarentena
  - Acciones rápidas

#### 5. Módulo de Inventario (Parcial)
- **tools-list.component**: Lista completa de herramientas con filtros
  - Filtros por categoría, almacén, estado
  - Tabla con paginación y ordenamiento
  - Acciones: Ver, Editar, Eliminar

### 🚧 Pendiente de Implementación

#### Módulo de Inventario
Los siguientes componentes necesitan ser creados en `src/app/modules/admin/inventory/`:

1. **Almacenes y Ubicaciones** (`warehouses/`)
   - `warehouses.component`: Lista de almacenes
   - `warehouse-form.component`: Formulario para crear/editar almacenes
   - `locations.component`: Gestión de ubicaciones dentro de almacenes

2. **Formulario de Herramientas** (`tools/tool-form/`)
   - `tool-form.component`: Formulario completo para registrar herramientas
     - Información básica (código, nombre, descripción)
     - Categorización
     - Especificaciones técnicas
     - Ubicación
     - Calibración
     - Información de compra
     - Imágenes y documentos

3. **Detalle de Herramienta** (`tools/tool-detail/`)
   - `tool-detail.component`: Vista detallada con:
     - Información completa
     - Historial de movimientos
     - Historial de calibración
     - Historial de mantenimiento
     - Documentos asociados

4. **Categorías** (`categories/`)
   - `categories.component`: Gestión de categorías y subcategorías

5. **Búsqueda Avanzada** (`search/`)
   - `search.component`: Búsqueda con múltiples filtros
   - Búsqueda por código de barras/QR

6. **Vista de Inventario** (`inventory-view/`)
   - `inventory-view.component`: Vista general del inventario
   - Reportes y estadísticas

#### Módulo de Movimientos
Crear en `src/app/modules/admin/movements/`:

1. **Entradas** (`entries/`)
   - `entries.component`: Lista de entradas
   - `entry-form.component`: Formulario de entrada
     - Por compra
     - Por devolución
     - Por ajuste
     - Retorno de calibración

2. **Salidas** (`exits/`)
   - `exits.component`: Lista de salidas
   - `exit-form.component`: Formulario de salida
     - Préstamo
     - Venta
     - Envío a calibración
     - Envío a mantenimiento

3. **Historial** (`history/`)
   - `history.component`: Historial completo de movimientos
   - Filtros por fecha, tipo, responsable

4. **Comprobantes** (`vouchers/`)
   - `vouchers.component`: Generación de comprobantes
   - Exportación a PDF

5. **Detalle de Movimiento** (`movement-detail/`)
   - `movement-detail.component`: Vista detallada del movimiento

#### Módulo de Kits
Crear en `src/app/modules/admin/kits/`:

1. **Lista de Kits** (`kits-list/`)
   - `kits-list.component`: Lista de kits con estado

2. **Formulario de Kit** (`kit-form/`)
   - `kit-form.component`: Crear/editar kit
   - Agregar/quitar herramientas
   - Definir herramientas obligatorias

3. **Detalle de Kit** (`kit-detail/`)
   - `kit-detail.component`: Vista completa del kit
   - Estado de cada herramienta

4. **Estado de Calibración** (`calibration-status/`)
   - `calibration-status.component`: Estado de calibración de todos los kits

#### Módulo de Calibración y Mantenimiento
Crear en `src/app/modules/admin/calibration/`:

1. **Enviar a Calibración** (`send-calibration/`)
   - `send-calibration.component`: Formulario de envío

2. **Recibir de Calibración** (`receive-calibration/`)
   - `receive-calibration.component`: Registro de retorno

3. **Seguimiento** (`calibration-tracking/`)
   - `calibration-tracking.component`: Lista de calibraciones en proceso

4. **Mantenimiento** (`maintenance/`)
   - `maintenance.component`: Gestión de mantenimientos

5. **Alertas** (`alerts/`)
   - `alerts.component`: Alertas de vencimiento de calibración

6. **Detalle** (`calibration-detail/`)
   - `calibration-detail.component`: Detalle de calibración/mantenimiento

#### Módulo de Gestión de Estado
Crear en `src/app/modules/admin/status-management/`:

1. **Cuarentena** (`quarantine/`)
   - `quarantine.component`: Lista de herramientas en cuarentena
   - `quarantine-form.component`: Registrar cuarentena
   - `quarantine-detail.component`: Detalle y resolución

2. **Bajas** (`decommission/`)
   - `decommission.component`: Lista de bajas
   - `decommission-form.component`: Registrar baja
   - `decommission-detail.component`: Detalle de baja

3. **Reportes** (`reports/`)
   - `reports.component`: Generación de reportes

#### Módulo de Administración
Crear en `src/app/modules/admin/administration/`:

1. **Usuarios** (`users/`)
   - `users.component`: Lista de usuarios
   - `user-form.component`: Crear/editar usuario
   - `user-detail.component`: Detalle de usuario

2. **Roles** (`roles/`)
   - `roles.component`: Gestión de roles y permisos

3. **Proveedores** (`suppliers/`)
   - `suppliers.component`: Lista de proveedores
   - `supplier-form.component`: Formulario de proveedor

4. **Clientes** (`customers/`)
   - `customers.component`: Lista de clientes
   - `customer-form.component`: Formulario de cliente

## Cómo Continuar el Desarrollo

### 1. Crear Componentes
Usar Angular CLI para generar componentes:

```bash
ng generate component modules/admin/inventory/warehouses --standalone
ng generate component modules/admin/inventory/tools/tool-form --standalone
ng generate component modules/admin/inventory/tools/tool-detail --standalone
# etc...
```

### 2. Patrón de Componentes
Seguir el patrón del `tools-list.component` existente:

- Importar módulos de Material necesarios
- Inyectar servicios correspondientes
- Implementar carga de datos en `ngOnInit`
- Usar tabla de Material con paginación y ordenamiento
- Implementar filtros cuando sea necesario
- Agregar acciones CRUD

### 3. Formularios Reactivos
Para formularios (tool-form, entry-form, etc.):

```typescript
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// En el componente
form: FormGroup;

constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
        code: ['', Validators.required],
        name: ['', Validators.required],
        // más campos...
    });
}
```

### 4. Mock API
Para desarrollo, crear servicios mock en `src/app/mock-api/`:

```typescript
// Ejemplo: src/app/mock-api/tools/api.ts
import { Injectable } from '@angular/core';
import { ErpMockApiService } from '@erp/lib/mock-api';
import { tools as toolsData } from './data';

@Injectable({ providedIn: 'root' })
export class ToolsMockApi {
    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        this._erpMockApiService
            .onGet('api/tools')
            .reply(() => [200, toolsData]);
    }
}
```

Registrar en `src/app/mock-api/index.ts`.

### 5. Validaciones y Permisos
Implementar guards para permisos basados en roles:

```typescript
// Ejemplo: warehouse-manager.guard.ts
canActivate(): boolean {
    const user = this.authService.currentUser;
    return user.role === 'admin' || user.role === 'warehouse_manager';
}
```

### 6. Componentes Compartidos
Crear componentes reutilizables en `src/app/shared/`:

- `tool-selector`: Selector de herramientas
- `warehouse-selector`: Selector de almacenes
- `category-selector`: Selector de categorías
- `status-badge`: Badge de estado
- `confirmation-dialog`: Diálogo de confirmación

### 7. Internacionalización
Agregar traducciones en `src/assets/i18n/`:

```json
{
    "tools": {
        "title": "Herramientas",
        "add": "Agregar Herramienta",
        "status": {
            "available": "Disponible",
            "in_use": "En Uso"
        }
    }
}
```

## Próximos Pasos Recomendados

1. ✅ **Implementar Mock API** para desarrollo sin backend
2. ✅ **Crear formulario de herramientas** (tool-form.component)
3. ✅ **Implementar gestión de almacenes**
4. ✅ **Desarrollar módulo de movimientos de entrada**
5. ✅ **Desarrollar módulo de movimientos de salida**
6. ✅ **Implementar gestión de kits**
7. ✅ **Desarrollar módulo de calibración**
8. ✅ **Implementar gestión de cuarentena y bajas**
9. ✅ **Desarrollar módulo de administración**
10. ✅ **Agregar reportes y exportación**

## Recursos

- **Angular Material**: https://material.angular.io/
- **Iconos Heroicons**: https://heroicons.com/

## Comandos Útiles

```bash
# Iniciar servidor de desarrollo
npm start

# Compilar para producción
npm run build

# Ejecutar tests
npm test

# Generar componente
ng g c modules/admin/[module]/[component] --standalone

# Generar servicio
ng g s core/services/[service-name]

# Generar modelo/interfaz
ng g interface core/models/[model-name]
```
