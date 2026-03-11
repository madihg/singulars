import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "singulars-migrate-2026-03-10-v2") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service client not configured" },
      { status: 503 },
    );
  }

  const results: Record<string, unknown> = {};

  // 1. Update hard.exe status to 'trained'
  const { data: hardUpdate, error: hardErr } = await supabase
    .from("performances")
    .update({ status: "trained" })
    .eq("slug", "hard-exe")
    .select("slug, status");
  results["hard-exe-update"] = hardErr
    ? { error: hardErr.message }
    : { data: hardUpdate };

  // 2. Update reverse.exe status to 'training' + metadata
  const { data: revUpdate, error: revErr } = await supabase
    .from("performances")
    .update({
      status: "training",
      location: "Media Archaeology Lab, Boulder",
      num_poems: 6,
      num_poets: 1,
    })
    .eq("slug", "reverse-exe")
    .select("slug, status, location, num_poems");
  results["reverse-exe-update"] = revErr
    ? { error: revErr.message }
    : { data: revUpdate };

  // 3. Get reverse.exe performance ID
  const { data: revPerf, error: revPerfErr } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", "reverse-exe")
    .single();

  if (revPerfErr || !revPerf) {
    results["reverse-exe-lookup"] = {
      error: revPerfErr?.message || "Not found",
    };
    return NextResponse.json(results);
  }

  const revId = revPerf.id;
  results["reverse-exe-id"] = revId;

  // 4. Check if poems already exist for reverse.exe
  const { data: existingPoems, error: existErr } = await supabase
    .from("poems")
    .select("id, theme")
    .eq("performance_id", revId);
  results["existing-poems"] = existErr
    ? { error: existErr.message }
    : { count: existingPoems?.length || 0 };

  // 5. Insert poems only if none exist
  if (!existingPoems || existingPoems.length === 0) {
    const poems = [
      {
        performance_id: revId,
        theme: "Dreams",
        theme_slug: "dreams",
        text: `I have a weak spot
for crucibles, 3-day bears, muscular executive
functions, crow's feet,
mouth-shut mastication, "project" lovers,
correct cutlery handling,
the cresting
of infatuation, that neverspace
where gold shimmers
out of reach`,
        author_name: "Halim Madi",
        author_type: "human",
        vote_count: 0,
      },
      {
        performance_id: revId,
        theme: "Dreams",
        theme_slug: "dreams",
        text: `When I sleep, sparks bathe my eyelids, reality dissolves to reveal the bones of a universe still alive. absences gather like summer flies and draw patterns on the wall. We pose there, motionless, and with each blink, the world rebuilds itself, more fragile than before. These dreams linger with their phosphorescent grain, they prove that elsewhere exists, and that words, when properly used, can piece together what was shattered.`,
        author_name: "Machine",
        author_type: "machine",
        vote_count: 0,
      },
      {
        performance_id: revId,
        theme: "Alchemy",
        theme_slug: "alchemy",
        text: `Blame the dangerous shapes
of our jaws, perilous cliffs
silently boasting the bodies
they've claimed \u2014 our first kiss
the gauging
of an equal, our first dream
the names of our children
Joya, Layla and the shape
of jaws to come`,
        author_name: "Halim Madi",
        author_type: "human",
        vote_count: 0,
      },
      {
        performance_id: revId,
        theme: "Alchemy",
        theme_slug: "alchemy",
        text: `pour transformer lead to roses we stretch our breath to brittle glass where quivers our last words already turned to salt in the orbit of impossible we open a crack into that zone where words ignite melt back into their primal elements thinking this is gathering then begins interventions of light to raise new gold from our language`,
        author_name: "Machine",
        author_type: "machine",
        vote_count: 0,
      },
      {
        performance_id: revId,
        theme: "The Winter in the Summer",
        theme_slug: "the-winter-in-the-summer",
        text: `Years ago, in the grip of S\u00e3o Paulo's summer, I asked a dozen friends to stare at an ice cube melting, skinning its integrity against the heated topology of release and afterwards when Andre asked me why I think I dodged the question maybe, maybe the way a burlesque queen might when asked why they do what they do`,
        author_name: "Halim Madi",
        author_type: "human",
        vote_count: 0,
      },
      {
        performance_id: revId,
        theme: "The Winter in the Summer",
        theme_slug: "the-winter-in-the-summer",
        text: `The ice field covers the rooftops, the clocks stone under frost. The hedgehog rounds the corner of the patio, fog in the breathing. The elderly woman unfamiliar in her mirror pulls woolens from plastic bags, lies down five minutes to breathe a winter that is not her own. The nonexistent ball of snow falls in the summer stroke of lightning. Between my teeth, a snowflake shatters.`,
        author_name: "Machine",
        author_type: "machine",
        vote_count: 0,
      },
    ];

    const { data: insertedPoems, error: insertErr } = await supabase
      .from("poems")
      .insert(poems)
      .select("id, theme, author_type");
    results["poems-insert"] = insertErr
      ? { error: insertErr.message }
      : { inserted: insertedPoems?.length || 0, data: insertedPoems };
  } else {
    results["poems-insert"] = { skipped: true, existing: existingPoems.length };
  }

  return NextResponse.json(results);
}
