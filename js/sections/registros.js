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
    this.filtrosProductoSeleccionados = new Set();
    this.filtroEstadoSeleccionado = '';
    this.cleanupTimeout = null;
    this.isCurrentSection = false;
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
      totalRegistros: document.getElementById('total-registros'),
      chipsContainer: document.querySelector('.chips-container'),
      loadingOverlay: document.getElementById('loading-overlay'),
      totalVendido: document.getElementById('total-vendido')
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

    const dropdown = document.getElementById('filtros-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.hasAttribute('data-filtro')) {
          e.preventDefault();
          const filtro = e.target.dataset.filtro;
          const valor = e.target.dataset.valor;

          if (filtro === 'producto') {
            // Alternar selección: si ya está, quitarlo; si no, añadirlo (máx 3)
            if (this.filtrosProductoSeleccionados.has(valor)) {
              this.filtrosProductoSeleccionados.delete(valor);
            } else {
              if (this.filtrosProductoSeleccionados.size < 3) {
                this.filtrosProductoSeleccionados.add(valor);
              } else {
                this.ui.showAlert('Máximo 3 productos permitidos', 'warning');
                return;
              }
            }
          } else if (filtro === 'estado') {
            // Para estado, sigue siendo exclusivo (solo uno)
            this.filtroEstadoSeleccionado =
              this.filtroEstadoSeleccionado === valor ? '' : valor;
          }

          this.aplicarFiltrosLocales();
        }
      });
    }
  }

  onSectionShow() {
    this.isCurrentSection = true;
    this.clearCleanupTimeout(); // Cancelar limpieza si estaba programada
  }

  onSectionHide() {
    this.isCurrentSection = false;
    this.scheduleDataCleanup();
  }

  // Método robusto para normalizar fechas (maneja tanto strings como objetos Date)
  normalizeDate(dateInput) {
    if (!dateInput) return null;

    // Si ya es un objeto Date, devolverlo directamente
    if (dateInput instanceof Date) {
      return dateInput;
    }

    // Si es string con formato YYYY-MM-DD
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      // Crear fecha en UTC para evitar desfases horarios
      const [year, month, day] = dateInput.split('-');
      return new Date(Date.UTC(year, month - 1, day));
    }

    // Si es string con formato DD/MM/YYYY
    if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      const [day, month, year] = dateInput.split('/');
      return new Date(Date.UTC(year, month - 1, day));
    }

    // Si es string con formato MM/DD/YYYY (formato Google Sheets por defecto)
    if (typeof dateInput === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
      const [month, day, year] = dateInput.split('/');
      return new Date(Date.UTC(year, month - 1, day));
    }

    // Intentar parsear como string de fecha
    const parsedDate = new Date(dateInput);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

    // Si nada funciona, intentar convertir cualquier string numérico
    if (typeof dateInput === 'string' && /^\d+$/.test(dateInput)) {
      // Si es un número, podría ser un timestamp
      const timestamp = parseInt(dateInput);
      if (!isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    return null;
  }

  // Método para formatear fecha a YYYY-MM-DD para comparaciones
  formatToISO(date) {
    if (!date || !(date instanceof Date)) return '';
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // Método para formatear fecha a DD/MM/YYYY para mostrar
  formatToDisplay(date) {
    if (!date || !(date instanceof Date)) return '-';
    
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  }

  // Método específico para comparar fechas en el filtro
  compareDates(fechaOriginal, startDateStr, endDateStr) {
    // Si es string y tiene formato YYYY-MM-DD, usarlo directamente
    if (typeof fechaOriginal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaOriginal)) {
      return fechaOriginal >= startDateStr && fechaOriginal <= endDateStr;
    }

    // Si es string con formato DD/MM/YYYY
    if (typeof fechaOriginal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaOriginal)) {
      const [day, month, year] = fechaOriginal.split('/');
      const fechaISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return fechaISO >= startDateStr && fechaISO <= endDateStr;
    }

    // Si es objeto Date, convertir a ISO
    if (fechaOriginal instanceof Date) {
      const fechaISO = this.formatToISO(fechaOriginal);
      return fechaISO >= startDateStr && fechaISO <= endDateStr;
    }

    // Si es cualquier otro formato, intentar parsear
    const normalizedDate = this.normalizeDate(fechaOriginal);
    if (normalizedDate) {
      const fechaISO = this.formatToISO(normalizedDate);
      return fechaISO >= startDateStr && fechaISO <= endDateStr;
    }

    // Si nada funciona, ignorar la fila
    return false;
  }

  filtrarPorFechaEnFrontend(data, startDateStr, endDateStr) {
    // Validar que data sea un array
    if (!Array.isArray(data)) {
      console.warn('Data no es un array:', data);
      return [];
    }

    return data.filter(row => {
      const fechaOriginal = row[6]; // Fecha está en la columna 6
      
      // Usar el método específico para comparación
      return this.compareDates(fechaOriginal, startDateStr, endDateStr);
    });
  }

  formatDate(dateInput) {
    const normalizedDate = this.normalizeDate(dateInput);
    return this.formatToDisplay(normalizedDate);
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
      this.elements.loadingOverlay.style.display = 'flex';

      const response = await this.api.fetchVentas({
        startDate: fechaInicio,
        endDate: fechaFin
      });

      if (!Array.isArray(response.data)) { // Extraer data del response
        throw new Error('Respuesta inválida del servidor');
      }

      // Transformar TODOS los registros del rango de fechas
      this.registros = response.data.map(item => {
        // Normalizar la fecha para comparación interna
        const normalizedDate = this.normalizeDate(item[6]);
        const fechaISO = this.formatToISO(normalizedDate);
        
        return {
          id: item[0],
          producto: item[1],
          referencia: item[2],
          descripcion: item[3],
          precio: item[4],
          precioFinal: item[5],
          fecha: this.formatDate(item[6]), // Formatear para mostrar
          fechaISO: fechaISO, // Fecha ISO para comparaciones
          hora: this.formatTime(item[7]),
          liquidado: item[8] || 'No'
        };
      });

      // Aplicar filtros locales (producto + estado)
      this.aplicarFiltrosLocales();

      this.elements.loadingOverlay.style.display = 'none';
      this.ui.hideLoading();
    } catch (error) {
      console.error('Error filtrando registros:', error);
      this.ui.showAlert('Error al filtrar registros', 'error');
      this.elements.loadingOverlay.style.display = 'none';
      this.ui.hideLoading();
    }
  }

  limpiarFiltros() {
    if (this.registros.length === 0) {
      // No hay datos para limpiar
      return;
    }

    this.elements.fechaInicio.value = '';
    this.elements.fechaFin.value = '';
    this.filtrosProductoSeleccionados.clear();
    this.filtroEstadoSeleccionado = '';

    this.filteredRegistros = [...this.registros];
    this.currentPage = 1;
    this.calcularTotales();
    this.renderizarRegistros();
    this.renderizarChips();
  }

  renderizarRegistros() {
    if (!this.elements.tableBody) return;

    const startIndex = (this.currentPage - 1) * this.registrosPerPage;
    const endIndex = startIndex + this.registrosPerPage;
    const registrosPagina = this.filteredRegistros.slice(startIndex, endIndex);

    this.elements.tableBody.innerHTML = '';

    registrosPagina.forEach(registro => {
      const row = document.createElement('tr');

      if (registro.liquidado === 'Si') {
        row.classList.add('fila-liquidada');
      }

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

  calcularTotales() {
    const totalRegistros = this.filteredRegistros.length;
    const totalVendido = this.filteredRegistros.reduce((suma, reg) => {
      return suma + (parseFloat(reg.precioFinal) || 0);
    }, 0);

    if (this.elements.totalRegistros) {
      this.elements.totalRegistros.textContent = totalRegistros;
    }
    if (this.elements.totalVendido) {
      this.elements.totalVendido.textContent = this.utils.formatCurrency(totalVendido);
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

  aplicarFiltrosLocales() {
    let filtrados = [...this.registros];

    // Filtro por productos seleccionados (múltiples)
    if (this.filtrosProductoSeleccionados.size > 0) {
      const productos = Array.from(this.filtrosProductoSeleccionados);
      filtrados = filtrados.filter(reg => productos.includes(reg.producto));
    }

    // Filtro por estado (liquidado / sin-liquidar)
    if (this.filtroEstadoSeleccionado) {
      const esperado = this.filtroEstadoSeleccionado === 'liquidado' ? 'Si' : 'No';
      filtrados = filtrados.filter(reg => reg.liquidado === esperado);
    }

    this.filteredRegistros = filtrados;
    this.currentPage = 1;
    this.calcularTotales();
    this.renderizarRegistros();
    this.renderizarChips();
  }

  renderizarChips() {
    if (!this.elements.chipsContainer) return;

    const chips = [];

    // Chips de productos
    this.filtrosProductoSeleccionados.forEach(producto => {
      chips.push({
        tipo: 'producto',
        valor: producto,
        etiqueta: `Producto: ${producto}`
      });
    });

    // Chip de estado
    if (this.filtroEstadoSeleccionado) {
      const etiqueta = this.filtroEstadoSeleccionado === 'liquidado'
        ? 'Estado: Liquidado'
        : 'Estado: Sin liquidar';
      chips.push({
        tipo: 'estado',
        valor: this.filtroEstadoSeleccionado,
        etiqueta
      });
    }

    this.elements.chipsContainer.innerHTML = chips.map(chip => `
    <span class="filtro-chip" data-tipo="${chip.tipo}" data-valor="${chip.valor}">
      ${chip.etiqueta}
      <button type="button" class="chip-remove" aria-label="Eliminar filtro">×</button>
    </span>
  `).join('');

    // Eventos de eliminación
    this.elements.chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = btn.closest('.filtro-chip');
        const tipo = chip.dataset.tipo;
        const valor = chip.dataset.valor;

        if (tipo === 'producto') {
          this.filtrosProductoSeleccionados.delete(valor);
        } else if (tipo === 'estado') {
          this.filtroEstadoSeleccionado = '';
        }

        this.aplicarFiltrosLocales();
      });
    });
  }

  scheduleDataCleanup() {
    this.clearCleanupTimeout();
    this.cleanupTimeout = setTimeout(() => {
      if (!this.isCurrentSection) {
        this.clearAllData();
      }
    }, 60 * 1000); // 60 segundos
  }

  clearCleanupTimeout() {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }
  }

  clearAllData() {
    this.registros = [];
    this.filteredRegistros = [];
    this.filtrosProductoSeleccionados.clear();
    this.filtroEstadoSeleccionado = '';
    this.currentPage = 1;

    // Limpiar UI
    if (this.elements.tableBody) this.elements.tableBody.innerHTML = '';
    if (this.elements.chipsContainer) this.elements.chipsContainer.innerHTML = '';
    if (this.elements.totalRegistros) this.elements.totalRegistros.textContent = '0';
    if (this.elements.totalVendido) this.elements.totalVendido.textContent = '0';

    // Limpiar inputs de fecha
    if (this.elements.fechaInicio) this.elements.fechaInicio.value = '';
    if (this.elements.fechaFin) this.elements.fechaFin.value = '';
  }
}