import "dotenv/config";
import cors from "cors";
import express from "express";
import { APP_NAME } from "@anantaone/shared";
import { prisma } from "./db.js";
import { v1Router } from "./routes/v1.js";
import { ownerRouter } from "./routes/owner.js";
import { ownerFinanceRouter } from "./routes/ownerFinance.js";
import { ownerSellRouter } from "./routes/ownerSell.js";
import { ownerMediaRouter } from "./routes/ownerMedia.js";
import { ownerCommerceRouter } from "./routes/ownerCommerce.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const extraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  appUrl,
  "https://anantaone.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...extraOrigins,
]);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, Render health checks) send no Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        allowedOrigins.has(origin) ||
        /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)
      ) {
        callback(null, true);
        return;
      }
      // Use false (not Error) so browsers still get a clean CORS response shape
      callback(null, false);
    },
  }),
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    app: APP_NAME,
    health: "/health",
    db: "/health/db",
  });
});

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
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/owner", ownerRouter);
app.use("/api/v1/owner", ownerFinanceRouter);
app.use("/api/v1/owner", ownerSellRouter);
app.use("/api/v1/owner", ownerMediaRouter);
app.use("/api/v1/owner", ownerCommerceRouter);
app.use("/api/v1/admin", adminRouter);

app.listen(port, "0.0.0.0", () => {
  console.log(`${APP_NAME} API listening on http://0.0.0.0:${port}`);
});
