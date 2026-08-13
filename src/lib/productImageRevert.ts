import { fetchImageBlobForEditing } from './fetchImageBlob';
import { updateProductImage, uploadProductImageRevertBackup } from './products';

const revertKey = (productId: string) => `katalog-img-revert:${productId}`;

export function getPrimaryImageRevertUrl(productId: string): string | null {
  try {
    return localStorage.getItem(revertKey(productId));
  } catch {
    return null;
  }
}

export function clearPrimaryImageRevert(productId: string): void {
  try {
    localStorage.removeItem(revertKey(productId));
  } catch {
    /* ignore */
  }
}

/** Kopia przed wycięciem tła (storage: products/{id}-revert.*). */
export async function backupPrimaryImageForRevert(
  productId: string,
  sourceUrl: string,
): Promise<void> {
  const blob = await fetchImageBlobForEditing(sourceUrl);
  const ext =
    blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const file = new File([blob], `revert.${ext}`, {
    type: blob.type || 'image/png',
  });
  const url = await uploadProductImageRevertBackup(productId, file);
  try {
    localStorage.setItem(revertKey(productId), url);
  } catch {
    /* ignore */
  }
}

export async function restorePrimaryImageFromRevert(productId: string): Promise<string> {
  const revertUrl = getPrimaryImageRevertUrl(productId);
  if (!revertUrl) {
    throw new Error('Brak zapisanej kopii sprzed wycinania tła');
  }
  const blob = await fetchImageBlobForEditing(revertUrl);
  const file = new File([blob], 'restored.png', { type: blob.type || 'image/png' });
  const url = await updateProductImage(productId, file);
  return url;
}
