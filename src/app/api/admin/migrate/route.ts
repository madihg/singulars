import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (key !== "singulars-migrate-2026-03-10") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "No DB client" }, { status: 503 });
  }

  const results: Record<string, unknown> = {};

  // 1. Update hard.exe to trained
  const { error: e1 } = await supabase
    .from("performances")
    .update({ status: "trained" })
    .eq("slug", "hard-exe");
  results["hard-exe-status"] = e1 ? e1.message : "trained";

  // 2. Update reverse.exe to training
  const { error: e2 } = await supabase
    .from("performances")
    .update({ status: "training" })
    .eq("slug", "reverse-exe");
  results["reverse-exe-status"] = e2 ? e2.message : "training";

  // 3. Get reverse.exe performance ID
  const { data: revPerf, error: e3 } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", "reverse-exe")
    .single();
  if (e3 || !revPerf) {
    results["reverse-exe-lookup"] = e3?.message || "not found";
    return NextResponse.json(results);
  }
  const revId = revPerf.id;

  // 4. Check if poems already exist for reverse.exe
  const { data: existing } = await supabase
    .from("poems")
    .select("id")
    .eq("performance_id", revId);
  if (existing && existing.length > 0) {
    results["reverse-exe-poems"] =
      `already has ${existing.length} poems, skipping`;
  } else {
    // Insert poems
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
        text: "When I sleep, sparks bathe my eyelids, reality dissolves to reveal the bones of a universe still alive. absences gather like summer flies and draw patterns on the wall. We pose there, motionless, and with each blink, the world rebuilds itself, more fragile than before. These dreams linger with their phosphorescent grain, they prove that elsewhere exists, and that words, when properly used, can piece together what was shattered.",
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
        text: "pour transformer lead to roses we stretch our breath to brittle glass where quivers our last words already turned to salt in the orbit of impossible we open a crack into that zone where words ignite melt back into their primal elements thinking this is gathering then begins interventions of light to raise new gold from our language",
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
        text: "The ice field covers the rooftops, the clocks stone under frost. The hedgehog rounds the corner of the patio, fog in the breathing. The elderly woman unfamiliar in her mirror pulls woolens from plastic bags, lies down five minutes to breathe a winter that is not her own. The nonexistent ball of snow falls in the summer stroke of lightning. Between my teeth, a snowflake shatters.",
        author_name: "Machine",
        author_type: "machine",
        vote_count: 0,
      },
    ];

    const { error: e4 } = await supabase.from("poems").insert(poems);
    results["reverse-exe-poems"] = e4 ? e4.message : "6 poems inserted";

    // Update poem count
    await supabase
      .from("performances")
      .update({ num_poems: 6, num_poets: 1 })
      .eq("slug", "reverse-exe");
  }

  // 5. Insert ground.exe if not exists
  const { data: groundCheck } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", "ground-exe");
  if (groundCheck && groundCheck.length > 0) {
    results["ground-exe"] = "already exists, skipping";
  } else {
    const { error: e5 } = await supabase.from("performances").insert({
      name: "ground.exe",
      slug: "ground-exe",
      color: "#D97706",
      location: "Currents New Media Festival, Santa Fe",
      date: "2026-06-12",
      num_poems: 0,
      num_poets: 0,
      status: "upcoming",
      poets: [],
    });
    results["ground-exe"] = e5 ? e5.message : "inserted as upcoming";
  }

  return NextResponse.json({ success: true, results });
}
