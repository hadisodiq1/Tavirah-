import {
  auth,
  db,
  FOUNDER_UID,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp
} from "./firebase.js";

import {
  esc,
  todayStr,
  BARRIER_LABELS,
  UNBLOCK_ADVICE,
  runStressDiagnostic,
  buildSynthesizedPrompt
} from "./engines.js";

import {
  isFounderUser,
  loadFounderTelemetry,
  pushFounderAnnouncement,
  pushFounderProtocol
} from "./founder.js";

// APP STATE
let currentUser = null;
let userData = null;
let liveConfig = {};
let isSignupMode = false;
let activeRoom = "daily-proof";
let unsubUser = null;
let unsubProofs = null;
let unsubChat = null;
let unsubConfig = null;
let cachedBuilders = [];

const DEFAULT_ROOMS = [
  { id: "daily-proof", name: "#daily-proof", desc: "Share completed daily moves" },
  { id: "unstuck-sos", name: "#unstuck-sos", desc: "Get real human help on roadblocks" },
  { id: "skill-swap", name: "#skill-swap", desc: "Trade skills & collaborate" },
  { id: "lounge", name: "#open-lounge", desc: "Connect with builders worldwide" }
];

// TOAST HELPER
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

// VIEW & SUBTAB SWITCHING
function switchView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-btn[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });

  if (viewName === "network") loadBuildersDirectory();
  if (viewName === "chat") subscribeToRoom(activeRoom);
  if (viewName === "founder" && isFounderUser(currentUser)) {
    loadFounderTelemetry(liveConfig);
  }
}

function switchEngine(engineName) {
  document.querySelectorAll(".engine-panel").forEach((p) => p.classList.add("hidden"));
  const panel = document.getElementById(`engine-${engineName}`);
  if (panel) panel.classList.remove("hidden");

  document.querySelectorAll(".subtab[data-engine]").forEach((t) => {
    t.classList.toggle("active", t.dataset.engine === engineName);
  });
}

// AUTH UI TOGGLES
document.getElementById("tab-signin").addEventListener("click", () => {
  isSignupMode = false;
  document.getElementById("tab-signin").classList.add("active");
  document.getElementById("tab-signup").classList.remove("active");
  document.getElementById("signup-name-field").classList.add("hidden");
  document.getElementById("auth-submit-btn").textContent = "Enter Tavirah OS";
  document.getElementById("auth-error").classList.add("hidden");
});

