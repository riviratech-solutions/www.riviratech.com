
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function main() {
  const tokenPath = path.resolve(
    process.env.GOOGLE_DRIVE_TOKEN_PATH ||
    "./.secrets/google-drive-token.json"
  );

  const saved = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

  if (!saved.refresh_token) {
    throw new Error("Refresh token not found. Run OAuth authorization again.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: saved.refresh_token,
  });

  // Obtain a fresh access token using the existing refresh token.
  const { token } = await oauth2Client.getAccessToken();

  if (!token) {
    throw new Error("Google did not return an access token.");
  }

  console.log("Success! A fresh access token was obtained.");
  console.log("Your existing refresh token remains available.");
  console.log("No interactive Google login was required.");
  console.log("Do not print or share the access token.");
}

main().catch((error) => {
  console.error(
    "Token refresh failed:",
    error.response?.data?.error || error.message
  );

  if (error.response?.data?.error === "invalid_grant") {
    console.error(
      "The refresh token may be expired or revoked. Run OAuth authorization again."
    );
  }

  process.exitCode = 1;
});
