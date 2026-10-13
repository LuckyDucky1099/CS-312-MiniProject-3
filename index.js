import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: "warning", text: "Please sign in first." };
    return res.redirect("/signin");
  }
  next();
}

/* ---------------------------- Blog feed ---------------------------- */

app.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM blogs ORDER BY date_created DESC, blog_id DESC"
    );
    res.render("index", { posts: rows });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Signup ----------------------------- */

app.get("/signup", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("signup", { error: null, form: {} });
});

app.post("/signup", async (req, res, next) => {
  const user_id = (req.body.user_id || "").trim();
  const name = (req.body.name || "").trim();
  const password = req.body.password || "";
  const form = { user_id, name };

  if (!user_id || !name || !password) {
    return res.render("signup", { error: "All fields are required.", form });
  }
  if (password.length < 6) {
    return res.render("signup", {
      error: "Password must be at least 6 characters.",
      form,
    });
  }

  try {
    const existing = await pool.query(
      "SELECT 1 FROM users WHERE user_id = $1",
      [user_id]
    );
    if (existing.rowCount > 0) {
      return res.render("signup", {
        error: "That user ID is already taken. Please choose a different one.",
        form,
      });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
      [user_id, hash, name]
    );

    req.session.flash = {
      type: "success",
      text: "Account created! Please sign in.",
    };
    res.redirect("/signin");
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Signin ----------------------------- */

app.get("/signin", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("signin", { error: null, form: {} });
});

app.post("/signin", async (req, res, next) => {
  const user_id = (req.body.user_id || "").trim();
  const password = req.body.password || "";

  try {
    const { rows } = await pool.query(
      "SELECT user_id, password, name FROM users WHERE user_id = $1",
      [user_id]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password));

    if (!ok) {
      return res.render("signin", {
        error: "Incorrect user ID or password. Please try again.",
        form: { user_id },
      });
    }

    
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { user_id: user.user_id, name: user.name };
      res.redirect("/");
    });
  } catch (err) {
    next(err);
  }
});

app.post("/signout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect("/signin");
  });
});

/* ------------------------------ Posts ------------------------------ */

// Create
app.post("/posts", requireAuth, async (req, res, next) => {
  const title = (req.body.title || "").trim();
  const body = (req.body.body || "").trim();
  if (!title || !body) {
    req.session.flash = { type: "danger", text: "Title and body are required." };
    return res.redirect("/");
  }
  try {
    const { user_id, name } = req.session.user;
    await pool.query(
      `INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created)
       VALUES ($1, $2, $3, $4, NOW())`,
      [name, user_id, title, body]
    );
    req.session.flash = { type: "success", text: "Post published." };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});


app.get("/posts/:id/edit", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
      [req.params.id, req.session.user.user_id]
    );
    if (rows.length === 0) {
      req.session.flash = {
        type: "danger",
        text: "You can only edit posts that you created.",
      };
      return res.redirect("/");
    }
    res.render("edit", { post: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});


app.post("/posts/:id/edit", requireAuth, async (req, res, next) => {
  const title = (req.body.title || "").trim();
  const body = (req.body.body || "").trim();
  try {
    if (!title || !body) {
      const { rows } = await pool.query(
        "SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
        [req.params.id, req.session.user.user_id]
      );
      if (rows.length === 0) return res.redirect("/");
      return res.render("edit", {
        post: { ...rows[0], title, body },
        error: "Title and body are required.",
      });
    }

    const result = await pool.query(
      `UPDATE blogs SET title = $1, body = $2
       WHERE blog_id = $3 AND creator_user_id = $4`,
      [title, body, req.params.id, req.session.user.user_id]
    );
    req.session.flash =
      result.rowCount > 0
        ? { type: "success", text: "Post updated." }
        : { type: "danger", text: "You can only edit posts that you created." };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});


app.post("/posts/:id/delete", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
      [req.params.id, req.session.user.user_id]
    );
    req.session.flash =
      result.rowCount > 0
        ? { type: "success", text: "Post deleted." }
        : { type: "danger", text: "You can only delete posts that you created." };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

/* ------------------------ Account (bonus) -------------------------- */

app.get("/account", requireAuth, (req, res) => {
  res.render("account", { error: null, form: { user_id: req.session.user.user_id } });
});

app.post("/account", requireAuth, async (req, res, next) => {
  const currentId = req.session.user.user_id;
  const newId = (req.body.user_id || "").trim();
  const currentPassword = req.body.current_password || "";
  const newPassword = req.body.new_password || "";
  const form = { user_id: newId };

  const fail = (error) => res.render("account", { error, form });

  try {
    if (!newId) return fail("User ID cannot be empty.");
    if (newPassword && newPassword.length < 6) {
      return fail("New password must be at least 6 characters.");
    }

    const { rows } = await pool.query(
      "SELECT password FROM users WHERE user_id = $1",
      [currentId]
    );
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password))) {
      return fail("Your current password is incorrect.");
    }

    if (newId !== currentId) {
      const taken = await pool.query("SELECT 1 FROM users WHERE user_id = $1", [newId]);
      if (taken.rowCount > 0) return fail("That user ID is already taken.");
    }

    const hash = newPassword
      ? await bcrypt.hash(newPassword, SALT_ROUNDS)
      : rows[0].password;

    
    await pool.query(
      "UPDATE users SET user_id = $1, password = $2 WHERE user_id = $3",
      [newId, hash, currentId]
    );

    req.session.user.user_id = newId;
    req.session.flash = { type: "success", text: "Account updated." };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- Errors ------------------------------ */

app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { message: "Something went wrong on our end." });
});

app.listen(PORT, () => {
  console.log(`Blog app running at http://localhost:${PORT}`);
});