document.getElementById("tab-signup").addEventListener("click", () => {
  isSignupMode = true;
  document.getElementById("tab-signup").classList.add("active");
  document.getElementById("tab-signin").classList.remove("active");
  document.getElementById("signup-name-field").classList.remove("hidden");
  document.getElementById("auth-submit-btn").textContent = "Create Builder Account";
  document.getElementById("auth-error").classList.add("hidden");
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim() || "Builder";
  const errEl = document.getElementById("auth-error");
  errEl.classList.add("hidden");

  try {
    if (isSignupMode) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    errEl.textContent = err.message.replace("Firebase:", "").trim();
    errEl.classList.remove("hidden");
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
});

// SYNC PUBLIC BUILDER DIRECTORY CARD (NO SENSITIVE DATA)
async function syncBuilderPublicCard(data) {
  if (!currentUser || !data) return;
  await setDoc(
    doc(db, "builders", currentUser.uid),
    {
      uid: currentUser.uid,
      displayName: data.displayName || currentUser.displayName || "Builder",
      visionTitle: data.visionTitle || "",
      primaryBarrier: data.primaryBarrier || "clarity",
      streak: Number(data.streak || 0),
      totalProofs: Number(data.totalProofs || 0),
      skillsOffer: data.skillsOffer || "",
      skillsNeed: data.skillsNeed || "",
      fearsDefeatedCount: (data.fearsConquered || []).length,
      experimentsCount: (data.experiments || []).length,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

// AUTH STATE LISTENER
onAuthStateChanged(auth, async (user) => {
  cleanupListeners();
  currentUser = user;

  if (!user) {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    return;
  }

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  const founder = isFounderUser(user);
  document.getElementById("nav-founder-btn").classList.toggle("hidden", !founder);
  document.getElementById("mobile-founder-btn").classList.toggle("hidden", !founder);

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const initialDoc = {
      uid: user.uid,
      displayName: user.displayName || user.email.split("@")[0],
      visionTitle: "",
      visionWhy: "",
      primaryBarrier: "clarity",
      streak: 0,
      totalProofs: 0,
      lastProofDate: "",
      todayMove: { text: "", completedToday: false, updatedDate: todayStr(0) },
      milestones: [],
      fearsConquered: [],
      skills: [],
      experiments: [],
      skillsOffer: "",
      skillsNeed: "",
      stressTest: null,
      createdAt: new Date().toISOString()
    };
    await setDoc(userRef, initialDoc);
    await syncBuilderPublicCard(initialDoc);
  }

  unsubUser = onSnapshot(userRef, (docSnap) => {
    if (!docSnap.exists()) return;
    userData = docSnap.data();
    renderAllUserViews();

    if (!userData.visionTitle) {
      document.getElementById("vision-modal").classList.remove("hidden");
    }
  });

  unsubProofs = onSnapshot(
    query(collection(db, "users", user.uid, "proofs"), orderBy("createdAt", "desc"), limit(50)),
    (snapList) => renderProofTimeline(snapList)
  );

  unsubConfig = onSnapshot(doc(db, "system_config", "live_updates"), (cfgSnap) => {
    liveConfig = cfgSnap.exists() ? cfgSnap.data() : {};
    renderLiveConfig();
  });

  renderRoomTabs();
  switchView("command");
});

function cleanupListeners() {
  if (unsubUser) unsubUser();
  if (unsubProofs) unsubProofs();
  if (unsubChat) unsubChat();
  if (unsubConfig) unsubConfig();
  unsubUser = unsubProofs = unsubChat = unsubConfig = null;
}

// RENDER USER STATE ACROSS VIEWS
function renderAllUserViews() {
  if (!userData) return;

  const name = userData.displayName || "Builder";
  document.getElementById("sidebar-user-tag").textContent = `${name} • ${userData.streak || 0}d streak`;

  // North Star
  document.getElementById("cmd-vision-title").textContent =
    userData.visionTitle || "Click 'Edit North Star' to lock your vision";
  document.getElementById("cmd-vision-why").textContent = userData.visionWhy || "";
  document.getElementById("cmd-barrier-badge").textContent =
    `Primary Block: ${BARRIER_LABELS[userData.primaryBarrier] || "—"}`;

  // Stats
  document.getElementById("stat-streak").textContent = `${userData.streak || 0} days`;
  document.getElementById("stat-proofs").textContent = userData.totalProofs || 0;
  const mastery = (userData.fearsConquered || []).length + (userData.experiments || []).length;
  document.getElementById("stat-mastery").textContent = mastery;

  // Today's Move
  const isToday = userData.todayMove?.updatedDate === todayStr(0);
  const completedToday = isToday && Boolean(userData.todayMove?.completedToday);
  const moveInput = document.getElementById("today-move-input");
  if (document.activeElement !== moveInput) {
    moveInput.value = userData.todayMove?.text || "";
  }

  const badge = document.getElementById("today-status-badge");
  badge.textContent = completedToday ? "Completed Today" : "Pending";
  badge.className = completedToday ? "badge badge-green" : "badge badge-accent";

  // Milestones Preview + Engine 2
  renderMilestones();
  renderStressTestSaved();
  renderFearBreaks();
  renderSkills();
  renderExperiments();

  // Engine 6 Prompt Synthesizer
  document.getElementById("ai-synth-prompt").value = buildSynthesizedPrompt(userData);
}

// VISION MODAL
document.getElementById("edit-vision-btn").addEventListener("click", () => {
  document.getElementById("v-title").value = userData?.visionTitle || "";
  document.getElementById("v-why").value = userData?.visionWhy || "";
  document.getElementById("v-barrier").value = userData?.primaryBarrier || "clarity";
  document.getElementById("vision-modal").classList.remove("hidden");
});

document.getElementById("close-vision-modal").addEventListener("click", () => {
  document.getElementById("vision-modal").classList.add("hidden");
});

document.getElementById("vision-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const updates = {
    visionTitle: document.getElementById("v-title").value.trim(),
    visionWhy: document.getElementById("v-why").value.trim(),
    primaryBarrier: document.getElementById("v-barrier").value
  };
  await updateDoc(doc(db, "users", currentUser.uid), updates);
  await syncBuilderPublicCard({ ...userData, ...updates });
  document.getElementById("vision-modal").classList.add("hidden");
  showToast("North Star Vision locked.");
});

// TODAY'S MOVE & PROOF LOGGING
document.getElementById("save-today-move-btn").addEventListener("click", async () => {
  const text = document.getElementById("today-move-input").value.trim();
  if (!text) return showToast("Write your single move for today first.");
  await updateDoc(doc(db, "users", currentUser.uid), {
    todayMove: {
      text,
      completedToday: userData.todayMove?.updatedDate === todayStr(0) ? Boolean(userData.todayMove?.completedToday) : false,
      updatedDate: todayStr(0)
    }
  });
  showToast("Today's Unbreakable Move locked.");
});

async function submitDailyProof(shareToRoom) {
  const moveText = document.getElementById("today-move-input").value.trim();
  const proofNote = document.getElementById("proof-note-input").value.trim();
  if (!proofNote) return showToast("Write 1 concrete sentence of proof before logging.");

  const today = todayStr(0);
  const yesterday = todayStr(-1);
  let newStreak = userData.streak || 0;

  if (userData.lastProofDate === today) {
    newStreak = Math.max(1, newStreak);
  } else if (userData.lastProofDate === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const newTotal = (userData.totalProofs || 0) + 1;

  await addDoc(collection(db, "users", currentUser.uid, "proofs"), {
    move: moveText || "Daily Reality Execution",
    note: proofNote,
    date: today,
    createdAt: serverTimestamp()
  });

  const updates = {
    streak: newStreak,
    totalProofs: newTotal,
    lastProofDate: today,
    todayMove: {
      text: moveText,
      completedToday: true,
      updatedDate: today
    }
  };
  await updateDoc(doc(db, "users", currentUser.uid), updates);
  await syncBuilderPublicCard({ ...userData, ...updates });

  if (shareToRoom) {
    await addDoc(collection(db, "rooms", "daily-proof", "messages"), {
      uid: currentUser.uid,
      authorName: userData.displayName || "Builder",
      authorVision: userData.visionTitle || "Building",
      authorStreak: newStreak,
      type: "proof",
      text: `Brick #${newTotal} (${newStreak}d streak): ${proofNote}`,
      createdAt: serverTimestamp()
    });
  }

  document.getElementById("proof-note-input").value = "";
  showToast(shareToRoom ? "Proof logged & shared to #daily-proof!" : "Reality Proof logged!");
}

document.getElementById("complete-proof-btn").addEventListener("click", () => submitDailyProof(false));
document.getElementById("complete-share-btn").addEventListener("click", () => submitDailyProof(true));

function renderProofTimeline(snapList) {
  const el = document.getElementById("proof-timeline-list");
  if (snapList.empty) {
    el.textContent = "Complete your first Daily Move to lay Brick #1.";
    return;
  }
  el.innerHTML = snapList.docs
    .map((d) => {
      const p = d.data();
      return `
        <div class="item-row">
          <div>
            <span class="badge badge-green mono">${esc(p.date || "")}</span>
            <strong style="display:block; margin-top:6px;">${esc(p.move)}</strong>
            <p class="small muted" style="margin-top:3px;">${esc(p.note)}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

// ENGINE 1: STRESS-TESTER
document.getElementById("run-stresstest-btn").addEventListener("click", async () => {
  const inputs = {
    capital: document.getElementById("st-capital").value,
    hours: document.getElementById("st-hours").value,
    stage: document.getElementById("st-stage").value,
    fear: document.getElementById("st-fear").value
  };
  const result = runStressDiagnostic(userData, inputs);
  await updateDoc(doc(db, "users", currentUser.uid), { stressTest: result });
  showToast("Reality Diagnostic saved to your workspace.");
});

function renderStressTestSaved() {
  const st = userData?.stressTest;
  const el = document.getElementById("st-results");
  if (!st) return;

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span class="badge badge-accent">READINESS INDEX: ${st.score}/100</span>
    </div>
    <h4 style="color:var(--text); margin-bottom:6px;">Single Point of Failure: ${esc(st.bottleneck)}</h4>
    <p class="small muted" style="margin-bottom:14px;">${esc(st.diagnosis)}</p>
    <strong class="small" style="display:block; margin-bottom:6px;">Your Minimum Viable Execution Path:</strong>
    ${(st.mvpPath || [])
      .map((s, idx) => `<div class="item-row small"><span><strong>${idx + 1}.</strong> ${esc(s)}</span></div>`)
      .join("")}
    <button id="apply-step1-btn" class="btn btn-secondary btn-sm" style="margin-top:8px;">Lock Step 1 as Today's Move</button>
  `;

  document.getElementById("apply-step1-btn")?.addEventListener("click", async () => {
    const step1 = st.mvpPath?.[0];
    if (!step1) return;
    await updateDoc(doc(db, "users", currentUser.uid), {
      todayMove: { text: step1, completedToday: false, updatedDate: todayStr(0) }
    });
    showToast("Step 1 locked into your Daily Command Center!");
  });
}

// ENGINE 2: MILESTONES (REVERSE-TIMELINE)
document.getElementById("add-milestone-btn").addEventListener("click", async () => {
  const title = document.getElementById("ms-title").value.trim();
  const targetDays = Number(document.getElementById("ms-days").value);
  if (!title) return showToast("Enter a concrete milestone deliverable.");

  const list = [...(userData.milestones || []), { id: "ms_" + Date.now(), title, targetDays, done: false }];
  await updateDoc(doc(db, "users", currentUser.uid), { milestones: list });
  document.getElementById("ms-title").value = "";
  showToast("Milestone added.");
});

function renderMilestones() {
  const list = userData?.milestones || [];
  const doneCount = list.filter((m) => m.done).length;
  const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;

  document.getElementById("ms-percent").textContent = `${pct}%`;
  document.getElementById("ms-progress-fill").style.width = `${pct}%`;

  const previewEl = document.getElementById("cmd-milestones-preview");
  const open = list.filter((m) => !m.done).slice(0, 3);
  previewEl.innerHTML = open.length
    ? open.map((m) => `<div style="margin-bottom:4px;">• ${esc(m.title)} <span class="mono">(${m.targetDays}d)</span></div>`).join("")
    : "No active milestones yet.";

  const listEl = document.getElementById("milestones-list");
  if (!list.length) {
    listEl.textContent = "No milestones yet.";
    return;
  }

  listEl.innerHTML = list
    .map(
      (m) => `
      <div class="item-row">
        <div>
          <span class="badge mono">${m.targetDays}d sprint</span>
          <div style="margin-top:5px; text-decoration:${m.done ? "line-through" : "none"}; color:${m.done ? "var(--muted)" : "var(--text)"};">
            ${esc(m.title)}
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary btn-sm ms-toggle" data-id="${m.id}">${m.done ? "Undo" : "Done"}</button>
          <button class="btn btn-danger btn-sm ms-del" data-id="${m.id}">×</button>
        </div>
      </div>
    `
    )
    .join("");

  listEl.querySelectorAll(".ms-toggle").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const updated = list.map((m) => (m.id === btn.dataset.id ? { ...m, done: !m.done } : m));
      await updateDoc(doc(db, "users", currentUser.uid), { milestones: updated });
    })
  );

  listEl.querySelectorAll(".ms-del").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const updated = list.filter((m) => m.id !== btn.dataset.id);
      await updateDoc(doc(db, "users", currentUser.uid), { milestones: updated });
    })
  );
}

