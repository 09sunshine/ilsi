import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  PORT: z.string().default("4000").transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:8080"),

  // Database & Supabase
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ilsi_lms"),
  SUPABASE_URL: z.string().default("https://uadawqgekfkmpnqcliam.supabase.co"),
  SUPABASE_ANON_KEY: z.string().default("sb_publishable_ATYKIh6JSmHA2leFH7DgZg_3POFntJS"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("placeholder_service_role_key"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().default("ilsi_lms_super_secret_auth_key_replace_in_production_min_32_chars"),
  BETTER_AUTH_URL: z.string().default("http://localhost:4000"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:4000/api/google/callback"),

  // Payment (Stripe)
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),

  // Email
  EMAIL_FROM: z.string().default("admissions@ilsi-leadership.org"),
  RESEND_API_KEY: z.string().default(""),
});

export const env = envSchema.parse(process.env);
