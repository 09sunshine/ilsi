import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: ((import.meta.env as any).VITE_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, ""),
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
