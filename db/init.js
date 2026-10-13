
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import pool from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const users = [
  { user_id: "alice", password: "alice123", name: "Alice Johnson" },
  { user_id: "bob", password: "bob12345", name: "Bob Martinez" },
  { user_id: "carol", password: "carol123", name: "Carol Nguyen" },
];

const blogs = [
  ["alice", "Alice Johnson", "Getting Started with Node.js",
   "Node.js lets you run JavaScript outside the browser. After installing it, you can create a server in just a few lines and start serving pages. The npm ecosystem makes adding features like routing and templating painless.",
   "2025-01-05 09:15:00"],
  ["bob", "Bob Martinez", "Why I Love Express.js",
   "Express keeps things minimal. Routing, middleware and error handling are all straightforward, which makes it a great first framework for anyone learning backend development.",
   "2025-01-12 14:30:00"],
  ["carol", "Carol Nguyen", "A Weekend Trip to the Grand Canyon",
   "We left Flagstaff at sunrise and reached the South Rim before the crowds. The light on the canyon walls in the early morning was unforgettable. Pack water, layers, and a good camera.",
   "2025-01-20 08:00:00"],
  ["alice", "Alice Johnson", "SQL Tips I Wish I Knew Earlier",
   "Always use parameterized queries to prevent SQL injection. Learn the difference between INNER and LEFT joins early. And index the columns you filter on most often.",
   "2025-02-02 17:45:00"],
  ["bob", "Bob Martinez", "Five Habits for Cleaner Code",
   "Name things clearly, keep functions small, write comments that explain why rather than what, delete dead code, and review your own pull request before asking others to.",
   "2025-02-10 11:20:00"],
];

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  const { rows: u } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (u[0].n === 0) {
    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      await pool.query(
        "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
        [user.user_id, hash, user.name]
      );
    }
    console.log("Seeded users.");
  }

  const { rows: b } = await pool.query("SELECT COUNT(*)::int AS n FROM blogs");
  if (b[0].n === 0) {
    for (const [uid, name, title, body, date] of blogs) {
      await pool.query(
        `INSERT INTO blogs (creator_user_id, creator_name, title, body, date_created)
         VALUES ($1, $2, $3, $4, $5)`,
        [uid, name, title, body, date]
      );
    }
    console.log("Seeded blog posts.");
  }

  console.log("Database ready.");
  await pool.end();
}

   run().catch((err) => {
     console.error("Database setup failed:", err);
     process.exit(1);
   });
