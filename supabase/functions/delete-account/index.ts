// B2B Exam Prep: a signed-in reader deletes their own account (and, through the foreign key, their saved progress).
// verify_jwt is on, so only a valid sign-in reaches this code; the account deleted is always the caller's own.
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

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return reply({ error: "Please sign in again, then try once more." }, 401, cors);
  const { error: gone } = await admin.auth.admin.deleteUser(data.user.id);
  if (gone) return reply({ error: "Could not delete the account right now. Please try again later." }, 500, cors);
  return reply({ ok: true }, 200, cors);
});
