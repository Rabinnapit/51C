// B2B Exam Prep: create an account that can sign in at once (no confirmation email; the free email service allows only a few an hour).
// Public by design, like any sign-up form: it checks the email and password itself and never returns anyone's data.
// Deployed to the Supabase project 51C as "signup" with verify_jwt off.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED = ["https://rabinnapit.github.io", "http://localhost:8790", "http://localhost:8791", "http://localhost:8792"];

function reply(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405, cors);

  let body: { email?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Send the email and password as JSON." }, 400, cors); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400, cors);
  if (password.length < 8 || password.length > 72) return reply({ error: "Use a password of 8 to 72 characters." }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return reply({ error: taken ? "An account with that email already exists. Sign in instead." : "Could not create the account right now. Please try again later." }, taken ? 409 : 400, cors);
  }
  return reply({ ok: true }, 200, cors);
});
