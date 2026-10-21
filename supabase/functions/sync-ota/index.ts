import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const manual = url.searchParams.get("manual") === "1";
    const feedId = url.searchParams.get("feed");

    if (req.method !== "POST" && !manual) {
      return json({ error: "Kaedah tidak dibenarkan" }, 405);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Senarai suapan yang perlu disegerak (lebih 14 minit) atau suapan khusus manual.
    let feeds: { id: string; room_type_id: string; label: string; url: string }[];
    if (feedId) {
      const { data, error } = await admin
        .from("ota_calendar_feeds").select("id, room_type_id, label, url").eq("id", feedId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Suapan tidak dijumpai" }, 404);
      feeds = [data];
    } else {
      const { data, error } = await admin.rpc("due_ical_feeds");
      if (error) throw error;
      feeds = (data ?? []) as typeof feeds;
    }

    const results: { feed_id: string; label: string; ok: boolean; blocks: number; error: string | null }[] = [];

    for (const feed of feeds) {
      let ok = false;
      let blocks = 0;
      let errMsg: string | null = null;
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "PerhentianBayB2B-Sync/1.0" },
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          errMsg = `HTTP ${res.status}`;
        } else {
          const body = await res.text();
          const { data: imported, error: importError } = await admin.rpc("import_ical_blocks", {
            p_room: feed.room_type_id,
            p_ical: body,
          });
          if (importError) {
            errMsg = importError.message;
          } else {
            blocks = Number(imported ?? 0);
            ok = true;
          }
        }
      } catch (e) {
        errMsg = e instanceof Error ? e.message : "Gagal mengambil kalendar";
      }

      const { error: recError } = await admin.rpc("record_feed_sync", {
        p_feed: feed.id,
        p_status: ok ? `OK: ${blocks} blok` : `Gagal: ${errMsg ?? "tidak diketahui"}`,
      });
      if (recError) console.error("record_feed_sync failed", recError);

      results.push({ feed_id: feed.id, label: feed.label, ok, blocks, error: errMsg });
    }

    return json({ synced: results.length, results });
  } catch (err) {
    console.error("sync-ota failed", err);
    return json({ error: "Penyegerakan gagal. Sila cuba lagi." }, 500);
  }
});