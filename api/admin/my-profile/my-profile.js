/**
 * API routes for src/pages/panel/admin/MyProfile.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { hashPassword, verifyPassword } = require("../../security/passwords");

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    router.post("/update-profile", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "1,2,3,X,Y"))) return;
            const {
                name,
                city,
                address,
                gender,
                qualification,
            } = req.body;

            /* Session Tokens */

            /* Validation */
            if (!name || name.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter full name",
                });
            }

            if (!city || city.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter city",
                });
            }

            if (!address || address.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter address",
                });
            }

            if (!gender) {
                return res.json({
                    success: false,
                    message: "Please select gender",
                });
            }

            if (!qualification || qualification.length <= 1) {
                return res.json({
                    success: false,
                    message: "Please enter qualification details",
                });
            }

            /* Update DB */
            const [result] = await db.promise().query(
                `UPDATE members
                    SET name = ?, city = ?, address = ?, gender = ?, qualification = ?
                    WHERE mem_id = ?`,
                [
                    name.trim(),
                    city.trim(),
                    address.trim(),
                    gender.toLowerCase(),
                    qualification.trim(),
                    ukey,
                ]
            );

            if (result.affectedRows === 0) {
                return res.json({
                    success: false,
                    message: "Profile update failed",
                });
            }

            return res.json({
                success: true,
                message: "Your profile details were successfully updated",
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                message: "Update Profile Error",
            });

        }
    });

    router.post("/ac-reset-password", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "1,2,3,X,Y"))) return;
            const {
                cpassword,
                npassword,
                rpassword,
            } = req.body;

            /* Validation */
            if (!cpassword || cpassword.length < 8) {
                return res.json({
                    success: false,
                    message: "Please enter valid current password",
                });
            }

            if (!npassword || npassword.length < 8) {
                return res.json({
                    success: false,
                    message: "Please enter minimum 8 characters new password",
                });
            }

            if (npassword.length > 15) {
                return res.json({
                    success: false,
                    message: "Please enter below 15 characters password",
                });
            }

            if (npassword === cpassword) {
                return res.json({
                    success: false,
                    message: "Do not use old password as new password",
                });
            }

            if (!rpassword || rpassword !== npassword) {
                return res.json({
                    success: false,
                    message: "Password did not match, try again",
                });
            }

            /* Get Current Password */
            const [rows] = await db.promise().query(
                "SELECT pwd3 FROM members WHERE mem_id = ? LIMIT 1",
                [ukey]
            );

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "User not found",
                });
            }

            const dbPassword = rows[0].pwd3;

            /* Verify Current Password */

            if (!(await verifyPassword(cpassword, dbPassword))) {
                return res.json({
                    success: false,
                    message: "You entered the current password incorrectly.",
                });
            }

            /* Hash New Password */
            const newHash = await hashPassword(npassword);

            /* Update Password */
            const [result] = await db.promise().query(
                "UPDATE members SET pwd3 = ? WHERE mem_id = ?",
                [newHash, ukey]
            );

            if (!result.affectedRows) {
                return res.json({
                    success: false,
                    message: "Password update failed",
                });
            }

            return res.json({
                success: true,
                message: "Your password was successfully changed",
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                message: "Reset Password Error",
            });

        }
    });
};
