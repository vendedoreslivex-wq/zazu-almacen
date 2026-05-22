import { supabase } from './supabase';

/**
 * Convert a data URL (e.g. "data:image/png;base64,iVBOR...") into a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+);/.exec(meta)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a signature (data URL or Blob) to the public `signatures` bucket and
 * return its public URL. Falls back to returning the data URL if the upload fails,
 * so the caller can still persist a value.
 */
export async function uploadSignature(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('signatures').upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) return dataUrl;
    const { data } = supabase.storage.from('signatures').getPublicUrl(path);
    return data.publicUrl ?? dataUrl;
  } catch {
    return dataUrl;
  }
}
