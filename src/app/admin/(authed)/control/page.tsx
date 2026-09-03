/**
 * /admin/control - per-performance control hub.
 *
 * The operator surfaces (control + stage) live per performance at
 * /<slug>/control and /<slug>/stage. This page is the entry point into them
 * from inside admin: it highlights whatever performance is currently in
 * `training` ("live now") and lists every performance with its own
 * control/stage links, so when a future show goes live it shows up here
 * automatically - nothing hard-coded to recover.exe.
 *
 * Control accepts the admin login cookie, so these links open without a ?key.
 */

import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";
import Win from "@/components/desktop/Win";

export const dynamic = "force-dynamic";

type Perf = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  status: "upcoming" | "training" | "trained";
  date: string;
};

async function fetchData(): Promise<{ perfs: Perf[]; withStage: Set<string> }> {
  const supabase = getServiceClient();
  if (!supabase) return { perfs: [], withStage: new Set() };

  const { data: perfs } = await supabase
    .from("performances")
    .select("id, slug, name, color, status, date")
    .order("date", { ascending: false });

  const { data: stageRows } = await supabase
    .from("stage_state")
    .select("performance_id");

  const withStage = new Set(
    ((stageRows || []) as { performance_id: string }[]).map(
      (r) => r.performance_id,
    ),
  );

  return { perfs: (perfs || []) as Perf[], withStage };
}

function ControlLinks({ slug }: { slug: string }) {
  return (
    <span className="sg-line__a">
      <Link className="btn" href={`/${slug}/control`}>
        open control &rarr;
      </Link>
      {/* A plain <a>, so it carries the basePath prefix itself. */}
      <a
        className="btn"
        href={`/singulars/${slug}/stage`}
        target="_blank"
        rel="noreferrer"
      >
        open stage &#x2197;
      </a>
    </span>
  );
}

export default async function AdminControlPage() {
  const { perfs, withStage } = await fetchData();
  const live = perfs.filter((p) => p.status === "training");

  return (
    <>
      <Win file="control.txt" span="w--eight">
        <p className="k">singulars &middot; admin</p>
        <h1 className="disp">control</h1>
        <p className="sub">
          Drive a performance&rsquo;s live stage: lock themes, publish poems,
          run the camera. Open control on your laptop, open the stage on the
          venue screen.
        </p>
      </Win>

      <Win file="live-now/" span="w--five" meta={`${live.length} live`}>
        {live.length > 0 ? (
          live.map((p) => (
            <div className="sg-line sg-line--2" key={p.id}>
              <span className="sg-line__n">
                <i
                  className="cdot"
                  style={{ ["--c" as string]: p.color || "var(--acc)" }}
                />
                {p.name}
                <span className="sg-pill" data-state="training">
                  training
                </span>
              </span>
              <ControlLinks slug={p.slug} />
            </div>
          ))
        ) : (
          <p className="note" style={{ marginTop: 0 }}>
            No performance is in training right now. Flip one to training on{" "}
            <Link href="/admin/performances">performances</Link> to drive its
            stage.
          </p>
        )}
      </Win>

      <Win
        file="performances/"
        span="w--seven"
        meta={`${perfs.length} in the series`}
      >
        <div className="hdr">
          <span className="k">performance</span>
          <span className="k">status</span>
          <span className="k">stage</span>
          <span className="k">open</span>
        </div>
        {perfs.map((p) => (
          <div className="sg-line sg-line--4" key={p.id}>
            <span className="sg-line__n">
              <i
                className="cdot"
                style={{ ["--c" as string]: p.color || "var(--metal)" }}
              />
              {p.name}
            </span>
            <span className="fr__s">{p.status}</span>
            <span className="fr__w">
              {withStage.has(p.id) ? "stage ready" : "no stage yet"}
            </span>
            <ControlLinks slug={p.slug} />
          </div>
        ))}
      </Win>
    </>
  );
}
