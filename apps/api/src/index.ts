import "dotenv/config";
import cors from "cors";
import express from "express";
import { APP_NAME } from "@anantaone/shared";
import { prisma } from "./db.js";
import { v1Router } from "./routes/v1.js";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

app.use(
  cors({
    origin: [appUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: APP_NAME,
    env: process.env.NODE_ENV ?? "development",
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "up" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(503).json({ ok: false, database: "down", message });
  }
});

app.use("/api/v1", v1Router);

app.listen(port, () => {
  console.log(`${APP_NAME} API listening on http://localhost:${port}`);
});
