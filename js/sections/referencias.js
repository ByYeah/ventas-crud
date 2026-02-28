import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class ReferenciasManager {
  constructor(app) {
    this.app = app;
    this.api = new ApiService();
    this.ui = new UIUtils();
    this.utils = Utils;

    // Estado local
    this.referencias = [];
    this.filtroActual = '';
    this.cargando = false;

    // Inicializar
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.elements = {
      section: document.getElementById('referencias'),
      tableBody: document.getElementById('referencias-table-body'),
      searchInput: document.getElementById('search-referencias'),
      btnAdd: document.getElementById('btn-add-referencia'),
      btnAddEmpty: document.getElementById('btn-add-referencia-empty'),
      btnExport: document.getElementById('btn-export-referencias'),
      emptyState: document.getElementById('referencias-empty-state'),
      countLabel: document.getElementById('referencias-count')
    };
  }

  bindEvents() {
    // Búsqueda en tiempo real
    this.elements.searchInput?.addEventListener('input', (e) => {
      this.filtroActual = e.target.value.trim();
      this.renderTable();
    });

    // Botón agregar nueva referencia
    this.elements.btnAdd?.addEventListener('click', () => {
      console.log('[Referencias] Click en Nueva Referencia');
      this.ui.showAlert('Funcionalidad en desarrollo: Modal de creación', 'info');
    });

    // Botón agregar desde estado vacío
    this.elements.btnAddEmpty?.addEventListener('click', () => {
      console.log('[Referencias] Click en Agregar Primera');
      this.ui.showAlert('Funcionalidad en desarrollo: Modal de creación', 'info');
    });

    // Botón exportar CSV
    this.elements.btnExport?.addEventListener('click', () => {
      this.exportarCSV();
    });

    // Delegación de eventos para botones de acción en tabla
    this.elements.tableBody?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.dataset.id;

      if (btn.classList.contains('btn-edit')) {
        console.log('[Referencias] Editar:', id);
        this.ui.showAlert('Funcionalidad en desarrollo: Editar referencia', 'info');
      } else if (btn.classList.contains('btn-delete')) {
        console.log('[Referencias] Eliminar:', id);
        this.ui.showAlert('Funcionalidad en desarrollo: Eliminar referencia', 'info');
      }
    });
  }

  onSectionShow() {
    console.log('[Referencias] Sección mostrada - cargando datos...');
    this.cargarReferencias();
  }

  async cargarReferencias() {
    if (this.cargando) return;

    this.cargando = true;
    this.mostrarLoading(true);

    try {
      console.log('[Referencias] Solicitando datos al backend...');

      // Usar POST con path='referencias' y action='list'
      const response = await this.api.post('/referencias', {
        action: 'list'
      });

      console.log('[Referencias] Respuesta:', response);

      if (response && response.status === 'success' && Array.isArray(response.data)) {
        this.referencias = response.data;
        console.log(`[Referencias] ${this.referencias.length} referencias cargadas`);

        this.renderTable();
        this.actualizarContador();
        this.mostrarEstadoVacio();
      } else {
        throw new Error('Respuesta inválida del servidor');
      }

    } catch (error) {
      console.error('[Referencias] Error cargando datos:', error);
      this.ui.showAlert('Error al cargar referencias: ' + error.message, 'error');
      this.referencias = [];
      this.renderTable();
    } finally {
      this.cargando = false;
      this.mostrarLoading(false);
    }
  }

  renderTable() {
    const { tableBody } = this.elements;
    if (!tableBody) return;

    // Filtrar datos según búsqueda
    const datosFiltrados = this.filtroActual
      ? this.referencias.filter(ref =>
        ref.producto?.toLowerCase().includes(this.filtroActual.toLowerCase()) ||
        ref.referencia?.toLowerCase().includes(this.filtroActual.toLowerCase())
      )
      : this.referencias;

    // Si no hay datos
    if (datosFiltrados.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; color:#6c757d; padding: 2rem;">
            ${this.filtroActual ? 'No se encontraron resultados para tu búsqueda' : 'No hay referencias registradas'}
          </td>
        </tr>
      `;
      return;
    }

    // Renderizar filas
    tableBody.innerHTML = datosFiltrados.map(ref => `
      <tr data-id="${this.escapeHtml(ref.id)}">
        <td>${this.escapeHtml(ref.producto)}</td>
        <td>${this.escapeHtml(ref.referencia)}</td>
        <td class="text-end">${this.utils.formatCurrency(ref.precioCompra)}</td>
        <td class="text-end">${this.utils.formatCurrency(ref.precioVenta)}</td>
        <td>${this.escapeHtml(ref.notas || '-')}</td>
        <td>${this.formatDateLocal(ref.updatedAt)}</td>
        <td class="text-end">
          <button class="btn btn-action btn-edit" data-id="${this.escapeHtml(ref.id)}" title="Editar">
            ✏️
          </button>
          <button class="btn btn-action btn-delete" data-id="${this.escapeHtml(ref.id)}" title="Eliminar">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

    this.actualizarContador(datosFiltrados.length);
  }

  mostrarLoading(mostrando) {
    const { tableBody } = this.elements;
    if (!tableBody) return;

    if (mostrando) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; color:#6c757d; padding: 2rem;">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <span class="ms-2">Cargando referencias...</span>
          </td>
        </tr>
      `;
    }
  }

  mostrarEstadoVacio() {
    const { emptyState, tableBody } = this.elements;
    if (!emptyState || !tableBody) return;

    if (this.referencias.length === 0) {
      emptyState.classList.remove('hidden');
      tableBody.parentElement?.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      tableBody.parentElement?.classList.remove('hidden');
    }
  }

  actualizarContador(cantidad = null) {
    const { countLabel } = this.elements;
    if (!countLabel) return;

    const total = cantidad !== null ? cantidad : this.referencias.length;
    countLabel.textContent = `${total} referencia${total !== 1 ? 's' : ''} registrada${total !== 1 ? 's' : ''}`;
  }

  formatDateLocal(dateString) {
    if (!dateString) return '-';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  exportarCSV() {
    if (this.referencias.length === 0) {
      this.ui.showAlert('No hay datos para exportar', 'warning');
      return;
    }

    // Encabezados CSV
    const headers = ['ID', 'Producto', 'Referencia', 'PrecioCompra', 'PrecioVenta', 'Notas', 'UpdatedAt'];

    // Filas CSV
    const rows = this.referencias.map(ref => [
      ref.id,
      ref.producto,
      ref.referencia,
      ref.precioCompra,
      ref.precioVenta,
      (ref.notas || '').replace(/,/g, ';'),
      ref.updatedAt
    ]);

    // Construir contenido CSV
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `referencias_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.ui.showAlert(`Exportadas ${this.referencias.length} referencias`, 'success');
  }

  async refresh() {
    await this.cargarReferencias();
  }
}