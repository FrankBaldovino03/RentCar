/**
 * AutoRent Pro - API Client
 * Conecta el frontend estrictamente con el backend Flask RESTful y MySQL en VirtualBox
 */

const CLOUDFLARE_TUNNEL_URL = 'https://accounts-endif-pod-forums.trycloudflare.com';

const API_BASE = (function() {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5000';
    }
    const host = (window.location.hostname || '').toLowerCase();
    // Si se abre directamente desde el túnel de Cloudflare o desde el propio Flask (:5000), usar ruta relativa
    if (host.includes('trycloudflare.com') || window.location.port === '5000') {
        return '';
    }
    // Si corre en GitHub Pages, usar el túnel público de Cloudflare hacia tu Flask + MySQL en VirtualBox
    if (host.includes('github.io')) {
        return CLOUDFLARE_TUNNEL_URL;
    }
    if (window.location.port && window.location.port !== '5000') {
        return 'http://localhost:5000';
    }
    return '';
})();

const Api = {
    baseUrl: API_BASE,
    fallbackLocalUrl: 'http://localhost:5000',

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
                // Si el túnel devolvió 530/502 y el usuario está en su propio PC, intentar localhost:5000
                if (this.baseUrl === CLOUDFLARE_TUNNEL_URL && (response.status === 530 || response.status === 502 || response.status === 504)) {
                    const localRes = await fetch(`${this.fallbackLocalUrl}${endpoint}`, config);
                    const localData = await localRes.json();
                    if (localRes.ok) return localData;
                }
                const message = (data && data.error) ? data.error : (data.message || `Error HTTP ${response.status}`);
                throw new Error(message);
            }

            return data;
        } catch (error) {
            // Si falló el túnel y el usuario está en su propio PC, intentar localhost:5000 antes de mostrar error
            if (this.baseUrl === CLOUDFLARE_TUNNEL_URL) {
                try {
                    const localRes = await fetch(`${this.fallbackLocalUrl}${endpoint}`, config);
                    const localData = await localRes.json();
                    if (localRes.ok) return localData;
                } catch (e) {}
            }
            if (error instanceof TypeError || (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Load failed')))) {
                throw new Error('Servidor o Base de Datos MySQL desconectada. Verifica que el backend Flask y la máquina virtual en VirtualBox estén encendidos.');
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
