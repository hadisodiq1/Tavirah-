import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  sendPasswordResetEmail,
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
  writeBatch,
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
  shortVision,
  todayStr,
  daysBetween,
  BARRIER_LABELS,
  classifyVisionArchetype,
  generateStarterSetup,
  runGroundCheck,
  getSunbeamContext,
  synthesizeSunbeamAction,
  computeAdaptiveUpdate,
  analyzeForestPulse,
  computeTreeState,
  renderLivingTreeSVG,
  computeMyceliumMatches
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
let lastSunbeamOutput = null;
let pendingSuggestedStep = "";
let isSubmittingProof = false;
// ONBOARDING STATE
const onbWeather = { capital: "zero", hours: "low", stage: "idea" };
let onbBarrier = "clarity";
// DRIFT-FREE TIMESTAMP FOCUS TIMER STATE
let focusDurationSecs = 25 * 60;
let focusRemainingSecs = 25 * 60;
let focusEndTimeMs = null;
let focusInterval = null;
const FOREST_CIRCLES = [
  { id: "daily-proof", name: "#todays-proof", desc: "Share real outcomes from today" },
  { id: "unstuck-sos", name: "#in-the-shade", desc: "Ask The Forest when blocked" },
  { id: "skill-swap", name: "#strength-swap", desc: "Trade skills & collaborate" },
  { id: "lounge", name: "#around-the-fire", desc: "Open conversation & warmth" }
];
// SAFE ERROR WRAPPER & TOAST
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3800);
}
async function safeAction(fn, errorPrefix = "Something went wrong") {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    showToast(`${errorPrefix}: ${err?.message || "Please try again."}`);
    return null;
  }
}
// STRICT VIEW ROUTER (GUARDS FOUNDER VIEW)
function switchView(viewName) {
  if (viewName === "founder" && !isFounderUser(currentUser)) {
    showToast("Access restricted.");
    return;
  }
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-btn[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });
  if (viewName === "forest") loadBuildersDirectory();
  if (viewName === "founder" && isFounderUser(currentUser)) {
    loadFounderTelemetry(liveConfig);
  }
}
// AUTH: GOOGLE + EMAIL + FORGOT PASSWORD
document.getElementById("google-signin-btn").addEventListener("click", async () => {
  const errEl = document.getElementById("auth-error");
  errEl.classList.add("hidden");
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    let msg = err.message.replace("Firebase:", "").trim();
    if (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request") {
      msg = "Popup blocked. Allow popups or sign in with Email below.";
    } else if (err.code === "auth/disallowed_useragent") {
      msg = "TikTok's built-in browser blocks Google sign-in. Open in Chrome/Safari or use Email below.";
    }
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }
});
document.getElementById("tab-signin").addEventListener("click", () => {
  isSignupMode = false;
  document.getElementById("tab-signin").classList.add("active");
  document.getElementById("tab-signup").classList.remove("active");
  document.getElementById("signup-name-field").classList.add("hidden");
  document.getElementById("auth-submit-btn").textContent = "Enter Tavirah";
  document.getElementById("auth-error").classList.add("hidden");
});
document.getElementById("tab-signup").addEventListener("click", () => {
  isSignupMode = true;
  document.getElementById("tab-signup").classList.add("active");
  document.getElementById("tab-signin").classList.remove("active");
  document.getElementById("signup-name-field").classList.remove("hidden");
  document.getElementById("auth-submit-btn").textContent = "Create Account";
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
document.getElementById("forgot-pw-btn").addEventListener("click", () => {
  const emailTyped = document.getElementById("auth-email").value.trim();
  if (emailTyped) document.getElementById("reset-email").value = emailTyped;
  document.getElementById("reset-panel").classList.remove("hidden");
});
document.getElementById("cancel-reset-btn").addEventListener("click", () => {
  document.getElementById("reset-panel").classList.add("hidden");
});
document.getElementById("send-reset-btn").addEventListener("click", async () => {
  const email = document.getElementById("reset-email").value.trim();
  if (!email) return showToast("Enter your account email first.");
  await safeAction(async () => {
    await sendPasswordResetEmail(auth, email);
    document.getElementById("reset-panel").classList.add("hidden");
    showToast("Recovery link sent! Check your inbox or spam folder.");
  }, "Could not send recovery email");
});
document.getElementById("logout-btn").addEventListener("click", () => safeAction(() => signOut(auth), "Sign out failed"));
// ONBOARDING 3-STEP FLOW
function setOnboardingStep(stepNum) {
  [1, 2, 3].forEach((n) => {
    document.getElementById(`onb-step-${n}`).classList.toggle("hidden", n !== stepNum);
    document.querySelector(`.breath-dot[data-dot="${n}"]`).classList.toggle("active", n <=stepNum);
  });
}
document.getElementById("onb-next-1").addEventListener("click", () => {
  const t = document.getElementById("onb-title").value.trim();
  const w = document.getElementById("onb-why").value.trim();
  if (!t || !w) return showToast("Enter your goal headline and why it matters.");
  setOnboardingStep(2);
});
document.getElementById("onb-back-2").addEventListener("click", () => setOnboardingStep(1));
document.getElementById("onb-next-2").addEventListener("click", () => setOnboardingStep(3));
document.getElementById("onb-back-3").addEventListener("click", () => setOnboardingStep(2));
document.querySelectorAll(".pill-choice").forEach((btn) => {
  btn.addEventListener("click", () => {
    const grp = btn.dataset.group;
    onbWeather[grp] = btn.dataset.val;
    document.querySelectorAll(`.pill-choice[data-group="${grp}"]`).forEach((b) => {
      b.classList.toggle("selected", b === btn);
    });
  });
});
document.querySelectorAll(".barrier-card[data-barrier]").forEach((btn) => {
  btn.addEventListener("click", () => {
    onbBarrier = btn.dataset.barrier;
    document.querySelectorAll(".barrier-card[data-barrier]").forEach((b) => {
      b.classList.toggle("selected", b === btn);
    });
  });
});
document.getElementById("onb-finish-btn").addEventListener("click", async () => {
  const visionTitle = document.getElementById("onb-title").value.trim();
  const visionWhy = document.getElementById("onb-why").value.trim();
  const publicProfile = document.getElementById("onb-public-optin").checked;
  const starter = generateStarterSetup(visionTitle, visionWhy, onbWeather, onbBarrier);
  const fearMap = { fear: "perfectionism", identity: "judgment", capital: "resources", clarity: "clarity", isolation: "clarity" };
  const groundReading = runGroundCheck({ visionTitle, visionWhy }, { ...onbWeather, fear: fearMap[onbBarrier] || "clarity" });
  const updates = {
    visionTitle,
    visionWhy,
    primaryBarrier: onbBarrier,
    publicProfile,
    weather: { ...onbWeather },
    stressTest: groundReading,
    todayMove: { text: starter.todayMoveText, completedToday: false, updatedDate: todayStr(0) },
    milestones: starter.milestones
  };
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    await syncBuilderVisibility({ ...userData, ...updates });
    document.getElementById("onboarding-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    showToast("Goal set! Here is your most useful step today.");
  }, "Could not save onboarding");
});
// STRICT OPT-IN PUBLIC DIRECTORY SYNC (DELETES PUBLIC DOC IF OPTED OUT)
async function syncBuilderVisibility(data) {
  if (!currentUser || !data) return;
  const builderRef = doc(db, "builders", currentUser.uid);
  if (!data.publicProfile) {
    await deleteDoc(builderRef).catch(() => {});
    return;
  }
  await setDoc(
    builderRef,
    {
      uid: currentUser.uid,
      displayName: data.displayName || currentUser.displayName || "Builder",
      visionTitle: shortVision(data.visionTitle || "", 70),
      primaryBarrier: data.primaryBarrier || "clarity",
      streak: Number(data.streak || 0),
      totalProofs: Number(data.totalProofs || 0),
      skillsOffer: data.skillsOffer || "",
      skillsNeed: data.skillsNeed || "",
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
    document.getElementById("onboarding-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    return;
  }
  document.getElementById("auth-screen").classList.add("hidden");
  const founder = isFounderUser(user);
  document.getElementById("nav-founder-btn").classList.toggle("hidden", !founder);
  document.getElementById("mobile-founder-btn").classList.toggle("hidden", !founder);
  const userRef = doc(db, "users", user.uid);
  const snap = await safeAction(() => getDoc(userRef), "Failed to load profile");
  if (!snap) return;
  if (!snap.exists()) {
    const initialDoc = {
      uid: user.uid,
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "Builder"),
      visionTitle: "",
      visionWhy: "",
      primaryBarrier: "clarity",
      publicProfile: false,
      mutedUids: [],
      weather: { capital: "zero", hours: "low", stage: "idea" },
      streak: 0,
      totalProofs: 0,
      lastProofDate: "",
      lastOutcome: "",
      todayMove: { text: "", completedToday: false, updatedDate: todayStr(0) },
      milestones: [],
      fearsConquered: [],
      experiments: [],
      skillsOffer: "",
      skillsNeed: "",
      stressTest: null,
      createdAt: new Date().toISOString()
    };
    await safeAction(() => setDoc(userRef, initialDoc), "Could not initialize account");
  }
  unsubUser = onSnapshot(userRef, (docSnap) => {
    if (!docSnap.exists()) return;
    userData = docSnap.data();
    if (!userData.visionTitle) {
      document.getElementById("app-shell").classList.add("hidden");
      document.getElementById("onboarding-screen").classList.remove("hidden");
      setOnboardingStep(1);
      return;
    }
    document.getElementById("onboarding-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    renderAllViews();
  });
  unsubProofs = onSnapshot(
    query(collection(db, "users", user.uid, "proofs"), orderBy("createdAt", "desc"), limit(50)),
    (snapList) => renderGrowthRings(snapList)
  );
  unsubConfig = onSnapshot(doc(db, "system_config", "live_updates"), (cfgSnap) => {
    liveConfig = cfgSnap.exists() ? cfgSnap.data() : {};
    renderLiveConfig();
  });
  renderRoomTabs();
  switchView("today");
});
function cleanupListeners() {
  if (unsubUser) unsubUser();
  if (unsubProofs) unsubProofs();
  if (unsubChat) unsubChat();
  if (unsubConfig) unsubConfig();
  unsubUser = unsubProofs = unsubChat = unsubConfig = null;
}
// RENDER ALL VIEWS
function renderAllViews() {
  if (!userData) return;
  const name = userData.displayName || "Builder";
  const tree = computeTreeState(userData);
  const arch = classifyVisionArchetype(userData.visionTitle, userData.visionWhy);
  document.getElementById("sidebar-user-tag").textContent = `${name} • ${tree.stage.emoji} ${tree.roots} roots`;
  document.getElementById("today-greeting").textContent = `Welcome back, ${name}.`;
  document.getElementById("today-stage-pill").textContent = `${tree.stage.emoji} ${tree.stage.name} • ${userData.streak || 0}d streak`;
  const completedToday = userData.todayMove?.updatedDate === todayStr(0) && Boolean(userData.todayMove?.completedToday);
  const rootsCirc = 477.5;
  const todayCirc = 351.8;
  document.getElementById("ring-roots-circle").style.strokeDashoffset = rootsCirc - (rootsCirc *
tree.rootDepthPct) / 100;
  document.getElementById("ring-today-circle").style.strokeDashoffset = completedToday ? 0 : todayCirc * 0.85;
  document.getElementById("ring-stage-emoji").textContent = tree.stage.emoji;
  document.getElementById("ring-roots-pct").textContent = `${tree.rootDepthPct}% Roots`;
  document.getElementById("today-ring-label").textContent = completedToday ? "Logged Today ✓" : "Open Today";
  document.getElementById("today-vision-label").textContent = shortVision(userData.visionTitle, 42);
  document.getElementById("today-archetype-pill").textContent = arch.label;
  document.getElementById("today-step-display").textContent =
    userData.todayMove?.text || "Open Sunbeam Clarity or edit your step for today.";
  if (document.activeElement !== document.getElementById("today-move-input")) {
    document.getElementById("today-move-input").value = userData.todayMove?.text || "";
  }
  // Next Milestone with real due date label
  const openStone = (userData.milestones || []).find((m) => !m.done);
  if (openStone) {
    const dueLabel = formatDueDateLabel(openStone.dueDate, openStone.targetDays);
    document.getElementById("next-stone-label").textContent = `${openStone.title} (${dueLabel})`;
  } else {
    document.getElementById("next-stone-label").textContent = "All current milestones completed.";
  }
  renderForestPulse();
  // Space 2: Living Tree (Honest counts)
  document.getElementById("living-tree-svg").innerHTML = renderLivingTreeSVG(tree);
  document.getElementById("tree-stage-title").textContent = `Stage: ${tree.stage.name}`;
  document.getElementById("tree-stage-subtitle").textContent = tree.stage.subtitle;
  document.getElementById("tree-roots-count").textContent = tree.roots;
  document.getElementById("tree-trunk-count").textContent = tree.trunk;
  document.getElementById("tree-canopy-count").textContent = tree.leaves;
  renderTestsList();
  renderFearsList();
  renderMilestones();
  // Forest Opt-In Checkbox & Skill inputs
  document.getElementById("forest-public-toggle").checked = Boolean(userData.publicProfile);
  if (document.activeElement !== document.getElementById("profile-offer")) {
    document.getElementById("profile-offer").value = userData.skillsOffer || "";
  }
  if (document.activeElement !== document.getElementById("profile-need")) {
    document.getElementById("profile-need").value = userData.skillsNeed || "";
  }
}
function formatDueDateLabel(dueDate, legacyDays) {
  if (!dueDate) return legacyDays ? `${legacyDays}d target` : "No date";
  const diff = daysBetween(todayStr(0), dueDate);
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  return `Due in ${diff}d`;
}
// FOREST PULSE
function renderForestPulse() {
  const pulse = analyzeForestPulse(userData);
  const card = document.getElementById("forest-pulse-card");
  if (!pulse) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  document.getElementById("pulse-badge").textContent = pulse.badge;
  document.getElementById("pulse-title").textContent = pulse.title;
  document.getElementById("pulse-message").textContent = pulse.message;
  const btn = document.getElementById("pulse-action-btn");
  btn.textContent = pulse.cta;
  btn.onclick = async () => {
    if (pulse.actionType === "shrink") {
      const tiny = `Spend just 5 calm minutes on "${shortVision(userData.visionTitle, 32)}" today`;
      await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), {
        todayMove: { text: tiny, completedToday: false, updatedDate: todayStr(0) }
      }), "Could not update step");
      showToast("Shrunk to a 5-minute restart step.");
    } else if (pulse.actionType === "focus") {
      openFocusSanctuary();
    } else if (pulse.actionType === "rock-fear") {
      openRockModal("fear");
    } else if (pulse.actionType === "rock-test") {
      openRockModal("test");
    } else if (pulse.actionType === "forest") {
      switchView("forest");
    }
  };
}
// INLINE STEP EDIT
document.getElementById("edit-step-toggle").addEventListener("click", () => {
  document.getElementById("today-step-edit-box").classList.toggle("hidden");
});
document.getElementById("save-today-move-btn").addEventListener("click", async () => {
  const text = document.getElementById("today-move-input").value.trim();
  if (!text) return showToast("Write your step first.");
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      todayMove: {
        text,
        completedToday: userData.todayMove?.updatedDate === todayStr(0) ?Boolean(userData.todayMove?.completedToday) : false,
        updatedDate: todayStr(0)
      }
    });
    document.getElementById("today-step-edit-box").classList.add("hidden");
    showToast("Today's step updated.");
  }, "Failed to save step");
});
// DRIFT-FREE TIMESTAMP FOCUS TIMER
function renderFocusClock(secs) {
  const safe = Math.max(0, secs);
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  document.getElementById("focus-timer-display").textContent = `${m}:${s}`;
}
function setFocusMinutes(mins) {
  clearInterval(focusInterval);
  focusInterval = null;
  focusEndTimeMs = null;
  focusDurationSecs = mins * 60;
  focusRemainingSecs = focusDurationSecs;
  document.getElementById("focus-toggle-btn").textContent = "Start Quiet Timer";
  renderFocusClock(focusRemainingSecs);
}
function openFocusSanctuary() {
  document.getElementById("focus-vision-tag").textContent = shortVision(userData?.visionTitle ||"My Goal", 42);
  document.getElementById("focus-step-title").textContent =
    userData?.todayMove?.text || "Take one focused step forward.";
  setFocusMinutes(25);
  document.getElementById("focus-overlay").classList.remove("hidden");
}
document.getElementById("enter-focus-btn").addEventListener("click", openFocusSanctuary);
document.getElementById("focus-15-btn").addEventListener("click", () => setFocusMinutes(15));
document.getElementById("focus-25-btn").addEventListener("click", () => setFocusMinutes(25));
document.getElementById("focus-toggle-btn").addEventListener("click", () => {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
    focusRemainingSecs = Math.max(0, Math.ceil((focusEndTimeMs - Date.now()) / 1000));
    focusEndTimeMs = null;
    document.getElementById("focus-toggle-btn").textContent = "Resume Timer";
    return;
  }
  focusEndTimeMs = Date.now() + focusRemainingSecs * 1000;
  document.getElementById("focus-toggle-btn").textContent = "Pause";
  focusInterval = setInterval(() => {
    const left = Math.ceil((focusEndTimeMs - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(focusInterval);
      focusInterval = null;
      focusRemainingSecs = 0;
      focusEndTimeMs = null;
      renderFocusClock(0);
      document.getElementById("focus-toggle-btn").textContent = "Complete ✓";
      showToast("Focus session complete! Record what happened when ready.");
      return;
    }
    focusRemainingSecs = left;
    renderFocusClock(left);
  }, 500);
});
document.getElementById("focus-exit-btn").addEventListener("click", () => {
  clearInterval(focusInterval);
  focusInterval = null;
  document.getElementById("focus-overlay").classList.add("hidden");
});
document.getElementById("focus-done-btn").addEventListener("click", () => {
  clearInterval(focusInterval);
  focusInterval = null;
  document.getElementById("focus-overlay").classList.add("hidden");
  document.getElementById("complete-modal").classList.remove("hidden");
});
// OBSERVE -> UPDATE: RECORD WHAT HAPPENED (ATOMIC BATCH + DUPLICATE GUARD)
document.getElementById("open-complete-btn").addEventListener("click", () => {
  document.getElementById("complete-modal").classList.remove("hidden");
});
document.getElementById("close-complete-btn").addEventListener("click", () => {
  document.getElementById("complete-modal").classList.add("hidden");
});
async function submitObservation(shareToCircle) {
  if (isSubmittingProof) return;
  const outcome = document.getElementById("proof-outcome").value;
  const note = document.getElementById("proof-note-input").value.trim();
  if (!note) return showToast("Write 1 honest sentence about what happened.");
  isSubmittingProof = true;
  const btnA = document.getElementById("complete-only-btn");
  const btnB = document.getElementById("complete-share-btn");
  btnA.disabled = btnB.disabled = true;
  try {
    const today = todayStr(0);
    const yesterday = todayStr(-1);
    const didAct = outcome !== "blocked_self";
    let newStreak = userData.streak || 0;
    let newTotal = userData.totalProofs || 0;
    if (didAct) {
      if (userData.lastProofDate === today) newStreak = Math.max(1, newStreak);
      else if (userData.lastProofDate === yesterday) newStreak += 1;
      else newStreak = 1;
      newTotal += 1;
    }
    const moveText = userData.todayMove?.text || "Daily Step";
    const batch = writeBatch(db);
    const proofRef = doc(collection(db, "users", currentUser.uid, "proofs"));
    batch.set(proofRef, {
      move: moveText,
      outcome,
      note,
      date: today,
      createdAt: serverTimestamp()
    });
    const userRef = doc(db, "users", currentUser.uid);
    const userUpdates = {
      streak: newStreak,
      totalProofs: newTotal,
      lastProofDate: didAct ? today : (userData.lastProofDate || ""),
      lastOutcome: outcome,
      todayMove: {
        text: moveText,
        completedToday: didAct,
        updatedDate: today
      }
    };
    batch.update(userRef, userUpdates);
    if (userData.publicProfile) {
      batch.set(
        doc(db, "builders", currentUser.uid),
        {
          uid: currentUser.uid,
          displayName: userData.displayName || "Builder",
          visionTitle: shortVision(userData.visionTitle || "", 70),
          primaryBarrier: userData.primaryBarrier || "clarity",
          streak: newStreak,
          totalProofs: newTotal,
          skillsOffer: userData.skillsOffer || "",
          skillsNeed: userData.skillsNeed || "",
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
    if (shareToCircle && didAct) {
      const msgRef = doc(collection(db, "rooms", "daily-proof", "messages"));
      batch.set(msgRef, {
        uid: currentUser.uid,
        authorName: userData.displayName || "Builder",
        authorVision: shortVision(userData.visionTitle, 28),
        authorStreak: newStreak,
        type: "proof",
        text: `Action #${newTotal} (${outcome}): ${note}`,
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();
    document.getElementById("proof-note-input").value = "";
    document.getElementById("complete-modal").classList.add("hidden");
    // Trigger OBSERVE -> UPDATE Next Decision modal
    const adaptive = computeAdaptiveUpdate(userData, outcome, note);
    pendingSuggestedStep = adaptive.nextStep;
    document.getElementById("upd-headline").textContent = adaptive.headline;
    document.getElementById("upd-reason").textContent = adaptive.reason;
    document.getElementById("upd-next-step").textContent = adaptive.nextStep;
    document.getElementById("update-decision-modal").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    showToast("Could not save record: " + (err.message || "Try again."));
  } finally {
    isSubmittingProof = false;
    btnA.disabled = btnB.disabled = false;
  }
}
document.getElementById("complete-only-btn").addEventListener("click", () => submitObservation(false));
document.getElementById("complete-share-btn").addEventListener("click", () => submitObservation(true));
document.getElementById("upd-accept-btn").addEventListener("click", async () => {
  if (!pendingSuggestedStep) return;
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      todayMove: {
        text: pendingSuggestedStep,
        completedToday: false,
        updatedDate: todayStr(0)
      }
    });
    document.getElementById("update-decision-modal").classList.add("hidden");
    showToast("Next step adapted based on real-world evidence!");
  }, "Could not update step");
});
document.getElementById("upd-keep-btn").addEventListener("click", () => {
  document.getElementById("update-decision-modal").classList.add("hidden");
});
// MY TREE: GROWTH RINGS, TESTS (ONLY OBSERVED COUNT AS LEAVES), FEARS (PLANNED VS FACED)
function renderGrowthRings(snapList) {
  const el = document.getElementById("growth-rings-list");
  if (snapList.empty) {
    el.textContent = "Record what happened today to add your first ring.";
    return;
  }
  el.innerHTML = snapList.docs
    .map((d) => {
      const p = d.data();
      const badgeCls = p.outcome === "blocked_self" ? "pill-clay" : "pill-moss";
      return `
        <div class="soft-row" style="flex-direction:column; gap:4px;">
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="pill ${badgeCls}">${esc(p.date || "")}</span>
            ${p.outcome ? `<span class="pill">${esc(p.outcome.replace("_", " "))}</span>` : ""}
          </div>
          <strong>${esc(p.move)}</strong>
          <span class="small muted">${esc(p.note)}</span>
        </div>
      `;
    })
    .join("");
}
function renderTestsList() {
  const list = userData?.experiments || [];
  const el = document.getElementById("tree-tests-list");
  if (!list.length) {
    el.textContent = "No assumptions tested yet.";
    return;
  }
  el.innerHTML = list
    .map(
      (ex) => `
      <div class="soft-row" style="flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="pill ${ex.status === "validated" ? "pill-moss" : ex.status === "pivoted" ? "pill-sky" : "pill-sun"}">${ex.status === "running" ? "TESTING (0 LEAVES YET)" : esc(ex.status.toUpperCase())}</span>
          <span class="small muted">${esc(ex.deadline)}</span>
        </div>
        <div>${esc(ex.hypothesis)}</div>
        ${ex.lesson ? `<div class="small muted">Observed: ${esc(ex.lesson)}</div>` : ""}
        ${
          ex.status === "running"
            ? `<div style="display:flex; gap:6px; flex-wrap:wrap; width:100%;">
                <input type="text" class="exp-lesson-input" data-id="${ex.id}" placeholder="What happened in real life?" style="flex:1; min-width:160px; padding:7px 10px;" />
                <button class="btn btn-moss btn-sm exp-finish" data-id="${ex.id}" data-status="validated" type="button">Held True</button>
                <button class="btn btn-glass btn-sm exp-finish" data-id="${ex.id}" data-status="pivoted" type="button">Needs Pivot</button>
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
      const lesson = input?.value.trim();
      if (!lesson) return showToast("Write what you observed before finishing this test.");
      const updated = list.map((ex) => (ex.id === id ? { ...ex, status, lesson } : ex));
      await safeAction(async () => {
        await updateDoc(doc(db, "users", currentUser.uid), { experiments: updated });
        const outcome = status === "validated" ? "worked" : "no_need";
        const adaptive = computeAdaptiveUpdate(userData, outcome, lesson);
        pendingSuggestedStep = adaptive.nextStep;
        document.getElementById("upd-headline").textContent = adaptive.headline;
        document.getElementById("upd-reason").textContent = adaptive.reason;
        document.getElementById("upd-next-step").textContent = adaptive.nextStep;
        document.getElementById("update-decision-modal").classList.remove("hidden");
        showToast("Observation recorded—your tree grew a leaf!");
      }, "Failed to save test result");
    })
  );
}
function renderFearsList() {
  const list = userData?.fearsConquered || [];
  const el = document.getElementById("tree-fears-list");
  if (!list.length) {
    el.textContent = "No fear resets planned yet.";
    return;
  }
  el.innerHTML = list
    .map((f) => {
      const faced = !f.status || f.status === "faced";
      return `
        <div class="soft-row" style="flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <span class="pill ${faced ? "pill-moss" : "pill-sun"}">${faced ? "FACED ✓ (TRUNK GROWN)" : "PLANNED (NOT FACED YET)"}</span>
          </div>
          <strong>Avoided: ${esc(f.fear)}</strong>
          <span class="small muted">5-Min Action: ${esc(f.microStep)}</span>
          ${!faced ? `<button class="btn btn-moss btn-sm mark-fear-faced" data-id="${f.id}" type="button">I Actually Faced This ✓</button>` : ""}
        </div>
      `;
    })
    .join("");
  el.querySelectorAll(".mark-fear-faced").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const updated = list.map((f) =>
        f.id === btn.dataset.id ? { ...f, status: "faced", facedAt: todayStr(0) } : f
      );
      await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), { fearsConquered: updated }), "Could not update fear");
      showToast("Courage proven! Your tree trunk just thickened.");
    })
  );
}
// THE SUNBEAM STUDIO
function openSunbeamStudio() {
  const ctx = getSunbeamContext(userData);
  document.getElementById("sb-archetype-badge").textContent = `Path: ${ctx.archetypeLabel}`;
  document.getElementById("sb-weather-badge").textContent = `Obstacle: ${ctx.weatherLabel}`;
  document.getElementById("sb-question").textContent = ctx.question;
  document.getElementById("sb-hint").textContent = ctx.hint;
  document.getElementById("sb-answer").value = "";
  document.getElementById("sb-output-panel").classList.add("hidden");
  document.getElementById("sunbeam-modal").classList.remove("hidden");
}
document.getElementById("open-sunbeam-top-btn").addEventListener("click", openSunbeamStudio);
document.getElementById("open-sunbeam-tree-btn").addEventListener("click", openSunbeamStudio);
document.getElementById("close-sunbeam-btn").addEventListener("click", () => {
  document.getElementById("sunbeam-modal").classList.add("hidden");
});
document.getElementById("sb-synthesize-btn").addEventListener("click", () => {
  const answer = document.getElementById("sb-answer").value.trim();
  if (!answer) return showToast("Type your honest situation first.");
  lastSunbeamOutput = synthesizeSunbeamAction(userData, answer);
  document.getElementById("sb-detected-signal").textContent = lastSunbeamOutput.signal;
  document.getElementById("sb-diagnosis").textContent = lastSunbeamOutput.diagnosis;
  document.getElementById("sb-today-step").textContent = lastSunbeamOutput.todayStep;
  document.getElementById("sb-seed-test").textContent = lastSunbeamOutput.seedTest;
  document.getElementById("sb-stone").textContent = lastSunbeamOutput.stone;
  document.getElementById("sb-output-panel").classList.remove("hidden");
});
document.getElementById("sb-apply-btn").addEventListener("click", async () => {
  if (!lastSunbeamOutput) return;
  const newExp = {
    id: "exp_" + Date.now(),
    hypothesis: lastSunbeamOutput.seedTest,
    deadline: todayStr(3),
    status: "running",
    lesson: ""
  };
  const newStone = {
    id: "ms_" + Date.now(),
    title: lastSunbeamOutput.stone,
    dueDate: todayStr(7),
    done: false
  };
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      todayMove: { text: lastSunbeamOutput.todayStep, completedToday: false, updatedDate: todayStr(0) },
      experiments: [newExp, ...(userData.experiments || [])],
      milestones: [newStone, ...(userData.milestones || [])]
    });
    document.getElementById("sunbeam-modal").classList.add("hidden");
    showToast("Tailored next step and assumption test applied!");
  }, "Could not apply Sunbeam output");
});
// HIT AN OBSTACLE MODAL
function openRockModal(autoPanel = null) {
  document.querySelectorAll(".rock-panel").forEach((p) => p.classList.add("hidden"));
  if (autoPanel) {
    const map = {
      fear: "rock-fear-panel",
      phototropism: "rock-phototropism-panel",
      test: "rock-test-panel",
      shade: "rock-shade-panel"
    };
    if (map[autoPanel]) document.getElementById(map[autoPanel]).classList.remove("hidden");
  }
  document.getElementById("rock-modal").classList.remove("hidden");
}
document.getElementById("hit-rock-btn").addEventListener("click", () => openRockModal());
document.getElementById("open-rock-sidebar-btn").addEventListener("click", () => openRockModal());
document.getElementById("open-test-modal-btn").addEventListener("click", () => openRockModal("test"));
document.getElementById("close-rock-btn").addEventListener("click", () => {
  document.getElementById("rock-modal").classList.add("hidden");
});
document.querySelectorAll(".rock-pick").forEach((btn) => {
  btn.addEventListener("click", () => openRockModal(btn.dataset.rock));
});
// Fear saved as PLANNED (Trunk only grows when user marks "I Actually Faced This ✓")
document.getElementById("save-fearbreak-btn").addEventListener("click", async () => {
  const protocol = document.getElementById("fb-protocol").value;
  const fear = document.getElementById("fb-fear").value.trim();
  const worstCase = document.getElementById("fb-worst").value.trim();
  const microStep = document.getElementById("fb-micro").value.trim();
  if (!fear || !microStep) return showToast("Name what you're avoiding and your 5-min step.");
  const updatedFears = [
    { id: "fb_" + Date.now(), protocol, fear, worstCase, microStep, status: "planned", createdAt: todayStr(0) },
    ...(userData.fearsConquered || [])
  ];
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      fearsConquered: updatedFears,
      todayMove: { text: microStep, completedToday: false, updatedDate: todayStr(0) }
    });
    document.getElementById("fb-fear").value = "";
    document.getElementById("fb-worst").value = "";
    document.getElementById("fb-micro").value = "";
    document.getElementById("rock-modal").classList.add("hidden");
    showToast("5-min step set for Today! Mark it faced in My Tree once done.");
  }, "Could not save fear reset");
});
document.getElementById("run-stresstest-btn").addEventListener("click", async () => {
  const inputs = {
    capital: document.getElementById("st-capital").value,
    hours: document.getElementById("st-hours").value,
    stage: document.getElementById("st-stage").value,
    fear: document.getElementById("st-fear").value
  };
  const reading = runGroundCheck(userData, inputs);
  await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), {
    weather: { capital: inputs.capital, hours: inputs.hours, stage: inputs.stage },
    stressTest: reading
  }), "Could not save diagnosis");
  const out = document.getElementById("st-results");
  out.innerHTML = `
    <span class="pill pill-moss" style="margin-bottom:8px;">${esc(reading.posture)}</span>
    <strong style="display:block; color:var(--text); margin-bottom:4px;">Likely Bottleneck: ${esc(reading.holdingBack)}</strong>
    <p class="small muted" style="margin-bottom:10px;">${esc(reading.truth)}</p>
    ${reading.steps.map((s, i) => `<div class="soft-row small"><span><strong>${i + 1}.</strong> ${esc(s)}</span></div>`).join("")}
    <button id="apply-ground-step1" class="btn btn-moss btn-sm" type="button">Set Step 1 as
Today's Focus</button>
  `;
  document.getElementById("apply-ground-step1")?.addEventListener("click", async () => {
    await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), {
      todayMove: { text: reading.steps[0], completedToday: false, updatedDate: todayStr(0) }
    }), "Could not update step");
    document.getElementById("rock-modal").classList.add("hidden");
    showToast("Step 1 is now your Today's Focus.");
  });
});
document.getElementById("add-exp-btn").addEventListener("click", async () => {
  const hypothesis = document.getElementById("exp-hyp").value.trim();
  const deadline = document.getElementById("exp-deadline").value || todayStr(3);
  if (!hypothesis) return showToast("Describe the assumption you're testing.");
  const updated = [
    { id: "exp_" + Date.now(), hypothesis, deadline, status: "running", lesson: "" },
    ...(userData.experiments || [])
  ];
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), { experiments: updated });
    document.getElementById("exp-hyp").value = "";
    document.getElementById("rock-modal").classList.add("hidden");
    switchView("tree");
    showToast("Test started! Record what happens to grow a leaf.");
  }, "Could not save test");
});
document.getElementById("send-sos-btn").addEventListener("click", async () => {
  const text = document.getElementById("sos-room-text").value.trim();
  if (!text) return showToast("Describe your obstacle in 1 sentence.");
  await safeAction(async () => {
    await addDoc(collection(db, "rooms", "unstuck-sos", "messages"), {
      uid: currentUser.uid,
      authorName: userData.displayName || "Builder",
      authorVision: shortVision(userData.visionTitle, 28),
      authorStreak: userData.streak || 0,
      type: "sos",
      text: `BLOCKED: ${text}`,
      createdAt: serverTimestamp()
    });
    document.getElementById("sos-room-text").value = "";
    document.getElementById("rock-modal").classList.add("hidden");
    switchView("forest");
    openForestTab("circles");
    activeRoom = "unstuck-sos";
    renderRoomTabs();
    subscribeToRoom(activeRoom);
    showToast("Shared with #in-the-shade.");
  }, "Could not send message");
});
document.getElementById("jump-mycelium-btn").addEventListener("click", () => {
  document.getElementById("rock-modal").classList.add("hidden");
  switchView("forest");
  openForestTab("mycelium");
});
// MILESTONES (REAL DUE DATES)
const openStonesModal = () => {
  if (!document.getElementById("ms-due-date").value) {
    document.getElementById("ms-due-date").value = todayStr(7);
  }
  document.getElementById("stones-modal").classList.remove("hidden");
};
document.getElementById("manage-stones-btn").addEventListener("click", openStonesModal);
document.getElementById("open-stones-tree-btn").addEventListener("click", openStonesModal);
document.getElementById("close-stones-btn").addEventListener("click", () => {
  document.getElementById("stones-modal").classList.add("hidden");
});
document.getElementById("add-milestone-btn").addEventListener("click", async () => {
  const title = document.getElementById("ms-title").value.trim();
  const dueDate = document.getElementById("ms-due-date").value || todayStr(7);
  if (!title) return showToast("Enter a concrete milestone.");
  const list = [...(userData.milestones || []), { id: "ms_" + Date.now(), title, dueDate, done: false }];
  await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), { milestones: list }), "Could not add milestone");
  document.getElementById("ms-title").value = "";
});
function renderMilestones() {
  const list = userData?.milestones || [];
  const done = list.filter((m) => m.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  document.getElementById("ms-percent").textContent = `${pct}%`;
  document.getElementById("ms-progress-fill").style.width = `${pct}%`;
  const el = document.getElementById("milestones-list");
  if (!list.length) {
    el.textContent = "No milestones yet.";
    return;
  }
  el.innerHTML = list
    .map((m) => {
      const due = formatDueDateLabel(m.dueDate, m.targetDays);
      const isOverdue = !m.done && due.startsWith("Overdue");
      return `
        <div class="soft-row">
          <div>
            <span class="pill ${isOverdue ? "pill-clay" : ""}">${esc(due)}</span>
            <div style="margin-top:5px; text-decoration:${m.done ? "line-through" : "none"}; color:${m.done ? "var(--muted)" : "var(--text)"};">${esc(m.title)}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-moss btn-sm ms-toggle" data-id="${m.id}" type="button">${m.done ? "Undo" : "Done"}</button>
            <button class="btn btn-clay btn-sm ms-del" data-id="${m.id}" type="button">×</button>
          </div>
        </div>
      `;
    })
    .join("");
  el.querySelectorAll(".ms-toggle").forEach((b) =>
    b.addEventListener("click", async () => {
      const updated = list.map((m) => (m.id === b.dataset.id ? { ...m, done: !m.done } : m));
      await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), { milestones: updated }), "Update failed");
    })
  );
  el.querySelectorAll(".ms-del").forEach((b) =>
    b.addEventListener("click", async () => {
      const updated = list.filter((m) => m.id !== b.dataset.id);
      await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), { milestones: updated }), "Delete failed");
    })
  );
}
// EDIT GOAL MODAL
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
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    await syncBuilderVisibility({ ...userData, ...updates });
    document.getElementById("vision-modal").classList.add("hidden");
    showToast("Goal updated.");
  }, "Could not update goal");
});
// THE FOREST: OPT-IN PRIVACY + 3-TYPE MYCELIUM + CIRCLES
function openForestTab(tab) {
  const isMyc = tab === "mycelium";
  document.getElementById("forest-mycelium").classList.toggle("hidden", !isMyc);
  document.getElementById("forest-circles").classList.toggle("hidden", isMyc);
  document.getElementById("forest-tab-mycelium").classList.toggle("active", isMyc);
  document.getElementById("forest-tab-circles").classList.toggle("active", !isMyc);
  if (!isMyc) subscribeToRoom(activeRoom);
}
document.getElementById("forest-tab-mycelium").addEventListener("click", () => openForestTab("mycelium"));
document.getElementById("forest-tab-circles").addEventListener("click", () => openForestTab("circles"));
document.getElementById("save-swap-profile-btn").addEventListener("click", async () => {
  const publicProfile = document.getElementById("forest-public-toggle").checked;
  const skillsOffer = document.getElementById("profile-offer").value.trim();
  const skillsNeed = document.getElementById("profile-need").value.trim();
  await safeAction(async () => {
    await updateDoc(doc(db, "users", currentUser.uid), { publicProfile, skillsOffer, skillsNeed });
    await syncBuilderVisibility({ ...userData, publicProfile, skillsOffer, skillsNeed });
    await loadBuildersDirectory();
    showToast(publicProfile ? "Forest visibility & skills updated!" : "Directory visibility turned off & removed.");
  }, "Could not save Forest settings");
});
async function loadBuildersDirectory() {
  const snap = await safeAction(() => getDocs(query(collection(db, "builders"), limit(150))), "Could not load directory");
  if (!snap) return;
  cachedBuilders = [];
  snap.forEach((d) => cachedBuilders.push(d.data()));
  renderMyceliumMatches();
  renderBuildersList(cachedBuilders);
}
function renderMatchCard(item, pillClass) {
  const b = item.builder;
  return `
    <div class="soft-row" style="flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center;
gap:6px; flex-wrap:wrap;">
        <strong>${esc(b.displayName)}</strong>
        <span class="pill ${pillClass}">${esc(item.reason)}</span>
      </div>
      <div class="small muted">${esc(shortVision(b.visionTitle, 60))}</div>
      <button class="btn btn-glass btn-sm ping-match-btn" data-name="${esc(b.displayName)}"
type="button">Connect in #strength-swap →</button>
    </div>
  `;
}
function bindMatchConnectButtons() {
  document.querySelectorAll(".ping-match-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openForestTab("circles");
      activeRoom = "skill-swap";
      renderRoomTabs();
      subscribeToRoom("skill-swap");
      const input = document.getElementById("chat-input");
      input.value = `@${btn.dataset.name} `;
      input.focus();
    });
  });
}
function renderMyceliumMatches() {
  const { skills, experience, support } = computeMyceliumMatches(userData, cachedBuilders, currentUser.uid);
  document.getElementById("mycelium-skills").innerHTML = skills.length
    ? skills.map((m) => renderMatchCard(m, "pill-moss")).join("")
    : "No exact skill overlap found yet. List specific skills you need above.";
  document.getElementById("mycelium-experience").innerHTML = experience.length
    ? experience.map((m) => renderMatchCard(m, "pill-sky")).join("")
    : "No builders ahead on your exact obstacle yet.";
  document.getElementById("mycelium-support").innerHTML = support.length
    ? support.map((m) => renderMatchCard(m, "pill-sun")).join("")
    : "As opted-in builders join, support peers will appear here.";
  bindMatchConnectButtons();
}
function renderBuildersList(list) {
  const grid = document.getElementById("builders-grid");
  if (!list.length) {
    grid.innerHTML = `<div class="soft-row small muted">No opted-in builders match that search yet.</div>`;
    return;
  }
  grid.innerHTML = list
    .sort((a, b) => (b.totalProofs || 0) - (a.totalProofs || 0))
    .map(
      (b) => `
      <div class="soft-row" style="flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <strong>${esc(b.displayName || "Builder")}</strong>
          <span class="pill pill-moss">${Number(b.totalProofs || 0)} actions • ${Number(b.streak ||0)}d</span>
        </div>
        <div style="font-weight:600;">${esc(shortVision(b.visionTitle || "Building", 70))}</div>
        <div class="small muted">Obstacle: ${esc(BARRIER_LABELS[b.primaryBarrier] || "—")}</
div>
        ${b.skillsOffer ? `<div class="small"><span class="pill pill-sky">Offers</span> ${esc(b.skillsOffer)}</div>` : ""}
        ${b.skillsNeed ? `<div class="small"><span class="pill pill-sun">Needs</span> ${esc(b.skillsNeed)}</div>` : ""}
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
// LIVE CIRCLES CHAT (FIXED LATEST-80 DESCENDING QUERY + MUTE/REPORT)
function renderRoomTabs() {
  const el = document.getElementById("chat-rooms-list");
  el.innerHTML = FOREST_CIRCLES.map(
    (r) => `
    <button class="room-btn ${r.id === activeRoom ? "active" : ""}" data-room="${r.id}"
type="button">
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
  const meta = FOREST_CIRCLES.find((r) => r.id === roomId) || FOREST_CIRCLES[0];
  document.getElementById("active-room-title").textContent = meta.name;
  document.getElementById("active-room-desc").textContent = meta.desc;
  // Query LATEST 80 messages descending, then reverse chronologically
  const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "desc"), limit(80));
  unsubChat = onSnapshot(q, (snap) => {
    const box = document.getElementById("chat-messages");
    const mutedSet = new Set(userData?.mutedUids || []);
    const docsNewestLast = snap.docs.slice().reverse().filter((d) => !mutedSet.has(d.data().uid));
    if (!docsNewestLast.length) {
      box.innerHTML = `<div class="small muted">Quiet inside ${esc(meta.name)} right now. Start the conversation!</div>`;
      return;
    }
    const founder = isFounderUser(currentUser);
    box.innerHTML = docsNewestLast
      .map((d) => {
        const m = d.data();
        const mine = m.uid === currentUser.uid;
        const typeClass = m.type === "proof" ? "proof-msg" : m.type === "sos" ? "sos-msg" : "";
        return `
          <div class="msg ${mine ? "mine" : ""} ${typeClass}">
            <div class="msg-meta">
              <strong>${esc(m.authorName || "Builder")}</strong>
              <span class="pill chat-vision-pill" title="${esc(m.authorVision || "")}">${esc(shortVision(m.authorVision, 28))}</span>
              <span class="muted">${Number(m.authorStreak || 0)}d</span>
              ${(mine || founder) ? `<button class="btn btn-clay btn-sm msg-del" data-id="${d.id}" type="button" style="padding:2px 8px; font-size:0.7rem;">Del</button>` : ""}
              ${!mine ? `<button class="link-btn msg-mute" data-uid="${esc(m.uid)}" type="button" style="font-size:0.7rem; color:var(--muted);">Hide</button>` : ""}
              ${!mine ? `<button class="link-btn msg-report" data-id="${d.id}" data-text="${esc(shortVision(m.text, 120))}" type="button" style="font-size:0.7rem; color:var(--clay);">Report</button>` : ""}
            </div>
            <div class="small">${esc(m.text)}</div>
          </div>
        `;
      })
      .join("");
    box.querySelectorAll(".msg-del").forEach((btn) =>
      btn.addEventListener("click", () => safeAction(() => deleteDoc(doc(db, "rooms", roomId, "messages", btn.dataset.id)), "Delete failed"))
    );
    box.querySelectorAll(".msg-mute").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const uidToMute = btn.dataset.uid;
        const nextMuted = Array.from(new Set([...(userData?.mutedUids || []), uidToMute]));
        await safeAction(() => updateDoc(doc(db, "users", currentUser.uid), { mutedUids: nextMuted }), "Could not hide user");
        showToast("User hidden from your chat view.");
      })
    );
    box.querySelectorAll(".msg-report").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await safeAction(async () => {
          await addDoc(collection(db, "reports"), {
            reporterUid: currentUser.uid,
            roomId,
            messageId: btn.dataset.id,
            messagePreview: btn.dataset.text,
            reason: "Flagged by community member",
            createdAt: serverTimestamp()
          });
          showToast("Message reported to Founder for review.");
        }, "Could not submit report");
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
  await safeAction(async () => {
    await addDoc(collection(db, "rooms", activeRoom, "messages"), {
      uid: currentUser.uid,
      authorName: userData?.displayName || "Builder",
      authorVision: shortVision(userData?.visionTitle || "Goal", 28),
      authorStreak: userData?.streak || 0,
      type: "chat",
      text,
      createdAt: serverTimestamp()
    });
  }, "Failed to send message");
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
  const protEl = document.getElementById("live-wisdom-list");
  if (!protos.length) {
    protEl.textContent = "Timely guidance from Tavirah appears here automatically.";
  } else {
    protEl.innerHTML = [...protos]
      .reverse()
      .map(
        (p) => `
        <div class="soft-row" style="flex-direction:column;">
          <span class="pill pill-sun">LIVING WISDOM</span>
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
// FOUNDER COCKPIT EVENTS
document.getElementById("refresh-founder-btn").addEventListener("click", () => {
  if (!isFounderUser(currentUser)) return;
  safeAction(() => loadFounderTelemetry(liveConfig), "Telemetry failed");
});
document.getElementById("f-push-ann-btn").addEventListener("click", async () => {
  if (!isFounderUser(currentUser)) return;
  const title = document.getElementById("f-ann-title").value.trim();
  const body = document.getElementById("f-ann-body").value.trim();
  if (!title) return showToast("Enter an announcement title.");
  await safeAction(async () => {
    await pushFounderAnnouncement(title, body);
    showToast("Announcement pushed LIVE!");
  }, "Push failed");
});
document.getElementById("f-push-proto-btn").addEventListener("click", async () => {
  if (!isFounderUser(currentUser)) return;
  const title = document.getElementById("f-proto-title").value.trim();
  const steps = document.getElementById("f-proto-steps").value.trim();
  if (!title || !steps) return showToast("Enter both title and steps.");
  await safeAction(async () => {
    await pushFounderProtocol(title, steps);
    document.getElementById("f-proto-title").value = "";
    document.getElementById("f-proto-steps").value = "";
    showToast("Living Wisdom pushed LIVE!");
  }, "Push failed");
});
document.getElementById("f-copy-brief-btn").addEventListener("click", async () => {
  await safeAction(() => navigator.clipboard.writeText(document.getElementById("f-ai-brief").value), "Copy failed");
  showToast("Live Founder Brief copied!");
});
// NAVIGATION BINDING
document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});
