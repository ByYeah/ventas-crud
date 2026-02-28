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

    // Estado del modal
    this.modalMode = 'create'; // 'create' | 'edit'
    this.editingId = null;

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

    // Botones para abrir modal de creación
    this.elements.btnAdd?.addEventListener('click', () => this.abrirModalCreacion());
    this.elements.btnAddEmpty?.addEventListener('click', () => this.abrirModalCreacion());

    // Botón exportar CSV
    this.elements.btnExport?.addEventListener('click', () => this.exportarCSV());

    // Delegación de eventos para botones de acción en tabla
    this.elements.tableBody?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.dataset.id;

      if (btn.classList.contains('btn-edit')) {
        this.abrirModalEdicion(id);
      } else if (btn.classList.contains('btn-delete')) {
        this.confirmarEliminacion(id);
      }
    });
  }

  onSectionShow() {
    console.log('[Referencias] Sección mostrada - cargando datos...');
    this.cargarReferencias();
  }


  abrirModalCreacion() {
    this.modalMode = 'create';
    this.editingId = null;

    const formHtml = this.generarFormularioHTML();

    this.ui.showCustomModal('➕ Nueva Referencia', formHtml, async (modal) => {
      const formData = this.obtenerDatosFormulario(modal);
      const validacion = this.validarFormulario(formData);

      if (!validacion.valido) {
        this.ui.showAlert(validacion.mensaje, 'error');
        return false; // No cerrar modal
      }

      try {
        this.ui.showLoading();

        const response = await this.api.post('/referencias', {
          action: 'create',
          ...formData
        });

        if (response.status === 'success') {
          this.ui.showAlert('✅ Referencia creada exitosamente', 'success');
          await this.cargarReferencias(); // Recargar tabla
          return true; // Cerrar modal
        } else {
          throw new Error(response.message || 'Error al crear referencia');
        }
      } catch (error) {
        console.error('[Referencias] Error al crear:', error);
        this.ui.showAlert('Error: ' + error.message, 'error');
        return false; // Mantener modal abierto
      } finally {
        this.ui.hideLoading();
      }
    });
  }

  async abrirModalEdicion(id) {
    // Buscar la referencia en el estado local
    const referencia = this.referencias.find(r => r.id === id);

    if (!referencia) {
      this.ui.showAlert('Referencia no encontrada', 'error');
      return;
    }

    this.modalMode = 'edit';
    this.editingId = id;

    const formHtml = this.generarFormularioHTML(referencia);

    this.ui.showCustomModal('✏️ Editar Referencia', formHtml, async (modal) => {
      const formData = this.obtenerDatosFormulario(modal);
      const validacion = this.validarFormulario(formData);

      if (!validacion.valido) {
        this.ui.showAlert(validacion.mensaje, 'error');
        return false; // Mantener modal abierto
      }

      try {
        this.ui.showLoading();

        // Llamar al endpoint de actualización
        const response = await this.api.post('/referencias', {
          action: 'update',
          id: id,
          ...formData
        });

        if (response.status === 'success') {
          this.ui.showAlert('✅ Referencia actualizada exitosamente', 'success');
          await this.cargarReferencias(); // Recargar tabla con datos actualizados
          return true; // Cerrar modal
        } else {
          throw new Error(response.message || 'Error al actualizar referencia');
        }
      } catch (error) {
        console.error('[Referencias] Error al editar:', error);
        this.ui.showAlert('Error: ' + error.message, 'error');
        return false; // Mantener modal abierto para corregir
      } finally {
        this.ui.hideLoading();
      }
    });
  }

  generarFormularioHTML(datos = {}) {
    return `
      <form id="form-referencia" style="display: grid; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Producto *
            </label>
            <input 
              type="text" 
              name="producto" 
              value="${this.escapeHtml(datos.producto || '')}"
              placeholder="Ej: Gorra, Camiseta..."
              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
              required
            >
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Referencia *
            </label>
            <input 
              type="text" 
              name="referencia" 
              value="${this.escapeHtml(datos.referencia || '')}"
              placeholder="Ej: DL7, AM20, AA25..."
              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
              required
            >
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Precio Compra *
            </label>
            <input 
              type="number" 
              name="precioCompra" 
              value="${datos.precioCompra || ''}"
              placeholder="0.00"
              step="0.01"
              min="0"
              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
              required
            >
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Precio Venta *
            </label>
            <input 
              type="number" 
              name="precioVenta" 
              value="${datos.precioVenta || ''}"
              placeholder="0.00"
              step="0.01"
              min="0"
              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
              required
            >
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
            Notas (opcional)
          </label>
          <textarea 
            name="notas" 
            rows="2"
            placeholder="Información adicional..."
            style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
          >${this.escapeHtml(datos.notas || '')}</textarea>
        </div>
      </form>
    `;
  }


  obtenerDatosFormulario(modal) {
    const form = modal.querySelector('#form-referencia');
    if (!form) return {};

    return {
      producto: form.querySelector('[name="producto"]')?.value?.trim() || '',
      referencia: form.querySelector('[name="referencia"]')?.value?.trim() || '',
      precioCompra: form.querySelector('[name="precioCompra"]')?.value || '',
      precioVenta: form.querySelector('[name="precioVenta"]')?.value || '',
      notas: form.querySelector('[name="notas"]')?.value?.trim() || ''
    };
  }


  validarFormulario(data) {
    if (!data.producto) {
      return { valido: false, mensaje: 'El campo Producto es obligatorio' };
    }
    if (!data.referencia) {
      return { valido: false, mensaje: 'El campo Referencia es obligatorio' };
    }

    const precioCompra = parseFloat(data.precioCompra);
    const precioVenta = parseFloat(data.precioVenta);

    if (isNaN(precioCompra) || precioCompra < 0) {
      return { valido: false, mensaje: 'Precio Compra debe ser un número válido mayor o igual a 0' };
    }
    if (isNaN(precioVenta) || precioVenta < 0) {
      return { valido: false, mensaje: 'Precio Venta debe ser un número válido mayor o igual a 0' };
    }

    return { valido: true, mensaje: '' };
  }

  async confirmarEliminacion(id) {
    const referencia = this.referencias.find(r => r.id === id);

    if (!referencia) {
      this.ui.showAlert('Referencia no encontrada', 'error');
      return;
    }

    const confirmado = await this.ui.showConfirm({
      title: 'Eliminar Referencia',
      message: `¿Estás seguro de eliminar "${referencia.referencia}" de "${referencia.producto}"? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmado) return;

    try {
      this.ui.showLoading();

      // Llamar al endpoint de eliminación
      const response = await this.api.post('/referencias', {
        action: 'delete',
        id: id
      });

      if (response.status === 'success') {
        this.ui.showAlert('✅ Referencia eliminada', 'success');
        await this.cargarReferencias(); // Recargar tabla sin el registro eliminado
      } else {
        throw new Error(response.message || 'Error al eliminar');
      }
    } catch (error) {
      console.error('[Referencias] Error al eliminar:', error);
      this.ui.showAlert('Error: ' + error.message, 'error');
    } finally {
      this.ui.hideLoading();
    }
  }

  async cargarReferencias() {
    if (this.cargando) return;

    this.cargando = true;
    this.mostrarLoading(true);

    try {
      console.log('[Referencias] Solicitando datos al backend...');

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

    const datosFiltrados = this.filtroActual
      ? this.referencias.filter(ref =>
        ref.producto?.toLowerCase().includes(this.filtroActual.toLowerCase()) ||
        ref.referencia?.toLowerCase().includes(this.filtroActual.toLowerCase())
      )
      : this.referencias;

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

    const headers = ['ID', 'Producto', 'Referencia', 'PrecioCompra', 'PrecioVenta', 'Notas', 'UpdatedAt'];
    const rows = this.referencias.map(ref => [
      ref.id,
      ref.producto,
      ref.referencia,
      ref.precioCompra,
      ref.precioVenta,
      (ref.notas || '').replace(/,/g, ';'),
      ref.updatedAt
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

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