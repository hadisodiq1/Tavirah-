import {
  db,
  FOUNDER_UID,
  collection,
  getDocs,
  doc,
  setDoc,
  arrayUnion
} from "./firebase.js";
import { esc, BARRIER_LABELS } from "./engines.js";

let latestTelemetryBrief = "";

export function isFounderUser(user) {
  return Boolean(user && user.uid === FOUNDER_UID);
}

export async function loadFounderTelemetry(liveConfig) {
  const usersSnap = await getDocs(collection(db, "users"));
  const users = [];
  let totalProofs = 0;
  const barrierCounts = {};

  usersSnap.forEach((docSnap) => {
    const u = docSnap.data();
    users.push(u);
    totalProofs += Number(u.totalProofs || 0);
    const b = u.primaryBarrier || "unspecified";
    barrierCounts[b] = (barrierCounts[b] || 0) + 1;
  });

  let topBlockerKey = "—";
  let topCount = 0;
  Object.entries(barrierCounts).forEach(([k, v]) => {
    if (v > topCount) {
      topCount = v;
      topBlockerKey = k;
    }
  });

  const topBlockerLabel = BARRIER_LABELS[topBlockerKey] || topBlockerKey;

  document.getElementById("f-total-users").textContent = users.length;
  document.getElementById("f-total-proofs").textContent = totalProofs;
  document.getElementById("f-top-blocker").textContent =
    topCount > 0 ? `${topBlockerLabel} (${topCount})` : "—";

  // Build telemetry user feed
  const tableEl = document.getElementById("f-users-table");
  if (users.length === 0) {
    tableEl.textContent = "No builders registered yet.";
  } else {
    tableEl.innerHTML = users
      .sort((a, b) => (b.totalProofs || 0) - (a.totalProofs || 0))
      .slice(0, 30)
      .map((u) => {
        const bName = BARRIER_LABELS[u.primaryBarrier] || "—";
        const bottleneck = u.stressTest?.bottleneck || "No diagnostic run";
        return `
          <div class="item-row">
            <div>
              <strong>${esc(u.displayName || "Builder")}</strong>
              <span class="badge" style="margin-left:6px;">${esc(bName)}</span>
              <div class="small muted" style="margin-top:4px;">Vision: ${esc(u.visionTitle || "Not set")}</div>
              <div class="small muted">Bottleneck: ${esc(bottleneck)}</div>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-green">${Number(u.totalProofs || 0)} proofs</span>
              <div class="small muted mono" style="margin-top:4px;">${Number(u.streak || 0)}d streak</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Generate 1-Click Founder Upgrade Brief for External AI
  const sampleVisions = users
    .filter((u) => u.visionTitle)
    .slice(0, 8)
    .map((u) => `- "${u.visionTitle}" [Blocker: ${BARRIER_LABELS[u.primaryBarrier] || u.primaryBarrier}, Proofs: ${u.totalProofs || 0}]`)
    .join("\n");

  const activeProtocolsCount = (liveConfig?.founderProtocols || []).length;

  latestTelemetryBrief = `TAVIRAH OS — FOUNDER LIVE TELEMETRY BRIEF
Date: ${new Date().toISOString().slice(0, 10)}
Total Builders: ${users.length}
Total Real-World Proofs Logged: ${totalProofs}
#1 Ecosystem Blocker: ${topBlockerLabel} (${topCount} builders)
Barrier Breakdown: ${JSON.stringify(barrierCounts)}
Live Pushed Protocols Active: ${activeProtocolsCount}

SAMPLE BUILDER VISIONS & TRACTION:
${sampleVisions || "- No visions logged yet"}

REQUEST TO MY AI PARTNER:
Based on these live user bottlenecks and current real-world tools/trends today:
1. What is the highest-impact upgrade we should add to Tavirah OS next?
2. Draft 1 new Live Protocol I can paste straight into my Founder Cockpit today to help builders overcome "${topBlockerLabel}".`;

  document.getElementById("f-ai-brief").value = latestTelemetryBrief;
}

export async function pushFounderAnnouncement(title, body) {
  await setDoc(
    doc(db, "system_config", "live_updates"),
    {
      announcement: {
        title: title.trim(),
        body: body.trim(),
        active: true,
        updatedAt: new Date().toISOString()
      }
    },
    { merge: true }
  );
}

export async function pushFounderProtocol(title, steps) {
  const newProto = {
    id: "proto_" + Date.now(),
    title: title.trim(),
    steps: steps.trim(),
    pushedAt: new Date().toISOString()
  };

  await setDoc(
    doc(db, "system_config", "live_updates"),
    {
      founderProtocols: arrayUnion(newProto)
    },
    { merge: true }
  );
}
