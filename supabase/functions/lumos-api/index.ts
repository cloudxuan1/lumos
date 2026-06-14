import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const VALID_STATUS = [
  "home", "work", "overtime", "slacking", "travel",
  "playing", "sleeping", "study", "peril",
];
const VALID_MODE = ["manual", "auto"];
const VALID_ENTITY = ["cloud", "crab", "owl"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/lumos-api", "");

  try {
    // GET /health — 心跳
    if (req.method === "GET" && path === "/health") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    // GET /status — 读全部状态
    if (req.method === "GET" && path === "/status") {
      const { data, error } = await supabase
        .from("clock_status")
        .select("*")
        .order("entity_id", { ascending: true });
      if (error) throw error;
      return json(data);
    }

    // PATCH /status/:entity_id — 更新某根指针
    if (req.method === "PATCH" && path.startsWith("/status/")) {
      const entityId = path.split("/")[2];
      if (!VALID_ENTITY.includes(entityId)) {
        return json({ error: "Invalid entity_id" }, 400);
      }
      const body = await req.json();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.status !== undefined) {
        if (!VALID_STATUS.includes(body.status)) {
          return json({ error: "Invalid status" }, 400);
        }
        patch.status = body.status;
      }
      if (body.mode !== undefined) {
        if (!VALID_MODE.includes(body.mode)) {
          return json({ error: "Invalid mode" }, 400);
        }
        patch.mode = body.mode;
      }
      if (body.manual_until !== undefined) {
        patch.manual_until = body.manual_until;
      }

      const { data, error } = await supabase
        .from("clock_status")
        .update(patch)
        .eq("entity_id", entityId)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
