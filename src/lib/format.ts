/** Formatowanie stanu magazynowego (wspólne, lekkie). */
export function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
