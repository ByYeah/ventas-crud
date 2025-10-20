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
    this.filtroEstadoSeleccionado = ''; // 'liquidado', 'sin-liquidar', o ''
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
      totalRegistros: document.getElementById('total-registros'),
      loadingOverlay: document.getElementById('loading-overlay'),
      totalRegistros: document.getElementById('total-registros'),
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
      this.elements.loadingOverlay.style.display = 'flex';

      const response = await this.api.fetchVentas({
        startDate: fechaInicio,
        endDate: fechaFin
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      //Transformar TODOS los registros del rango de fechas
      this.registros = response.data.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2],
        descripcion: item[3],
        precio: item[4],
        precioFinal: item[5],
        fecha: this.formatDate(item[6]),
        hora: this.formatTime(item[7]),
        liquidado: item[8] || 'No'
      }));

      //Aplicar filtros locales (producto + estado)
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
}