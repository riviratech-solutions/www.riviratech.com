
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

async function main() {
  const localFile = process.argv[2];

  if (!localFile) {
    throw new Error(
      'Usage: node --env-file=.env upload-to-drive-oauth.js "E:\\path\\file.pdf"'
    );
  }

  const filePath = path.resolve(localFile);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("The specified file does not exist.");
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const tokenPath = path.resolve(process.env.GOOGLE_DRIVE_TOKEN_PATH || "");

  if (!folderId || !process.env.GOOGLE_DRIVE_TOKEN_PATH) {
    throw new Error("Drive folder ID or token path is missing from .env.");
  }

  const saved = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

  if (!saved.refresh_token) {
    throw new Error("No refresh token found. Run oauth-setup.js first.");
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI
  );

  auth.setCredentials({ refresh_token: saved.refresh_token });

  const drive = google.drive({ version: "v3", auth });
  const name = path.basename(filePath);
  const mimeType = mime.lookup(filePath) || "application/octet-stream";

  // Verify that this account can access the destination folder.
  const folder = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType",
  });

  if (folder.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("The configured Drive ID is not a folder.");
  }

  console.log(`Uploading ${name} to ${folder.data.name}...`);

  const result = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: "id,name,mimeType,size",
    uploadType: "resumable",
  });

  console.log("Upload successful:");
  console.log({
    id: result.data.id,
    name: result.data.name,
    mimeType: result.data.mimeType,
    size: result.data.size,
  });
  console.log("The upload does not make the file public.");
}

main().catch((error) => {
  console.error(
    "Upload failed:",
    error.response?.data?.error?.message || error.message
  );
  process.exitCode = 1;
});
