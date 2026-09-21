import { betterAuth } from "better-auth";
import { pool } from "../database/pool.js";
import { env } from "./env.js";

const trustedOrigins = Array.from(
  new Set([
    ...((env.FRONTEND_URL || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)),
    "https://ilsicampus.org",
    "https://www.ilsicampus.org",
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
  ])
);

export const auth = betterAuth({
  database: pool,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL.replace(/\/+$/, ""),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "PARTICIPANT",
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
      },
      firstLogin: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      locale: {
        type: "string",
        required: false,
        defaultValue: "en",
      },
    },
  },
});
