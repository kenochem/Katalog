import { useEffect } from 'react';
import { getSupplierRegistry, loadSupplierRegistry, useSupplierRegistry } from '../lib/supplierRegistry';

export const SUPPLIER_LIST_ID = 'catalog-supplier-names';

/** Podpowiedzi nazw dostawców z rejestru dla pól tekstowych (`<input list={SUPPLIER_LIST_ID}>`). */
export function SupplierDatalist() {
  useSupplierRegistry();
  useEffect(() => {
    void loadSupplierRegistry();
  }, []);
  return (
    <datalist id={SUPPLIER_LIST_ID}>
      {getSupplierRegistry()
        .filter((s) => !s.removed)
        .map((s) => (
          <option key={s.name} value={s.name} />
        ))}
    </datalist>
  );
}