// ENGINE 3: FEAR & FRICTION LAB
document.getElementById("save-fearbreak-btn").addEventListener("click", async () => {
  const protocol = document.getElementById("fb-protocol").value;
  const fear = document.getElementById("fb-fear").value.trim();
  const worstCase = document.getElementById("fb-worst").value.trim();
  const microStep = document.getElementById("fb-micro").value.trim();
  if (!fear || !microStep) return showToast("Fill in the action you're avoiding and your 5-min step.");

  const updated = [
    { id: "fb_" + Date.now(), protocol, fear, worstCase, microStep, conqueredAt: todayStr(0) },
    ...(userData.fearsConquered || [])
  ];
  await updateDoc(doc(db, "users", currentUser.uid), { fearsConquered: updated });
  await syncBuilderPublicCard({ ...userData, fearsConquered: updated });

  document.getElementById("fb-fear").value = "";
  document.getElementById("fb-worst").value = "";
  document.getElementById("fb-micro").value = "";
  showToast("Block dismantled! Execute your 5-minute step right now.");
});

function renderFearBreaks() {
  const list = userData?.fearsConquered || [];
  const el = document.getElementById("fearbreak-list");
  if (!list.length) {
    el.textContent = "No barriers logged yet.";
    return;
  }
  el.innerHTML = list
    .map(
      (f) => `
      <div class="item-row">
        <div>
          <span class="badge badge-accent">${esc(f.protocol)}</span>
          <strong style="display:block; margin-top:5px;">Avoided: ${esc(f.fear)}</strong>
          <div class="small muted">5-Min Action: ${esc(f.microStep)}</div>
        </div>
      </div>
    `
    )
    .join("");
}

