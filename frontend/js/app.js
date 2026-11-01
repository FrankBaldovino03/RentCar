/**
 * AutoRent Pro - Application Logic
 * Gestión Operativa y Control de Flota con Paginación y Orden Ascendente (Menor a Mayor)
 */

let currentView = "dashboard";
let catalogMarcas = [];
let catalogTipos = [];
let catalogMetodos = [];
let listVehiculos = [];
let listClientes = [];
let listEmpleados = [];
let listPagos = [];
let listAlquileres = [];

// Instancias de gráficos Chart.js
let chartFlota = null;
let chartActividad = null;

// Estados de paginación y ordenamiento (por defecto: menor a mayor por ID)
const paginationState = {
    vehiculos: { page: 1, pageSize: 15, sortField: "id_vehiculo", sortOrder: "asc" },
    reservas: { page: 1, pageSize: 15, sortField: "id_reserva", sortOrder: "asc" },
    alquileres: { page: 1, pageSize: 15, sortField: "id_alquiler", sortOrder: "asc" },
    pagos: { page: 1, pageSize: 15, sortField: "id_pago", sortOrder: "asc" },
    mantenimientos: { page: 1, pageSize: 15, sortField: "id_mantenimiento", sortOrder: "asc" },
    clientes: { page: 1, pageSize: 15, sortField: "id_cliente", sortOrder: "asc" },
    empleados: { page: 1, pageSize: 15, sortField: "id_empleado", sortOrder: "asc" }
};

const viewMetadata = {
    dashboard: { title: "Dashboard General", subtitle: "Métricas de AutoRent Pro en tiempo real" },
    vehiculos: { title: "Gestión de Flota Vehicular", subtitle: "Catálogo y estado técnico de la flota" },
    reservas: { title: "Control de Reservas", subtitle: "Validación de concurrencia y agenda" },
    alquileres: { title: "Contratos de Alquiler", subtitle: "Gestión de entregas y devoluciones de vehículos" },
    pagos: { title: "Caja y Comprobantes de Pago", subtitle: "Recaudos vinculados a contratos de arrendamiento" },
    mantenimientos: { title: "Mantenimiento Técnico", subtitle: "Órdenes de servicio y control de taller" },
    clientes: { title: "Directorio de Clientes", subtitle: "Información y contacto de arrendatarios" },
    empleados: { title: "Personal de la Empresa", subtitle: "Asesores comerciales y mecánicos de patio" }
};

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) {
        lucide.createIcons();
    }
    initAuth();
});

/* ==========================================================================
   AUTENTICACIÓN Y SESIÓN (TABLA: usuario)
   ========================================================================== */
function initAuth() {
    currentUser = null;

    // Se limpia cualquier sesión persistente previa para que SIEMPRE inicie en el Login
    localStorage.removeItem("autorent_user");
    sessionStorage.removeItem("autorent_user");

    // Limpiar campos del formulario de login
    const uInput = document.getElementById("login-usuario");
    const pInput = document.getElementById("login-password");
    if (uInput) uInput.value = "";
    if (pInput) pInput.value = "";

    showAuthScreen();
    checkHealth();
    setInterval(checkHealth, 30000);
}

function showAuthScreen() {
    const authEl = document.getElementById("auth-screen");
    const appEl = document.getElementById("app-layout");
    if (authEl) authEl.classList.remove("hidden");
    if (appEl) appEl.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
}

function showAppLayout() {
    const authEl = document.getElementById("auth-screen");
    const appEl = document.getElementById("app-layout");
    if (authEl) authEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    
    // Actualizar datos del usuario en la barra superior
    updateUserHeader();
    if (window.lucide) lucide.createIcons();
}

function updateUserHeader() {
    if (!currentUser) return;
    const nameEl = document.getElementById("user-display-name");
    const roleEl = document.getElementById("user-display-role");
    const avatarEl = document.getElementById("user-avatar");

    if (nameEl) {
        const displayName = currentUser.nombre_completo || currentUser.usuario || "Usuario";
        nameEl.innerHTML = `${displayName} <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400 group-hover:text-blue-600 inline"></i>`;
    }
    if (roleEl) roleEl.textContent = `${currentUser.cargo || "Empleado"} • @${currentUser.usuario}`;
    if (avatarEl) {
        const initials = (currentUser.nombre ? currentUser.nombre[0] : "") + 
                         (currentUser.apellido ? currentUser.apellido[0] : "");
        avatarEl.textContent = initials.toUpperCase() || "AD";
    }
    if (window.lucide) lucide.createIcons();
}

async function handleLogin(e) {
    e.preventDefault();
    const usuarioInput = document.getElementById("login-usuario");
    const passwordInput = document.getElementById("login-password");
    const btnSubmit = document.getElementById("btn-login-submit");

    const usuario = usuarioInput.value.trim();
    const password = passwordInput.value;

    if (!usuario || !password) {
        Swal.fire({
            icon: "warning",
            title: "Campos Requeridos",
            text: "Por favor ingresa tanto tu usuario como tu contraseña."
        });
        return;
    }

    const originalBtnHtml = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Verificando credenciales...</span>
    `;

    try {
        const result = await Api.login(usuario, password);
        currentUser = result.user;
        localStorage.setItem("autorent_user", JSON.stringify(currentUser));

        toastSuccess(result.message || `Bienvenido, ${currentUser.nombre_completo}`);
        showAppLayout();
        checkHealth();
        loadCatalogs();
        navigate("dashboard");
        setInterval(checkHealth, 30000);
    } catch (err) {
        Swal.fire({
            icon: "error",
            title: "Acceso Denegado",
            text: err.message || "Usuario o contraseña inválidos en la base de datos",
            confirmButtonColor: "#2563eb"
        });
        passwordInput.value = "";
        passwordInput.focus();
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnHtml;
        if (window.lucide) lucide.createIcons();
    }
}

async function logout() {
    const confirm = await Swal.fire({
        title: "¿Cerrar Sesión?",
        text: `¿Deseas salir de la cuenta de ${currentUser ? currentUser.nombre_completo : "usuario"}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Permanecer"
    });

    if (confirm.isConfirmed) {
        currentUser = null;
        localStorage.removeItem("autorent_user");
        showAuthScreen();
        const passEl = document.getElementById("login-password");
        if (passEl) passEl.value = "";
        toastSuccess("Sesión finalizada correctamente");
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    btn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
    if (window.lucide) lucide.createIcons();
}

function fillDemoLogin(user, pass) {
    const u = document.getElementById("login-usuario");
    const p = document.getElementById("login-password");
    if (u) {
        u.value = user;
        u.focus();
    }
    if (p) {
        p.value = pass;
    }
    const btn = document.getElementById("btn-login-submit");
    if (btn) {
        btn.classList.add("ring-2", "ring-sky-400", "scale-[1.01]");
        setTimeout(() => {
            btn.classList.remove("ring-2", "ring-sky-400", "scale-[1.01]");
        }, 400);
    }
}

function showForgotPassHelp() {
    Swal.fire({
        icon: "info",
        title: "Recuperación de Acceso",
        html: `Por políticas de seguridad y control operativo, el restablecimiento de contraseñas es gestionado internamente.<br><br>
               Si olvidaste tu clave o necesitas reactivar tu usuario, por favor contacta al <b>Administrador del Sistema</b> o al área de soporte técnico.`,
        confirmButtonColor: "#2563eb",
        confirmButtonText: "Entendido",
        background: "#0f172a",
        color: "#f8fafc"
    });
}


/* ==========================================================================
   HEALTH CHECK & CONEXIÓN MYSQL
   ========================================================================== */
async function checkHealth() {
    const badge = document.getElementById("db-badge");
    const details = document.getElementById("db-details");
    if (!badge) return;

    try {
        const data = await Api.health();
        if (data.status === "online") {
            badge.className = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online`;
            if (details) {
                const version = (data.version || "").split("-")[0];
                details.textContent = `${data.database} (MySQL v${version})`;
            }
        } else {
            throw new Error(data.message || "Error al conectar");
        }
    } catch (err) {
        badge.className = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20";
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Desconectado`;
        if (details) {
            details.textContent = "Sin enlace a MySQL Server";
        }
    }
}

/* ==========================================================================
   CARGA DE CATÁLOGOS BASE
   ========================================================================== */
async function loadCatalogs() {
    try {
        const [marcas, tipos, metodos, vehiculos, clientes, empleados] = await Promise.all([
            Api.getMarcas().catch(() => []),
            Api.getTiposVehiculo().catch(() => []),
            Api.getMetodosPago().catch(() => []),
            Api.getVehiculos("", "", 5000).catch(() => []),
            Api.getClientes("", 5000).catch(() => []),
            Api.getEmpleados("", 5000).catch(() => [])
        ]);

        catalogMarcas = sortData(marcas || [], "nombre", "asc");
        catalogTipos = sortData(tipos || [], "nombre", "asc");
        catalogMetodos = sortData(metodos || [], "id_metodo_pago", "asc");
        listVehiculos = sortData(vehiculos || [], "id_vehiculo", "asc");
        listClientes = sortData(clientes || [], "id_cliente", "asc");
        listEmpleados = sortData(empleados || [], "id_empleado", "asc");
    } catch (e) {
        console.error("Error al cargar catálogos:", e);
    }
}

/* ==========================================================================
   NAVEGACIÓN ENTRE VISTAS
   ========================================================================== */
function navigate(viewName) {
    currentView = viewName;

    // Actualizar botones de navegación en sidebar
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const activeBtn = document.getElementById(`nav-${viewName}`);
    if (activeBtn) activeBtn.classList.add("active");

    // Ocultar todas las secciones y mostrar la activa
    document.querySelectorAll("#content-container > section").forEach(sec => sec.classList.add("hidden"));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove("hidden");

    // Actualizar título y subtítulo del header
    const meta = viewMetadata[viewName] || { title: viewName, subtitle: "" };
    const titleEl = document.getElementById("view-title");
    const subEl = document.getElementById("view-subtitle");
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    fetchCurrentView();
}

function fetchCurrentView() {
    switch (currentView) {
        case "dashboard": loadDashboard(); break;
        case "vehiculos": loadVehiculos(); break;
        case "reservas": loadReservas(); break;
        case "alquileres": loadAlquileres(); break;
        case "pagos": loadPagos(); break;
        case "mantenimientos": loadMantenimientos(); break;
        case "clientes": loadClientes(); break;
        case "empleados": loadEmpleados(); break;
    }
}

/* ==========================================================================
   SISTEMA DE ORDENAMIENTO Y PAGINACIÓN
   ========================================================================== */

/**
 * Ordena un arreglo de objetos según el campo y dirección (asc o desc).
 * Por defecto maneja números, strings y fechas de menor a mayor.
 */
function sortData(list, field, order = "asc") {
    if (!list || !list.length) return [];
    return [...list].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (valA === null || valA === undefined) valA = "";
        if (valB === null || valB === undefined) valB = "";

        // Comparación numérica
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "") {
            return order === "asc" ? numA - numB : numB - numA;
        }

        // Comparación alfanumérica natural
        return order === "asc"
            ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
            : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
}

/**
 * Cambia la página activa de una sección.
 */
function setPage(sectionKey, newPage) {
    if (paginationState[sectionKey]) {
        paginationState[sectionKey].page = newPage;
        fetchCurrentView();
    }
}

/**
 * Cambia el tamaño de página (filas por página) y reinicia a la página 1.
 */
function changePageSize(sectionKey, newSize) {
    if (paginationState[sectionKey]) {
        paginationState[sectionKey].pageSize = parseInt(newSize, 10);
        paginationState[sectionKey].page = 1;
        fetchCurrentView();
    }
}

/**
 * Alterna el orden de una columna (menor a mayor por defecto).
 */
function toggleSort(sectionKey, field) {
    const state = paginationState[sectionKey];
    if (!state) return;

    if (state.sortField === field) {
        state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
    } else {
        state.sortField = field;
        state.sortOrder = "asc"; // Por defecto siempre menor a mayor
    }
    state.page = 1;
    fetchCurrentView();
}

/**
 * Actualiza los indicadores visuales (▲ / ▼) en las cabeceras de tabla.
 */
function updateSortIndicators(sectionKey) {
    const state = paginationState[sectionKey];
    if (!state) return;

    document.querySelectorAll(`[id^="sort-${sectionKey}-"]`).forEach(el => {
        el.textContent = "";
    });

    const activeIndicator = document.getElementById(`sort-${sectionKey}-${state.sortField}`);
    if (activeIndicator) {
        activeIndicator.textContent = state.sortOrder === "asc" ? " ▲" : " ▼";
    }
}

