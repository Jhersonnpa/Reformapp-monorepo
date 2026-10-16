import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function r2(): S3Client | null {
  const account = process.env["R2_ACCOUNT_ID"];
  const key = process.env["R2_ACCESS_KEY_ID"];
  const secret = process.env["R2_SECRET_ACCESS_KEY"];
  if (!account || !key || !secret) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  });
}

/** URL presignada PUT (fotos WebP 1280px comprimidas en cliente antes de subir). */
export async function presignedPutUrl(objectKey: string, contentType = "image/webp"): Promise<string | null> {
  const client = r2();
  const bucket = process.env["R2_BUCKET"];
  if (!client || !bucket) return null; // dev sin R2: el caller devuelve 501 explicativo
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }), {
    expiresIn: 600,
  });
}

export async function presignedGetUrl(objectKey: string): Promise<string | null> {
  const client = r2();
  const bucket = process.env["R2_BUCKET"];
  if (!client || !bucket) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 3600 });
}