// ENGINE 4: SKILL-GAP MAPPER
document.getElementById("add-skill-btn").addEventListener("click", async () => {
  const name = document.getElementById("sk-name").value.trim();
  const level = document.getElementById("sk-status").value;
  if (!name) return showToast("Enter a skill name.");

  const updated = [...(userData.skills || []), { id: "sk_" + Date.now(), name, level }];
  await updateDoc(doc(db, "users", currentUser.uid), { skills: updated });
  document.getElementById("sk-name").value = "";
  showToast("Skill mapped.");
});

document.getElementById("save-swap-profile-btn").addEventListener("click", async () => {
  const skillsOffer = document.getElementById("profile-offer").value.trim();
  const skillsNeed = document.getElementById("profile-need").value.trim();
  await updateDoc(doc(db, "users", currentUser.uid), { skillsOffer, skillsNeed });
  await syncBuilderPublicCard({ ...userData, skillsOffer, skillsNeed });
  showToast("Builder Network skill-swap card updated.");
});

function renderSkills() {
  if (document.activeElement !== document.getElementById("profile-offer")) {
    document.getElementById("profile-offer").value = userData?.skillsOffer || "";
  }
  if (document.activeElement !== document.getElementById("profile-need")) {
    document.getElementById("profile-need").value = userData?.skillsNeed || "";
  }

  const list = userData?.skills || [];
  const el = document.getElementById("skills-list");
  if (!list.length) {
    el.textContent = "No skills mapped yet.";
    return;
  }
  const labels = {
    learning: ["Learning 20%", "badge-accent"],
    mastered: ["Can Offer", "badge-green"],
    swap: ["Seeking Swap", "badge-blue"]
  };
  el.innerHTML = list
    .map((s) => {
      const [txt, cls] = labels[s.level] || ["Mapped", "badge"];
      return `
        <div class="item-row">
          <div><strong>${esc(s.name)}</strong> <span class="badge ${cls}" style="margin-left:6px;">${txt}</span></div>
          <button class="btn btn-danger btn-sm sk-del" data-id="${s.id}">×</button>
        </div>
      `;
    })
    .join("");

  el.querySelectorAll(".sk-del").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const updated = list.filter((s) => s.id !== btn.dataset.id);
      await updateDoc(doc(db, "users", currentUser.uid), { skills: updated });
    })
  );
}

