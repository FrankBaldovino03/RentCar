# AutoRent Pro - Frontend del Sistema de Alquiler de Vehículos
**Proyecto Académico:** Sistema de Base de Datos para una Plataforma de Alquiler de Vehículos  
**Institución:** Corporación Unificada de Educación Superior – CUN (Sincelejo - Sucre, 2026)  
**Tecnologías Utilizadas:** HTML5 semántico, CSS3 moderno (Vanilla Design System) y JavaScript (ES6+).

---

## 🚀 Cómo Ejecutar la Aplicación

No requiere instalaciones complejas ni dependencias pesadas de Node.js.

### Opción 1: Abrir directamente en el navegador
1. Ve a la carpeta `frontend/`.
2. Haz doble clic sobre [index.html](file:///d:/Documentos/Alquiler_Vehiculos/frontend/index.html) para abrirlo en Chrome, Edge, Firefox u otro navegador.

### Opción 2: Usando un servidor local (Recomendado)
Desde PowerShell o terminal en esta carpeta:
```bash
python -m http.server 8080 --directory "d:\Documentos\Alquiler_Vehiculos\frontend"
```
Luego abre en tu navegador: `http://localhost:8080`

---

## 📁 Estructura del Proyecto

```
d:/Documentos/Alquiler_Vehiculos/frontend/
├── index.html            # SPA con estructura modular, vistas, paneles y diálogos modales
├── css/
│   └── style.css         # Sistema de diseño moderno, variables CSS, layout responsive y animaciones
├── js/
│   ├── data.js           # Semillas normalizadas (3FN) con los datos del documento de la CUN
│   ├── store.js          # Capa de persistencia (localStorage), triggers T-SQL y validador antisolapamiento
│   └── app.js            # Controlador central, rutas, renderizado dinámico, KPIs y eventos
└── README.md             # Esta documentación técnica
```

---

## 🧩 Mapeo de las 10 Entidades del Proyecto

El frontend modela e implementa de manera completa las 10 tablas normalizadas en Tercera Forma Normal (3FN):

1. **`vehiculo`**: Placa, marca, tipo, modelo, año, color, estado (`Disponible`, `Reservado`, `Alquilado`, `En mantenimiento`, `Inactivo`), kilometraje y tarifa diaria. Diseñado con soporte conceptual para *System-Versioned Temporal Tables*.
2. **`cliente`**: Cédula/Identificación única, nombres, apellidos, teléfono, correo electrónico único y dirección.
3. **`empleado`**: Identificador, nombre, teléfono, correo, cargo (`Asesor`, `Administrador`, `Mecánico`, `Supervisor`) y estado.
4. **`reserva`**: Control de fechas de inicio y fin, asignación de vehículo y cliente, cálculo de días estimados.
5. **`alquiler`**: Contrato de entrega en vía, asesor responsable, kilometraje de salida (`km_inicio`), kilometraje de retorno (`km_fin`), saldo y estado.
6. **`pago`**: Recaudos, recibos, montos, número de comprobante/referencia y estado.
7. **`mantenimiento`**: Órdenes de trabajo preventivo y correctivo, costos, mecánico asignado y estado.
8. **`marca`**: Catálogo base normalizado (Toyota, Kia, Chevrolet, Mazda, Renault).
9. **`tipo_vehiculo`**: Clasificación de la flota (Sedan, SUV, Camioneta 4x4).
10. **`metodo_pago`**: Medios financieros admitidos (Tarjeta de Crédito/Débito, Transferencia PSE/Bancolombia, Efectivo en Caja).

---

## ⚡ Reglas de Negocio Implementadas

### 1. Control Transaccional y Algoritmo Antisolapamiento de Fechas (`sp_RegistrarReserva`)
El sistema valida en tiempo real la condición lógica:
$$\text{Colisión} = (F_{\text{inicio\_solicitada}} < F_{\text{fin\_existente}}) \land (F_{\text{fin\_solicitada}} > F_{\text{inicio\_existente}})$$
- Comprueba si el vehículo ya cuenta con una reserva activa o contrato de alquiler vigente en ese lapso.
- Notifica al usuario de forma inmediata en la interfaz con avisos visuales (verde si está libre, rojo si hay conflicto de colisión).

### 2. Autómata de Estados Automatizado mediante Triggers T-SQL (`trg_ActualizarEstadoVehiculo_Alquiler`)
- **Entrega de Vehículo (Alquiler Activo):** El vehículo pasa automáticamente a estado **`Alquilado`**.
- **Cierre de Contrato de Alquiler:** Al registrar el kilometraje final (`km_fin`), el vehículo actualiza su odómetro y conmuta automáticamente a **`Disponible`**.
- **Orden de Mantenimiento:** Al ingresar a mantenimiento correctivo o preventivo (`En Proceso`), el activo cambia a **`En mantenimiento`**. Al finalizarse la orden, se restaura a **`Disponible`**.

---

## 🎨 Características de Diseño
- **Tipografía moderna:** Google Fonts (*Plus Jakarta Sans* y *JetBrains Mono*).
- **Iconografía dinámica:** Lucide Icons.
- **Micro-interacciones:** Transiciones fluidas, badges con colores semánticos por estado, efectos de hover y feedback mediante notificaciones Toast.
- **Diseño Responsive:** Adaptado a pantallas de escritorio, tablets y dispositivos móviles con menú lateral deslizable.
