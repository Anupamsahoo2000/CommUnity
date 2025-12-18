// backend/utils/s3.js
const AWS = require("aws-sdk");
require("dotenv").config();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Upload a file buffer to S3 with public-read ACL
 * Returns: public URL
 */
async function uploadPublicFile(
  buffer,
  key,
  contentType = "application/octet-stream"
) {
  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME is not configured");
  }

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  };

  const result = await s3.upload(params).promise();

  // result.Location is the public URL
  return result.Location;
}

module.exports = {
  uploadPublicFile,
};