// ENGINE 5: REAL-WORLD EXPERIMENT LAB
document.getElementById("add-exp-btn").addEventListener("click", async () => {
  const hypothesis = document.getElementById("exp-hyp").value.trim();
  const deadline = document.getElementById("exp-deadline").value || todayStr(3);
  if (!hypothesis) return showToast("Write a clear hypothesis to test.");

  const updated = [
    { id: "exp_" + Date.now(), hypothesis, deadline, status: "running", lesson: "" },
    ...(userData.experiments || [])
  ];
  await updateDoc(doc(db, "users", currentUser.uid), { experiments: updated });
  await syncBuilderPublicCard({ ...userData, experiments: updated });
  document.getElementById("exp-hyp").value = "";
  showToast("Experiment launched.");
});

function renderExperiments() {
  const list = userData?.experiments || [];
  const el = document.getElementById("experiments-list");
  if (!list.length) {
    el.textContent = "No experiments launched yet.";
    return;
  }
  el.innerHTML = list
    .map(
      (ex) => `
      <div class="item-row" style="flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="badge ${ex.status === "validated" ? "badge-green" : ex.status === "pivoted" ? "badge-blue" : "badge-accent"}">${esc(ex.status.toUpperCase())}</span>
          <span class="small mono muted">Due: ${esc(ex.deadline)}</span>
        </div>
        <div style="font-weight:500;">${esc(ex.hypothesis)}</div>
        ${ex.lesson ? `<div class="small muted">Lesson: ${esc(ex.lesson)}</div>` : ""}
        ${
          ex.status === "running"
            ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">
                <input type="text" class="exp-lesson-input" data-id="${ex.id}" placeholder="Real-world result / lesson..." style="flex:1; min-width:180px; padding:7px 10px;" />
                <button class="btn btn-primary btn-sm exp-finish" data-id="${ex.id}" data-status="validated">Validated</button>
                <button class="btn btn-secondary btn-sm exp-finish" data-id="${ex.id}" data-status="pivoted">Pivoted</button>
               </div>`
            : ""
        }
      </div>
    `
    )
    .join("");

  el.querySelectorAll(".exp-finish").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status;
      const input = el.querySelector(`.exp-lesson-input[data-id="${id}"]`);
      const lesson = input?.value.trim() || "Completed real-world test.";
      const updated = list.map((ex) => (ex.id === id ? { ...ex, status, lesson } : ex));
      await updateDoc(doc(db, "users", currentUser.uid), { experiments: updated });
      showToast(`Experiment marked ${status}.`);
    })
  );
}

// ENGINE 6: COPY AI PROMPT
document.getElementById("copy-synth-btn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("ai-synth-prompt").value);
  showToast("Personalized AI Co-Founder prompt copied!");
});

// LIVE SYSTEM CONFIG (FOUNDER PUSHES)
function renderLiveConfig() {
  const ann = liveConfig?.announcement;
  const banner = document.getElementById("live-announcement");
  if (ann && ann.active && ann.title) {
    document.getElementById("ann-title").textContent = ann.title;
    document.getElementById("ann-body").textContent = ann.body || "";
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  const protos = liveConfig?.founderProtocols || [];
  const protEl = document.getElementById("live-protocols-list");
  if (!protos.length) {
    protEl.textContent = "No custom protocols pushed yet—check back soon!";
  } else {
    protEl.innerHTML = [...protos]
      .reverse()
      .map(
        (p) => `
        <div class="item-row" style="flex-direction:column;">
          <span class="badge badge-accent">LIVE PROTOCOL</span>
          <strong style="margin-top:6px;">${esc(p.title)}</strong>
          <p class="small muted" style="white-space:pre-line; margin-top:4px;">${esc(p.steps)}</p>
        </div>
      `
      )
      .join("");
  }
}

document.getElementById("dismiss-ann-btn").addEventListener("click", () => {
  document.getElementById("live-announcement").classList.add("hidden");
});

// BUILDER NETWORK DIRECTORY
async function loadBuildersDirectory() {
  const snap = await getDocs(query(collection(db, "builders"), limit(80)));
  cachedBuilders = [];
  snap.forEach((d) => cachedBuilders.push(d.data()));
  renderBuildersList(cachedBuilders);
}

function renderBuildersList(list) {
  const grid = document.getElementById("builders-grid");
  if (!list.length) {
    grid.innerHTML = `<div class="card small muted">No builders match that search yet.</div>`;
    return;
  }
  grid.innerHTML = list
    .sort((a, b) => (b.totalProofs || 0) - (a.totalProofs || 0))
    .map(
      (b) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong>${esc(b.displayName || "Builder")}</strong>
          <span class="badge badge-green">${Number(b.totalProofs || 0)} proofs • ${Number(b.streak || 0)}d</span>
        </div>
        <div style="margin-top:8px; font-weight:600;">${esc(b.visionTitle || "Defining vision...")}</div>
        <div class="small muted" style="margin-top:4px;">Facing: ${esc(BARRIER_LABELS[b.primaryBarrier] || "—")}</div>
        ${b.skillsOffer ? `<div class="small" style="margin-top:8px;"><span class="badge badge-blue">Can Offer</span> ${esc(b.skillsOffer)}</div>` : ""}
        ${b.skillsNeed ? `<div class="small" style="margin-top:6px;"><span class="badge badge-accent">Looking For</span> ${esc(b.skillsNeed)}</div>` : ""}
      </div>
    `
    )
    .join("");
}

