/**
 * Emails to students, shared by routes that create accounts or approve
 * certificates. Same wording and look as the ones in
 * admin/enrollees/enrollees.js (/accept-enroll) and
 * admin/certificates/certificates.js (/accept-certificate).
 *
 * Every value is HTML-escaped: names, courses and batches are typed by people.
 */
const SITE = "https://www.riviratech.com";

const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Unix seconds / ms, or a date string such as a batch's "2026-01-05T10:00"
function prettyDate(v) {
    if (v == null || v === "") return "";
    const s = String(v).trim();
    let d;
    if (/^\d{9,10}$/.test(s)) d = new Date(Number(s) * 1000);
    else if (/^\d{12,13}$/.test(s)) d = new Date(Number(s));
    else d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN");
}

const footer = `
    <p>
        If you have any questions, feel free to contact us at:
        <br>
        📧 support@riviratech.com
    </p>

    <br>

    <p>
        Best Regards,<br>
        <b>Rivira Technologies Team</b><br>
        🌐 www.riviratech.com
    </p>`;

/** New student account: course / batch and the sign-in details. */
function accountCreatedMail({ name, email, password, courseName, batchName, endDate }) {
    const end = prettyDate(endDate);
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

        <h2 style="color:#2c7be5;">Welcome to Rivira Technologies!</h2>

        <p>Dear <b>${esc(name)}</b>,</p>

        <p>
            Your student account has been
            <b style="color:green;">successfully created</b>.
        </p>

        <hr>

        <h3>📘 Course & Batch Details</h3>

        <table cellpadding="6">
            <tr>
            <td><b>Course</b></td>
            <td>: ${esc(courseName || "-")}</td>
            </tr>
            ${batchName ? `<tr>
            <td><b>Batch</b></td>
            <td>: ${esc(batchName)}</td>
            </tr>` : ""}
            ${end ? `<tr>
            <td><b>End Date</b></td>
            <td>: ${esc(end)}</td>
            </tr>` : ""}
        </table>

        <hr>

        <h3>🔐 Login Details</h3>

        <p>Please use the following credentials to access your account:</p>

        <table cellpadding="6">
            <tr>
            <td><b>Login URL</b></td>
            <td>: <a href="${SITE}/signin">
                ${SITE}/signin</a></td>
            </tr>
            <tr>
            <td><b>Email / Mobile</b></td>
            <td>: ${esc(email)}</td>
            </tr>
            <tr>
            <td><b>Password</b></td>
            <td>: ${esc(password)}</td>
            </tr>
        </table>

        <p style="color:red;">
            ⚠️ For security reasons, please change your password after first login.
        </p>

        <hr>
        ${footer}
    </div>`;
    return {
        subject: `Hi ${name}, Your Student Account is Ready – Rivira Technologies`,
        html,
    };
}

/** Certificate request approved: details and the download link. */
function certificateApprovedMail({ name, type, courseName, batchName, sdate, edate, memId, reqId }) {
    const link = `${SITE}/certificate/download?m=${encodeURIComponent(memId || "")}&req_id=${encodeURIComponent(reqId || "")}`;
    const from = prettyDate(sdate), to = prettyDate(edate);
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

        <h2 style="color:#28a745;">Certificate Request Approved</h2>

        <p>Dear <b>${esc(name)}</b>,</p>

        <p>
            Thank you for submitting your certificate request to Rivira Technologies.
        </p>

        <p>
            We are pleased to inform you that your certificate request has been
            <b style="color:green;">successfully approved</b>.
        </p>

        <hr>

        <h3>📄 Certificate Details</h3>

        <p style="color:#555;">
            <b>Certificate Type:</b> ${esc(type || "course")}<br>
            ${batchName ? `<b>Batch:</b> ${esc(batchName)}<br>` : ""}
            <b>Course:</b> ${esc(courseName || "-")}<br>
            ${from || to ? `<b>Duration:</b> ${esc(from || "-")} to ${esc(to || "-")}` : ""}
        </p>

        <hr>

        <h3>📥 Certificate Access</h3>

        <p>
            Your certificate is ready! You can view and download your official certificate in PDF format here:
        </p>

        <p style="margin: 22px 0;">
            <a href="${link}"
               style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">
                🎓 Download Certificate PDF
            </a>
        </p>

        <p style="font-size: 13px; color: #64748b;">
            Direct Link: <a href="${link}" style="color: #2563eb;">${link}</a>
        </p>

        <hr>

        <p>
            Congratulations on your achievement, and we wish you continued success!
        </p>
        ${footer}
    </div>`;
    return {
        subject: `Hi ${name}, Certificate Request Approved – Rivira Technologies`,
        html,
    };
}

module.exports = { accountCreatedMail, certificateApprovedMail, prettyDate };
