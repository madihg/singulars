import { permanentRedirect } from "next/navigation";

// The About content is folded into the landing page (Saf session 2,
// Aug 31 2026): one page, no click-outs. Old links keep working.
export default function AboutPage() {
  permanentRedirect("/");
}
