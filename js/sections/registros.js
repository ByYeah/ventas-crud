import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class RegistrosManager {
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
  }

  initElements() {
    this.elements = {
      fechaInicio: document.getElementById('fecha-inicio'),
      fechaFin: document.getElementById('fecha-fin'),
      btnBuscar: document.getElementById('btn-buscar'),
      btnLimpiar: document.getElementById('btn-limpiar'),
      btnAnterior: document.getElementById('btn-anterior'),
      btnSiguiente: document.getElementById('btn-siguiente'),
      paginaActual: document.getElementById('pagina-actual'),
      tableBody: document.querySelector('#registrosTable tbody'),
      totalRegistros: document.getElementById('total-registros')
    };
  }

  bindEvents() {
    this.elements.btnBuscar.addEventListener('click', () => this.filtrarRegistros());
    this.elements.btnLimpiar.addEventListener('click', () => this.limpiarFiltros());
    this.elements.btnAnterior.addEventListener('click', () => this.cambiarPagina(-1));
    this.elements.btnSiguiente.addEventListener('click', () => this.cambiarPagina(1));

    // Establecer fecha máxima por defecto (hoy)
    const today = new Date().toISOString().split('T')[0];
    this.elements.fechaInicio.max = today;
    this.elements.fechaFin.max = today;
  }

  async onSectionShow() {
    if (this.registros.length === 0) {
      await this.cargarRegistros();
    }
    this.renderizarRegistros();
  }

  async cargarRegistros() {
    try {
      this.ui.showLoading();
      const response = await this.api.fetchVentas();

      // Transformar los datos para mantener compatibilidad
      this.registros = response.data.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2],
        descripcion: item[3],
        precio: item[4],
        precioFinal: item[5],
        fecha: this.formatDate(item[6]),
        hora: this.formatTime(item[7])
      }));

      this.filteredRegistros = [...this.registros];
      this.updateTotalRegistros();
      this.ui.hideLoading();
    } catch (error) {
      console.error('Error cargando registros:', error);
      this.ui.showAlert('Error al cargar registros', 'error');
      this.ui.hideLoading();
    }
  }

  formatDate(dateInput) {
    if (!dateInput) return "-";
    if (typeof dateInput === 'string' && dateInput.includes('/')) return dateInput;

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "-";

    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  }

  formatTime(timeInput) {
    if (!timeInput) return "-";

    // Caso 1: Si ya es una hora formateada (HH:mm:ss)
    if (typeof timeInput === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeInput)) {
      return timeInput;
    }

    // Caso 2: Si es un timestamp numérico (ej: 1745931860000)
    if (typeof timeInput === 'number') {
      const date = new Date(timeInput);
      if (!isNaN(date.getTime())) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      }
    }

    // Caso 3: Si es un objeto Date o string ISO (ej: "Sat Dec 30 1899 13:04:00 GMT-0456")
    const date = new Date(timeInput);
    if (!isNaN(date.getTime())) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }

    // Caso 4: Si es un string de hora suelto (ej: "13:04:00")
    if (typeof timeInput === 'string' && timeInput.includes(':')) {
      const [hours, minutes, seconds] = timeInput.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }

    return "-"; // Valor por defecto si no se puede parsear
  }


  async filtrarRegistros() {
    const fechaInicio = this.elements.fechaInicio.value;
    const fechaFin = this.elements.fechaFin.value || fechaInicio;

    if (!fechaInicio) {
      this.ui.showAlert('Seleccione al menos una fecha de inicio', 'warning');
      return;
    }

    try {
      this.ui.showLoading();

      // Usar el backend para filtrar por fechas
      const response = await this.api.fetchVentas({
        startDate: fechaInicio,
        endDate: fechaFin
      });

      this.filteredRegistros = response.data.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2],
        descripcion: item[3],
        precio: item[4],
        precioFinal: item[5],
        fecha: this.formatDate(item[6]),
        hora: this.formatTime(item[7])
      }));

      this.currentPage = 1;
      this.updateTotalRegistros();
      this.renderizarRegistros();
      this.ui.hideLoading();
    } catch (error) {
      console.error('Error filtrando registros:', error);
      this.ui.showAlert('Error al filtrar registros', 'error');
      this.ui.hideLoading();
    }
  }

  limpiarFiltros() {
    this.elements.fechaInicio.value = '';
    this.elements.fechaFin.value = '';
    this.filteredRegistros = [...this.registros];
    this.currentPage = 1;
    this.updateTotalRegistros();
    this.renderizarRegistros();
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
        <td>${registro.id}</td>
        <td>${registro.producto}</td>
        <td>${registro.referencia || '-'}</td>
        <td>${registro.descripcion || '-'}</td>
        <td>${this.utils.formatCurrency(registro.precio)}</td>
        <td>${this.utils.formatCurrency(registro.precioFinal)}</td>
        <td>${registro.fecha}</td> <!-- Ya viene formateado del backend -->
        <td>${registro.hora || '-'}</td>
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

  updateTotalRegistros() {
    if (this.elements.totalRegistros) {
      this.elements.totalRegistros.textContent = this.filteredRegistros.length;
    }
  }

  cambiarPagina(delta) {
    const totalPages = Math.ceil(this.filteredRegistros.length / this.registrosPerPage);
    this.currentPage += delta;

    if (this.currentPage < 1) this.currentPage = 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    this.renderizarRegistros();
  }

  exportToCSV() {
    if (this.filteredRegistros.length === 0) {
      this.ui.showAlert('No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['ID', 'Producto', 'Referencia', 'Descripción', 'Precio', 'Precio Final', 'Fecha', 'Hora'];
    const csvRows = [
      headers.join(','),
      ...this.filteredRegistros.map(registro =>
        [
          registro.id,
          `"${registro.producto.replace(/"/g, '""')}"`,
          `"${registro.referencia.replace(/"/g, '""')}"`,
          `"${(registro.descripcion || '').replace(/"/g, '""')}"`,
          registro.precio,
          registro.precioFinal,
          registro.fecha,  // Ya viene formateado
          registro.hora || ''
        ].join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', `registros_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}