document.getElementById("network-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = cachedBuilders.filter((b) =>
    `${b.displayName} ${b.visionTitle} ${b.skillsOffer} ${b.skillsNeed} ${BARRIER_LABELS[b.primaryBarrier] || ""}`
      .toLowerCase()
      .includes(q)
  );
  renderBuildersList(filtered);
});

// REAL-TIME MULTI-ROOM CHAT
function renderRoomTabs() {
  const el = document.getElementById("chat-rooms-list");
  el.innerHTML = DEFAULT_ROOMS.map(
    (r) => `
    <button class="room-btn ${r.id === activeRoom ? "active" : ""}" data-room="${r.id}">
      <strong>${esc(r.name)}</strong>
      <div class="small muted" style="font-size:0.74rem;">${esc(r.desc)}</div>
    </button>
  `
  ).join("");

  el.querySelectorAll(".room-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeRoom = btn.dataset.room;
      renderRoomTabs();
      subscribeToRoom(activeRoom);
    })
  );
}

function subscribeToRoom(roomId) {
  if (unsubChat) unsubChat();
  const meta = DEFAULT_ROOMS.find((r) => r.id === roomId) || DEFAULT_ROOMS[0];
  document.getElementById("active-room-title").textContent = meta.name;
  document.getElementById("active-room-desc").textContent = meta.desc;

  const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"), limit(80));
  unsubChat = onSnapshot(q, (snap) => {
    const box = document.getElementById("chat-messages");
    if (snap.empty) {
      box.innerHTML = `<div class="small muted">No messages in ${esc(meta.name)} yet. Start the momentum!</div>`;
      return;
    }

    const founder = isFounderUser(currentUser);
    box.innerHTML = snap.docs
      .map((d) => {
        const m = d.data();
        const mine = m.uid === currentUser.uid;
        const typeClass = m.type === "proof" ? "proof-msg" : m.type === "sos" ? "sos-msg" : "";
        return `
          <div class="msg ${mine ? "mine" : ""} ${typeClass}">
            <div class="msg-meta">
              <strong>${esc(m.authorName || "Builder")}</strong>
              <span class="badge">${esc(m.authorVision || "Building")}</span>
              <span class="mono muted">${Number(m.authorStreak || 0)}d</span>
              ${(mine || founder) ? `<button class="btn btn-danger btn-sm msg-del" data-id="${d.id}" style="padding:2px 7px; font-size:0.7rem;">Del</button>` : ""}
            </div>
            <div class="small">${esc(m.text)}</div>
          </div>
        `;
      })
      .join("");

    box.querySelectorAll(".msg-del").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await deleteDoc(doc(db, "rooms", roomId, "messages", btn.dataset.id));
      })
    );

    box.scrollTop = box.scrollHeight;
  });
}

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  await addDoc(collection(db, "rooms", activeRoom, "messages"), {
    uid: currentUser.uid,
    authorName: userData?.displayName || "Builder",
    authorVision: userData?.visionTitle || "Building",
    authorStreak: userData?.streak || 0,
    type: "chat",
    text,
    createdAt: serverTimestamp()
  });
});