/**
 * Renderiza la barra de paginación interactiva con selector de tamaño y botones.
 */
function renderPaginationBar(containerId, sectionKey, totalItems) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = paginationState[sectionKey];
    const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));

    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const startItem = totalItems === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const endItem = Math.min(totalItems, state.page * state.pageSize);

    // Rango de páginas visibles (hasta 5 botones numerados)
    const maxVisible = 5;
    let startPage = Math.max(1, state.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    let pageButtonsHtml = "";
    for (let p = startPage; p <= endPage; p++) {
        const isActive = p === state.page;
        pageButtonsHtml += `
            <button class="page-btn ${isActive ? 'active' : ''}" 
                    onclick="setPage('${sectionKey}', ${p})">${p}</button>
        `;
    }

    container.className = "pagination-bar";
    container.innerHTML = `
        <div class="flex items-center gap-3">
            <span>Mostrando <strong class="text-slate-800">${startItem}</strong> - <strong class="text-slate-800">${endItem}</strong> de <strong class="text-slate-800">${totalItems}</strong> registros</span>
            <div class="flex items-center gap-1.5 ml-2">
                <span class="text-slate-400">Filas:</span>
                <select class="page-size-select" onchange="changePageSize('${sectionKey}', this.value)">
                    <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
                    <option value="15" ${state.pageSize === 15 ? 'selected' : ''}>15</option>
                    <option value="25" ${state.pageSize === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
        </div>
        <div class="pagination-controls">
            <button class="page-btn" title="Primera página" ${state.page === 1 ? 'disabled' : ''} onclick="setPage('${sectionKey}', 1)">
                &laquo;
            </button>
            <button class="page-btn" title="Página anterior" ${state.page === 1 ? 'disabled' : ''} onclick="setPage('${sectionKey}', ${state.page - 1})">
                &lsaquo;
            </button>
            ${pageButtonsHtml}
            <button class="page-btn" title="Página siguiente" ${state.page === totalPages ? 'disabled' : ''} onclick="setPage('${sectionKey}', ${state.page + 1})">
                &rsaquo;
            </button>
            <button class="page-btn" title="Última página" ${state.page === totalPages ? 'disabled' : ''} onclick="setPage('${sectionKey}', ${totalPages})">
                &raquo;
            </button>
        </div>
    `;
}

/* ==========================================================================
   1. DASHBOARD Y GRÁFICAS
   ========================================================================== */
