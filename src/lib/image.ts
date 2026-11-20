/**
 * Réduit une photo avant envoi : côté le plus long ≤ `maxSize` px, JPEG qualité 0,85.
 * Une photo de téléphone (3–8 Mo) passe à ~300 Ko : envoi rapide et coût d'analyse plus bas,
 * sans perte de lisibilité pour un tableau.
 */
export async function photoToJpegBase64(file: Blob, maxSize = 1568): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
}
