import { AWS_UPLOADS, SERVER_URL } from "../components/Includes";

/* A class's document link: a server upload is a public file under /uploads; one
   stored on Google Drive ("gdrive:<id>", api/admin/live-classes/class-drive.js) is
   downloaded through the API, which checks the viewer may see the class. */
export function classDocUrl(doc: string | undefined | null, reqId: string | undefined | null): string {
  const d = String(doc || "");
  return d.startsWith("gdrive:") ? SERVER_URL + "api/class-doc/" + String(reqId || "") : AWS_UPLOADS + d;
}
