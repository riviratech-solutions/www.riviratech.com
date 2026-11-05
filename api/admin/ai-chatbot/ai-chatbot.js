/**
 * The old AI chatbot routes. No page calls these any more; kept so nothing is
 * lost.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity, verifyAccount, addactivity } = ctx;

    router.post("/aichatbot", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { q, s, n } = req.body;

            /* 1️⃣ Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sorting */
            let orderBy = "id DESC";
            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search */
            let where = "WHERE status != '1D'";
            let params = [];

            if (search) {
                where = `
                    WHERE status != '1D'
                    AND (keyword ILIKE ? OR msg ILIKE ?)
                `;
                params.push(`%${search}%`, `%${search}%`);
            }

            /* 4️⃣ Pagination */
            const limit = 10;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM aichatbot
                ${where}
                `;

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                const total = countRows[0]?.total || 0;
                const lastPage = total === 0 ? 0 : Math.ceil(total / limit);

                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                        SELECT *
                        FROM aichatbot
                        ${where}
                        ORDER BY ${orderBy}
                        LIMIT ? OFFSET ?
                    `;

                const dataParams = [...params, limit, offset];

                db.query(dataSql, dataParams, (err2, rows) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (rows.length === 0) {
                        return res.json({
                            success: false,
                            data: [],
                            total,
                            page,
                            lastPage,
                            message: "No data found"
                        });
                    }

                    /* ✅ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
                        total,
                        page,
                        lastPage
                    });

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/add-chatbot", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* 1️⃣ Get Body */
            const { keyword, msg, label, href, internal } = req.body;

            /* 2️⃣ Validation */
            if (!keyword || keyword.trim().length < 2) {
                return res.json({
                    success: false,
                    message: "Please enter keyword"
                });
            }

            /* 3️⃣ Check Duplicate */
            const checkSql = `
      SELECT id 
      FROM aichatbot 
      WHERE keyword = ?
      LIMIT 1
    `;

            db.query(checkSql, [keyword.trim()], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length > 0) {
                    return res.json({
                        success: false,
                        message: "Keyword already exists"
                    });
                }

                /* 4️⃣ Insert */
                const insertSql = `
        INSERT INTO aichatbot 
        (keyword, msg, label, href, internal, status)
        VALUES (?, ?, ?, ?, ?, '1')
      `;

                db.query(
                    insertSql,
                    [
                        keyword.trim(),
                        msg || "",
                        label || "",
                        href || "",
                        internal ? 1 : 0
                    ],
                    (err2, result) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                        if (result.affectedRows === 1) {

                            const insertedId = result.insertId;

                            /* 5️⃣ Fetch inserted row */
                            const selectSql = `
              SELECT * FROM aichatbot WHERE id = ? LIMIT 1
            `;

                            db.query(selectSql, [insertedId], (err3, rows) => {

                                if (err3) {
                                    console.error(err3);
                                    return res.json({
                                        success: false,
                                        message: "Inserted but fetch failed"
                                    });
                                }

                                // ✅ Activity log (optional)
                                let info = "New chatbot keyword added '" + keyword.trim() + "'";
                                addactivity(ukey, insertedId, "aichatbot", info, "", "");

                                return res.json({
                                    success: true,
                                    data: rows[0],
                                    message: "Chatbot entry added successfully"
                                });

                            });

                        } else {
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                    }
                );

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/update-chatbot", async (req, res) => {

        const { key } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* 1️⃣ Get Data */
            const { id, keyword, msg, label, href, internal } = req.body;

            /* 2️⃣ Validate ID */
            if (!id || isNaN(id)) {
                return res.json({
                    success: false,
                    message: "Invalid chatbot ID"
                });
            }

            /* 3️⃣ Validate Keyword */
            if (!keyword || keyword.trim().length < 2) {
                return res.json({
                    success: false,
                    message: "Please enter keyword"
                });
            }

            /* 4️⃣ Optional Link Validation */
            if (label && !href) {
                return res.json({
                    success: false,
                    message: "Link URL required"
                });
            }

            /* 5️⃣ Update */
            const updateSql = `
      UPDATE aichatbot
      SET 
        keyword = ?,
        msg = ?,
        label = ?,
        href = ?,
        internal = ?
      WHERE id = ?
      LIMIT 1
    `;

            db.query(
                updateSql,
                [
                    keyword.trim(),
                    msg || "",
                    label || "",
                    href || "",
                    internal ? 1 : 0,
                    id
                ],
                (err, result) => {

                    if (err) {
                        console.error(err);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (result.affectedRows !== 1) {
                        return res.json({
                            success: false,
                            message: "No record found or no change made"
                        });
                    }

                    /* ✅ Activity Log */
                    let info = "Chatbot updated '" + keyword.trim() + "'";
                    addactivity(key, id, "aichatbot", info, "", "");

                    /* 6️⃣ Fetch Updated Row */
                    const selectSql = `
          SELECT * FROM aichatbot
          WHERE id = ?
          LIMIT 1
        `;

                    db.query(selectSql, [id], (err2, rows) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Updated but fetch failed"
                            });
                        }

                        return res.json({
                            success: true,
                            data: rows[0],
                            message: "Chatbot updated successfully"
                        });

                    });

                }
            );

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/disable-chatbot", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 1️⃣ Validate ID */
            if (!id || isNaN(id)) {
                return res.json({
                    success: false,
                    message: "Invalid chatbot ID"
                });
            }

            /* 2️⃣ Check Exists & Active */
            const sql = `
      SELECT id, keyword 
      FROM aichatbot 
      WHERE id = ? AND status = '1'
      LIMIT 1
    `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "Record not found or already disabled"
                    });
                }

                const dbId = rows[0].id;
                const keyword = rows[0].keyword;

                /* 3️⃣ Disable */
                const updateSql = `
        UPDATE aichatbot 
        SET status = '1S'
        WHERE id = ? AND status = '1'
        LIMIT 1
      `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong"
                        });
                    }

                    if (result.affectedRows === 1) {

                        /* ✅ Activity Log */
                        let info = "Chatbot disabled '" + keyword + "'";
                        addactivity(ukey, dbId, "aichatbot", info, "", "");

                        return res.json({
                            success: true,
                            message: "Chatbot disabled successfully"
                        });

                    } else {
                        return res.json({
                            success: false,
                            message: "No change made"
                        });
                    }

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/enable-chatbot", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 1️⃣ Validate ID */
            if (!id || isNaN(id)) {
                return res.json({
                    success: false,
                    message: "Invalid chatbot ID"
                });
            }

            /* 2️⃣ Check Exists & Disabled */
            const sql = `
      SELECT id, keyword
      FROM aichatbot
      WHERE id = ? AND status = '1S'
      LIMIT 1
    `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "Record not found or already active"
                    });
                }

                const dbId = rows[0].id;
                const keyword = rows[0].keyword;

                /* 3️⃣ Enable */
                const updateSql = `
        UPDATE aichatbot
        SET status = '1'
        WHERE id = ? AND status = '1S'
        LIMIT 1
      `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong"
                        });
                    }

                    if (result.affectedRows === 1) {

                        /* ✅ Activity Log */
                        let info = "Chatbot enabled '" + keyword + "'";
                        addactivity(ukey, dbId, "aichatbot", info, "", "");

                        return res.json({
                            success: true,
                            message: "Chatbot enabled successfully"
                        });

                    } else {
                        return res.json({
                            success: false,
                            message: "No change made"
                        });
                    }

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/delete-chatbot", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 1️⃣ Validate ID */
            if (!id || isNaN(id)) {
                return res.json({
                    success: false,
                    message: "Invalid chatbot ID"
                });
            }

            /* 2️⃣ Check Exists (Active or Disabled) */
            const sql = `
                SELECT id, keyword
                FROM aichatbot
                WHERE id = ? AND (status = '1' OR status = '1S')
                LIMIT 1
                `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "Record not found or already deleted"
                    });
                }

                const dbId = rows[0].id;
                const keyword = rows[0].keyword;

                /* 3️⃣ Soft Delete */
                const updateSql = `
                    UPDATE aichatbot
                    SET status = '1D'
                    WHERE id = ? AND (status = '1' OR status = '1S')
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong"
                        });
                    }

                    if (result.affectedRows === 1) {

                        /* ✅ Activity Log */
                        let info = "Chatbot deleted '" + keyword + "'";
                        addactivity(ukey, dbId, "aichatbot", info, "", "");

                        return res.json({
                            success: true,
                            message: "Chatbot deleted successfully"
                        });

                    } else {
                        return res.json({
                            success: false,
                            message: "No change made"
                        });
                    }

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/aichatbotumt", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { q, s, n } = req.body;

            /* 1️⃣ Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sorting */
            let orderBy = "id DESC";
            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search */
            let where = "WHERE status != '1D'";
            let params = [];

            if (search) {
                where = `
                    WHERE status != '1D'
                    AND (keyword ILIKE ?)
                `;
                params.push(`%${search}%`);
            }

            /* 4️⃣ Pagination */
            const limit = 10;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM aichatbotumt
                ${where}
                `;

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                const total = countRows[0]?.total || 0;
                const lastPage = total === 0 ? 0 : Math.ceil(total / limit);

                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                        SELECT *
                        FROM aichatbotumt
                        ${where}
                        ORDER BY ${orderBy}
                        LIMIT ? OFFSET ?
                    `;

                const dataParams = [...params, limit, offset];

                db.query(dataSql, dataParams, (err2, rows) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (rows.length === 0) {
                        return res.json({
                            success: false,
                            data: [],
                            total,
                            page,
                            lastPage,
                            message: "No data found"
                        });
                    }

                    /* ✅ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
                        total,
                        page,
                        lastPage
                    });

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/delete-chatbotumt", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 1️⃣ Validate ID */
            if (!id || isNaN(id)) {
                return res.json({
                    success: false,
                    message: "Invalid chatbot ID"
                });
            }

            /* 2️⃣ Check Exists (Active or Disabled) */
            const sql = `
                SELECT id, keyword
                FROM aichatbotumt 
                WHERE id = ? AND (status = '1' OR status = '1S')
                LIMIT 1
                `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "Record not found or already deleted"
                    });
                }

                const dbId = rows[0].id;
                const keyword = rows[0].keyword;

                /* 3️⃣ Soft Delete */
                const updateSql = `
                    UPDATE aichatbotumt
                    SET status = '1D'
                    WHERE id = ? AND (status = '1' OR status = '1S')
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong"
                        });
                    }

                    if (result.affectedRows === 1) {

                        return res.json({
                            success: true,
                            message: "Chatbot msg deleted successfully"
                        });

                    } else {
                        return res.json({
                            success: false,
                            message: "No change made"
                        });
                    }

                });

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/chatbot-response", async (req, res) => {
      try {
        const { message } = req.body;

        let {
          key,
          token,
          aut, } = req.body;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
          return res.json(security);
        }

        // Fetch all active chatbot rules
        const sql = `
      SELECT * FROM aichatbot
      WHERE status = '1' LIMIT 200
    `;

        db.query(sql, [], (err2, rows) => {

          if (err2) {
            console.error(err2);
            return res.json({
              success: false,
              message: "Database error"
            });
          }

          if (rows.length === 0) {
            return res.json({
              success: false,
              data: [],
              message: "No data found"
            });
          }

          return res.json({
            success: true,
            data: rows,
          });

        });

      } catch (err) {
        console.error(err);
        return res.json({ success: false });
      }
    });

    router.post("/add-chatbotumt", async (req, res) => {

      try {

        /* 1️⃣ Get Body */
        const { key, token, aut, keyword } = req.body;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
          return res.json(security);
        }

        /* 2️⃣ Validation */
        if (!keyword || keyword.trim().length < 2) {
          return res.json({
            success: false,
            message: "Please enter keyword"
          });
        }

        /* 3️⃣ Check Duplicate */
        const checkSql = `
      SELECT id 
      FROM aichatbotumt  
      WHERE keyword = ?
      LIMIT 1
    `;

        db.query(checkSql, [keyword.trim()], (err, rows) => {

          if (err) {
            console.error(err);
            return res.json({
              success: false,
              message: "Database error"
            });
          }

          if (rows.length > 0) {
            return res.json({
              success: false,
              message: "Keyword already exists"
            });
          }

          /* 4️⃣ Insert */
          const insertSql = `
        INSERT INTO aichatbotumt  
        (keyword, status)
        VALUES (?, '1')
      `;

          db.query(
            insertSql,
            [
              keyword.trim()
            ],
            (err2, result) => {

              if (err2) {
                console.error(err2);
                return res.json({
                  success: false,
                  message: "Something went wrong, try again"
                });
              }

              if (result.affectedRows === 1) {

                return res.json({
                  success: true,
                  data: rows[0],
                  message: "Chatbot entry added successfully"
                });

              } else {
                return res.json({
                  success: false,
                  message: "Something went wrong, try again"
                });
              }

            }
          );

        });

      } catch (err) {
        console.error(err);
        return res.json({
          success: false,
          message: "Server error"
        });
      }

    });
};
