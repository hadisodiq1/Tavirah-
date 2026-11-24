import {
  db,
  FOUNDER_UID,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  arrayUnion
} from "./firebase.js";
import { esc, BARRIER_LABELS, computeTreeState } from "./engines.js";
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
  const tableEl = document.getElementById("f-users-table");
  if (users.length === 0) {
    tableEl.textContent = "No accounts registered yet.";
  } else {
    tableEl.innerHTML = users
      .sort((a, b) => (b.totalProofs || 0) - (a.totalProofs || 0))
      .slice(0, 30)
      .map((u) => {
        const bName = BARRIER_LABELS[u.primaryBarrier] || "—";
        const tree = computeTreeState(u);
        return `
          <div class="soft-row">
            <div>
              <strong>${esc(u.displayName || "Builder")}</strong>
              <span class="pill" style="margin-left:6px;">${tree.stage.emoji} ${esc(tree.stage.name)}
</span>
              <div class="small muted" style="margin-top:4px;">Goal: ${esc(u.visionTitle || "Not set")}
</div>
              <div class="small muted">Obstacle: ${esc(bName)} • Last outcome: ${esc(u.lastOutcome || "none")}</div>
            </div>
            <div style="text-align:right;">
              <span class="pill pill-moss">${Number(u.totalProofs || 0)} actions</span>
              <div class="small muted" style="margin-top:4px;">${Number(u.streak || 0)}d streak</
div>
            </div>
          </div>
        `;
      })
      .join("");
  }
  // Load Community Moderation Reports
  const reportsEl = document.getElementById("f-reports-list");
  try {
    const repSnap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(20)));
    if (repSnap.empty) {
      reportsEl.textContent = "No reports submitted.";
    } else {
      reportsEl.innerHTML = repSnap.docs
        .map((d) => {
          const r = d.data();
          return `
            <div class="soft-row" style="margin-top:8px;">
              <div>
                <strong>Room: ${esc(r.roomId || "unknown")}</strong>
                <div class="small muted">Reported text: "${esc(r.messagePreview || "")}"</div>
                <div class="small muted">Reason: ${esc(r.reason || "")}</div>
              </div>
              <button class="btn btn-glass btn-sm f-dismiss-report" data-id="${d.id}"
type="button">Dismiss</button>
            </div>
          `;
        })
        .join("");
      reportsEl.querySelectorAll(".f-dismiss-report").forEach((btn) =>
        btn.addEventListener("click", async () => {
          await deleteDoc(doc(db, "reports", btn.dataset.id));
          loadFounderTelemetry(liveConfig);
        })
      );
    }
  } catch (err) {
    reportsEl.textContent = "Unable to load reports.";
  }
  const sampleVisions = users
    .filter((u) => u.visionTitle)
    .slice(0, 8)
    .map((u) => `- "${u.visionTitle}" [Obstacle: ${BARRIER_LABELS[u.primaryBarrier] ||u.primaryBarrier}, Actions: ${u.totalProofs || 0}, Outcome: ${u.lastOutcome || "none"}]`)
    .join("\n");
  latestTelemetryBrief = `TAVIRAH OS v2.1 — FOUNDER TELEMETRY BRIEF Date: ${new Date().toISOString().slice(0, 10)}
Registered Accounts: ${users.length}
Real Actions Logged: ${totalProofs}
#1 Obstacle: ${topBlockerLabel} (${topCount} accounts)
Obstacle Breakdown: ${JSON.stringify(barrierCounts)}
Live Wisdom Protocols Active: ${(liveConfig?.founderProtocols || []).length}
ANONYMIZED GOAL SAMPLE: ${sampleVisions || "- None yet"}
REQUEST TO MY AI PARTNER: Based on these real-world outcomes and obstacles: 1. Where is Tavirah's Observe -> Update decision logic helping or missing?2. Draft 1 practical Living Wisdom protocol I can push today to help builders overcome "${topBlockerLabel}".`;
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