async function loadDashboard() {
    try {
        const data = await Api.getDashboard();
        const kpis = data.kpis || {};

        const totalVehEl = document.getElementById("kpi-total-vehiculos");
        const dispEl = document.getElementById("kpi-disponibles");
        const alqEl = document.getElementById("kpi-alquilados");
        const mantEl = document.getElementById("kpi-mantenimiento");
        const alqActEl = document.getElementById("kpi-alquileres-activos");
        const totalResEl = document.getElementById("kpi-total-reservas");
        const resPendEl = document.getElementById("kpi-res-pendientes");
        const resConfEl = document.getElementById("kpi-res-confirmadas");
        const resFinEl = document.getElementById("kpi-res-finalizadas");
        const resCancEl = document.getElementById("kpi-res-canceladas");
        const resRechEl = document.getElementById("kpi-res-rechazadas");
        const recaudoEl = document.getElementById("kpi-total-recaudo");

        if (totalVehEl) totalVehEl.textContent = kpis.total_vehiculos || 0;
        if (dispEl) dispEl.textContent = `${kpis.disponibles || 0} disp.`;
        if (alqEl) alqEl.textContent = `${kpis.alquilados || 0} alquilados`;
        if (mantEl) mantEl.textContent = `${kpis.en_mantenimiento || 0} en taller`;
        if (alqActEl) alqActEl.textContent = kpis.alquileres_activos || 0;
        
        // Sincronización exacta con GROUP BY estado de reserva en MySQL
        if (totalResEl) totalResEl.textContent = kpis.total_reservas || 0;
        if (resPendEl) resPendEl.textContent = `${kpis.reservas_pendientes || 0} Pendientes`;
        if (resConfEl) resConfEl.textContent = `${kpis.reservas_confirmadas || 0} Confirmadas`;
        if (resFinEl) resFinEl.textContent = `${kpis.reservas_finalizadas || 0} Finalizadas`;
        if (resCancEl) resCancEl.textContent = `${kpis.reservas_canceladas || 0} Canceladas`;
        if (resRechEl) resRechEl.textContent = `${kpis.reservas_rechazadas || 0} Rechazadas`;
        if (recaudoEl) recaudoEl.textContent = `$ ${Number(kpis.total_recaudo || 0).toLocaleString("es-CO")}`;

        // Renderizar / Actualizar Gráficas
        renderCharts(kpis, data.conteos);

        // Tabla de últimos alquileres
        const alqBody = document.getElementById("dash-ultimos-alquileres");
        if (alqBody) {
            if (!data.ultimos_alquileres || !data.ultimos_alquileres.length) {
                alqBody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-slate-400">Sin alquileres recientes</td></tr>`;
            } else {
                alqBody.innerHTML = data.ultimos_alquileres.map(a => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-2.5 font-medium text-slate-700">${a.cliente_nombre || "N/A"}</td>
                        <td class="py-2.5 text-slate-600 font-mono">${a.vehiculo_placa} <span class="text-slate-400 font-sans">(${a.vehiculo_detalle})</span></td>
                        <td class="py-2.5 text-slate-500">${formatDate(a.fecha_inicio)}</td>
                        <td class="py-2.5">${renderBadge(a.estado)}</td>
                    </tr>
                `).join("");
            }
        }

        // Tabla de últimas reservas
        const resBody = document.getElementById("dash-ultimas-reservas");
        if (resBody) {
            if (!data.ultimas_reservas || !data.ultimas_reservas.length) {
                resBody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-slate-400">Sin reservas recientes</td></tr>`;
            } else {
                resBody.innerHTML = data.ultimas_reservas.map(r => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-2.5 font-medium text-slate-700">${r.cliente_nombre || "N/A"}</td>
                        <td class="py-2.5 text-slate-600 font-mono">${r.vehiculo_placa} <span class="text-slate-400 font-sans">(${r.vehiculo_detalle})</span></td>
                        <td class="py-2.5 text-slate-500">${formatDate(r.fecha_inicio)}</td>
                        <td class="py-2.5">${renderBadge(r.estado)}</td>
                    </tr>
                `).join("");
            }
        }

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error al cargar dashboard:", e);
    }
}

function renderCharts(kpis, conteos) {
    if (typeof Chart === "undefined") return;

    // 1. Gráfica de Donut: Estados de la Flota
    const ctxFlota = document.getElementById("chart-flota-estados");
    if (ctxFlota) {
        if (chartFlota) chartFlota.destroy();
        chartFlota = new Chart(ctxFlota, {
            type: "doughnut",
            data: {
                labels: ["Disponibles", "Alquilados", "Reservados", "Taller"],
                datasets: [{
                    data: [
                        kpis.disponibles || 0,
                        kpis.alquilados || 0,
                        kpis.reservados || 0,
                        kpis.en_mantenimiento || 0
                    ],
                    backgroundColor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"],
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { font: { family: "Plus Jakarta Sans", size: 11 }, boxWidth: 12 }
                    }
                },
                cutout: "70%"
            }
        });
    }

    // 2. Gráfica de Barras: Registros en BD
    const ctxAct = document.getElementById("chart-actividad-db");
    if (ctxAct && conteos) {
        if (chartActividad) chartActividad.destroy();
        chartActividad = new Chart(ctxAct, {
            type: "bar",
            data: {
                labels: ["Vehículos", "Clientes", "Empleados", "Alquileres", "Reservas", "Mantenim."],
                datasets: [{
                    label: "Total Registros",
                    data: [
                        conteos.vehiculo || 0,
                        conteos.cliente || 0,
                        conteos.empleado || 0,
                        conteos.alquiler || 0,
                        conteos.reserva || 0,
                        conteos.mantenimiento || 0
                    ],
                    backgroundColor: "#3b82f6",
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: "#f1f5f9" },
                        ticks: { font: { family: "Plus Jakarta Sans", size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "Plus Jakarta Sans", size: 11 } }
                    }
                }
            }
        });
    }
}

/* ==========================================================================
   2. VEHÍCULOS (Paginado y Ordenado)
   ========================================================================== */
async function loadVehiculos() {
    const search = document.getElementById("vehiculos-search") ? document.getElementById("vehiculos-search").value : "";
    const estado = document.getElementById("vehiculos-filtro-estado") ? document.getElementById("vehiculos-filtro-estado").value : "";
    const tbody = document.getElementById("table-vehiculos-body");
    if (!tbody) return;

    try {
        const rows = await Api.getVehiculos(search, estado, 5000);
        listVehiculos = rows;

        const state = paginationState.vehiculos;
        const sorted = sortData(rows, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("vehiculos");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400">No se encontraron vehículos.</td></tr>`;
            renderPaginationBar("pagination-vehiculos", "vehiculos", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(v => {
            const isReservado = (v.estado || "").toLowerCase() === "reservado" || Boolean(v.monto_abono);
            let estadoHtml = renderBadge(v.estado);

            if (isReservado) {
                estadoHtml = `
                    <div class="inline-flex flex-col items-start gap-1">
                        <span class="badge badge-reservado">Reservado</span>
                        ${v.monto_abono ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap"><i data-lucide="receipt" class="w-3 h-3 text-amber-600"></i> Abono: $ ${Number(v.monto_abono).toLocaleString("es-CO")}</span>` : ''}
                    </div>
                `;
            }

            return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold font-mono text-slate-500 whitespace-nowrap">#${v.id_vehiculo}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs border border-slate-200">${v.placa}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="font-semibold text-slate-800 text-sm">${v.marca_nombre || "Sin marca"} ${v.modelo}</div>
                </td>
                <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">${v.tipo_nombre || "General"}</td>
                <td class="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">${v.año || v.anio || "2024"} · ${v.color || "Blanco"}</td>
                <td class="px-4 py-3 font-mono text-slate-700 text-xs whitespace-nowrap">${Number(v.kilometraje || 0).toLocaleString()} km</td>
                <td class="px-4 py-3 whitespace-nowrap">${estadoHtml}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    <button onclick="editVehiculo(${v.id_vehiculo})" title="Editar" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteVehiculoItem(${v.id_vehiculo})" title="Eliminar" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
            `;
        }).join("");

        renderPaginationBar("pagination-vehiculos", "vehiculos", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-rose-500">Error al cargar vehículos: ${err.message}</td></tr>`;
    }
}

async function openModalVehiculo(vehiculo = null) {
    await loadCatalogs();

    // Llenar datalist de marcas sugeridas para facilitar la escritura
    const dlMarcas = document.getElementById("marcas-datalist");
    if (dlMarcas) {
        const marcasUnicas = [...new Set(catalogMarcas.map(m => m.nombre).filter(Boolean))].sort();
        dlMarcas.innerHTML = marcasUnicas.map(m => `<option value="${m}">`).join("");
    }

    fillSelect("v-tipo", catalogTipos, "id_tipo_vehiculo", "nombre");

    if (vehiculo) {
        document.getElementById("modal-vehiculo-title").textContent = "Editar Vehículo";
        document.getElementById("v-id").value = vehiculo.id_vehiculo;
        document.getElementById("v-placa").value = vehiculo.placa;
        document.getElementById("v-placa").disabled = true;
        document.getElementById("v-modelo").value = vehiculo.modelo;
        document.getElementById("v-marca").value = vehiculo.marca_nombre || "";
        document.getElementById("v-tipo").value = vehiculo.id_tipo_vehiculo;
        document.getElementById("v-anio").value = vehiculo.año || vehiculo.anio || 2024;
        document.getElementById("v-color").value = vehiculo.color || "";
        document.getElementById("v-km").value = vehiculo.kilometraje || 0;
        document.getElementById("v-estado").value = vehiculo.estado || "Disponible";
    } else {
        document.getElementById("modal-vehiculo-title").textContent = "Nuevo Vehículo";
        document.getElementById("form-vehiculo").reset();
        document.getElementById("v-id").value = "";
        document.getElementById("v-marca").value = "";
        document.getElementById("v-placa").disabled = false;
    }
    openModal("modal-vehiculo");
}

function editVehiculo(id) {
    const v = listVehiculos.find(item => item.id_vehiculo === id);
    if (v) openModalVehiculo(v);
}

async function saveVehiculo(e) {
    e.preventDefault();
    const id = document.getElementById("v-id").value;
    const marcaTexto = document.getElementById("v-marca").value.trim();

    if (!marcaTexto) {
        Swal.fire("Atención", "Por favor escribe la marca del vehículo.", "warning");
        return;
    }

    const payload = {
        marca: marcaTexto,
        marca_nombre: marcaTexto,
        id_tipo_vehiculo: parseInt(document.getElementById("v-tipo").value),
        placa: document.getElementById("v-placa").value.trim().toUpperCase(),
        modelo: document.getElementById("v-modelo").value.trim(),
        año: parseInt(document.getElementById("v-anio").value),
        anio: parseInt(document.getElementById("v-anio").value),
        color: document.getElementById("v-color").value.trim(),
        kilometraje: parseInt(document.getElementById("v-km").value) || 0,
        estado: document.getElementById("v-estado").value
    };

    try {
        let result;
        if (id) {
            result = await Api.updateVehiculo(id, payload);
        } else {
            result = await Api.createVehiculo(payload);
        }

        closeModal("modal-vehiculo");
        toastSuccess(result.message || "Vehículo guardado correctamente");
        loadVehiculos();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

function deleteVehiculoItem(id) {
    deleteItem("vehiculos", id, "¿Deseas eliminar este vehículo y todo su historial dependiente?");
}

/* ==========================================================================
   3. RESERVAS (Paginado y Ordenado)
   ========================================================================== */
let listReservas = [];

async function loadReservas() {
    const search = document.getElementById("reservas-search") ? document.getElementById("reservas-search").value : "";
    const estado = document.getElementById("reservas-filtro-estado") ? document.getElementById("reservas-filtro-estado").value : "";
    const tbody = document.getElementById("table-reservas-body");
    if (!tbody) return;

    try {
        const rows = await Api.getReservas(search, estado, 5000);
        listReservas = rows;
        const state = paginationState.reservas;
        const sorted = sortData(rows, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("reservas");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No hay reservas registradas.</td></tr>`;
            renderPaginationBar("pagination-reservas", "reservas", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(r => `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">#${r.id_reserva}</td>
                <td class="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">${r.cliente_nombre || "N/A"}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                    <span class="font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs border border-slate-200">${r.vehiculo_placa}</span> 
                    <span class="text-slate-400 font-sans text-xs ml-1">(${r.vehiculo_detalle})</span>
                </td>
                <td class="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">${formatDate(r.fecha_inicio)}</td>
                <td class="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">${formatDate(r.fecha_reserva)}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                        ${renderBadge(r.estado)}
                        <select onchange="cambiarEstadoReserva(${r.id_reserva}, this.value)" title="Cambiar estado en la base de datos" class="text-[11px] font-medium py-0.5 px-1 border border-slate-200 rounded bg-white text-slate-600 cursor-pointer outline-none hover:border-blue-400">
                            <option value="Pendiente" ${r.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Confirmada" ${r.estado === 'Confirmada' ? 'selected' : ''}>Confirmada</option>
                            <option value="Finalizada" ${r.estado === 'Finalizada' ? 'selected' : ''}>Finalizada</option>
                            <option value="Cancelada" ${r.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                            <option value="Rechazada" ${r.estado === 'Rechazada' ? 'selected' : ''}>Rechazada</option>
                        </select>
                    </div>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    <button onclick="editReserva(${r.id_reserva})" title="Editar Reserva" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteItem('reservas', ${r.id_reserva}, '¿Eliminar definitivamente esta reserva de la base de datos?')" title="Eliminar" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join("");

        renderPaginationBar("pagination-reservas", "reservas", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Error al cargar reservas: ${err.message}</td></tr>`;
    }
}

/* ==========================================================================
   SEARCHABLE PICKER COMPONENT (COMBO BUSCADOR REUTILIZABLE)
   ========================================================================== */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let activeSearchPickerCloseFn = null;

function createSearchPicker({
    containerId,
    hiddenInputId,
    placeholder,
    getItems,
    searchFn,
    renderItem,
    renderSelected,
    onSelect,
    onClear
}) {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!container || !hiddenInput) return null;

    let selectedItem = null;

    function render() {
        if (selectedItem) {
            container.innerHTML = `
                <div class="search-picker-selected-card">
                    <div class="flex-1 min-w-0 pr-2">
                        ${renderSelected(selectedItem)}
                    </div>
                    <button type="button" class="search-picker-change-btn" title="Cambiar selección">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        Cambiar
                    </button>
                </div>
            `;
            const changeBtn = container.querySelector(".search-picker-change-btn");
            if (changeBtn) {
                changeBtn.onclick = () => {
                    setValue(null);
                    setTimeout(() => {
                        const input = container.querySelector(".search-picker-input");
                        if (input) {
                            input.focus();
                            openDropdown("");
                        }
                    }, 50);
                };
            }
        } else {
            container.innerHTML = `
                <div class="search-picker-input-wrapper">
                    <svg class="search-picker-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input type="text" class="search-picker-input" placeholder="${placeholder}" autocomplete="off">
                    <div class="search-picker-dropdown hidden"></div>
                </div>
            `;

            const input = container.querySelector(".search-picker-input");
            const dropdown = container.querySelector(".search-picker-dropdown");

            input.onfocus = () => {
                openDropdown(input.value.trim());
            };

            input.oninput = () => {
                openDropdown(input.value.trim());
            };

            input.onkeydown = (e) => {
                if (e.key === "Escape") {
                    closeDropdown();
                }
            };
        }
    }

    function openDropdown(query) {
        if (activeSearchPickerCloseFn && activeSearchPickerCloseFn !== closeDropdown) {
            activeSearchPickerCloseFn();
        }

        const dropdown = container.querySelector(".search-picker-dropdown");
        if (!dropdown) return;

        const allItems = typeof getItems === "function" ? getItems() : [];
        let filtered = allItems;
        if (query) {
            const q = query.toLowerCase();
            filtered = allItems.filter(item => searchFn(item, q));
        }

        if (!filtered.length) {
            dropdown.innerHTML = `
                <div class="p-3 text-center text-xs text-slate-400">
                    No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>"
                </div>
            `;
        } else {
            const displayList = filtered.slice(0, 30);
            dropdown.innerHTML = displayList.map((item, idx) => `
                <div class="search-picker-item" data-idx="${idx}">
                    ${renderItem(item)}
                </div>
            `).join("") + (filtered.length > 30 ? `
                <div class="px-3 py-1.5 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-100 font-medium">
                    Mostrando 30 de ${filtered.length} opciones. Escribe para afinar búsqueda.
                </div>
            ` : "");

            dropdown.querySelectorAll(".search-picker-item").forEach((el, idx) => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    setValue(displayList[idx]);
                    closeDropdown();
                };
            });
        }

        dropdown.classList.remove("hidden");
        activeSearchPickerCloseFn = closeDropdown;
    }

    function closeDropdown() {
        const dropdown = container.querySelector(".search-picker-dropdown");
        if (dropdown) dropdown.classList.add("hidden");
        if (activeSearchPickerCloseFn === closeDropdown) {
            activeSearchPickerCloseFn = null;
        }
    }

    function setValue(item) {
        selectedItem = item;
        if (item) {
            const idVal = item.id_alquiler || item.id_cliente || item.id_vehiculo || item.id_empleado || item.id;
            hiddenInput.value = idVal;
            if (onSelect) onSelect(item);
        } else {
            hiddenInput.value = "";
            if (onClear) onClear();
        }
        render();
    }

    document.addEventListener("click", (e) => {
        if (!container.contains(e.target)) {
            closeDropdown();
        }
    });

    render();

    return {
        setValue,
        getValue: () => selectedItem,
        reset: () => setValue(null)
    };
}

let pickerResCliente = null;
let pickerResVehiculo = null;

async function openModalReserva(reserva = null) {
    await loadCatalogs();

    const vehiculosList = [...listVehiculos].sort((a, b) => (a.estado === "Disponible" ? -1 : 1));

    // 1. Buscador de Cliente para Reserva
    pickerResCliente = createSearchPicker({
        containerId: "picker-res-cliente",
        hiddenInputId: "res-cliente",
        placeholder: "Buscar cliente por nombre o cédula...",
        getItems: () => listClientes,
        searchFn: (c, q) => (
            `${c.nombre || ""} ${c.apellido || ""} ${c.identificacion || ""} ${c.correo || ""} ${c.telefono || ""}`
        ).toLowerCase().includes(q),
        renderItem: (c) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    ${(c.nombre?.[0] || "C") + (c.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${c.nombre} ${c.apellido}</div>
                    <div class="text-xs text-slate-500 truncate">Cédula: <span class="font-mono font-medium text-slate-700">${c.identificacion}</span> ${c.telefono ? "· Tel: " + c.telefono : ""}</div>
                </div>
            </div>
        `,
        renderSelected: (c) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    ${(c.nombre?.[0] || "C") + (c.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${c.nombre} ${c.apellido}</div>
                    <div class="text-xs text-slate-500 truncate">Cédula: <span class="font-mono font-medium text-slate-700">${c.identificacion}</span> ${c.telefono ? "· Tel: " + c.telefono : ""}</div>
                </div>
            </div>
        `
    });

    // 2. Buscador de Vehículo para Reserva
    pickerResVehiculo = createSearchPicker({
        containerId: "picker-res-vehiculo",
        hiddenInputId: "res-vehiculo",
        placeholder: "Buscar vehículo por placa, marca o modelo...",
        getItems: () => vehiculosList,
        searchFn: (v, q) => (
            `${v.placa || ""} ${v.marca_nombre || ""} ${v.modelo || ""} ${v.color || ""} ${v.tipo_nombre || ""}`
        ).toLowerCase().includes(q),
        renderItem: (v) => `
            <div class="flex items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-sm">
                        🚗
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 truncate">
                            <span class="font-mono font-bold bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                            <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                        </div>
                        <div class="text-xs text-slate-500 truncate">${v.color || "Blanco"} · Odómetro: <span class="font-mono font-medium">${Number(v.kilometraje || 0).toLocaleString()} km</span></div>
                    </div>
                </div>
                <span class="badge ${v.estado === 'Disponible' ? 'badge-disponible' : (v.estado === 'Reservado' ? 'badge-reservado' : 'badge-alquilado')} shrink-0 text-[11px]">${v.estado}</span>
            </div>
        `,
        renderSelected: (v) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 text-sm">
                    🚗
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5 truncate">
                        <span class="font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                        <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                    </div>
                    <div class="text-xs text-slate-500 font-mono truncate">${v.color || "Blanco"} · Estado: ${v.estado}</div>
                </div>
            </div>
        `
    });

    if (reserva) {
        document.getElementById("modal-reserva-title").textContent = `Editar Reserva #${reserva.id_reserva}`;
        document.getElementById("res-id").value = reserva.id_reserva;

        const cli = listClientes.find(c => c.id_cliente === reserva.id_cliente);
        if (cli) pickerResCliente.setValue(cli);
        else document.getElementById("res-cliente").value = reserva.id_cliente;

        const veh = listVehiculos.find(v => v.id_vehiculo === reserva.id_vehiculo);
        if (veh) pickerResVehiculo.setValue(veh);
        else document.getElementById("res-vehiculo").value = reserva.id_vehiculo;

        document.getElementById("res-fecha").value = (reserva.fecha_inicio || "").split("T")[0];
        document.getElementById("res-estado").value = reserva.estado || "Pendiente";
        document.getElementById("res-obs").value = reserva.observaciones || "";
        document.getElementById("btn-save-reserva").textContent = "Guardar Cambios";
    } else {
        document.getElementById("modal-reserva-title").textContent = "Nueva Reserva";
        document.getElementById("form-reserva").reset();
        document.getElementById("res-id").value = "";
        document.getElementById("res-cliente").value = "";
        document.getElementById("res-vehiculo").value = "";
        pickerResCliente.reset();
        pickerResVehiculo.reset();

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById("res-fecha").value = tomorrow.toISOString().split("T")[0];
        document.getElementById("res-estado").value = "Pendiente";
        document.getElementById("btn-save-reserva").textContent = "Confirmar Reserva";
    }
    openModal("modal-reserva");
}

function editReserva(id) {
    const r = listReservas.find(item => item.id_reserva === id);
    if (r) openModalReserva(r);
}

async function saveReserva(e) {
    e.preventDefault();
    const id = document.getElementById("res-id").value;
    const idCliente = parseInt(document.getElementById("res-cliente").value);
    const idVehiculo = parseInt(document.getElementById("res-vehiculo").value);

    if (!idCliente) {
        Swal.fire({
            icon: "warning",
            title: "Cliente requerido",
            text: "Por favor busca y selecciona el Cliente para la reserva.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    if (!idVehiculo) {
        Swal.fire({
            icon: "warning",
            title: "Vehículo requerido",
            text: "Por favor busca y selecciona el Vehículo para la reserva.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const payload = {
        id_cliente: idCliente,
        id_vehiculo: idVehiculo,
        fecha_inicio: document.getElementById("res-fecha").value,
        estado: document.getElementById("res-estado").value,
        observaciones: document.getElementById("res-obs").value.trim()
    };

    try {
        let result;
        if (id) {
            result = await Api.updateReserva(id, payload);
        } else {
            result = await Api.createReserva(payload);
        }
        closeModal("modal-reserva");
        toastSuccess(result.message || "Reserva procesada exitosamente");
        loadReservas();
        loadDashboard();
        loadCatalogs();
    } catch (err) {
        Swal.fire({
            icon: "warning",
            title: "Validación de Concurrencia",
            text: err.message,
            confirmButtonColor: "#2563eb"
        });
    }
}

async function cambiarEstadoReserva(id, nuevoEstado) {
    try {
        const result = await Api.updateEstadoReserva(id, nuevoEstado);
        toastSuccess(result.message || `Reserva #${id} actualizada a ${nuevoEstado}`);
        loadReservas();
        loadDashboard();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
        loadReservas();
    }
}

/* ==========================================================================
   4. ALQUILERES / CONTRATOS (Paginado y Ordenado)
   ========================================================================== */
async function loadAlquileres() {
    const search = document.getElementById("alquileres-search") ? document.getElementById("alquileres-search").value : "";
    const estado = document.getElementById("alquileres-filtro-estado") ? document.getElementById("alquileres-filtro-estado").value : "";
    const tbody = document.getElementById("table-alquileres-body");
    if (!tbody) return;

    try {
        const rows = await Api.getAlquileres(search, estado, 5000);
        listAlquileres = rows || [];
        const state = paginationState.alquileres;
        const sorted = sortData(listAlquileres, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("alquileres");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">Sin contratos registrados.</td></tr>`;
            renderPaginationBar("pagination-alquileres", "alquileres", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(a => `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold font-mono text-slate-700 whitespace-nowrap">#${a.id_alquiler}</td>
                <td class="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">${a.cliente_nombre || "N/A"}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                    <span class="font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs border border-slate-200">${a.vehiculo_placa}</span> 
                    <span class="text-slate-400 font-sans text-xs ml-1">(${a.vehiculo_detalle})</span>
                </td>
                <td class="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">${a.empleado_nombre || "N/A"}</td>
                <td class="px-4 py-3 text-xs font-mono whitespace-nowrap">
                    <span class="text-slate-700 font-medium">${Number(a.km_inicio || 0).toLocaleString()} km</span> 
                    → <span class="${a.km_fin ? 'text-emerald-600 font-bold' : 'text-slate-400'}">${a.km_fin ? Number(a.km_fin).toLocaleString() + ' km' : 'En curso'}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    ${renderBadge(a.estado)}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1.5">
                        ${a.estado === 'Activo' ? `
                            <button onclick="openCerrarAlquiler(${a.id_alquiler}, ${a.km_inicio})" title="Registrar Retorno y Cierre de Vehículo" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors inline-flex items-center gap-1 shadow-xs">
                                <i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i> Retorno
                            </button>
                        ` : a.estado === 'Pendiente' ? `
                            <button onclick="cambiarEstadoAlquiler(${a.id_alquiler}, 'Activo', ${a.km_inicio || 0})" title="Iniciar y Entregar Vehículo" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors inline-flex items-center gap-1 shadow-xs">
                                <i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar
                            </button>
                        ` : a.estado === 'Cancelado' ? `
                            <button onclick="cambiarEstadoAlquiler(${a.id_alquiler}, 'Pendiente', ${a.km_inicio || 0})" title="Restaurar a Pendiente" class="px-2 py-1 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors inline-flex items-center gap-1 shadow-xs">
                                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> A Pendiente
                            </button>
                        ` : ''}

                        <!-- Botón Hub de Acciones (Gestionar Contrato) -->
                        <button onclick="openGestionarAlquiler(${a.id_alquiler})" title="Gestionar estados y acciones de este contrato" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:border-slate-300 transition-all inline-flex items-center gap-1.5 shadow-xs">
                            <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 text-slate-500"></i> Gestionar
                        </button>

                        <!-- Botón Eliminar -->
                        <button onclick="deleteItem('alquileres', ${a.id_alquiler}, '¿Eliminar definitivamente este contrato?')" title="Eliminar contrato" class="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");

        renderPaginationBar("pagination-alquileres", "alquileres", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Error al cargar contratos: ${err.message}</td></tr>`;
    }
}

function openGestionarAlquiler(idAlquiler) {
    const alq = (listAlquileres || []).find(a => a.id_alquiler === idAlquiler);
    if (!alq) return;

    document.getElementById("gestionar-alq-titulo").textContent = `Gestionar Contrato #${alq.id_alquiler}`;
    document.getElementById("gestionar-alq-subtitulo").textContent = `Cliente: ${alq.cliente_nombre || "Cliente General"} · Asesor: ${alq.empleado_nombre || "Sin Asesor"}`;
    document.getElementById("gestionar-alq-badge").innerHTML = renderBadge(alq.estado);
    document.getElementById("gestionar-alq-vehiculo").textContent = `${alq.vehiculo_placa || "Sin Placa"} (${alq.vehiculo_detalle || ""})`;

    // Acción 1: Retorno / Cierre
    const btnRetorno = document.getElementById("btn-gestionar-retorno");
    if (btnRetorno) {
        btnRetorno.onclick = () => {
            closeModal("modal-gestionar-alquiler");
            openCerrarAlquiler(alq.id_alquiler, alq.km_inicio || 0);
        };
    }

    // Acción 2: Iniciar / Activar
    const btnActivar = document.getElementById("btn-gestionar-activar");
    if (btnActivar) {
        btnActivar.onclick = () => {
            closeModal("modal-gestionar-alquiler");
            cambiarEstadoAlquiler(alq.id_alquiler, "Activo", alq.km_inicio || 0);
        };
    }

    // Acción 3: Pasar a Pendiente
    const btnPendiente = document.getElementById("btn-gestionar-pendiente");
    if (btnPendiente) {
        btnPendiente.onclick = () => {
            closeModal("modal-gestionar-alquiler");
            cambiarEstadoAlquiler(alq.id_alquiler, "Pendiente", alq.km_inicio || 0);
        };
    }

    // Acción 4: Cancelar Contrato
    const btnCancelar = document.getElementById("btn-gestionar-cancelar");
    if (btnCancelar) {
        btnCancelar.onclick = () => {
            closeModal("modal-gestionar-alquiler");
            cambiarEstadoAlquiler(alq.id_alquiler, "Cancelado", alq.km_inicio || 0);
        };
    }

    // Acción Eliminar
    const btnEliminar = document.getElementById("btn-gestionar-eliminar");
    if (btnEliminar) {
        btnEliminar.onclick = () => {
            closeModal("modal-gestionar-alquiler");
            deleteItem("alquileres", alq.id_alquiler, "¿Eliminar definitivamente este contrato?");
        };
    }

    openModal("modal-gestionar-alquiler");
    if (window.lucide) lucide.createIcons();
}

async function cambiarEstadoAlquiler(id, nuevoEstado, kmInicio) {
    if (nuevoEstado === "Retorno" || nuevoEstado === "Finalizado") {
        // Abre el modal de Retorno / Cierre para registrar kilometraje de retorno y observaciones
        openCerrarAlquiler(id, kmInicio);
        return;
    }

    if (nuevoEstado === "Cancelado") {
        const confirm = await Swal.fire({
            title: "¿Cancelar contrato de alquiler?",
            text: `El contrato #${id} se marcará como Cancelado y el vehículo quedará Disponible en la flota.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, cancelar contrato",
            cancelButtonText: "Volver",
            confirmButtonColor: "#ef4444"
        });
        if (!confirm.isConfirmed) {
            loadAlquileres();
            return;
        }
    } else if (nuevoEstado === "Activo") {
        const confirm = await Swal.fire({
            title: "¿Iniciar y Activar Contrato?",
            text: `El contrato #${id} pasará a Activo y el vehículo asignado quedará marcado como 'Alquilado'.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sí, activar contrato",
            cancelButtonText: "Volver",
            confirmButtonColor: "#2563eb"
        });
        if (!confirm.isConfirmed) {
            loadAlquileres();
            return;
        }
    } else if (nuevoEstado === "Pendiente") {
        const confirm = await Swal.fire({
            title: "¿Pasar contrato a Pendiente?",
            text: `El contrato #${id} quedará en espera y el vehículo asignado se liberará a 'Disponible'.`,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "Sí, pasar a Pendiente",
            cancelButtonText: "Volver",
            confirmButtonColor: "#f59e0b"
        });
        if (!confirm.isConfirmed) {
            loadAlquileres();
            return;
        }
    }

    try {
        const result = await Api.updateEstadoAlquiler(id, nuevoEstado);
        toastSuccess(result.message || `Contrato #${id} actualizado a ${nuevoEstado}`);
        loadAlquileres();
        loadDashboard();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
        loadAlquileres();
    }
}

let pickerAlqCliente = null;
let pickerAlqVehiculo = null;
let pickerAlqEmpleado = null;

async function openModalAlquiler() {
    await loadCatalogs();

    const vehiculosOpt = listVehiculos.filter(v => v.estado === "Disponible");
    const vehiculosList = vehiculosOpt.length ? vehiculosOpt : listVehiculos;

    // 1. Buscador de Cliente Arrendatario
    pickerAlqCliente = createSearchPicker({
        containerId: "picker-alq-cliente",
        hiddenInputId: "alq-cliente",
        placeholder: "Buscar cliente por nombre, apellido o cédula...",
        getItems: () => listClientes,
        searchFn: (c, q) => (
            `${c.nombre || ""} ${c.apellido || ""} ${c.identificacion || ""} ${c.correo || ""} ${c.telefono || ""}`
        ).toLowerCase().includes(q),
        renderItem: (c) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    ${(c.nombre?.[0] || "C") + (c.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${c.nombre} ${c.apellido}</div>
                    <div class="text-xs text-slate-500 truncate">Cédula: <span class="font-mono font-medium text-slate-700">${c.identificacion}</span> ${c.telefono ? "· Tel: " + c.telefono : ""}</div>
                </div>
            </div>
        `,
        renderSelected: (c) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    ${(c.nombre?.[0] || "C") + (c.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${c.nombre} ${c.apellido}</div>
                    <div class="text-xs text-slate-500 truncate">Cédula: <span class="font-mono font-medium text-slate-700">${c.identificacion}</span> ${c.telefono ? "· Tel: " + c.telefono : ""}</div>
                </div>
            </div>
        `
    });

    // 2. Buscador de Vehículo Disponible
    pickerAlqVehiculo = createSearchPicker({
        containerId: "picker-alq-vehiculo",
        hiddenInputId: "alq-vehiculo",
        placeholder: "Buscar vehículo por placa, marca o modelo...",
        getItems: () => vehiculosList,
        searchFn: (v, q) => (
            `${v.placa || ""} ${v.marca_nombre || ""} ${v.modelo || ""} ${v.color || ""} ${v.tipo_nombre || ""}`
        ).toLowerCase().includes(q),
        renderItem: (v) => `
            <div class="flex items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-sm">
                        🚗
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 truncate">
                            <span class="font-mono font-bold bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                            <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                        </div>
                        <div class="text-xs text-slate-500 truncate">${v.color || "Blanco"} · Odómetro: <span class="font-mono font-medium">${Number(v.kilometraje || 0).toLocaleString()} km</span></div>
                    </div>
                </div>
                <span class="badge ${v.estado === 'Disponible' ? 'badge-disponible' : 'badge-alquilado'} shrink-0 text-[11px]">${v.estado}</span>
            </div>
        `,
        renderSelected: (v) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 text-sm">
                    🚗
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5 truncate">
                        <span class="font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                        <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                    </div>
                    <div class="text-xs text-slate-500 font-mono truncate">Odómetro salida: ${Number(v.kilometraje || 0).toLocaleString()} km · ${v.color || "Blanco"}</div>
                </div>
            </div>
        `,
        onSelect: (v) => {
            document.getElementById("alq-km").value = v.kilometraje || 0;
        },
        onClear: () => {
            document.getElementById("alq-km").value = 0;
        }
    });

    // 3. Buscador de Asesor Comercial
    pickerAlqEmpleado = createSearchPicker({
        containerId: "picker-alq-empleado",
        hiddenInputId: "alq-empleado",
        placeholder: "Buscar asesor por nombre, apellido o cargo...",
        getItems: () => listEmpleados.filter(e => e.estado !== "Inactivo"),
        searchFn: (e, q) => (
            `${e.nombre || ""} ${e.apellido || ""} ${e.cargo || ""} ${e.correo || ""}`
        ).toLowerCase().includes(q),
        renderItem: (e) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                    ${(e.nombre?.[0] || "A") + (e.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${e.nombre} ${e.apellido}</div>
                    <div class="text-xs text-purple-700 font-medium truncate">Cargo: ${e.cargo || "Asesor Comercial"}</div>
                </div>
            </div>
        `,
        renderSelected: (e) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    ${(e.nombre?.[0] || "A") + (e.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${e.nombre} ${e.apellido}</div>
                    <div class="text-xs text-purple-700 font-medium truncate">${e.cargo || "Asesor Comercial"}</div>
                </div>
            </div>
        `
    });

    // Resetear formulario y campos
    document.getElementById("form-alquiler").reset();
    document.getElementById("alq-cliente").value = "";
    document.getElementById("alq-vehiculo").value = "";
    document.getElementById("alq-empleado").value = "";
    document.getElementById("alq-km").value = 0;
    document.getElementById("alq-obs").value = "";

    // Ocultar registro rápido de cliente al abrir
    toggleInlineNuevoCliente(false);

    // Precargar métodos de pago en el select
    fillSelect("alq-pago-metodo", catalogMetodos, "id_metodo_pago", "nombre");

    // Preseleccionar asesor si el usuario logueado tiene id_empleado
    if (currentUser && currentUser.id_empleado) {
        const empLogueado = listEmpleados.find(e => e.id_empleado === currentUser.id_empleado);
        if (empLogueado && pickerAlqEmpleado) {
            pickerAlqEmpleado.setValue(empLogueado);
        }
    }

    // Configuración inicial de la sección de Pago / Abono
    const chkPago = document.getElementById("alq-incluir-pago");
    if (chkPago) chkPago.checked = true;
    toggleSeccionPagoAlquiler(true);

    const selPagoEstado = document.getElementById("alq-pago-estado");
    if (selPagoEstado) selPagoEstado.value = "Abono";
    actualizarInfoTipoPago("Abono");

    const txtMonto = document.getElementById("alq-pago-monto");
    if (txtMonto) txtMonto.value = "";
    const txtRef = document.getElementById("alq-pago-ref");
    if (txtRef) txtRef.value = "";

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("alq-fecha").value = now.toISOString().slice(0, 16);

    openModal("modal-alquiler");
}

/* ==========================================================================
   MÓDULO EXPRESS: REGISTRO RÁPIDO DE CLIENTE Y PAGO INTEGRADO
   ========================================================================== */

function toggleInlineNuevoCliente(forceShow) {
    const box = document.getElementById("box-inline-nuevo-cliente");
    const btn = document.getElementById("btn-toggle-nuevo-cliente");
    if (!box) return;

    const shouldShow = forceShow !== undefined ? forceShow : box.classList.contains("hidden");
    if (shouldShow) {
        box.classList.remove("hidden");
        if (btn) btn.innerHTML = `<i data-lucide="x" class="w-3.5 h-3.5"></i> Cancelar registro rápido`;
        const firstInput = document.getElementById("quick-cli-doc");
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    } else {
        box.classList.add("hidden");
        if (btn) btn.innerHTML = `<i data-lucide="user-plus" class="w-3.5 h-3.5"></i> + ¿Cliente Nuevo? Registrar aquí`;
    }
    if (window.lucide) lucide.createIcons();
}

async function submitQuickCliente() {
    const doc = (document.getElementById("quick-cli-doc")?.value || "").trim();
    const tel = (document.getElementById("quick-cli-tel")?.value || "").trim();
    const nom = (document.getElementById("quick-cli-nom")?.value || "").trim();
    const ape = (document.getElementById("quick-cli-ape")?.value || "").trim();
    const cor = (document.getElementById("quick-cli-cor")?.value || "").trim();

    if (!doc || !nom || !ape || !tel) {
        Swal.fire({
            icon: "warning",
            title: "Datos incompletos",
            text: "Por favor diligencia Cédula, Nombres, Apellidos y Teléfono del nuevo cliente.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    try {
        const payload = {
            identificacion: doc,
            nombre: nom,
            apellido: ape,
            telefono: tel,
            correo: cor || `${doc}@cliente.com`,
            direccion: "Registrado en Alquiler Express"
        };

        const res = await Api.createCliente(payload);
        const newId = res.id_cliente || res.id;

        const nuevoCliente = {
            id_cliente: newId,
            identificacion: doc,
            nombre: nom,
            apellido: ape,
            telefono: tel,
            correo: cor
        };

        // Incorporar al listado en memoria y ordenarlo
        listClientes.unshift(nuevoCliente);

        // Preseleccionar automáticamente en el picker de cliente del alquiler
        if (pickerAlqCliente) {
            pickerAlqCliente.setValue(nuevoCliente);
        }

        // Ocultar formulario inline y limpiar
        toggleInlineNuevoCliente(false);
        document.getElementById("quick-cli-doc").value = "";
        document.getElementById("quick-cli-tel").value = "";
        document.getElementById("quick-cli-nom").value = "";
        document.getElementById("quick-cli-ape").value = "";
        document.getElementById("quick-cli-cor").value = "";

        toastSuccess(`Cliente ${nom} ${ape} registrado y seleccionado.`);
    } catch (err) {
        Swal.fire("Error al registrar cliente", err.message, "error");
    }
}

function toggleSeccionPagoAlquiler(checked) {
    const box = document.getElementById("box-pago-alquiler");
    if (!box) return;
    if (checked) {
        box.classList.remove("hidden");
    } else {
        box.classList.add("hidden");
    }
}

function actualizarInfoTipoPago(tipo) {
    const hint = document.getElementById("pago-alquiler-hint");
    if (!hint) return;

    if (tipo === "Abono") {
        hint.className = "p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2";
        hint.innerHTML = `
            <i data-lucide="info" class="w-4 h-4 shrink-0 text-amber-600 mt-0.5"></i>
            <div>
                <strong>Modo Abono Activo:</strong> El vehículo seleccionado quedará marcado inmediatamente como <strong>Reservado</strong> en la flota y mostrará el valor del abono registrado.
            </div>
        `;
    } else if (tipo === "Pagado") {
        hint.className = "p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2";
        hint.innerHTML = `
            <i data-lucide="check-circle" class="w-4 h-4 shrink-0 text-emerald-600 mt-0.5"></i>
            <div>
                <strong>Pago Total Completado:</strong> Se asentará el pago completo en caja y el vehículo pasará al estado definido en el contrato.
            </div>
        `;
    } else {
        hint.className = "p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2";
        hint.innerHTML = `
            <i data-lucide="clock" class="w-4 h-4 shrink-0 text-slate-500 mt-0.5"></i>
            <div>
                <strong>Cobro Pendiente:</strong> Se creará el registro contable en estado Pendiente para recaudar posteriormente.
            </div>
        `;
    }
    if (window.lucide) lucide.createIcons();
}

function handleSelectVehiculoAlquiler() {
    const vehiculoId = parseInt(document.getElementById("alq-vehiculo").value);
    const found = listVehiculos.find(v => v.id_vehiculo === vehiculoId);
    if (found) {
        document.getElementById("alq-km").value = found.kilometraje || 0;
    }
}

async function saveAlquiler(e) {
    e.preventDefault();

    const idCliente = parseInt(document.getElementById("alq-cliente").value);
    const idVehiculo = parseInt(document.getElementById("alq-vehiculo").value);
    const idEmpleado = parseInt(document.getElementById("alq-empleado").value);

    if (!idCliente) {
        Swal.fire({
            icon: "warning",
            title: "Cliente requerido",
            text: "Por favor busca o registra el Cliente Arrendatario.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    if (!idVehiculo) {
        Swal.fire({
            icon: "warning",
            title: "Vehículo requerido",
            text: "Por favor selecciona el Vehículo Disponible para el contrato.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    if (!idEmpleado) {
        Swal.fire({
            icon: "warning",
            title: "Asesor requerido",
            text: "Por favor selecciona el Asesor Comercial responsable.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const incluirPago = document.getElementById("alq-incluir-pago")?.checked;
    const montoPago = parseFloat(document.getElementById("alq-pago-monto")?.value) || 0;
    const estadoPago = document.getElementById("alq-pago-estado")?.value || "Abono";
    const metodoPago = parseInt(document.getElementById("alq-pago-metodo")?.value) || 1;
    const refPago = (document.getElementById("alq-pago-ref")?.value || "").trim();

    if (incluirPago && montoPago <= 0 && estadoPago !== "Pendiente") {
        Swal.fire({
            icon: "warning",
            title: "Monto de pago requerido",
            text: "Has marcado registrar pago/abono. Por favor ingresa el monto en pesos COP.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const estadoAlquiler = document.getElementById("alq-estado") ? document.getElementById("alq-estado").value : "Activo";

    const payload = {
        id_cliente: idCliente,
        id_vehiculo: idVehiculo,
        id_empleado: idEmpleado,
        fecha_inicio: document.getElementById("alq-fecha").value.replace("T", " "),
        km_inicio: parseInt(document.getElementById("alq-km").value) || 0,
        estado: estadoAlquiler,
        observaciones: document.getElementById("alq-obs").value.trim()
    };

    try {
        // 1. Guardar Contrato de Alquiler
        const result = await Api.createAlquiler(payload);
        const idAlquiler = result.id_alquiler;

        // 2. Si se marcó pago o abono, registrarlo de inmediato vinculado al alquiler
        let pagoMensaje = "";
        if (incluirPago && montoPago > 0) {
            try {
                await Api.createPago({
                    id_alquiler: idAlquiler,
                    id_metodo_pago: metodoPago,
                    monto: montoPago,
                    estado: estadoPago,
                    referencia: refPago || (estadoPago === "Abono" ? `ABONO-ALQ-${idAlquiler}` : `PAGO-ALQ-${idAlquiler}`)
                });
                pagoMensaje = estadoPago === "Abono"
                    ? `<br><br><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-xs">🚗 Vehículo marcado como <strong>RESERVADO</strong> con abono de $ ${Number(montoPago).toLocaleString("es-CO")}</span>`
                    : `<br><br><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs">💳 Pago de $ ${Number(montoPago).toLocaleString("es-CO")} registrado con éxito</span>`;
            } catch (pagoErr) {
                console.error("Error al registrar pago asociado:", pagoErr);
                pagoMensaje = `<br><br><span class="text-rose-600 text-xs">Advertencia: Contrato creado, pero el comprobante de pago generó un aviso: ${pagoErr.message}</span>`;
            }
        }

        closeModal("modal-alquiler");

        Swal.fire({
            icon: "success",
            title: "¡Operación Realizada con Éxito!",
            html: `Contrato de alquiler <b>#${idAlquiler}</b> procesado correctamente.${pagoMensaje}`,
            confirmButtonColor: "#2563eb",
            confirmButtonText: "Aceptar"
        });

        // Recargar vistas y catálogos sincronizados
        loadAlquileres();
        loadVehiculos();
        loadDashboard();
        loadPagos();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error al procesar contrato", err.message, "error");
    }
}

function openCerrarAlquiler(idAlquiler, kmInicio) {
    document.getElementById("close-alq-id").value = idAlquiler;
    document.getElementById("close-alq-km-fin").value = kmInicio;
    document.getElementById("close-alq-km-fin").min = kmInicio;
    document.getElementById("close-alq-km-hint").textContent = `El kilometraje de entrega debe ser mayor o igual a ${kmInicio} km.`;
    document.getElementById("close-alq-obs").value = "";
    openModal("modal-cerrar-alquiler");
}

async function submitCerrarAlquiler(e) {
    e.preventDefault();
    const idAlquiler = document.getElementById("close-alq-id").value;
    const payload = {
        km_fin: parseInt(document.getElementById("close-alq-km-fin").value),
        observaciones: document.getElementById("close-alq-obs").value.trim()
    };

    try {
        const result = await Api.cerrarAlquiler(idAlquiler, payload);
        closeModal("modal-cerrar-alquiler");
        Swal.fire({
            icon: "success",
            title: "Vehículo Retornado",
            text: result.message || "Contrato cerrado y vehículo restablecido a estado Disponible.",
            confirmButtonColor: "#2563eb"
        });
        loadAlquileres();
        loadDashboard();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/* ==========================================================================
   5. PAGOS Y CAJA (Paginado, Ordenado y Gestión de Estados/Abonos)
   ========================================================================== */
async function loadPagos() {
    const search = document.getElementById("pagos-search") ? document.getElementById("pagos-search").value.trim() : "";
    const estado = document.getElementById("pagos-filtro-estado") ? document.getElementById("pagos-filtro-estado").value : "";
    const tbody = document.getElementById("table-pagos-body");
    if (!tbody) return;

    try {
        const rows = await Api.getPagos(search, estado, 5000);
        listPagos = rows || [];
        const state = paginationState.pagos;
        const sorted = sortData(listPagos, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("pagos");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-slate-400">No se encontraron recibos de pago con los criterios actuales.</td></tr>`;
            renderPaginationBar("pagination-pagos", "pagos", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(p => {
            const estadoNorm = (p.estado || "Pendiente").trim();
            const esPendiente = estadoNorm.toLowerCase() === "pendiente";
            const esAbono = estadoNorm.toLowerCase() === "abono";

            return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-3 py-3 font-bold font-mono text-slate-700 whitespace-nowrap">#${p.id_pago}</td>
                <td class="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5">
                        <i data-lucide="file-text" class="w-3.5 h-3.5 text-blue-600"></i> Contrato #${p.id_alquiler}
                    </span>
                </td>
                <td class="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">${p.cliente_nombre || "Cliente General"}</td>
                <td class="px-2.5 py-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium">${p.metodo_nombre || "Efectivo"}</span>
                </td>
                <td class="px-3 py-3 font-bold ${esPendiente ? 'text-amber-600' : 'text-emerald-600'} font-mono text-sm whitespace-nowrap">
                    $ ${Number(p.monto).toLocaleString("es-CO")}
                </td>
                <td class="px-2.5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">${p.referencia || "—"}</td>
                <td class="px-2.5 py-3 text-xs text-slate-400 whitespace-nowrap">${formatDate(p.fecha_pago)}</td>
                <td class="px-2.5 py-3 whitespace-nowrap">${renderBadge(p.estado)}</td>
                <td class="px-3 py-3 text-right pr-4 whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1">
                        <button onclick="quickChangePagoEstado(${p.id_pago}, '${p.estado}', ${p.monto})" title="Cambiar Estado / Registrar Abono" class="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors inline-flex items-center gap-1">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i> ${esPendiente ? 'Pagar / Abonar' : esAbono ? 'Completar' : 'Estado'}
                        </button>
                        <button onclick="editPago(${p.id_pago})" title="Editar Recibo Completo" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteItem('pagos', ${p.id_pago}, '¿Deseas anular este recibo de pago?')" title="Eliminar / Anular" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join("");

        renderPaginationBar("pagination-pagos", "pagos", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-rose-500">Error al cargar pagos: ${err.message}</td></tr>`;
    }
}

/**
 * Ventana emergente rápida para cambiar el estado de un pago o registrar un abono / pago total
 */
async function quickChangePagoEstado(idPago, currentEstado, currentMonto) {
    const estadoActual = (currentEstado || "Pendiente").trim();
    const montoFormateado = Number(currentMonto || 0);

    const { value: formValues } = await Swal.fire({
        title: `<div class="text-left font-bold text-slate-800 text-lg flex items-center gap-2">
            <span class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">#</span>
            Cambiar Estado del Pago #${idPago}
        </div>`,
        html: `
            <div class="text-left space-y-3.5 pt-2 text-sm">
                <p class="text-xs text-slate-500">
                    Selecciona el nuevo estado del comprobante y ajusta el monto si el cliente realizó un abono o completó el saldo:
                </p>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Estado de Pago</label>
                    <select id="swal-pago-estado" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                        <option value="Completado" ${estadoActual.toLowerCase() === "completado" ? "selected" : ""}>✅ Completado (Pagado Total)</option>
                        <option value="Abono" ${estadoActual.toLowerCase() === "abono" ? "selected" : ""}>🟡 Abono (Pago Parcial)</option>
                        <option value="Pendiente" ${estadoActual.toLowerCase() === "pendiente" ? "selected" : ""}>⏳ Pendiente (Por Cobrar)</option>
                        <option value="Rechazado" ${estadoActual.toLowerCase() === "rechazado" ? "selected" : ""}>❌ Rechazado (Anulado / Sin Fondos)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Monto Registrado ($ COP)</label>
                    <input type="number" id="swal-pago-monto" value="${montoFormateado}" step="1000" min="0" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-[11px] text-slate-400 mt-1">Si es un abono, ingresa el valor abonado. Si ya liquidó el total, confirma la cifra.</p>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Actualizar Estado",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#2563eb",
        preConfirm: () => {
            const estado = document.getElementById("swal-pago-estado").value;
            const monto = parseFloat(document.getElementById("swal-pago-monto").value);
            if (isNaN(monto) || monto < 0) {
                Swal.showValidationMessage("Por favor ingresa un monto válido mayor o igual a 0.");
                return false;
            }
            return { estado, monto };
        }
    });

    if (formValues) {
        try {
            await Api.updateEstadoPago(idPago, formValues.estado, formValues.monto);
            toastSuccess(`Pago #${idPago} actualizado a '${formValues.estado}' correctamente.`);
            await loadPagos();
            if (typeof loadDashboard === "function") loadDashboard();
        } catch (err) {
            Swal.fire("Error", err.message || "No se pudo actualizar el pago", "error");
        }
    }
}

let pickerPagoAlquiler = null;

/**
 * Abrir el modal de registro o edición de pago con Buscador de Contrato
 */
async function openModalPago(pago = null) {
    await loadCatalogs();
    try {
        const alquileres = await Api.getAlquileres("", "", 1000);
        fillSelect("pago-metodo", catalogMetodos, "id_metodo_pago", "nombre");

        // Filtrar contratos para cobro: solo contratos pendientes de pago y abonos (excluye Finalizados y Cancelados)
        const contratosParaPago = alquileres.filter(a => {
            if (pago && a.id_alquiler === pago.id_alquiler) return true;
            const alqEst = (a.estado || "").toLowerCase();
            const pagoEst = (a.pago_estado || "").toLowerCase();

            // Nunca mostrar contratos Finalizados ni Cancelados
            if (alqEst === "finalizado" || alqEst === "cancelado") return false;

            // Excluir si ya está totalmente completado/pagado
            if (pagoEst === "completado") return false;

            // Incluir si tiene pago en Pendiente, Abono o contrato vigente por cobrar
            return true;
        });

        // Inicializar Buscador de Contrato de Alquiler
        pickerPagoAlquiler = createSearchPicker({
            containerId: "picker-pago-alquiler",
            hiddenInputId: "pago-alquiler",
            placeholder: "Buscar contrato por #, cliente o placa...",
            getItems: () => contratosParaPago,
            searchFn: (a, q) => (
                `#${a.id_alquiler} ${a.id_alquiler} ${a.cliente_nombre || ""} ${a.vehiculo_placa || ""} ${a.vehiculo_detalle || ""} ${a.pago_estado || ""} ${a.estado || ""}`
            ).toLowerCase().includes(q),
            renderItem: (a) => {
                const pagoEst = (a.pago_estado || "Pendiente").trim();
                const esAbono = pagoEst.toLowerCase() === "abono";
                const badgeHtml = esAbono 
                    ? `<span class="badge bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px]">Abono</span>`
                    : `<span class="badge badge-pendiente text-[11px]">Pendiente</span>`;

                return `
                <div class="flex items-center justify-between gap-3 min-w-0">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                            #${a.id_alquiler}
                        </div>
                        <div class="min-w-0">
                            <div class="font-semibold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                <span>${a.cliente_nombre || "Cliente General"}</span>
                                <span class="text-[11px] text-slate-400 font-normal">(${a.estado})</span>
                            </div>
                            <div class="text-xs text-slate-500 truncate flex items-center gap-1.5">
                                <span class="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium text-[11px]">${a.vehiculo_placa || "Sin placa"}</span>
                                <span class="truncate">· ${a.vehiculo_detalle || ""}</span>
                            </div>
                        </div>
                    </div>
                    <div class="shrink-0 text-right">
                        ${badgeHtml}
                    </div>
                </div>
                `;
            },
            renderSelected: (a) => {
                const pagoEst = (a.pago_estado || "Pendiente").trim();
                const esAbono = pagoEst.toLowerCase() === "abono";
                const badgeHtml = esAbono 
                    ? `<span class="badge bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px]">Abono</span>`
                    : `<span class="badge badge-pendiente text-[11px]">Pendiente</span>`;

                return `
                <div class="flex items-center justify-between gap-3 min-w-0 w-full">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold font-mono text-xs flex items-center justify-center shrink-0 shadow-sm">
                            #${a.id_alquiler}
                        </div>
                        <div class="min-w-0">
                            <div class="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                                <span>Contrato #${a.id_alquiler}</span>
                                <span class="text-xs font-normal text-slate-500">— ${a.cliente_nombre}</span>
                            </div>
                            <div class="text-xs text-slate-500 truncate flex items-center gap-1.5">
                                <span class="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold border border-blue-200 text-[11px]">${a.vehiculo_placa}</span>
                                <span class="truncate">${a.vehiculo_detalle || ""}</span>
                            </div>
                        </div>
                    </div>
                    <div class="shrink-0">
                        ${badgeHtml}
                    </div>
                </div>
                `;
            }
        });

        const modalTitle = document.getElementById("modal-pago-title");
        const btnSave = document.getElementById("btn-save-pago");

        if (pago) {
            if (modalTitle) modalTitle.textContent = `Editar Comprobante #${pago.id_pago}`;
            if (btnSave) btnSave.textContent = "Guardar Cambios";
            document.getElementById("pago-id").value = pago.id_pago;
            document.getElementById("pago-alquiler").value = pago.id_alquiler;

            const foundAlq = alquileres.find(a => a.id_alquiler === pago.id_alquiler);
            if (foundAlq && pickerPagoAlquiler) {
                pickerPagoAlquiler.setValue(foundAlq);
            } else if (pickerPagoAlquiler) {
                pickerPagoAlquiler.setValue({
                    id_alquiler: pago.id_alquiler,
                    cliente_nombre: pago.cliente_nombre || "Cliente General",
                    vehiculo_placa: pago.vehiculo_placa || "—",
                    vehiculo_detalle: "Contrato Registrado",
                    estado: "Activo"
                });
            }

            document.getElementById("pago-metodo").value = pago.id_metodo_pago;
            document.getElementById("pago-monto").value = pago.monto;
            document.getElementById("pago-referencia").value = pago.referencia || "";
            document.getElementById("pago-estado").value = pago.estado || "Completado";
        } else {
            if (modalTitle) modalTitle.textContent = "Registrar Comprobante de Pago";
            if (btnSave) btnSave.textContent = "Guardar Recibo";
            document.getElementById("pago-id").value = "";
            document.getElementById("pago-monto").value = "";
            document.getElementById("pago-referencia").value = "TRX-" + Math.floor(100000 + Math.random() * 900000);
            document.getElementById("pago-estado").value = "Completado";
            if (pickerPagoAlquiler) pickerPagoAlquiler.reset();
        }

        openModal("modal-pago");
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        Swal.fire("Error", "No se pudieron cargar los contratos de alquiler para el pago.", "error");
    }
}

/**
 * Abrir edición completa de un recibo
 */
function editPago(idPago) {
    const found = listPagos.find(p => p.id_pago === idPago);
    if (!found) {
        Swal.fire("Error", "No se encontró el registro del comprobante de pago.", "error");
        return;
    }
    openModalPago(found);
}

/**
 * Guardar o actualizar comprobante de pago
 */
async function savePago(e) {
    e.preventDefault();
    const idPago = document.getElementById("pago-id").value;
    const idAlquiler = parseInt(document.getElementById("pago-alquiler").value);

    if (!idAlquiler) {
        Swal.fire({
            icon: "warning",
            title: "Contrato requerido",
            text: "Por favor busca y selecciona el Contrato de Alquiler vinculado al comprobante.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const payload = {
        id_alquiler: idAlquiler,
        id_metodo_pago: parseInt(document.getElementById("pago-metodo").value),
        monto: parseFloat(document.getElementById("pago-monto").value),
        estado: document.getElementById("pago-estado").value,
        referencia: document.getElementById("pago-referencia").value.trim()
    };

    try {
        if (idPago) {
            const result = await Api.updatePago(idPago, payload);
            closeModal("modal-pago");
            toastSuccess(result.message || "Comprobante de pago actualizado exitosamente");
        } else {
            const result = await Api.createPago(payload);
            closeModal("modal-pago");
            toastSuccess(result.message || "Pago registrado exitosamente");
        }
        loadPagos();
        if (typeof loadDashboard === "function") loadDashboard();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/* ==========================================================================
   6. MANTENIMIENTO TÉCNICO (Paginado y Ordenado)
   ========================================================================== */
let pickerMantVehiculo = null;
let pickerMantEmpleado = null;

async function loadMantenimientos() {
    const search = document.getElementById("mantenimientos-search") ? document.getElementById("mantenimientos-search").value.trim() : "";
    const estado = document.getElementById("mantenimientos-filtro-estado") ? document.getElementById("mantenimientos-filtro-estado").value : "";
    const tbody = document.getElementById("table-mantenimientos-body");
    if (!tbody) return;

    try {
        const rows = await Api.getMantenimientos(search, estado, 5000);
        const state = paginationState.mantenimientos;
        const sorted = sortData(rows, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("mantenimientos");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400">Sin órdenes de taller encontradas con los filtros aplicados.</td></tr>`;
            renderPaginationBar("pagination-mantenimientos", "mantenimientos", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(m => {
            const st = (m.estado || "").toLowerCase();
            const esPendiente = st.includes("proceso") || st.includes("pendiente");
            const esCompletado = st.includes("completado") || st.includes("realizado");

            let actionBtn = "";
            if (esPendiente) {
                actionBtn = `
                    <button onclick="promptCompletarMantenimiento(${m.id_mantenimiento}, '${m.vehiculo_placa || ""}', ${m.costo || 0})" 
                            title="Completar mantenimiento y liberar vehículo a Disponible" 
                            class="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1.5 mr-1.5 shadow-sm">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i> Completar
                    </button>
                `;
            } else if (esCompletado) {
                actionBtn = `
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mr-1.5">
                        <i data-lucide="check-check" class="w-3.5 h-3.5"></i> Listo
                    </span>
                `;
            }

            return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold font-mono text-slate-700 whitespace-nowrap">#${m.id_mantenimiento}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs border border-slate-200">${m.vehiculo_placa}</span>
                    <span class="text-xs text-slate-500 font-medium ml-1">(${m.vehiculo_detalle})</span>
                </td>
                <td class="px-4 py-3 text-slate-700 text-sm font-medium whitespace-nowrap">${m.empleado_nombre || "No asignado"}</td>
                <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">${formatDate(m.fecha_mantenimiento)}</td>
                <td class="px-4 py-3 text-slate-700 text-xs max-w-[220px] truncate" title="${m.descripcion || ''}">${m.descripcion || "Mantenimiento preventivo"}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 font-mono text-sm whitespace-nowrap">$ ${Number(m.costo || 0).toLocaleString("es-CO")}</td>
                <td class="px-4 py-3 whitespace-nowrap">${renderBadge(m.estado)}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    ${actionBtn}
                    <button onclick="deleteItem('mantenimientos', ${m.id_mantenimiento}, '¿Eliminar orden de mantenimiento?')" title="Eliminar Orden" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
            `;
        }).join("");

        renderPaginationBar("pagination-mantenimientos", "mantenimientos", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-rose-500">Error al cargar mantenimientos: ${err.message}</td></tr>`;
    }
}

async function openModalMantenimiento() {
    await loadCatalogs();

    // 1. Selector tipo búsqueda para Vehículo
    pickerMantVehiculo = createSearchPicker({
        containerId: "picker-mant-vehiculo",
        hiddenInputId: "mant-vehiculo",
        placeholder: "Buscar vehículo por placa, marca o modelo...",
        getItems: () => listVehiculos,
        searchFn: (v, q) => (
            `${v.placa || ""} ${v.marca_nombre || ""} ${v.modelo || ""} ${v.color || ""} ${v.estado || ""}`
        ).toLowerCase().includes(q),
        renderItem: (v) => {
            const estadoBadge = v.estado === 'Disponible' 
                ? 'badge-disponible' 
                : (v.estado === 'Mantenimiento' ? 'badge-mantenimiento' : 'badge-alquilado');
            return `
            <div class="flex items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-sm">
                        🚗
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 truncate">
                            <span class="font-mono font-bold bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                            <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                        </div>
                        <div class="text-xs text-slate-500 truncate">${v.color || "Blanco"} · Odómetro: <span class="font-mono font-medium">${Number(v.kilometraje || 0).toLocaleString()} km</span></div>
                    </div>
                </div>
                <span class="badge ${estadoBadge} shrink-0 text-[11px]">${v.estado}</span>
            </div>
            `;
        },
        renderSelected: (v) => `
            <div class="flex items-center justify-between w-full gap-2 min-w-0">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 text-sm">
                        🚗
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 truncate">
                            <span class="font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs shrink-0">${v.placa}</span>
                            <span class="font-semibold text-slate-800 text-sm truncate">${v.marca_nombre || ""} ${v.modelo || ""}</span>
                        </div>
                        <div class="text-xs text-slate-500 font-mono truncate">Odómetro: ${Number(v.kilometraje || 0).toLocaleString()} km · Estado actual: ${v.estado}</div>
                    </div>
                </div>
                <span class="badge ${v.estado === 'Disponible' ? 'badge-disponible' : (v.estado === 'Mantenimiento' ? 'badge-mantenimiento' : 'badge-alquilado')} shrink-0 text-[11px]">${v.estado}</span>
            </div>
        `
    });

    // 2. Selector tipo búsqueda para Mecánico / Personal técnico
    pickerMantEmpleado = createSearchPicker({
        containerId: "picker-mant-empleado",
        hiddenInputId: "mant-empleado",
        placeholder: "Buscar mecánico o técnico por nombre o cargo...",
        getItems: () => {
            const mecanicos = listEmpleados.filter(e => (e.cargo || "").toLowerCase().includes("mecánico") || (e.cargo || "").toLowerCase().includes("mecanico"));
            return (mecanicos.length > 0 ? mecanicos : listEmpleados).filter(e => e.estado !== "Inactivo");
        },
        searchFn: (e, q) => (
            `${e.nombre || ""} ${e.apellido || ""} ${e.cargo || ""} ${e.identificacion || ""}`
        ).toLowerCase().includes(q),
        renderItem: (e) => `
            <div class="flex items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                        ${(e.nombre?.[0] || "M") + (e.apellido?.[0] || "")}
                    </div>
                    <div class="min-w-0">
                        <div class="font-semibold text-slate-800 text-sm truncate">${e.nombre} ${e.apellido}</div>
                        <div class="text-xs text-slate-500 truncate"><span class="text-emerald-700 font-medium">${e.cargo || "Técnico"}</span> ${e.telefono ? "· Tel: " + e.telefono : ""}</div>
                    </div>
                </div>
                <span class="badge bg-slate-100 text-slate-600 border border-slate-200 shrink-0 text-[10px] uppercase font-mono">${e.cargo || "Personal"}</span>
            </div>
        `,
        renderSelected: (e) => `
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    ${(e.nombre?.[0] || "M") + (e.apellido?.[0] || "")}
                </div>
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 text-sm truncate">${e.nombre} ${e.apellido}</div>
                    <div class="text-xs text-slate-500 truncate"><span class="text-emerald-700 font-medium">${e.cargo || "Técnico"}</span> ${e.identificacion ? "· Doc: " + e.identificacion : ""}</div>
                </div>
            </div>
        `
    });

    document.getElementById("form-mantenimiento").reset();
    document.getElementById("mant-vehiculo").value = "";
    document.getElementById("mant-empleado").value = "";
    if (pickerMantVehiculo) pickerMantVehiculo.reset();
    if (pickerMantEmpleado) pickerMantEmpleado.reset();

    document.getElementById("mant-fecha").value = new Date().toISOString().split("T")[0];
    openModal("modal-mantenimiento");
}

async function saveMantenimiento(e) {
    e.preventDefault();
    const idVehiculo = parseInt(document.getElementById("mant-vehiculo").value);
    const idEmpleado = parseInt(document.getElementById("mant-empleado").value);

    if (!idVehiculo) {
        Swal.fire({
            icon: "warning",
            title: "Vehículo requerido",
            text: "Por favor busca y selecciona el vehículo a intervenir.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    if (!idEmpleado) {
        Swal.fire({
            icon: "warning",
            title: "Mecánico requerido",
            text: "Por favor busca y selecciona el mecánico responsable de la orden.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const payload = {
        id_vehiculo: idVehiculo,
        id_empleado: idEmpleado,
        fecha_mantenimiento: document.getElementById("mant-fecha").value,
        costo: parseFloat(document.getElementById("mant-costo").value) || 0,
        estado: document.getElementById("mant-estado").value,
        descripcion: document.getElementById("mant-desc").value.trim()
    };

    try {
        const result = await Api.createMantenimiento(payload);
        closeModal("modal-mantenimiento");
        toastSuccess(result.message || "Mantenimiento programado correctamente");
        loadMantenimientos();
        loadDashboard();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/* ==========================================================================
   7. CLIENTES (Paginado y Ordenado)
   ========================================================================== */
async function loadClientes() {
    const search = document.getElementById("clientes-search") ? document.getElementById("clientes-search").value : "";
    const tbody = document.getElementById("table-clientes-body");
    if (!tbody) return;

    try {
        const rows = await Api.getClientes(search, 5000);
        listClientes = rows;

        const state = paginationState.clientes;
        const sorted = sortData(rows, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("clientes");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No se encontraron clientes registrados.</td></tr>`;
            renderPaginationBar("pagination-clientes", "clientes", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(c => `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold font-mono text-slate-500 whitespace-nowrap">#${c.id_cliente}</td>
                <td class="px-4 py-3 font-bold font-mono text-slate-700 whitespace-nowrap">${c.identificacion}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">${c.nombre} ${c.apellido}</td>
                <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${c.telefono}</td>
                <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${c.correo || "—"}</td>
                <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap max-w-[200px] truncate" title="${c.direccion || ''}">${c.direccion || "—"}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    <button onclick="editCliente(${c.id_cliente})" title="Editar" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteItem('clientes', ${c.id_cliente}, '¿Deseas eliminar este cliente y todos sus registros asociados?')" title="Eliminar" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join("");

        renderPaginationBar("pagination-clientes", "clientes", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Error al cargar clientes: ${err.message}</td></tr>`;
    }
}

function openModalCliente(cliente = null) {
    if (cliente) {
        document.getElementById("modal-cliente-title").textContent = "Editar Cliente";
        document.getElementById("c-id").value = cliente.id_cliente;
        document.getElementById("c-identificacion").value = cliente.identificacion;
        document.getElementById("c-nombre").value = cliente.nombre;
        document.getElementById("c-apellido").value = cliente.apellido;
        document.getElementById("c-telefono").value = cliente.telefono;
        document.getElementById("c-correo").value = cliente.correo || "";
        document.getElementById("c-direccion").value = cliente.direccion || "";
    } else {
        document.getElementById("modal-cliente-title").textContent = "Registrar Cliente";
        document.getElementById("form-cliente").reset();
        document.getElementById("c-id").value = "";
    }
    openModal("modal-cliente");
}

function editCliente(id) {
    const c = listClientes.find(item => item.id_cliente === id);
    if (c) openModalCliente(c);
}

async function saveCliente(e) {
    e.preventDefault();
    const id = document.getElementById("c-id").value;
    const payload = {
        identificacion: document.getElementById("c-identificacion").value.trim(),
        nombre: document.getElementById("c-nombre").value.trim(),
        apellido: document.getElementById("c-apellido").value.trim(),
        telefono: document.getElementById("c-telefono").value.trim(),
        correo: document.getElementById("c-correo").value.trim(),
        direccion: document.getElementById("c-direccion").value.trim()
    };

    try {
        let result;
        if (id) {
            result = await Api.updateCliente(id, payload);
        } else {
            result = await Api.createCliente(payload);
        }

        closeModal("modal-cliente");
        toastSuccess(result.message || "Cliente guardado exitosamente");
        loadClientes();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/* ==========================================================================
   8. EMPLEADOS (Paginado y Ordenado)
   ========================================================================== */
async function loadEmpleados() {
    const search = document.getElementById("empleados-search") ? document.getElementById("empleados-search").value : "";
    const tbody = document.getElementById("table-empleados-body");
    if (!tbody) return;

    try {
        const rows = await Api.getEmpleados(search, 5000);
        listEmpleados = rows;

        const state = paginationState.empleados;
        const sorted = sortData(rows, state.sortField, state.sortOrder);
        const total = sorted.length;

        updateSortIndicators("empleados");

        if (!total) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No hay empleados registrados.</td></tr>`;
            renderPaginationBar("pagination-empleados", "empleados", 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageItems = sorted.slice(start, start + state.pageSize);

        tbody.innerHTML = pageItems.map(e => `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold font-mono text-slate-500 whitespace-nowrap">#${e.id_empleado}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">${e.nombre} ${e.apellido}</td>
                <td class="px-4 py-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">${e.cargo || "Asesor"}</span></td>
                <td class="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">${e.telefono} <span class="text-slate-400 ml-1">(${e.correo || ""})</span></td>
                <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">${formatDate(e.fecha_ingreso)}</td>
                <td class="px-4 py-3 whitespace-nowrap">${renderBadge(e.estado)}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    <button onclick="editEmpleado(${e.id_empleado})" title="Editar" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteItem('empleados', ${e.id_empleado}, '¿Eliminar empleado de la base de datos?')" title="Eliminar" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join("");

        renderPaginationBar("pagination-empleados", "empleados", total);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Error al cargar empleados: ${err.message}</td></tr>`;
    }
}

function openModalEmpleado(emp = null) {
    if (emp) {
        document.getElementById("modal-empleado-title").textContent = "Editar Empleado";
        document.getElementById("emp-id").value = emp.id_empleado;
        document.getElementById("emp-nombre").value = emp.nombre;
        document.getElementById("emp-apellido").value = emp.apellido;
        document.getElementById("emp-cargo").value = emp.cargo;
        document.getElementById("emp-telefono").value = emp.telefono;
        document.getElementById("emp-correo").value = emp.correo || "";
        document.getElementById("emp-estado").value = emp.estado || "Activo";
    } else {
        document.getElementById("modal-empleado-title").textContent = "Registrar Empleado";
        document.getElementById("form-empleado").reset();
        document.getElementById("emp-id").value = "";
    }
    openModal("modal-empleado");
}

function editEmpleado(id) {
    const e = listEmpleados.find(item => item.id_empleado === id);
    if (e) openModalEmpleado(e);
}

async function saveEmpleado(e) {
    e.preventDefault();
    const id = document.getElementById("emp-id").value;
    const payload = {
        nombre: document.getElementById("emp-nombre").value.trim(),
        apellido: document.getElementById("emp-apellido").value.trim(),
        cargo: document.getElementById("emp-cargo").value.trim(),
        telefono: document.getElementById("emp-telefono").value.trim(),
        correo: document.getElementById("emp-correo").value.trim(),
        estado: document.getElementById("emp-estado").value
    };

    try {
        let result;
        if (id) {
            result = await Api.updateEmpleado(id, payload);
        } else {
            result = await Api.createEmpleado(payload);
        }

        closeModal("modal-empleado");
        toastSuccess(result.message || "Empleado guardado correctamente");
        loadEmpleados();
        loadCatalogs();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/* ==========================================================================
   HELPERS GLOBALES
   ========================================================================== */
async function deleteItem(endpoint, id, questionText) {
    const confirm = await Swal.fire({
        title: "¿Estás seguro?",
        text: questionText,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (confirm.isConfirmed) {
        try {
            const result = await Api.delete(`/api/${endpoint}/${id}`);
            toastSuccess(result.message || "Registro eliminado exitosamente");
            fetchCurrentView();
            loadCatalogs();
        } catch (err) {
            Swal.fire("No se pudo eliminar", err.message, "error");
        }
    }
}

function fillSelect(selectId, items, valueKey, labelGenerator) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = (items || []).map(item => {
        const val = item[valueKey];
        const text = typeof labelGenerator === "function" ? labelGenerator(item) : item[labelGenerator];
        return `<option value="${val}">${text}</option>`;
    }).join("");
}

function renderBadge(status) {
    if (!status) return `<span class="badge bg-slate-100 text-slate-500">—</span>`;
    const st = status.toLowerCase();
    if (st === "disponible" || st === "pagado" || st === "completado" || st === "activo") {
        return `<span class="badge badge-disponible">${status}</span>`;
    }
    if (st === "alquilado") {
        return `<span class="badge badge-alquilado">${status}</span>`;
    }
    if (st === "confirmada") {
        return `<span class="badge badge-confirmada">${status}</span>`;
    }
    if (st === "pendiente") {
        return `<span class="badge badge-pendiente">${status}</span>`;
    }
    if (st === "abono" || st === "parcial") {
        return `<span class="badge bg-amber-50 text-amber-700 border border-amber-200 font-semibold">${status}</span>`;
    }
    if (st === "finalizada" || st === "finalizado") {
        return `<span class="badge badge-finalizada">${status}</span>`;
    }
    if (st === "rechazada" || st === "rechazado") {
        return `<span class="badge badge-rechazada">${status}</span>`;
    }
    if (st === "cancelada" || st === "cancelado" || st === "inactivo") {
        return `<span class="badge badge-cancelada">${status}</span>`;
    }
    if (st === "reservado") {
        return `<span class="badge badge-reservado">${status}</span>`;
    }
    if (st.includes("mantenimiento") || st === "en proceso") {
        return `<span class="badge badge-mantenimiento">${status}</span>`;
    }
    return `<span class="badge bg-slate-100 text-slate-700">${status}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
    } catch (e) {
        return dateStr;
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove("hidden");
        if (window.lucide) lucide.createIcons();
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add("hidden");
    }
}

function toastSuccess(msg) {
    Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
    });
}

function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/* ==========================================================================
   ACCIÓN: COMPLETAR MANTENIMIENTO TÉCNICO
   ========================================================================== */
async function promptCompletarMantenimiento(id, placa, costoActual) {
    const { value: formValues } = await Swal.fire({
        title: `<div class="flex items-center justify-center gap-2 text-slate-800 text-lg font-bold"><i data-lucide="wrench" class="w-5 h-5 text-emerald-600 inline"></i> Completar Mantenimiento</div>`,
        html: `
            <div class="text-left text-sm text-slate-600 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs text-slate-500 font-semibold uppercase">Vehículo intervenido:</span>
                    <span class="font-mono font-bold text-slate-800 bg-white border border-slate-300 px-2 py-0.5 rounded">${placa || 'N/A'}</span>
                </div>
                <p class="text-xs text-emerald-700 mt-2 flex items-center gap-1 font-medium">
                    <span>🚗</span> Al completar la orden, el vehículo volverá a estar <strong>Disponible</strong>.
                </p>
            </div>
            <div class="text-left space-y-3">
                <div>
                    <label class="text-xs font-semibold text-slate-700 block mb-1">Costo final del servicio ($ COP):</label>
                    <input id="swal-mant-costo" type="number" min="0" step="1000" class="input-form font-mono font-bold" value="${costoActual || 0}">
                </div>
                <div>
                    <label class="text-xs font-semibold text-slate-700 block mb-1">Observación o trabajo finalizado (opcional):</label>
                    <textarea id="swal-mant-obs" class="input-form text-xs" rows="2" placeholder="Reparación completada con éxito, vehículo listo para renta..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Completar y Liberar Vehículo",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#059669",
        cancelButtonColor: "#64748b",
        didOpen: () => {
            if (window.lucide) lucide.createIcons();
        },
        preConfirm: () => {
            const cInput = document.getElementById("swal-mant-costo");
            const oInput = document.getElementById("swal-mant-obs");
            return {
                costo: parseFloat(cInput ? cInput.value : 0) || 0,
                descripcion: oInput ? oInput.value.trim() : ""
            };
        }
    });

    if (formValues) {
        try {
            const res = await Api.completarMantenimiento(id, formValues);
            toastSuccess(res.message || `Mantenimiento #${id} completado. Vehículo ahora Disponible.`);
            loadMantenimientos();
            loadVehiculos();
            loadDashboard();
            loadCatalogs();
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        }
    }
}

/* ==========================================================================
   PERFIL DEL ADMINISTRADOR
   ========================================================================== */
async function openModalPerfil() {
    if (!currentUser || !currentUser.id_usuario) {
        toastError("No hay una sesión activa de usuario.");
        return;
    }

    try {
        let user = currentUser;
        try {
            const fresh = await Api.getPerfil(currentUser.id_usuario);
            if (fresh) user = { ...currentUser, ...fresh };
        } catch (e) {
            console.warn("No se pudo obtener perfil fresco, usando sesión local:", e);
        }

        document.getElementById("perfil-nombre").value = user.nombre || "";
        document.getElementById("perfil-apellido").value = user.apellido || "";
        document.getElementById("perfil-correo").value = user.correo || "";
        document.getElementById("perfil-telefono").value = user.telefono || "";
        document.getElementById("perfil-usuario").value = user.usuario || "";
        document.getElementById("perfil-password").value = "";
        document.getElementById("perfil-password-confirm").value = "";

        const cargoEl = document.getElementById("perfil-cargo-badge");
        if (cargoEl) cargoEl.textContent = `${user.cargo || "Administrador del Sistema"} • Usuario #${user.id_usuario}`;

        const avatarPreview = document.getElementById("perfil-avatar-preview");
        if (avatarPreview) {
            const initials = (user.nombre ? user.nombre[0] : "") + (user.apellido ? user.apellido[0] : "");
            avatarPreview.textContent = initials.toUpperCase() || "AD";
        }

        openModal("modal-perfil");
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        Swal.fire("Error", "No se pudo cargar el perfil: " + err.message, "error");
    }
}

async function savePerfil(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.id_usuario) return;

    const nombre = document.getElementById("perfil-nombre").value.trim();
    const apellido = document.getElementById("perfil-apellido").value.trim();
    const correo = document.getElementById("perfil-correo").value.trim();
    const telefono = document.getElementById("perfil-telefono").value.trim();
    const usuario = document.getElementById("perfil-usuario").value.trim();
    const password = document.getElementById("perfil-password").value;
    const passwordConfirm = document.getElementById("perfil-password-confirm").value;

    if (!usuario) {
        Swal.fire("Atención", "El nombre de usuario es obligatorio.", "warning");
        return;
    }

    if (password && password !== passwordConfirm) {
        Swal.fire({
            icon: "warning",
            title: "Las contraseñas no coinciden",
            text: "Por favor verifica que la nueva contraseña y su confirmación sean exactamente iguales.",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const payload = {
        nombre,
        apellido,
        correo,
        telefono,
        usuario
    };

    if (password && password.trim()) {
        payload.password = password.trim();
    }

    const btnSubmit = document.getElementById("btn-save-perfil");
    const originalText = btnSubmit ? btnSubmit.innerHTML : "";
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Guardando...`;
    }

    try {
        const result = await Api.updatePerfil(currentUser.id_usuario, payload);
        
        if (result.user) {
            currentUser = { ...currentUser, ...result.user };
            localStorage.setItem("autorent_user", JSON.stringify(currentUser));
        }

        updateUserHeader();
        closeModal("modal-perfil");
        toastSuccess(result.message || "Perfil de administrador actualizado correctamente");
    } catch (err) {
        Swal.fire("Error al actualizar perfil", err.message, "error");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
            if (window.lucide) lucide.createIcons();
        }
    }
}