// TACTICAL UNBLOCK SOS MODAL
const openUnblock = () => document.getElementById("unblock-modal").classList.remove("hidden");
document.getElementById("open-unblock-btn").addEventListener("click", openUnblock);
document.getElementById("mobile-unblock-btn").addEventListener("click", openUnblock);
document.getElementById("close-unblock-btn").addEventListener("click", () => {
  document.getElementById("unblock-modal").classList.add("hidden");
});

document.querySelectorAll(".unblock-choice").forEach((btn) => {
  btn.addEventListener("click", () => {
    const advice = UNBLOCK_ADVICE[btn.dataset.block] || "";
    document.getElementById("unblock-advice-text").textContent = advice;
    document.getElementById("unblock-advice-box").classList.remove("hidden");
  });
});

document.getElementById("send-sos-btn").addEventListener("click", async () => {
  const input = document.getElementById("sos-room-text");
  const text = input.value.trim();
  if (!text) return showToast("Describe your blocker in 1 sentence first.");

  await addDoc(collection(db, "rooms", "unstuck-sos", "messages"), {
    uid: currentUser.uid,
    authorName: userData?.displayName || "Builder",
    authorVision: userData?.visionTitle || "Building",
    authorStreak: userData?.streak || 0,
    type: "sos",
    text: `SOS BLOCKER: ${text}`,
    createdAt: serverTimestamp()
  });

  input.value = "";
  document.getElementById("unblock-modal").classList.add("hidden");
  activeRoom = "unstuck-sos";
  renderRoomTabs();
  switchView("chat");
  showToast("Ping sent to #unstuck-sos!");
});

