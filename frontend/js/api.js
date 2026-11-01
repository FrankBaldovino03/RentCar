/**
 * AutoRent Pro - API Client
 * Conecta el frontend con el backend Flask RESTful (MySQL en VirtualBox)
 * Incluye respaldo inteligente en localStorage (Modo Demo / Cloud) cuando se abre desde GitHub Pages
 */

const API_BASE = (function() {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5000';
    }
    const host = (window.location.hostname || '').toLowerCase();
    // Si corre en GitHub Pages u otro dominio externo, apunta al backend local de Flask si está encendido
    if (host.includes('github.io') || (window.location.port && window.location.port !== '5000')) {
        return 'http://localhost:5000';
    }
    return '';
})();

/* ==========================================================================
   BASE DE DATOS LOCAL DE RESPALDO (PARA GITHUB PAGES / DEMO SIN BACKEND)
   ========================================================================== */
const MockDB = {
    STORAGE_KEY: 'autorent_pro_mock_db_v1',

    getInitialData() {
        return {
            usuarios: [
                {
                    id_usuario: 1,
                    id_empleado: 1,
                    usuario: 'admin',
                    password: 'admin',
                    estado: 'Activo',
                    nombre: 'Franklin',
                    apellido: 'Baldovino',
                    correo: 'baldovinofranklin0406@gmail.com',
                    telefono: '3001234567',
                    cargo: 'Administrador General'
                },
                {
                    id_usuario: 2,
                    id_empleado: 1,
                    usuario: 'frankbaldovino03',
                    password: 'frankbaldovino03',
                    estado: 'Activo',
                    nombre: 'Franklin',
                    apellido: 'Baldovino',
                    correo: 'baldovinofranklin0406@gmail.com',
                    telefono: '3001234567',
                    cargo: 'Administrador General'
                }
            ],
            marcas: [
                { id_marca: 1, nombre: 'Toyota' },
                { id_marca: 2, nombre: 'Mazda' },
                { id_marca: 3, nombre: 'Chevrolet' },
                { id_marca: 4, nombre: 'Renault' },
                { id_marca: 5, nombre: 'Kia' },
                { id_marca: 6, nombre: 'Nissan' }
            ],
            tipos_vehiculo: [
                { id_tipo_vehiculo: 1, nombre: 'Sedán', descripcion: 'Automóvil ejecutivo de 4 puertas' },
                { id_tipo_vehiculo: 2, nombre: 'SUV / Camioneta', descripcion: 'Camioneta familiar y todoterreno' },
                { id_tipo_vehiculo: 3, nombre: 'Hatchback', descripcion: 'Compacto urbano económico' },
                { id_tipo_vehiculo: 4, nombre: 'Pick-Up', descripcion: 'Camioneta de platón y carga' }
            ],
            metodos_pago: [
                { id_metodo_pago: 1, nombre: 'Efectivo', descripcion: 'Pago en caja principal' },
                { id_metodo_pago: 2, nombre: 'Transferencia Bancaria', descripcion: 'Bancolombia / Nequi / PSE' },
                { id_metodo_pago: 3, nombre: 'Tarjeta de Crédito', descripcion: 'Datáfono Visa / MasterCard' },
                { id_metodo_pago: 4, nombre: 'Tarjeta Débito', descripcion: 'Datáfono ahorro / corriente' }
            ],
            vehiculos: [
                { id_vehiculo: 1, id_marca: 1, marca_nombre: 'Toyota', id_tipo_vehiculo: 2, tipo_nombre: 'SUV / Camioneta', placa: 'KLM-452', modelo: 'Corolla Cross XEI', año: 2024, color: 'Blanco Perlado', kilometraje: 14200, estado: 'Disponible' },
                { id_vehiculo: 2, id_marca: 2, marca_nombre: 'Mazda', id_tipo_vehiculo: 1, tipo_nombre: 'Sedán', placa: 'JHT-891', modelo: 'Mazda 3 Touring', año: 2023, color: 'Gris Máquina', kilometraje: 28500, estado: 'Alquilado' },
                { id_vehiculo: 3, id_marca: 4, marca_nombre: 'Renault', id_tipo_vehiculo: 2, tipo_nombre: 'SUV / Camioneta', placa: 'FTR-104', modelo: 'Duster Iconic 4x4', año: 2024, color: 'Plata', kilometraje: 9800, estado: 'Disponible' },
                { id_vehiculo: 4, id_marca: 3, marca_nombre: 'Chevrolet', id_tipo_vehiculo: 3, tipo_nombre: 'Hatchback', placa: 'MNP-330', modelo: 'Onix Turbo RS', año: 2023, color: 'Rojo', kilometraje: 31400, estado: 'Reservado' },
                { id_vehiculo: 5, id_marca: 6, marca_nombre: 'Nissan', id_tipo_vehiculo: 4, tipo_nombre: 'Pick-Up', placa: 'wert-908'.toUpperCase(), modelo: 'Frontier Pro-4X', año: 2022, color: 'Negro', kilometraje: 54000, estado: 'En mantenimiento' },
                { id_vehiculo: 6, id_marca: 5, marca_nombre: 'Kia', id_tipo_vehiculo: 1, tipo_nombre: 'Sedán', placa: 'BVC-712', modelo: 'K3 Cross GT-Line', año: 2025, color: 'Azul', kilometraje: 3200, estado: 'Disponible' }
            ],
            clientes: [
                { id_cliente: 1, identificacion: '1045678901', nombre: 'Carlos', apellido: 'Mendoza', telefono: '3104567890', correo: 'cmendoza@correo.com', direccion: 'Cra 45 # 72-18', fecha_registro: '2026-10-15' },
                { id_cliente: 2, identificacion: '1098234567', nombre: 'Laura', apellido: 'Gómez', telefono: '3157894561', correo: 'laura.gomez@empresa.co', direccion: 'Calle 84 # 51B-30', fecha_registro: '2026-10-18' },
                { id_cliente: 3, identificacion: '72345890', nombre: 'Andrés', apellido: 'Villalba', telefono: '3012349876', correo: 'avillalba@gmail.com', direccion: 'Av. Circunvalar # 12-40', fecha_registro: '2026-10-22' },
                { id_cliente: 4, identificacion: '1140892341', nombre: 'Valentina', apellido: 'Ríos', telefono: '3206541239', correo: 'vrios@hotmail.com', direccion: 'Calle 93 # 46-10', fecha_registro: '2026-10-28' }
            ],
            empleados: [
                { id_empleado: 1, nombre: 'Franklin', apellido: 'Baldovino', telefono: '3001234567', correo: 'baldovinofranklin0406@gmail.com', cargo: 'Administrador General', fecha_ingreso: '2025-01-10', estado: 'Activo' },
                { id_empleado: 2, nombre: 'Mateo', apellido: 'Suárez', telefono: '3112223344', correo: 'msuarez@autorent.co', cargo: 'Asesor Comercial', fecha_ingreso: '2025-03-15', estado: 'Activo' },
                { id_empleado: 3, nombre: 'Jorge', apellido: 'Pineda', telefono: '3189998877', correo: 'jpineda@autorent.co', cargo: 'Mecánico Jefe', fecha_ingreso: '2025-05-01', estado: 'Activo' }
            ],
            reservas: [
                { id_reserva: 1, id_cliente: 2, id_vehiculo: 4, fecha_reserva: '2026-10-29', fecha_inicio: '2026-11-03', estado: 'Confirmada', observaciones: 'Entrega en aeropuerto a las 10:00 AM' },
                { id_reserva: 2, id_cliente: 4, id_vehiculo: 1, fecha_reserva: '2026-10-31', fecha_inicio: '2026-11-05', estado: 'Pendiente', observaciones: 'Solicita silla para bebé adicional' }
            ],
            alquileres: [
                { id_alquiler: 1, id_cliente: 1, id_vehiculo: 2, id_empleado: 1, fecha_inicio: '2026-10-28', km_inicio: 28100, km_fin: null, estado: 'Activo', observaciones: 'Tanque lleno, sin rayones' },
                { id_alquiler: 2, id_cliente: 3, id_vehiculo: 3, id_empleado: 2, fecha_inicio: '2026-10-20', km_inicio: 9200, km_fin: 9800, estado: 'Finalizado', observaciones: 'Retornado en excelente estado' }
            ],
            pagos: [
                { id_pago: 1, id_alquiler: 1, id_metodo_pago: 2, fecha_pago: '2026-10-28', monto: 650000, estado: 'Completado', referencia: 'TRX-984120' },
                { id_pago: 2, id_alquiler: 2, id_metodo_pago: 3, fecha_pago: '2026-10-20', monto: 480000, estado: 'Completado', referencia: 'POS-552310' }
            ],
            mantenimientos: [
                { id_mantenimiento: 1, id_vehiculo: 5, id_empleado: 3, fecha_mantenimiento: '2026-10-30', descripcion: 'Cambio de aceite sintético, filtros y alineación 4x4', costo: 320000, estado: 'En proceso' }
            ]
        };
    },

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        const init = this.getInitialData();
        this.save(init);
        return init;
    },

    save(db) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(db));
        } catch (e) {}
    },

    enrich(db) {
        const marcasMap = Object.fromEntries(db.marcas.map(m => [m.id_marca, m.nombre]));
        const tiposMap = Object.fromEntries(db.tipos_vehiculo.map(t => [t.id_tipo_vehiculo, t.nombre]));
        const clientesMap = Object.fromEntries(db.clientes.map(c => [c.id_cliente, c]));
        const empleadosMap = Object.fromEntries(db.empleados.map(e => [e.id_empleado, e]));
        const metodosMap = Object.fromEntries(db.metodos_pago.map(m => [m.id_metodo_pago, m.nombre]));

        db.vehiculos.forEach(v => {
            v.marca_nombre = v.marca_nombre || marcasMap[v.id_marca] || 'General';
            v.tipo_nombre = v.tipo_nombre || tiposMap[v.id_tipo_vehiculo] || 'Sedán';
        });
        const vehiculosMap = Object.fromEntries(db.vehiculos.map(v => [v.id_vehiculo, v]));

        db.reservas.forEach(r => {
            const c = clientesMap[r.id_cliente] || {};
            const v = vehiculosMap[r.id_vehiculo] || {};
            r.cliente_nombre = `${c.nombre || ''} ${c.apellido || ''}`.trim() || 'Cliente';
            r.cliente_identificacion = c.identificacion || '';
            r.vehiculo_placa = v.placa || 'N/A';
            r.vehiculo_detalle = `${v.marca_nombre || ''} ${v.modelo || ''}`.trim();
        });

        db.alquileres.forEach(a => {
            const c = clientesMap[a.id_cliente] || {};
            const e = empleadosMap[a.id_empleado] || {};
            const v = vehiculosMap[a.id_vehiculo] || {};
            const pago = [...db.pagos].reverse().find(p => Number(p.id_alquiler) === Number(a.id_alquiler));
            a.cliente_nombre = `${c.nombre || ''} ${c.apellido || ''}`.trim() || 'Cliente';
            a.empleado_nombre = `${e.nombre || ''} ${e.apellido || ''}`.trim() || 'Asesor';
            a.vehiculo_placa = v.placa || 'N/A';
            a.vehiculo_detalle = `${v.marca_nombre || ''} ${v.modelo || ''}`.trim();
            a.pago_estado = pago ? pago.estado : null;
            a.pago_monto = pago ? pago.monto : null;
        });

        const alquileresMap = Object.fromEntries(db.alquileres.map(a => [a.id_alquiler, a]));
        db.pagos.forEach(p => {
            const alq = alquileresMap[p.id_alquiler] || {};
            p.metodo_nombre = metodosMap[p.id_metodo_pago] || 'Efectivo';
            p.cliente_nombre = alq.cliente_nombre || 'Cliente';
            p.vehiculo_placa = alq.vehiculo_placa || 'N/A';
        });

        db.mantenimientos.forEach(m => {
            const e = empleadosMap[m.id_empleado] || {};
            const v = vehiculosMap[m.id_vehiculo] || {};
            m.empleado_nombre = `${e.nombre || ''} ${e.apellido || ''}`.trim() || 'Mecánico';
            m.vehiculo_placa = v.placa || 'N/A';
            m.vehiculo_detalle = `${v.marca_nombre || ''} ${v.modelo || ''}`.trim();
        });

        return db;
    },

    handle(endpoint, method = 'GET', body = null) {
        const db = this.enrich(this.load());
        const [rawPath, queryStr] = endpoint.split('?');
        const params = new URLSearchParams(queryStr || '');

        if (rawPath === '/api/health') {
            return {
                status: 'online',
                message: 'Modo Cloud / Demo Activo (GitHub Pages)',
                database: 'alquiler_vehiculos',
                version: '8.0.36-Cloud'
            };
        }

        if (rawPath === '/api/auth/login' && method === 'POST') {
            const uInput = (body.usuario || '').trim().toLowerCase();
            const pInput = body.password || '';
            let found = db.usuarios.find(u => u.usuario.toLowerCase() === uInput || (u.correo && u.correo.toLowerCase() === uInput));

            // Si en modo demo escribe cualquier usuario administrador válido o las credenciales por defecto
            if (!found && uInput) {
                found = {
                    id_usuario: 1,
                    id_empleado: 1,
                    usuario: body.usuario.trim(),
                    nombre: 'Franklin',
                    apellido: 'Baldovino',
                    correo: 'baldovinofranklin0406@gmail.com',
                    telefono: '3001234567',
                    cargo: 'Administrador General'
                };
            }

            return {
                status: 'success',
                message: `¡Bienvenido(a), ${found.nombre} ${found.apellido}!`,
                user: {
                    id_usuario: found.id_usuario,
                    id_empleado: found.id_empleado,
                    usuario: found.usuario,
                    nombre: found.nombre,
                    apellido: found.apellido,
                    nombre_completo: `${found.nombre} ${found.apellido}`,
                    correo: found.correo,
                    telefono: found.telefono || '3001234567',
                    cargo: found.cargo || 'Administrador'
                }
            };
        }

        if (rawPath.startsWith('/api/auth/perfil/')) {
            const idU = parseInt(rawPath.split('/').pop(), 10) || 1;
            let u = db.usuarios.find(x => x.id_usuario === idU) || db.usuarios[0];
            if (method === 'PUT' && body) {
                Object.assign(u, {
                    nombre: body.nombre || u.nombre,
                    apellido: body.apellido || u.apellido,
                    correo: body.correo || u.correo,
                    telefono: body.telefono || u.telefono,
                    usuario: body.usuario || u.usuario
                });
                this.save(db);
                return {
                    message: 'Perfil actualizado exitosamente',
                    user: {
                        ...u,
                        nombre_completo: `${u.nombre} ${u.apellido}`.trim()
                    }
                };
            }
            return u;
        }

        if (rawPath === '/api/dashboard') {
            const v = db.vehiculos;
            const r = db.reservas;
            const a = db.alquileres;
            const p = db.pagos;
            const m = db.mantenimientos;
            return {
                conteos: {
                    vehiculo: v.length,
                    cliente: db.clientes.length,
                    empleado: db.empleados.length,
                    reserva: r.length,
                    alquiler: a.length,
                    pago: p.length,
                    mantenimiento: m.length
                },
                kpis: {
                    total_vehiculos: v.length,
                    disponibles: v.filter(x => (x.estado || '').toLowerCase() === 'disponible').length,
                    reservados: v.filter(x => (x.estado || '').toLowerCase() === 'reservado').length,
                    alquilados: v.filter(x => (x.estado || '').toLowerCase() === 'alquilado').length,
                    en_mantenimiento: v.filter(x => (x.estado || '').toLowerCase().includes('mantenimiento')).length,
                    alquileres_activos: a.filter(x => (x.estado || '').toLowerCase() === 'activo').length,
                    total_reservas: r.length,
                    reservas_pendientes: r.filter(x => (x.estado || '').toLowerCase() === 'pendiente').length,
                    reservas_confirmadas: r.filter(x => (x.estado || '').toLowerCase() === 'confirmada').length,
                    reservas_finalizadas: r.filter(x => (x.estado || '').toLowerCase() === 'finalizada').length,
                    reservas_canceladas: r.filter(x => (x.estado || '').toLowerCase() === 'cancelada').length,
                    reservas_rechazadas: r.filter(x => (x.estado || '').toLowerCase() === 'rechazada').length,
                    total_recaudo: p.reduce((acc, item) => acc + (Number(item.monto) || 0), 0),
                    mantenimientos_pendientes: m.filter(x => (x.estado || '').toLowerCase() !== 'completado').length
                },
                ultimos_alquileres: [...a].reverse().slice(0, 5),
                ultimas_reservas: [...r].reverse().slice(0, 5)
            };
        }

        // Catálogos
        if (rawPath === '/api/marcas') return db.marcas;
        if (rawPath === '/api/tipos_vehiculo') return db.tipos_vehiculo;
        if (rawPath === '/api/metodos_pago') return db.metodos_pago;

        // Vehículos
        if (rawPath === '/api/vehiculos') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                const est = (params.get('estado') || '').toLowerCase();
                return db.vehiculos.filter(v => {
                    const matchEst = !est || (v.estado || '').toLowerCase() === est;
                    const matchS = !s || v.placa.toLowerCase().includes(s) || v.modelo.toLowerCase().includes(s) || (v.marca_nombre || '').toLowerCase().includes(s);
                    return matchEst && matchS;
                });
            }
            if (method === 'POST') {
                const newId = db.vehiculos.reduce((max, x) => Math.max(max, x.id_vehiculo), 0) + 1;
                const nuevo = { id_vehiculo: newId, ...body };
                db.vehiculos.push(nuevo);
                this.save(db);
                return { message: 'Vehículo registrado exitosamente', id_vehiculo: newId };
            }
        }
        if (rawPath.startsWith('/api/vehiculos/')) {
            const id = parseInt(rawPath.split('/').pop(), 10);
            if (method === 'PUT') {
                const idx = db.vehiculos.findIndex(x => x.id_vehiculo === id);
                if (idx !== -1) Object.assign(db.vehiculos[idx], body);
                this.save(db);
                return { message: `Vehículo #${id} actualizado correctamente` };
            }
            if (method === 'DELETE') {
                db.vehiculos = db.vehiculos.filter(x => x.id_vehiculo !== id);
                this.save(db);
                return { message: `Vehículo #${id} eliminado` };
            }
        }

        // Clientes
        if (rawPath === '/api/clientes') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                return db.clientes.filter(c => !s || c.nombre.toLowerCase().includes(s) || c.apellido.toLowerCase().includes(s) || c.identificacion.includes(s));
            }
            if (method === 'POST') {
                const newId = db.clientes.reduce((max, x) => Math.max(max, x.id_cliente), 0) + 1;
                db.clientes.push({ id_cliente: newId, fecha_registro: new Date().toISOString().slice(0, 10), ...body });
                this.save(db);
                return { message: 'Cliente registrado exitosamente', id_cliente: newId };
            }
        }
        if (rawPath.startsWith('/api/clientes/')) {
            const id = parseInt(rawPath.split('/').pop(), 10);
            if (method === 'PUT') {
                const idx = db.clientes.findIndex(x => x.id_cliente === id);
                if (idx !== -1) Object.assign(db.clientes[idx], body);
                this.save(db);
                return { message: `Cliente #${id} actualizado` };
            }
            if (method === 'DELETE') {
                db.clientes = db.clientes.filter(x => x.id_cliente !== id);
                this.save(db);
                return { message: `Cliente #${id} eliminado` };
            }
        }

        // Empleados
        if (rawPath === '/api/empleados') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                return db.empleados.filter(e => !s || e.nombre.toLowerCase().includes(s) || e.apellido.toLowerCase().includes(s) || (e.cargo || '').toLowerCase().includes(s));
            }
            if (method === 'POST') {
                const newId = db.empleados.reduce((max, x) => Math.max(max, x.id_empleado), 0) + 1;
                db.empleados.push({ id_empleado: newId, fecha_ingreso: new Date().toISOString().slice(0, 10), ...body });
                this.save(db);
                return { message: 'Empleado guardado', id_empleado: newId };
            }
        }
        if (rawPath.startsWith('/api/empleados/')) {
            const id = parseInt(rawPath.split('/').pop(), 10);
            if (method === 'PUT') {
                const idx = db.empleados.findIndex(x => x.id_empleado === id);
                if (idx !== -1) Object.assign(db.empleados[idx], body);
                this.save(db);
                return { message: `Empleado #${id} actualizado` };
            }
            if (method === 'DELETE') {
                db.empleados = db.empleados.filter(x => x.id_empleado !== id);
                this.save(db);
                return { message: `Empleado #${id} eliminado` };
            }
        }

        // Reservas
        if (rawPath === '/api/reservas') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                const est = (params.get('estado') || '').toLowerCase();
                return db.reservas.filter(r => {
                    const matchEst = !est || (r.estado || '').toLowerCase() === est;
                    const matchS = !s || (r.cliente_nombre || '').toLowerCase().includes(s) || (r.vehiculo_placa || '').toLowerCase().includes(s);
                    return matchEst && matchS;
                });
            }
            if (method === 'POST') {
                const newId = db.reservas.reduce((max, x) => Math.max(max, x.id_reserva), 0) + 1;
                db.reservas.push({ id_reserva: newId, fecha_reserva: new Date().toISOString().slice(0, 10), ...body });
                this.save(db);
                return { message: 'Reserva confirmada exitosamente', id_reserva: newId };
            }
        }
        if (rawPath.startsWith('/api/reservas/')) {
            const parts = rawPath.split('/');
            const isEstado = parts[parts.length - 1] === 'estado';
            const id = parseInt(isEstado ? parts[parts.length - 2] : parts[parts.length - 1], 10);
            const idx = db.reservas.findIndex(x => x.id_reserva === id);
            if (method === 'PUT' && idx !== -1) {
                Object.assign(db.reservas[idx], body);
                this.save(db);
                return { message: `Reserva #${id} actualizada` };
            }
            if (method === 'DELETE') {
                db.reservas = db.reservas.filter(x => x.id_reserva !== id);
                this.save(db);
                return { message: `Reserva #${id} eliminada` };
            }
        }

        // Alquileres
        if (rawPath === '/api/alquileres') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                const est = (params.get('estado') || '').toLowerCase();
                return db.alquileres.filter(a => {
                    const matchEst = !est || (a.estado || '').toLowerCase() === est;
                    const matchS = !s || (a.cliente_nombre || '').toLowerCase().includes(s) || (a.vehiculo_placa || '').toLowerCase().includes(s) || String(a.id_alquiler).includes(s);
                    return matchEst && matchS;
                });
            }
            if (method === 'POST') {
                const newId = db.alquileres.reduce((max, x) => Math.max(max, x.id_alquiler), 0) + 1;
                db.alquileres.push({ id_alquiler: newId, km_fin: null, estado: 'Activo', ...body });
                const v = db.vehiculos.find(x => Number(x.id_vehiculo) === Number(body.id_vehiculo));
                if (v && (body.estado || 'Activo') === 'Activo') v.estado = 'Alquilado';
                this.save(db);
                return { message: 'Contrato de alquiler iniciado.', id_alquiler: newId };
            }
        }
        if (rawPath.startsWith('/api/alquileres/')) {
            const parts = rawPath.split('/');
            const action = parts[parts.length - 1];
            const id = parseInt((action === 'estado' || action === 'cerrar') ? parts[parts.length - 2] : action, 10);
            const idx = db.alquileres.findIndex(x => x.id_alquiler === id);
            if ((method === 'PUT' || method === 'POST') && idx !== -1) {
                if (action === 'cerrar') {
                    db.alquileres[idx].estado = 'Finalizado';
                    db.alquileres[idx].km_fin = body.km_fin;
                    const v = db.vehiculos.find(x => Number(x.id_vehiculo) === Number(db.alquileres[idx].id_vehiculo));
                    if (v) {
                        v.estado = 'Disponible';
                        if (body.km_fin) v.kilometraje = Math.max(v.kilometraje || 0, Number(body.km_fin));
                    }
                } else {
                    Object.assign(db.alquileres[idx], body);
                }
                this.save(db);
                return { message: `Contrato #${id} actualizado` };
            }
            if (method === 'DELETE') {
                db.alquileres = db.alquileres.filter(x => x.id_alquiler !== id);
                this.save(db);
                return { message: `Contrato #${id} eliminado` };
            }
        }

        // Pagos
        if (rawPath === '/api/pagos') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                const est = (params.get('estado') || '').toLowerCase();
                return db.pagos.filter(p => {
                    const matchEst = !est || (p.estado || '').toLowerCase() === est;
                    const matchS = !s || (p.cliente_nombre || '').toLowerCase().includes(s) || (p.referencia || '').toLowerCase().includes(s) || String(p.id_alquiler).includes(s);
                    return matchEst && matchS;
                });
            }
            if (method === 'POST') {
                const newId = db.pagos.reduce((max, x) => Math.max(max, x.id_pago), 0) + 1;
                db.pagos.push({ id_pago: newId, fecha_pago: new Date().toISOString().slice(0, 10), ...body });
                this.save(db);
                return { message: 'Pago registrado con éxito', id_pago: newId };
            }
        }
        if (rawPath.startsWith('/api/pagos/')) {
            const parts = rawPath.split('/');
            const isEstado = parts[parts.length - 1] === 'estado';
            const id = parseInt(isEstado ? parts[parts.length - 2] : parts[parts.length - 1], 10);
            const idx = db.pagos.findIndex(x => x.id_pago === id);
            if (method === 'PUT' && idx !== -1) {
                Object.assign(db.pagos[idx], body);
                this.save(db);
                return { status: 'success', message: `Pago #${id} actualizado` };
            }
            if (method === 'DELETE') {
                db.pagos = db.pagos.filter(x => x.id_pago !== id);
                this.save(db);
                return { message: `Pago #${id} eliminado` };
            }
        }

        // Mantenimientos
        if (rawPath === '/api/mantenimientos') {
            if (method === 'GET') {
                const s = (params.get('search') || '').toLowerCase();
                const est = (params.get('estado') || '').toLowerCase();
                return db.mantenimientos.filter(m => {
                    const matchEst = !est || (m.estado || '').toLowerCase() === est;
                    const matchS = !s || (m.vehiculo_placa || '').toLowerCase().includes(s) || (m.descripcion || '').toLowerCase().includes(s);
                    return matchEst && matchS;
                });
            }
            if (method === 'POST') {
                const newId = db.mantenimientos.reduce((max, x) => Math.max(max, x.id_mantenimiento), 0) + 1;
                db.mantenimientos.push({ id_mantenimiento: newId, ...body });
                this.save(db);
                return { message: 'Mantenimiento registrado', id_mantenimiento: newId };
            }
        }
        if (rawPath.startsWith('/api/mantenimientos/')) {
            const parts = rawPath.split('/');
            const isComp = parts[parts.length - 1] === 'completar';
            const id = parseInt(isComp ? parts[parts.length - 2] : parts[parts.length - 1], 10);
            const idx = db.mantenimientos.findIndex(x => x.id_mantenimiento === id);
            if ((method === 'PUT' || method === 'POST') && idx !== -1) {
                if (isComp) {
                    db.mantenimientos[idx].estado = 'Completado';
                    if (body && body.costo) db.mantenimientos[idx].costo = body.costo;
                    const v = db.vehiculos.find(x => Number(x.id_vehiculo) === Number(db.mantenimientos[idx].id_vehiculo));
                    if (v) v.estado = 'Disponible';
                } else {
                    Object.assign(db.mantenimientos[idx], body);
                }
                this.save(db);
                return { message: `Mantenimiento #${id} actualizado` };
            }
            if (method === 'DELETE') {
                db.mantenimientos = db.mantenimientos.filter(x => x.id_mantenimiento !== id);
                this.save(db);
                return { message: `Mantenimiento #${id} eliminado` };
            }
        }

        return { status: 'success', message: 'Operación procesada' };
    }
};

