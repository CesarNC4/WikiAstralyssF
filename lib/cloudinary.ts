import "server-only";
import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary como origen de medios (reemplaza Cloudflare R2).
 * Cloud name es público; api_key/secret sólo en servidor (subidas firmadas).
 */
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/** Sube un archivo (Buffer/base64 data URI) a Cloudinary y devuelve metadatos. */
export async function uploadToCloudinary(
  dataUri: string,
  folder = "astralys",
): Promise<{
  publicId: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}> {
  const res = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    overwrite: false,
  });
  return {
    publicId: res.public_id,
    url: res.secure_url,
    width: res.width,
    height: res.height,
    bytes: res.bytes,
    format: res.format,
  };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