// FOUNDER COCKPIT EVENTS
document.getElementById("refresh-founder-btn").addEventListener("click", () => loadFounderTelemetry(liveConfig));

document.getElementById("f-push-ann-btn").addEventListener("click", async () => {
  const title = document.getElementById("f-ann-title").value.trim();
  const body = document.getElementById("f-ann-body").value.trim();
  if (!title) return showToast("Enter an announcement title.");
  await pushFounderAnnouncement(title, body);
  showToast("Announcement pushed LIVE to all Tavirah builders!");
});

document.getElementById("f-push-proto-btn").addEventListener("click", async () => {
  const title = document.getElementById("f-proto-title").value.trim();
  const steps = document.getElementById("f-proto-steps").value.trim();
  if (!title || !steps) return showToast("Enter both protocol title and steps.");
  await pushFounderProtocol(title, steps);
  document.getElementById("f-proto-title").value = "";
  document.getElementById("f-proto-steps").value = "";
  showToast("New Protocol pushed LIVE to Engine #6!");
});

document.getElementById("f-copy-brief-btn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("f-ai-brief").value);
  showToast("Live Founder Brief copied—paste it to your AI partner!");
});

// NAVIGATION & SUBTAB DELEGATION
document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.querySelectorAll(".subtab[data-engine]").forEach((btn) => {
  btn.addEventListener("click", () => switchEngine(btn.dataset.engine));
});

document.querySelectorAll("[data-jump-engine]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView("engines");
    switchEngine(btn.dataset.jumpEngine);
  });
});
