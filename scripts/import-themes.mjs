import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "singulars" },
});

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const themes = [
  {
    content: "love",
    votes: 4,
    completed: true,
    created_at: "2025-11-16T21:57:25.969Z",
    updated_at: "2025-12-05T22:44:32.736Z",
  },
  {
    content: "oysters",
    votes: 4,
    completed: true,
    created_at: "2025-11-20T00:12:07.859Z",
    updated_at: "2025-11-21T17:52:57.080Z",
  },
  {
    content: "death",
    votes: 3,
    completed: true,
    created_at: "2025-11-17T14:21:33.993Z",
    updated_at: "2025-11-19T15:15:47.673Z",
  },
  {
    content: "memories",
    votes: 3,
    completed: true,
    created_at: "2025-11-19T17:49:15.278Z",
    updated_at: "2025-11-21T17:08:38.707Z",
  },
  {
    content: "touch grass",
    votes: 2,
    completed: true,
    created_at: "2025-11-16T21:59:24.448Z",
    updated_at: "2025-11-19T15:15:47.841Z",
  },
  {
    content: "care",
    votes: 2,
    completed: true,
    created_at: "2025-11-16T22:04:04.327Z",
    updated_at: "2025-11-19T15:15:51.227Z",
  },
  {
    content: "falling out of contact with old friends",
    votes: 2,
    completed: true,
    created_at: "2025-11-17T13:53:50.625Z",
    updated_at: "2025-11-19T15:15:51.499Z",
  },
  {
    content: "Singularity",
    votes: 2,
    completed: true,
    created_at: "2025-11-19T12:36:53.402Z",
    updated_at: "2025-11-21T19:26:30.461Z",
  },
  {
    content: "Compromise",
    votes: 2,
    completed: true,
    created_at: "2025-11-19T12:52:29.292Z",
    updated_at: "2025-11-20T16:30:37.396Z",
  },
  {
    content: "first love",
    votes: 2,
    completed: true,
    created_at: "2025-11-19T13:30:22.493Z",
    updated_at: "2025-11-22T18:32:59.869Z",
  },
  {
    content: "age of post truth",
    votes: 2,
    completed: true,
    created_at: "2025-11-19T17:50:25.680Z",
    updated_at: "2025-11-22T18:57:59.618Z",
  },
  {
    content: "Major Kusanagi",
    votes: 1,
    completed: true,
    created_at: "2025-11-17T01:49:48.946Z",
    updated_at: "2025-11-19T15:15:53.268Z",
  },
  {
    content: "open air backseat",
    votes: 1,
    completed: true,
    created_at: "2025-11-19T12:40:24.870Z",
    updated_at: "2025-11-22T19:26:30.346Z",
  },
  {
    content: "the winter in the summer",
    votes: 1,
    completed: true,
    created_at: "2025-12-12T01:01:35.919Z",
    updated_at: "2026-03-12T19:58:15.880Z",
  },
  {
    content: "limerence",
    votes: 0,
    completed: true,
    created_at: "2025-11-17T14:21:18.195Z",
    updated_at: "2025-11-19T15:15:54.206Z",
  },
  {
    content: "Currency",
    votes: 0,
    completed: true,
    created_at: "2025-11-19T12:38:21.897Z",
    updated_at: "2025-11-20T17:59:31.011Z",
  },
  {
    content: "Desire",
    votes: 0,
    completed: true,
    created_at: "2025-11-19T12:40:05.034Z",
    updated_at: "2025-11-20T16:30:41.265Z",
  },
  {
    content: "crime",
    votes: 0,
    completed: true,
    created_at: "2025-11-19T13:29:45.093Z",
    updated_at: "2025-11-20T17:34:22.568Z",
  },
  {
    content: "grief",
    votes: 0,
    completed: true,
    created_at: "2025-11-19T13:30:02.868Z",
    updated_at: "2025-11-20T17:08:25.179Z",
  },
  {
    content: "Romance",
    votes: 0,
    completed: true,
    created_at: "2025-12-06T02:20:45.923Z",
    updated_at: "2025-12-06T03:11:53.652Z",
  },
  {
    content: "Sun",
    votes: 0,
    completed: true,
    created_at: "2025-12-06T03:11:47.209Z",
    updated_at: "2025-12-06T03:37:31.828Z",
  },
  {
    content: "Diegetic",
    votes: 0,
    completed: true,
    created_at: "2025-12-06T03:38:19.507Z",
    updated_at: "2025-12-06T05:26:58.493Z",
  },
  {
    content: "Particles",
    votes: 0,
    completed: true,
    created_at: "2025-12-06T05:26:55.273Z",
    updated_at: "2025-12-06T08:21:49.879Z",
  },
  {
    content: "Mortality",
    votes: 0,
    completed: true,
    created_at: "2026-03-10T18:37:27.793Z",
    updated_at: "2026-03-12T20:45:25.653Z",
  },
  {
    content: "Tinder",
    votes: 0,
    completed: true,
    created_at: "2026-03-10T18:37:42.419Z",
    updated_at: "2026-03-12T21:31:41.425Z",
  },
  {
    content: "Academic life",
    votes: 0,
    completed: true,
    created_at: "2026-03-12T21:14:29.567Z",
    updated_at: "2026-03-13T21:19:54.058Z",
  },
  {
    content: "Liberation",
    votes: 0,
    completed: false,
    created_at: "2026-03-13T21:20:05.619Z",
    updated_at: "2026-03-13T21:20:05.619Z",
  },
];

async function importThemes() {
  console.log(`Importing ${themes.length} themes...`);

  const rows = themes.map((t) => ({
    content: t.content,
    theme_slug: slugify(t.content),
    votes: t.votes,
    completed: t.completed,
    archived: false,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const { error } = await supabase.from("themes").insert(row);
    if (error) {
      if (error.code === "23505") {
        skipped++;
        console.log(`  Skipped (already exists): ${row.content}`);
      } else {
        console.error(`  Error inserting "${row.content}":`, error.message);
      }
    } else {
      imported++;
      console.log(`  Imported: ${row.content}`);
    }
  }

  console.log(`\nImported ${imported}, skipped ${skipped} duplicates.`);

  // Verify
  const { data: all } = await supabase
    .from("themes")
    .select("id, content, votes, completed")
    .order("votes", { ascending: false });

  console.log(`\nTotal themes in DB: ${all?.length}`);
  console.log(`  Active: ${all?.filter((t) => !t.completed).length}`);
  console.log(`  Completed: ${all?.filter((t) => t.completed).length}`);
}

importThemes();
