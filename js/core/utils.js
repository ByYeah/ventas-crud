import { CONFIG, STYLES } from './config.js';

export class Utils {
  static formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  static formatDateLocal(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  static formatTimeLocal(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  static formatDisplayDate(dateString) {
    if (!dateString) return "Fecha no disponible";
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return "Fecha inválida";
    }
  }

  static getPendingVentas() {
    try {
      const ventas = localStorage.getItem('pendingVentas');
      return ventas ? JSON.parse(ventas) : [];
    } catch (error) {
      console.error('Error al leer ventas pendientes:', error);
      return [];
    }
  }

  static savePendingVentas(ventas) {
    try {
      localStorage.setItem('pendingVentas', JSON.stringify(ventas));
    } catch (error) {
      console.error('Error al guardar ventas pendientes:', error);
    }
  }
}