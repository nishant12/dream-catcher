import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import helmet from "helmet";
import { initDatabase } from "./config/database-init.js";
import dreamsRouter from "./routes/dreams.js";
import pool from "./config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Add security headers
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
}

const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", uptime: process.uptime() });
  } catch (e) {
    res.status(503).json({
      status: "error",
      db: "disconnected",
      message: e.message,
      uptime: process.uptime(),
    });
  }
});

app.get("/shutdown", (req, res) => {
  res.send("Shutting down the server...");
  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 100);
});

let server;

process.on("SIGTERM", gracefulShutDown);

async function gracefulShutDown() {
  console.log("Received SIGTERM, shutting down gracefully...");

  server.close(() => {
    console.log("Closed out remaining connections.");
  });

  try {
    await pool.end();
    console.log("Database connection pool closed.");
    process.exit(0);
  } catch (error) {
    console.error("Error closing database connection pool:", error);
    process.exit(1);
  }
}

// API Routes
app.use("/api/dreams", dreamsRouter);

// Initialize database then start server
initDatabase()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
  });
