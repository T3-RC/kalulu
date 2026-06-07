/**
 * Browser upload flow: unsigned upload straight to Cloudinary -> return public +
 * thumbnail URLs. Pair with `kalulu.createPost(publicUrl, lat, lng, when, caption)`.
 *
 * Only the cloud name (public) and an UNSIGNED upload preset are used — no API key
 * or secret ever touches the client. Create the preset in the Cloudinary dashboard:
 * Settings -> Upload -> Upload presets -> Add (Signing Mode = Unsigned).
 */
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadResult {
  publicUrl: string;
  thumbnailUrl: string;
  key: string; // Cloudinary public_id
}

export async function uploadImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_BYTES) throw new Error("File too large (max 25 MB)");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { secure_url: string; public_id: string };

  return {
    // Original (auto format + quality for delivery).
    publicUrl: withTransform(data.secure_url, "f_auto,q_auto"),
    // 400px-wide thumbnail generated on the fly by Cloudinary.
    thumbnailUrl: withTransform(data.secure_url, "w_400,c_scale,f_auto,q_auto"),
    key: data.public_id,
  };
}

/** Insert a Cloudinary transformation segment right after `/upload/`. */
function withTransform(secureUrl: string, transform: string): string {
  return secureUrl.replace("/upload/", `/upload/${transform}/`);
}

/** Browsers can't read EXIF without a lib; fall back to file mtime. */
export function bestEffortCaptureTime(file: File): Date {
  return file.lastModified ? new Date(file.lastModified) : new Date();
}
