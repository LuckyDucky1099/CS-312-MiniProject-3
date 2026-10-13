# CS 312 Mini-Project 3 – Blog with Node.js, Express, EJS & PostgreSQL

A multi-user blog. Anyone can read posts; signed-in users can create posts and
edit/delete only the ones they created. Passwords are hashed with bcrypt, and the
bonus **Account** page lets users change their user ID and password.

## Setup

1. Install [Node.js](https://nodejs.org) and PostgreSQL.
2. In pgAdmin, create a database named `BlogDB`.
3. Install dependencies and configure the environment:
   ```bash
   npm install
   cp .env.example .env     # then edit .env with your Postgres password
   ```
4. Create the tables and seed sample data (3 users, 5 posts):
   ```bash
   npm run initdb
   ```
   (`db/schema.sql` contains the table definitions if you prefer running them in pgAdmin.
   Seeding is done by the script because seeded passwords must be hashed.)
5. Start the app and open http://localhost:3000
   ```bash
   npm start
   ```

## Sample logins

| user_id | password  |
|---------|-----------|
| alice   | alice123  |
| bob     | bob12345  |
| carol   | carol123  |

## Database schema

**users**: `user_id` (PK, varchar 255), `password` (varchar 255, bcrypt hash), `name` (varchar 255)

**blogs**: `blog_id` (PK, serial), `creator_name`, `creator_user_id` (FK -> users.user_id,
`ON UPDATE CASCADE`, `ON DELETE CASCADE`), `title`, `body` (text), `date_created` (timestamp)

## Routes and SQL used

| Route | Action | SQL |
|-------|--------|-----|
| `GET /` | Blog feed | `SELECT * FROM blogs ORDER BY date_created DESC` |
| `POST /signup` | Register | `SELECT` to check ID, then `INSERT INTO users` |
| `POST /signin` | Log in | `SELECT ... FROM users WHERE user_id = $1`, then bcrypt compare |
| `POST /posts` | Create post | `INSERT INTO blogs` |
| `POST /posts/:id/edit` | Edit post | `UPDATE blogs ... WHERE blog_id = $3 AND creator_user_id = $4` |
| `POST /posts/:id/delete` | Delete post | `DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2` |
| `POST /account` | Change ID/password | `UPDATE users SET user_id, password WHERE user_id = $3` |

Ownership is enforced in the SQL `WHERE` clause, so a user cannot modify another
user's post even by crafting a request by hand.

## Notes on the bonus

The assignment suggests MD5, but MD5 is fast and unsalted, which makes it unsafe for
passwords. This project uses **bcrypt** (salted and deliberately slow) instead.
