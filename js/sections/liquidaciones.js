import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class LiquidacionesManager {
  constructor(app) {
    this.app = app;
    this.api = new ApiService();
    this.ui = new UIUtils();
    this.utils = Utils;
    this.registrosParaLiquidar = []; // Todos los registros no liquidados en el rango
    this.registrosPaginados = []; // Registros actuales en la página
    this.currentPage = 1;
    this.registrosPerPage = 10; // Valor por defecto
    this.totalPages = 1;
    this.initElements();
    this.bindEvents();
  }

  // Inicializando referencias a elementos del DOM
  initElements() {
    this.elements = {
      fechaInicioLiqui: document.getElementById('fecha-inicio-liqui'),
      fechaFinLiqui: document.getElementById('fecha-fin-liqui'),
      fechaInicioDisplay: document.getElementById('fecha-inicio-display'),
      fechaFinDisplay: document.getElementById('fecha-fin-display'),
      totalRegistrosLiqui: document.getElementById('total-registros-liqui'),
      totalValorLiqui: document.getElementById('total-valor-liqui'),
      btnConfirmarLiqui: document.getElementById('btn-confirmar-liqui'),
      btnCancelarLiqui: document.getElementById('btn-cancelar-liqui'),
      tableBody: document.getElementById('liquidacionTableBody'),
      previewCount: document.getElementById('preview-count'),
      btnAnteriorLiqui: document.getElementById('btn-anterior-liqui'),
      btnSiguienteLiqui: document.getElementById('btn-siguiente-liqui'),
      paginaActualLiqui: document.getElementById('pagina-actual-liqui'),
      registrosPorPagina: document.getElementById('registros-por-pagina')
    };
  }

  // Vincula eventos
  bindEvents() {
    // Calcular al cambiar fechas
    this.elements.fechaInicioLiqui?.addEventListener('change', () => this.calcularResumenLiquidacion());
    this.elements.fechaFinLiqui?.addEventListener('change', () => this.calcularResumenLiquidacion());

    // Acciones
    this.elements.btnConfirmarLiqui?.addEventListener('click', () => this.confirmarLiquidacion());
    this.elements.btnCancelarLiqui?.addEventListener('click', () => this.cancelarLiquidacion());

    // Paginación
    this.elements.btnAnteriorLiqui?.addEventListener('click', () => this.cambiarPagina(-1));
    this.elements.btnSiguienteLiqui?.addEventListener('click', () => this.cambiarPagina(1));

    // Dropdown de registros por página
    this.elements.registrosPorPagina?.addEventListener('change', (e) => {
      this.registrosPerPage = parseInt(e.target.value);
      this.currentPage = 1; // Resetear a la primera página
      this.calcularPaginas(); // Recalcular páginas con el nuevo tamaño
      this.renderizarVistaPrevia();
    });
  }


  onSectionShow() {
    const today = this.utils.getTodayInputFormat();
    
    this.elements.fechaFinLiqui.value = today;
    this.elements.fechaFinLiqui.max = today;
    this.elements.fechaFinDisplay.textContent = this.formatDateForDisplay(today);

    this.calcularResumenLiquidacion();
}

  // Formatear YYYY-MM-DD → DD/MM/YYYY
  formatDateForDisplay(isoDate) {
    if (!isoDate) return '-';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  // Formatear hora para mostrarla en formato amigable
  formatoHoraAmigable(hora) {
    // Manejar el formato inconsistente de Google Sheets
    if (!hora) return '-';

    if (typeof hora === 'string') {
      // Si ya es formato HH:mm:ss, mantenerlo
      if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) {
        return hora;
      }
      // Si es formato HH:mm, añadir segundos
      if (/^\d{2}:\d{2}$/.test(hora)) {
        return hora + ':00';
      }
      // Si contiene fecha completa, extraer solo hora
      if (hora.includes('GMT') || hora.includes('T')) {
        try {
          const date = new Date(hora);
          if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
          }
        } catch (e) {
        }
      }
    }

    return hora.toString();
  }

  // Calcular total registros y valor para el rango
  async calcularResumenLiquidacion() {
    const inicio = this.elements.fechaInicioLiqui.value;
    const fin = this.elements.fechaFinLiqui.value;

    this.elements.fechaInicioDisplay.textContent = inicio ? this.formatDateForDisplay(inicio) : '-';
    this.elements.fechaFinDisplay.textContent = fin ? this.formatDateForDisplay(fin) : '-';

    if (!inicio || !fin) {
      this.resetResumen();
      this.renderizarVistaPrevia([]);
      return;
    }

    try {
      this.ui.showLoading();

      // Añadir filtro de estado "No liquidado"
      const response = await this.api.fetchVentas({
        startDate: inicio,
        endDate: fin,
        liquidado: 'No' // Solo registros no liquidados
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Respuesta inválida');
      }

      // Transformar registros completos (para mostrar en la tabla)
      const registros = response.data.map(item => ({
        id: item[0],
        producto: item[1],
        referencia: item[2] || '-',
        precioFinal: parseFloat(item[5]) || 0,
        fecha: this.formatDateForDisplay(item[6]),
        hora: this.formatoHoraAmigable(item[7]),
        liquidado: (item[8] || 'No').toString().trim()
      }));

      // Filtrar solo NO liquidadas (ya se hace con el filtro, pero por si acaso)
      const pendientes = registros.filter(r => r.liquidado === 'No');

      const totalRegistros = pendientes.length;
      const totalValor = pendientes.reduce((sum, r) => sum + r.precioFinal, 0);

      this.registrosParaLiquidar = pendientes;

      this.elements.totalRegistrosLiqui.textContent = totalRegistros;
      this.elements.totalValorLiqui.textContent = this.utils.formatCurrency(totalValor);

      this.currentPage = 1;
      this.calcularPaginas();
      this.renderizarVistaPrevia();

    } catch (error) {
      this.ui.showAlert('Error al cargar datos', 'error');
      this.resetResumen();
      this.renderizarVistaPrevia([]);
    } finally {
      this.ui.hideLoading();
    }
  }

  // Calcular número de páginas
  calcularPaginas() {
    this.totalPages = Math.ceil(this.registrosParaLiquidar.length / this.registrosPerPage);
    this.registrosPaginados = this.registrosParaLiquidar.slice(
      (this.currentPage - 1) * this.registrosPerPage,
      this.currentPage * this.registrosPerPage
    );
  }

  // Cambiar página
  cambiarPagina(delta) {
    const nuevaPagina = this.currentPage + delta;

    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPages) {
      this.currentPage = nuevaPagina;
      this.calcularPaginas();
      this.renderizarVistaPrevia();
      this.actualizarControlesPaginacion();
    }
  }

  // Actualizar controles de paginación
  actualizarControlesPaginacion() {
    if (this.elements.btnAnteriorLiqui) {
      this.elements.btnAnteriorLiqui.disabled = this.currentPage <= 1;
    }
    if (this.elements.btnSiguienteLiqui) {
      this.elements.btnSiguienteLiqui.disabled = this.currentPage >= this.totalPages;
    }
    if (this.elements.paginaActualLiqui) {
      this.elements.paginaActualLiqui.textContent = `${this.currentPage} de ${this.totalPages}`;
    }
  }

  resetResumen() {
    this.elements.totalRegistrosLiqui.textContent = '0';
    this.elements.totalValorLiqui.textContent = this.utils.formatCurrency(0);
    this.registrosParaLiquidar = [];
    this.registrosPaginados = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.renderizarVistaPrevia([]);
  }


 async confirmarLiquidacion() {
    if (this.registrosParaLiquidar.length === 0) {
        this.ui.showAlert('No hay registros pendientes en el rango seleccionado', 'warning');
        return;
    }

    const totalValor = this.elements.totalValorLiqui.textContent;
    const cantidad = this.registrosParaLiquidar.length;

    const confirmado = await this.ui.showConfirm({
        title: 'Confirmar Liquidación',
        message: `Se marcarán ${cantidad} registros como liquidados (Total: ${totalValor}). ¿Desea continuar?`,
        confirmText: 'Confirmar y Liquidar',
        type: 'primary'
    });

    if (confirmado) {
        this.confirmarLiquidacionReal();
    }
}


  async confirmarLiquidacionReal() {
    if (this.registrosParaLiquidar.length === 0) {
      this.ui.showAlert('No hay registros pendientes de liquidar', 'warning');
      return;
    }

    try {
      this.ui.showLoading();

      // Asegurar que los IDs sean strings
      const idsParaLiquidar = this.registrosParaLiquidar.map(r => {
        // Convertir a string para asegurar consistencia
        return r.id.toString();
      });

      // Llamar al endpoint real de liquidación
      const response = await this.api.post('/liquidar', {
        ids: idsParaLiquidar
      });

      if (response.status === 'success') {
        this.ui.showAlert(`✅ ${response.actualizados} registros liquidados exitosamente`, 'success');

        // Limpiar fechas seleccionadas
        this.limpiarFechasSeleccionadas();

        // Recalcular resumen (esto mostrará 0 registros pendientes)
        this.calcularResumenLiquidacion();
      } else {
        throw new Error(response.message || 'Error en la liquidación');
      }

    } catch (error) {
      this.ui.showAlert('Error al procesar la liquidación: ' + error.message, 'error');
    } finally {
      this.ui.hideLoading();
    }
  }

  // Limpiar fechas seleccionadas
  limpiarFechasSeleccionadas() {
    if (this.elements.fechaInicioLiqui) {
      this.elements.fechaInicioLiqui.value = '';
    }
    if (this.elements.fechaFinLiqui) {
      this.elements.fechaFinLiqui.value = '';
    }
    if (this.elements.fechaInicioDisplay) {
      this.elements.fechaInicioDisplay.textContent = '-';
    }
    if (this.elements.fechaFinDisplay) {
      this.elements.fechaFinDisplay.textContent = '-';
    }
  }

  // Cancelar (limpiar selección)
  cancelarLiquidacion() {
    this.elements.fechaInicioLiqui.value = '';
    this.elements.fechaFinLiqui.value = '';
    this.resetResumen();
  }

  renderizarVistaPrevia() {
    if (!this.elements.tableBody) return;

    // Calcular páginas si no se ha hecho
    if (this.registrosParaLiquidar.length > 0 && this.totalPages === 0) {
      this.calcularPaginas();
    }

    this.elements.tableBody.innerHTML = this.registrosPaginados.length === 0
      ? '<tr><td colspan="6" style="text-align:center; color:#6c757d">No hay registros pendientes en este rango</td></tr>'
      : this.registrosPaginados.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.producto}</td>
          <td>${r.referencia}</td>
          <td>${this.utils.formatCurrency(r.precioFinal)}</td>
          <td>${r.fecha}</td>
          <td>${r.hora}</td>
        </tr>
      `).join('');

    // Actualizar contador
    if (this.elements.previewCount) {
      const totalPendientes = this.registrosParaLiquidar.length;
      this.elements.previewCount.textContent =
        `${totalPendientes} ${totalPendientes === 1 ? 'registro' : 'registros'} pendiente${totalPendientes !== 1 ? 's' : ''} por liquidar`;
    }

    // Actualizar controles de paginación
    this.actualizarControlesPaginacion();
  }
}