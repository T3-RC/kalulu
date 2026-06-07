// Cloudinary unsigned upload from React Native (expo-image-picker gives a local
// file URI). No API key/secret — uses the public cloud name + unsigned preset.
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload a local image URI to Cloudinary.
 * @param {string} uri  local file uri from ImagePicker
 * @returns {Promise<{publicUrl:string, thumbnailUrl:string, key:string}>}
 */
export async function uploadImageAsync(uri) {
  const name = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(name);
  const ext = (match ? match[1] : "jpg").toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const form = new FormData();
  // RN FormData file shape:
  form.append("file", { uri, name, type: mime });
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  const withT = (t) => data.secure_url.replace("/upload/", `/upload/${t}/`);
  return {
    publicUrl: withT("f_auto,q_auto"),
    thumbnailUrl: withT("w_400,c_scale,f_auto,q_auto"),
    key: data.public_id,
  };
}
