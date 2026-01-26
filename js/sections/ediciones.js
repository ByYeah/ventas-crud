import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class EdicionesManager {
    constructor(app) {
        this.app = app;
        this.api = new ApiService();
        this.ui = new UIUtils();
        this.utils = Utils;
        this.registros = [];
        this.filteredRegistros = [];
        this.currentPage = 1;
        this.registrosPerPage = CONFIG.PAGINATION.registrosPorPagina;
        this.initElements();
        this.bindEvents();
        this.cleanupTimeout = null;
        this.isCurrentSection = false;
    }

    initElements() {
        this.elements = {
            fechaInicio: document.getElementById('fecha-inicio-ediciones'),
            fechaFin: document.getElementById('fecha-fin-ediciones'),
            filtroTipoProducto: document.getElementById('filtro-tipo-producto'),
            filtroReferencia: document.getElementById('filtro-referencia'),
            btnBuscar: document.getElementById('btn-buscar-ediciones'),
            btnLimpiar: document.getElementById('btn-limpiar-ediciones'),
            btnAnterior: document.getElementById('btn-anterior-ediciones'),
            btnSiguiente: document.getElementById('btn-siguiente-ediciones'),
            paginaActual: document.getElementById('pagina-actual-ediciones'),
            loadingOverlay: document.getElementById('loading-overlay-ediciones'),
            tableBody: document.querySelector('#tabla-ediciones tbody'),
        };
    }

    bindEvents() {
        this.elements.btnBuscar.addEventListener('click', () => this.filtrarRegistros());
        this.elements.btnLimpiar.addEventListener('click', () => this.limpiarFiltros());
        this.elements.btnAnterior.addEventListener('click', () => this.cambiarPagina(-1));
        this.elements.btnSiguiente.addEventListener('click', () => this.cambiarPagina(1));

        // Event delegation para botones de Editar/Eliminar
        this.elements.tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-editar')) {
                const id = e.target.dataset.id;
                this.prepararEdicion(id);
            }
            if (e.target.classList.contains('btn-eliminar')) {
                const id = e.target.dataset.id;
                this.prepararEliminacion(id);
            }
        });
    }

    onSectionShow() {
        this.isCurrentSection = true;
        this.clearCleanupTimeout();

        // Uso de la nueva utilidad centralizada
        const today = this.utils.getTodayInputFormat();
        this.elements.fechaInicio.value = today;
        this.elements.fechaFin.value = today;
    }

    onSectionHide() {
        this.isCurrentSection = false;
        this.scheduleDataCleanup();
    }

    normalizeDate(dateInput) {
        if (!dateInput) return null;
        if (dateInput instanceof Date) return dateInput;
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [year, month, day] = dateInput.split('-');
            return new Date(Date.UTC(year, month - 1, day));
        }
        if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
            const [day, month, year] = dateInput.split('/');
            return new Date(Date.UTC(year, month - 1, day));
        }
        if (typeof dateInput === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
            const [month, day, year] = dateInput.split('/');
            return new Date(Date.UTC(year, month - 1, day));
        }
        const parsedDate = new Date(dateInput);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
        if (typeof dateInput === 'string' && /^\d+$/.test(dateInput)) {
            const timestamp = parseInt(dateInput);
            if (!isNaN(timestamp)) return new Date(timestamp);
        }
        return null;
    }

    formatToISO(date) {
        if (!date || !(date instanceof Date)) return '';
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatToDisplay(date) {
        if (!date || !(date instanceof Date)) return '-';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    compareDates(fechaOriginal, startDateStr, endDateStr) {
        if (typeof fechaOriginal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaOriginal)) {
            return fechaOriginal >= startDateStr && fechaOriginal <= endDateStr;
        }
        if (typeof fechaOriginal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaOriginal)) {
            const [day, month, year] = fechaOriginal.split('/');
            const fechaISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            return fechaISO >= startDateStr && fechaISO <= endDateStr;
        }
        if (fechaOriginal instanceof Date) {
            const fechaISO = this.formatToISO(fechaOriginal);
            return fechaISO >= startDateStr && fechaISO <= endDateStr;
        }
        const normalizedDate = this.normalizeDate(fechaOriginal);
        if (normalizedDate) {
            const fechaISO = this.formatToISO(normalizedDate);
            return fechaISO >= startDateStr && fechaISO <= endDateStr;
        }
        return false;
    }

    formatDate(dateInput) {
        const normalizedDate = this.normalizeDate(dateInput);
        return this.formatToDisplay(normalizedDate);
    }

    formatTime(timeInput) {
        if (!timeInput) return "-";
        if (typeof timeInput === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeInput)) return timeInput;
        if (typeof timeInput === 'number') {
            const date = new Date(timeInput);
            if (!isNaN(date.getTime())) {
                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            }
        }
        const date = new Date(timeInput);
        if (!isNaN(date.getTime())) {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        }
        if (typeof timeInput === 'string' && timeInput.includes(':')) {
            const [hours, minutes, seconds] = timeInput.split(':');
            return `${(hours || '00').padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}:${(seconds || '00').padStart(2, '0')}`;
        }
        return "-";
    }

    async filtrarRegistros() {
        const fechaInicio = this.elements.fechaInicio.value;
        const fechaFin = this.elements.fechaFin.value || fechaInicio;
        const tipoProducto = this.elements.filtroTipoProducto.value;
        const referencia = this.elements.filtroReferencia.value.trim();

        if (!fechaInicio) {
            const confirmar = await this.ui.showConfirm('¿Desea cargar todos los registros? Esta acción puede tardar.');
            if (!confirmar) return;
        }

        try {
            this.elements.loadingOverlay.style.display = 'flex';
            const response = await this.api.fetchVentas({
                startDate: fechaInicio || undefined,
                endDate: fechaFin || undefined
            });

            if (!Array.isArray(response.data)) {
                throw new Error('Respuesta inválida del servidor');
            }

            this.registros = response.data.map(item => {
                const normalizedDate = this.normalizeDate(item[6]);
                const fechaISO = this.formatToISO(normalizedDate);
                return {
                    id: item[0],
                    producto: item[1],
                    referencia: item[2],
                    descripcion: item[3],
                    precio: item[4],
                    precioFinal: item[5],
                    fecha: this.formatDate(item[6]),
                    fechaISO: fechaISO,
                    hora: this.formatTime(item[7])
                };
            });

            // Aplicar filtros adicionales
            let resultados = [...this.registros];

            // Filtrar por Tipo de Producto
            if (tipoProducto) {
                resultados = resultados.filter(r => r.producto === tipoProducto);
            }

            // Filtrar por Referencia (coincidencia parcial)
            if (referencia) {
                resultados = resultados.filter(r => r.referencia.toLowerCase().includes(referencia.toLowerCase()));
            }

            this.filteredRegistros = resultados;
            this.currentPage = 1;
            this.renderizarRegistros();
            this.updatePaginationControls();

            // Ocultar loader
            this.elements.loadingOverlay.style.display = 'none';
        } catch (error) {
            console.error('Error filtrando registros para ediciones:', error);
            this.ui.showAlert('Error al filtrar registros', 'error');
            this.elements.loadingOverlay.style.display = 'none';

        }
    }

    limpiarFiltros() {
        // Limpiar fechas
        this.elements.fechaInicio.value = '';
        this.elements.fechaFin.value = '';

        // Limpiar filtros adicionales
        this.elements.filtroTipoProducto.value = '';
        this.elements.filtroReferencia.value = '';

        // Recargar datos
        this.filtrarRegistros();
    }

    renderizarRegistros() {
        if (!this.elements.tableBody) return;

        const startIndex = (this.currentPage - 1) * this.registrosPerPage;
        const endIndex = startIndex + this.registrosPerPage;
        const registrosPagina = this.filteredRegistros.slice(startIndex, endIndex);

        this.elements.tableBody.innerHTML = '';

        registrosPagina.forEach(registro => {
            const row = document.createElement('tr');

            row.innerHTML = `
        <td>${registro.producto}</td>
        <td>${registro.referencia || '-'}</td>
        <td>${registro.descripcion || '-'}</td>
        <td>${this.utils.formatCurrency(registro.precio)}</td>
        <td>${this.utils.formatCurrency(registro.precioFinal)}</td>
        <td>${registro.fecha}</td>
        <td>${registro.hora || '-'}</td>
        <td class="acciones-cell">
            <button class="btn btn-editar" data-id="${registro.id}" title="Editar">${String.fromCodePoint(0x270F)} </button>
            <button class="btn btn-eliminar" data-id="${registro.id}" title="Eliminar">${String.fromCodePoint(0x1F5D1)} </button>
        </td>
      `;
            this.elements.tableBody.appendChild(row);
        });

        this.updatePaginationControls();
    }

    updatePaginationControls() {
        const totalPages = Math.ceil(this.filteredRegistros.length / this.registrosPerPage);

        this.elements.btnAnterior.disabled = this.currentPage <= 1;
        this.elements.btnSiguiente.disabled = this.currentPage >= totalPages;
        this.elements.paginaActual.textContent = this.currentPage;
    }

    cambiarPagina(delta) {
        const totalPages = Math.ceil(this.filteredRegistros.length / this.registrosPerPage);
        this.currentPage += delta;

        if (this.currentPage < 1) this.currentPage = 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;

        this.renderizarRegistros();
    }

    prepararEdicion(id) {
        this.ui.showAlert(`Funcionalidad de edición para ID ${id} aún no implementada.`, 'info');
    }

    async prepararEliminacion(id) {
        const confirmado = await this.ui.showConfirm({
            title: '¿Eliminar Registro?',
            message: `Esta acción no se puede deshacer. ID del registro: ${id}`,
            confirmText: 'Eliminar definitivamente',
            type: 'danger' // Cambiará el color del botón
        });

        if (confirmado) {
            try {
                this.ui.showLoading();
                const response = await this.api.deleteVenta(id);
                if (response.status === 'success') {
                    this.ui.showAlert('Registro eliminado', 'success');
                    this.filtrarRegistros(); // Recargar tabla
                }
            } catch (error) {
                this.ui.showAlert('Error al eliminar', 'error');
            } finally {
                this.ui.hideLoading();
            }
        }
    }

    async eliminarRegistro(id) {
        try {
            this.elements.loadingOverlay.style.display = 'flex'; // Mostrar loader local
            await this.api.deleteVenta(id); // Usar la función de la API
            this.elements.loadingOverlay.style.display = 'none'; // Ocultar loader local
            this.ui.showAlert('Registro eliminado exitosamente.', 'success');
            // Actualizar la lista local y la vista
            this.registros = this.registros.filter(r => r.id !== id);
            this.filteredRegistros = this.filteredRegistros.filter(r => r.id !== id);
            this.renderizarRegistros(); // Refresca la tabla
            this.updatePaginationControls(); // Actualiza los botones de paginación
        } catch (error) {
            console.error('Error al eliminar registro:', error);
            this.elements.loadingOverlay.style.display = 'none'; // Ocultar loader local
            this.ui.showAlert('Error al eliminar el registro: ' + (error.message || 'Error desconocido.'), 'error');
        }
    }


    scheduleDataCleanup() {
        this.clearCleanupTimeout();
        this.cleanupTimeout = setTimeout(() => {
            if (!this.isCurrentSection) this.clearAllData();
        }, 60 * 1000);
    }

    clearCleanupTimeout() {
        if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
        this.cleanupTimeout = null;
    }

    clearAllData() {
        this.registros = [];
        this.filteredRegistros = [];
        this.currentPage = 1;

        if (this.elements.tableBody) this.elements.tableBody.innerHTML = '';
        if (this.elements.chipsContainer) this.elements.chipsContainer.innerHTML = '';
        if (this.elements.paginaActual) this.elements.paginaActual.textContent = '1';
    }
}