const Api = {
    baseUrl: API_BASE,

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json') 
                ? await response.json() 
                : await response.text();

            if (!response.ok) {
                // Si estamos en GitHub Pages y devuelve 404/405 por no haber backend, usar respaldo MockDB
                if (response.status === 404 || response.status === 405) {
                    const parsedBody = options.body ? JSON.parse(options.body) : null;
                    return MockDB.handle(endpoint, options.method || 'GET', parsedBody);
                }
                const message = (data && data.error) ? data.error : (data.message || `Error HTTP ${response.status}`);
                throw new Error(message);
            }

            return data;
        } catch (error) {
            // Si el backend Flask local no está encendido (Failed to fetch / NetworkError), usar respaldo MockDB automáticamente
            if (error instanceof TypeError || (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Load failed')))) {
                const parsedBody = options.body ? JSON.parse(options.body) : null;
                return MockDB.handle(endpoint, options.method || 'GET', parsedBody);
            }
            console.error(`[API Error] ${config.method || 'GET'} ${url}:`, error);
            throw error;
        }
    },

    get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    },

    post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // 1. Health check & Autenticación
    health() {
        return this.get('/api/health');
    },

    login(usuario, password) {
        return this.post('/api/auth/login', { usuario, password });
    },

    getPerfil(idUsuario) {
        return this.get(`/api/auth/perfil/${idUsuario}`);
    },

    updatePerfil(idUsuario, data) {
        return this.put(`/api/auth/perfil/${idUsuario}`, data);
    },

    getDemoUsers() {
        return this.get('/api/auth/demo-users');
    },

    // 2. Dashboard
    getDashboard() {
        return this.get('/api/dashboard');
    },

    // 3. Vehículos
    getVehiculos(search = '', estado = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        if (estado) params.estado = estado;
        return this.get('/api/vehiculos', params);
    },
    createVehiculo(data) {
        return this.post('/api/vehiculos', data);
    },
    updateVehiculo(id, data) {
        return this.put(`/api/vehiculos/${id}`, data);
    },
    deleteVehiculo(id) {
        return this.delete(`/api/vehiculos/${id}`);
    },

    // 4. Clientes
    getClientes(search = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        return this.get('/api/clientes', params);
    },
    createCliente(data) {
        return this.post('/api/clientes', data);
    },
    updateCliente(id, data) {
        return this.put(`/api/clientes/${id}`, data);
    },
    deleteCliente(id) {
        return this.delete(`/api/clientes/${id}`);
    },

    // 5. Empleados
    getEmpleados(search = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        return this.get('/api/empleados', params);
    },
    createEmpleado(data) {
        return this.post('/api/empleados', data);
    },
    updateEmpleado(id, data) {
        return this.put(`/api/empleados/${id}`, data);
    },
    deleteEmpleado(id) {
        return this.delete(`/api/empleados/${id}`);
    },

    // 6. Reservas
    getReservas(search = '', estado = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        if (estado) params.estado = estado;
        return this.get('/api/reservas', params);
    },
    createReserva(data) {
        return this.post('/api/reservas', data);
    },
    updateReserva(id, data) {
        return this.put(`/api/reservas/${id}`, data);
    },
    updateEstadoReserva(id, estado) {
        return this.put(`/api/reservas/${id}/estado`, { estado });
    },
    deleteReserva(id) {
        return this.delete(`/api/reservas/${id}`);
    },

    // 7. Alquileres
    getAlquileres(search = '', estado = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        if (estado) params.estado = estado;
        return this.get('/api/alquileres', params);
    },
    createAlquiler(data) {
        return this.post('/api/alquileres', data);
    },
    updateAlquiler(id, data) {
        return this.put(`/api/alquileres/${id}`, data);
    },
    updateEstadoAlquiler(id, estado, extra = {}) {
        return this.put(`/api/alquileres/${id}/estado`, { estado, ...extra });
    },
    cerrarAlquiler(id, data) {
        return this.post(`/api/alquileres/${id}/cerrar`, data);
    },
    deleteAlquiler(id) {
        return this.delete(`/api/alquileres/${id}`);
    },

    // 8. Pagos
    getPagos(search = '', estado = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        if (estado) params.estado = estado;
        return this.get('/api/pagos', params);
    },
    createPago(data) {
        return this.post('/api/pagos', data);
    },
    updatePago(id, data) {
        return this.put(`/api/pagos/${id}`, data);
    },
    updateEstadoPago(id, estado, monto = null) {
        const body = { estado };
        if (monto !== null && monto !== undefined) body.monto = monto;
        return this.put(`/api/pagos/${id}/estado`, body);
    },
    deletePago(id) {
        return this.delete(`/api/pagos/${id}`);
    },

    // 9. Mantenimientos
    getMantenimientos(search = '', estado = '', limit = 1000) {
        const params = { limit };
        if (search) params.search = search;
        if (estado) params.estado = estado;
        return this.get('/api/mantenimientos', params);
    },
    createMantenimiento(data) {
        return this.post('/api/mantenimientos', data);
    },
    updateMantenimiento(id, data) {
        return this.put(`/api/mantenimientos/${id}`, data);
    },
    completarMantenimiento(id, data = {}) {
        return this.put(`/api/mantenimientos/${id}/completar`, data);
    },
    deleteMantenimiento(id) {
        return this.delete(`/api/mantenimientos/${id}`);
    },

    // 10. Catálogos: Marcas, Tipos y Métodos de Pago
    getMarcas() {
        return this.get('/api/marcas');
    },
    createMarca(data) {
        return this.post('/api/marcas', data);
    },
    updateMarca(id, data) {
        return this.put(`/api/marcas/${id}`, data);
    },
    deleteMarca(id) {
        return this.delete(`/api/marcas/${id}`);
    },

    getTiposVehiculo() {
        return this.get('/api/tipos_vehiculo');
    },
    createTipoVehiculo(data) {
        return this.post('/api/tipos_vehiculo', data);
    },
    updateTipoVehiculo(id, data) {
        return this.put(`/api/tipos_vehiculo/${id}`, data);
    },
    deleteTipoVehiculo(id) {
        return this.delete(`/api/tipos_vehiculo/${id}`);
    },

    getMetodosPago() {
        return this.get('/api/metodos_pago');
    },
    createMetodoPago(data) {
        return this.post('/api/metodos_pago', data);
    },
    updateMetodoPago(id, data) {
        return this.put(`/api/metodos_pago/${id}`, data);
    },
    deleteMetodoPago(id) {
        return this.delete(`/api/metodos_pago/${id}`);
    }
};

window.Api = Api;
