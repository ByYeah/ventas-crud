import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class VentasManager {
  constructor(app) {
    this.app = app;
    this.api = new ApiService();
    this.ui = new UIUtils();
    this.utils = Utils;
    this.ventas = [];
    this.pendingVentas = [];
    this.initElements();
    this.bindEvents();
    this.setupFormValidation();
  }

  initElements() {
    this.elements = {
      form: document.getElementById('ventaForm'),
      producto: document.getElementById('producto'),
      referencia: document.getElementById('referencia'),
      descripcion: document.getElementById('descripcion'),
      precio: document.getElementById('precio'),
      precioFinal: document.getElementById('precioFinal'),
      btnCancelar: document.getElementById('btn-cancelar'),
      tableBody: document.querySelector(CONFIG.ELEMENTS.ventasTable)
    };
  }

  bindEvents() {
    if (this.elements.form) {
      this.elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    if (this.elements.btnCancelar) {
      this.elements.btnCancelar.addEventListener('click', () => this.resetForm());
    }

    // Calcular precio final automáticamente
    if (this.elements.precio) {
      this.elements.precio.addEventListener('input', () => this.calcularPrecioFinal());
    }
  }

  setupFormValidation() {
    if (this.elements.form) {
      // Validación personalizada para precios
      this.elements.precio.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (value < 0) {
          e.target.setCustomValidity('El precio no puede ser negativo');
        } else {
          e.target.setCustomValidity('');
        }
      });

      // Validación para producto
      this.elements.producto.addEventListener('change', (e) => {
        if (!e.target.value) {
          e.target.setCustomValidity('Seleccione un producto');
        } else {
          e.target.setCustomValidity('');
        }
      });
    }
  }

  async onSectionShow() {
    if (this.ventas.length === 0) {
      await this.loadInitialData();
    }
    this.renderVentas();
    this.elements.producto?.focus();
  }

  async loadInitialData() {
    try {
      this.ui.showLoading();

      // Obtener ventas del servidor
      const serverVentas = await this.api.fetchVentas();

      // Obtener ventas pendientes locales
      this.pendingVentas = this.utils.getPendingVentas();

      // Filtrar duplicados
      this.ventas = this.mergeAndDeduplicateVentas(serverVentas, this.pendingVentas);

      // Procesar pendientes si hay conexión
      if (this.app.state.isOnline && this.pendingVentas.length > 0) {
        await this.processPendingVentas();
      }

      this.ui.hideLoading();
    } catch (error) {
      console.error('Error cargando ventas:', error);
      this.ui.showAlert('Error al cargar ventas', 'error');
      this.ui.hideLoading();

      // Usar solo ventas locales si falla la conexión
      this.ventas = this.utils.getPendingVentas();
    }
  }

  async handleFormSubmit() {
    const nuevaVenta = this.createVentaFromForm();

    try {
      this.ventas.unshift(nuevaVenta);
      this.renderVentas();

      const result = await this.api.sendVenta(nuevaVenta);

      if (result?.status === 'success') {
        this.ui.showAlert('✅ Venta registrada con éxito', 'success');
        this.resetForm(true); // Limpiar todos los campos

        // Actualizar lista de ventas desde el servidor
        this.ventas = await this.api.fetchVentas();
        this.renderVentas();
      } else {
        this.savePendingVenta(nuevaVenta);
        this.ui.showAlert('⚠️ Se guardó localmente', 'warning');
        this.resetForm(true); // Limpiar incluso en caso de error
      }
    } catch (error) {
      this.savePendingVenta(nuevaVenta);
      this.ui.showAlert('📴 Se guardó localmente (sin conexión)', 'info');
      this.resetForm(true); // Limpiar campos en modo offline
    }
  }

  resetForm(clearAll = true) { // Siempre limpiar completamente
    if (!this.elements.form) return;

    this.elements.form.reset();
    this.elements.precioFinal.value = '';

    // Resetear el estado modificado del precio final
    if (this.elements.precioFinal) {
      this.elements.precioFinal.removeAttribute('data-modified');
    }

    // Enfocar el primer campo
    this.elements.producto?.focus();
  }

  createVentaFromForm() {
    const now = new Date();

    return {
      id: Date.now(),
      producto: this.elements.producto.value.trim(),
      referencia: this.elements.referencia.value.trim(),
      descripcion: this.elements.descripcion.value.trim(),
      precio: parseFloat(this.elements.precio.value) || 0,
      precioFinal: this.elements.precioFinal.value
        ? parseFloat(this.elements.precioFinal.value)
        : parseFloat(this.elements.precio.value),
      fecha: this.utils.formatDateLocal(now),
      hora: this.utils.formatTimeLocal(now),
      _timestamp: Date.now()
    };
  }

  mergeAndDeduplicateVentas(serverVentas, localVentas) {
    const uniqueVentas = [];
    const ids = new Set();

    // Primero agregar ventas del servidor
    serverVentas.forEach(venta => {
      if (!ids.has(venta.id)) {
        ids.add(venta.id);
        uniqueVentas.push(venta);
      }
    });

    // Luego agregar ventas locales que no estén en el servidor
    localVentas.forEach(venta => {
      if (!ids.has(venta.id)) {
        ids.add(venta.id);
        uniqueVentas.push(venta);
      }
    });

    return uniqueVentas;
  }

  renderVentas() {
    if (!this.elements.tableBody) return;

    const lastFive = [...this.ventas].slice(0, 5);
    this.elements.tableBody.innerHTML = '';

    lastFive.forEach(venta => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${venta.id}</td>
        <td>${venta.producto}</td>
        <td>${venta.referencia || '-'}</td>
        <td>${venta.descripcion || '-'}</td>
        <td>${this.utils.formatCurrency(venta.precio)}</td>
        <td>${this.utils.formatCurrency(venta.precioFinal)}</td>
        <td>${this.utils.formatDisplayDate(venta.fecha)} / ${venta.hora || '--:--'}</td>
      `;
      this.elements.tableBody.appendChild(row);
    });
  }

  calcularPrecioFinal() {
    if (!this.elements.precio || !this.elements.precioFinal) return;

    const precio = parseFloat(this.elements.precio.value) || 0;

    // Solo actualizar si el precio final no ha sido modificado manualmente
    if (!this.elements.precioFinal.dataset.modified) {
      this.elements.precioFinal.value = precio.toFixed(0);
    }
  }

  async processPendingVentas() {
    if (this.pendingVentas.length === 0) return;

    const results = {
      success: [],
      failed: []
    };

    // Procesar en lotes para evitar timeouts
    for (let i = 0; i < this.pendingVentas.length; i++) {
      const venta = this.pendingVentas[i];

      try {
        const result = await this.api.sendVenta(venta);

        if (result?.status === 'success' && !result?.isDuplicate) {
          results.success.push(venta);
        } else {
          results.failed.push(venta);
        }
      } catch (error) {
        console.error('Error sincronizando venta pendiente:', error);
        results.failed.push(venta);
      }
    }

    this.utils.savePendingVentas(results.failed);
    this.pendingVentas = results.failed;

    if (results.success.length > 0) {
      this.ui.showAlert(`✅ ${results.success.length} ventas sincronizadas`, 'success');
      // Actualizar lista desde el servidor
      this.ventas = await this.api.fetchVentas();
      this.renderVentas();
    }
  }

  savePendingVenta(venta) {
    const pending = this.utils.getPendingVentas();

    // Verificar si ya existe una venta pendiente similar
    const exists = pending.some(p =>
      p.producto === venta.producto &&
      p.referencia === venta.referencia &&
      Math.abs(p._timestamp - venta._timestamp) < 60000 // 1 minuto de diferencia
    );

    if (!exists) {
      pending.push(venta);
      this.utils.savePendingVentas(pending);
    }
  }
}