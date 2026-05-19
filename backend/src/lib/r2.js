/**
 * Cloudflare R2 Upload Utility
 *
 * R2 is S3-compatible, so we use @aws-sdk/client-s3.
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID       – Your Cloudflare account ID
 *   R2_ACCESS_KEY_ID    – R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY – R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME      – Name of the R2 bucket
 *   R2_PUBLIC_URL       – Public base URL for the bucket (e.g. https://assets.yourdomain.com)
 *                         If using the default r2.dev subdomain:
 *                         https://pub-<hash>.r2.dev
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// ---------------------------------------------------------------------------
// Client — created once at module load so it is reused across calls.
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

if (!R2_ACCOUNT_ID) {
  throw new Error('[r2] R2_ACCOUNT_ID environment variable is not set.');
}

const r2Client = new S3Client({
  region: 'auto',                                              // R2 ignores region but the SDK requires a value
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// uploadMockup
// ---------------------------------------------------------------------------

/**
 * Upload a PNG mockup buffer to Cloudflare R2.
 *
 * @param {Buffer} buffer   – Raw PNG image data
 * @param {string} leadId   – Unique identifier for the lead (used as part of the S3 key)
 * @returns {Promise<string>} The public URL of the uploaded mockup
 */
async function uploadMockup(buffer, leadId) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, ''); // strip trailing slash

  if (!bucket) {
    throw new Error('[r2] R2_BUCKET_NAME environment variable is not set.');
  }
  if (!publicBaseUrl) {
    throw new Error('[r2] R2_PUBLIC_URL environment variable is not set.');
  }

  const key = `mockups/${leadId}.png`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  });

  await r2Client.send(command);

  const publicUrl = `${publicBaseUrl}/${key}`;
  return publicUrl;
}

/**
 * Delete a mockup from Cloudflare R2.
 *
 * @param {string} leadId   – Unique identifier for the lead
 */
async function deleteMockup(leadId) {
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error('[r2] R2_BUCKET_NAME environment variable is not set.');
  }

  const key = `mockups/${leadId}.png`;

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await r2Client.send(command);
  console.log(`[r2] Deleted mockup for lead ${leadId} from R2 storage.`);
  
  // Clear the database reference so it generates a new one if needed again
  const pool = require('./../config/db');
  await pool.query('UPDATE leads SET mockup_url = NULL WHERE id = $1', [leadId]);
}

module.exports = {
  uploadMockup,
  deleteMockup,
  r2Client
};
