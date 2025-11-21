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
    this.registrosParaLiquidar = []; // IDs de registros no liquidadas en el rango

    this.initElements();
    this.bindEvents();
  }

  // Inicializando referencias a elementos del DOM
  initElements() {
    this.elements = {
      // Inputs de fecha
      fechaInicioLiqui: document.getElementById('fecha-inicio-liqui'),
      fechaFinLiqui: document.getElementById('fecha-fin-liqui'),

      // Displays de fechas
      fechaInicioDisplay: document.getElementById('fecha-inicio-display'),
      fechaFinDisplay: document.getElementById('fecha-fin-display'),

      // Totales
      totalRegistrosLiqui: document.getElementById('total-registros-liqui'),
      totalValorLiqui: document.getElementById('total-valor-liqui'),

      // Botones
      btnConfirmarLiqui: document.getElementById('btn-confirmar-liqui'),
      btnCancelarLiqui: document.getElementById('btn-cancelar-liqui'),

      // Tabla de vista previa
      tableBody: document.getElementById('liquidacionTableBody'),
      previewCount: document.getElementById('preview-count')
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
  }

  // Llamado al entrar a la sección
  onSectionShow() {
    // Establecer fecha final = hoy
    const today = new Date().toISOString().split('T')[0];
    this.elements.fechaFinLiqui.value = today;
    this.elements.fechaFinLiqui.max = today;
    this.elements.fechaFinDisplay.textContent = this.formatDateForDisplay(today);

    // Calcular con fechas actuales (puedes inicializar inicio si quieres)
    this.calcularResumenLiquidacion();
  }

  // Formatear YYYY-MM-DD → DD/MM/YYYY
  formatDateForDisplay(isoDate) {
    if (!isoDate) return '-';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
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

      const response = await this.api.fetchVentas({
        startDate: inicio,
        endDate: fin
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
        hora: item[7] || '-',
        liquidado: (item[8] || 'No').toString().trim()
      }));

      // Filtrar solo NO liquidadas
      const pendientes = registros.filter(r => r.liquidado === 'No');

      const totalRegistros = pendientes.length;
      const totalValor = pendientes.reduce((sum, r) => sum + r.precioFinal, 0);

      // Guardar para confirmar
      this.registrosParaLiquidar = pendientes.map(r => r.id);

      // Actualizar UI
      this.elements.totalRegistrosLiqui.textContent = totalRegistros;
      this.elements.totalValorLiqui.textContent = this.utils.formatCurrency(totalValor);

      // Renderizar vista previa
      this.renderizarVistaPrevia(pendientes);

    } catch (error) {
      console.error('Error en calcularResumenLiquidacion:', error);
      this.ui.showAlert('Error al cargar datos', 'error');
      this.resetResumen();
      this.renderizarVistaPrevia([]);
    } finally {
      this.ui.hideLoading();
    }
  }

  // Reiniciar resumen
  resetResumen() {
    this.elements.totalRegistrosLiqui.textContent = '0';
    this.elements.totalValorLiqui.textContent = this.utils.formatCurrency(0);
    this.registrosParaLiquidar = [];
    this.renderizarVistaPrevia([]);
  }

  // Confirmar liquidación (enviar IDs al backend)
  async confirmarLiquidacion() {
    if (this.registrosParaLiquidar.length === 0) {
      this.ui.showAlert('No hay registros pendientes de liquidar en el rango seleccionado', 'warning');
      return;
    }

    const confirm = this.ui.showConfirm(
      '¿Confirmar liquidación?',
      `Se marcarán ${this.registrosParaLiquidar.length} registros como liquidados. ¿Desea continuar?`
    );

    if (!confirm) return;

    try {
      this.ui.showLoading();

      // Endpoint futuro: /liquidar (por ahora simulamos)
      // const response = await this.api.post('/liquidar', { ids: this.registrosParaLiquidar });

      // Por ahora, simulamos éxito
      await new Promise(resolve => setTimeout(resolve, 800));

      this.ui.showAlert(`✅ ${this.registrosParaLiquidar.length} registros liquidados exitosamente`, 'success');

      // Limpiar y recalcular
      this.registrosParaLiquidar = [];
      this.calcularResumenLiquidacion();

    } catch (error) {
      console.error('Error al confirmar liquidación:', error);
      this.ui.showAlert('Error al procesar la liquidación', 'error');
    } finally {
      this.ui.hideLoading();
    }
  }

  // Cancelar (limpiar selección)
  cancelarLiquidacion() {
    this.elements.fechaInicioLiqui.value = '';
    this.elements.fechaFinLiqui.value = '';
    this.resetResumen();
  }

  renderizarVistaPrevia(registros) {
    if (!this.elements.tableBody) return;

    this.elements.tableBody.innerHTML = registros.length === 0
      ? '<tr><td colspan="6" style="text-align:center; color:#6c757d">No hay registros pendientes en este rango</td></tr>'
      : registros.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.producto}</td>
          <td>${r.referencia}</td>
          <td>${this.utils.formatCurrency(r.precioFinal)}</td>
          <td>${r.fecha}</td>
          <td>${r.hora}</td>
        </tr>
      `).join('');

    this.elements.previewCount.textContent =
      `${registros.length} ${registros.length === 1 ? 'registro' : 'registros'} pendiente${registros.length !== 1 ? 's' : ''}`;
  }
}