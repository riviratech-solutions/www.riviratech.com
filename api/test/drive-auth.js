/**
 * Google Drive OAuth helper for class storage (admin/live-classes/class-drive.js).
 *
 * No separate host or port is needed:
 *   - In the Admin Panel, open /panel/google-drive to sign in with Google,
 *     verify your refresh token, and test resumable uploads directly in the UI.
 *   - Or from the terminal:
 *       1. Print the OAuth sign-in URL:
 *            node --env-file=.env test/drive-auth.js
 *       2. Exchange a returned code or redirect URL:
 *            node --env-file=.env test/drive-auth.js "<code or callback URL>"
 */
const drive = require("../admin/live-classes/class-drive");

async function main() {
    const codeArg = process.argv[2];
    const baseDomain = String(process.env.DOMAIN || "http://localhost:5173").replace(/\/$/, "");
    const redirectUri = `${baseDomain}/panel/google-drive`;

    if (codeArg) {
        const res = await drive.exchangeOAuthCode(codeArg, redirectUri);
        console.log(res.message);
        if (res.quota && res.quota.ok) {
            const gb = (n) => (Number(n || 0) / 1024 ** 3).toFixed(2) + " GB";
            console.log(
                `Drive storage (${res.quota.saEmail}): ${gb(res.quota.usageBytes)} used of ${
                    res.quota.limitBytes ? gb(res.quota.limitBytes) : "unlimited"
                }.`
            );
        }
        return;
    }

    const { authUrl, redirectUri: finalRedirect } = drive.generateOAuthUrl(redirectUri);
    console.log("Admin Panel page (recommended - no separate host or port needed):");
    console.log(`  ${finalRedirect}\n`);
    console.log("Or open this Google OAuth link directly:");
    console.log(`  ${authUrl}\n`);
}

main().catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
});
