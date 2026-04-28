 
const VERSION = "v12-taskjson-updated"; 

const express = require("express");
const { Pool } = require("pg");

const app = express();
const cors = require("cors"); // Tillåter anrop från frontend (t.ex. Amplify) till API:t  

const fs = require("fs");
app.use(express.json());

// Tillåter endast anrop från min frontend-domän.
// Detta krävs eftersom API:t nås via CloudFront (annan origin).
// Att begränsa origin är säkrare än att tillåta alla (*).
app.use(cors({
  origin: "https://main.d27vh4ztyhscep.amplifyapp.com"
}));

// Hämta från ECS env vars
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});


async function initDB() {
  try {
    if (!fs.existsSync("./init.sql")) {
      console.log("init.sql not found, skipping DB init");
      return;
    }

    const sql = fs.readFileSync("./init.sql", "utf8");
    await pool.query(sql);
    console.log("DB initialized from init.sql");
  } catch (err) {
    console.error("DB init failed", err);
  }
}

initDB().catch(err => {
  console.error("InitDB crashed", err);
});

app.get("/", (req, res) => {
  res.json({
    message: "API running ",
    version: VERSION,
  });
});

// Test endpoint  

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", version: VERSION });
  } catch (err) {
    console.error("DB health failed:", err.message);

    // 👇 fortfarande OK!
    res.json({ status: "ok", db: "disconnected", version: VERSION });
  }
});


// Hämta tasks från DB
app.get("/tasks", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tasks");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// Skapa task
app.post("/tasks", async (req, res) => {
  const { title } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *",
      [title, false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Insert failed" });
  }
});

// Delete task
app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ message: "Task deleted", task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Update task
app.put("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { title, done } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE tasks
      SET title = COALESCE($1, title),
          done = COALESCE($2, done),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [title, done, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

console.log("Starting app...");
app.listen(3000, "0.0.0.0", () => {
  console.log("Running on port 3000");
});