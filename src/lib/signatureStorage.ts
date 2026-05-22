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
 * Upload a data URL to a public Storage bucket and return its public URL.
 * Falls back to the original data URL if the upload fails so the caller can
 * still persist a value. Subfolder is used to keep the bucket organized.
 */
async function uploadToBucket(dataUrl: string, bucket: string, subfolder: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${subfolder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      console.error(`upload to ${bucket}/${path} failed:`, error);
      return dataUrl;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl ?? dataUrl;
  } catch (err) {
    console.error(`upload to ${bucket} threw:`, err);
    return dataUrl;
  }
}

/** Upload a signature (data URL) and return its public URL. */
export function uploadSignature(dataUrl: string): Promise<string> {
  return uploadToBucket(dataUrl, 'signatures', 'sig');
}

/** Upload an operation photo and return its public URL. */
export function uploadPhoto(dataUrl: string): Promise<string> {
  return uploadToBucket(dataUrl, 'signatures', 'photo');
}
