/**
 * Minimal WebRTC helpers for the recover.exe live camera: Halim's laptop
 * (control, SF) captures getUserMedia and publishes to the venue screen
 * (stage, Porto). Signaling is non-trickle (we wait for ICE gathering to
 * finish, then exchange the full SDP via Supabase / the stage API), so we
 * don't need a low-latency candidate channel - a couple of polled round
 * trips is enough.
 *
 * Reliability: STUN for the easy case + public TURN (relay) for restrictive
 * venue networks, overridable via NEXT_PUBLIC_TURN_* envs for a paid/owned
 * TURN server. ALWAYS dry-run on a network like the venue's before the show.
 */

export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Optional owned/paid TURN (recommended for the real show).
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }

  // Free public TURN fallback (best-effort; UDP + TCP + 443 so it can punch
  // through most conference firewalls). Not guaranteed under heavy load.
  servers.push(
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  );

  return servers;
}

/**
 * Resolve once the peer connection has finished gathering ICE candidates, so
 * the SDP we hand to signaling already contains them (non-trickle). Caps the
 * wait so a stuck gather doesn't hang the UI.
 */
export function waitForIceGathering(
  pc: RTCPeerConnection,
  // 8s (was 4s): relay candidates from a TURN server over TCP/443 routinely
  // take 3-6s to gather, especially from a restrictive network. Since signaling
  // is non-trickle, any candidate not gathered before this resolves is lost for
  // good - too short a cap silently drops the relay path and media never flows.
  timeoutMs = 8000,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    pc.addEventListener("icegatheringstatechange", check);
    // Fallback: resolve on timeout even if a relay candidate is slow.
    setTimeout(finish, timeoutMs);
  });
}
