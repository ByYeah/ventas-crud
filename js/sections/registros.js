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

      // OBTENER FECHAS DEL FORMULARIO
      const startDate = document.getElementById('startDate')?.value;
      const endDate = document.getElementById('endDate')?.value;

      let filteredData = response.data;

      // FILTRAR EN EL FRONTEND ANTES DE TRANSFORMAR
      if (startDate && endDate) {
        filteredData = this.filtrarPorFechaEnFrontend(response.data, startDate, endDate);
        console.log('Fechas filtradas en frontend:', filteredData.map(r => r[6]));
      }

      // TRANSFORMAR LOS DATOS FILTRADOS
      this.registros = filteredData.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2],
        descripcion: item[3],
        precio: item[4],
        precioFinal: item[5],
        fecha: this.formatDate(item[6]), // Esto convierte a DD/MM/YYYY
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

  filtrarPorFechaEnFrontend(data, startDateStr, endDateStr) {
    // Validar que data sea un array
    if (!Array.isArray(data)) {
      console.warn('Data no es un array:', data);
      return [];
    }

    return data.filter(row => {
      let fechaOriginal = row[6]; // Fecha está en la columna 6

      // Validar que exista
      if (fechaOriginal == null) {
        console.warn('Fecha es null o undefined:', row);
        return false;
      }

      let fechaISO = null;

      // Si es objeto Date
      if (fechaOriginal instanceof Date) {
        const year = fechaOriginal.getFullYear();
        const month = (fechaOriginal.getMonth() + 1).toString().padStart(2, '0');
        const day = fechaOriginal.getDate().toString().padStart(2, '0');
        fechaISO = `${year}-${month}-${day}`;
      }
      // Si es string con formato DD/MM/YYYY
      else if (typeof fechaOriginal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaOriginal)) {
        const [day, month, year] = fechaOriginal.split('/');
        fechaISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      // Si es string con formato YYYY-MM-DD
      else if (typeof fechaOriginal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaOriginal)) {
        fechaISO = fechaOriginal;
      }
      // Si es cualquier otro formato, intentar parsear
      else {
        const date = new Date(fechaOriginal);
        if (isNaN(date.getTime())) {
          console.warn('Fecha no válida:', fechaOriginal);
          return false;
        }
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        fechaISO = `${year}-${month}-${day}`;
      }

      // Comparar con el rango
      return fechaISO >= startDateStr && fechaISO <= endDateStr;
    });
  }

  formatDate(dateInput) {
    if (!dateInput) return "-";

    // Si ya es DD/MM/YYYY, devolver tal cual
    if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }

    let date;

    // Si es YYYY-MM-DD, crear fecha sin desfase
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      // Crear fecha en UTC para evitar desfases
      const [year, month, day] = dateInput.split('-');
      date = new Date(Date.UTC(year, month - 1, day));
    } else {
      // Para otros formatos, usar el constructor normal
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) return "-";

    // Formatear en formato DD/MM/YYYY
    return `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCFullYear()}`;
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
      // Validar que cada parte exista
      return `${(hours || '00').padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}:${(seconds || '00').padStart(2, '0')}`;
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

      console.log('Respuesta del backend:', response);

      // Validar que response.data sea un array
      if (!Array.isArray(response.data)) {
        console.error('response.data no es un array:', response.data);
        this.ui.showAlert('Error: respuesta inválida del servidor', 'error');
        this.ui.hideLoading();
        return;
      }

      console.log('Fechas en la respuesta:', response.data.map(item => item[6]));

      // Transformar los datos filtrados
      const registrosTransformados = response.data.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2],
        descripcion: item[3],
        precio: item[4],
        precioFinal: item[5],
        fecha: this.formatDate(item[6]),  // ← Aquí se formatea la fecha
        hora: this.formatTime(item[7])
      }));

      console.log('Registros transformados:', registrosTransformados.map(r => r.fecha));

      // FILTRO EN EL FRONTEND DESPUÉS DE TRANSFORMAR
      const filteredRegistros = registrosTransformados.filter(item => {
        const [day, month, year] = item.fecha.split('/');
        const fechaISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const dentroRango = fechaISO >= fechaInicio && fechaISO <= fechaFin;
        console.log(`Fecha: ${item.fecha} -> ${fechaISO}, Dentro de rango: ${dentroRango}`);
        return dentroRango;
      });

      console.log('Registros filtrados después de transformar:', filteredRegistros.map(r => r.fecha));

      this.filteredRegistros = filteredRegistros;
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