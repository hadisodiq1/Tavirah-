export function esc(str = "") {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}
export function shortVision(str = "", max = 28) {
  const clean = String(str).trim();
  if (!clean) return "Goal";
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}
export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return 999;
  const a = new Date(dateA + "T00:00:00");
  const b = new Date(dateB + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
export const BARRIER_LABELS = {
  clarity: "Finding Clarity",
  fear: "Fear & Perfectionism",
  capital: "Starting From Zero",
  identity: "Circumstance & Identity",
  isolation: "Walking Alone"
};
function hasWord(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
// 1. WHOLE-WORD & PHRASE VISION CLASSIFIER (NO SUBSTRING BUGS)
const ARCHETYPES = {
  software: {
    id: "software",
    label: "Digital & Tech Builder",
    terms: ["app", "apps", "software", "website", "web app", "mobile app", "ai", "platform", "saas", "coding", "code", "developer", "tool", "bot", "automation", "tech"]
  },
  commerce: {
    id: "commerce",
    label: "Product & Commerce",
    terms: ["shop", "store", "brand", "clothing", "fashion", "food", "product", "sell", "market", "delivery", "farm", "farming", "logistics", "business", "retail", "merch"]
  },
  media: {
    id: "media",
    label: "Story, Art & Voice",
    terms: ["tiktok", "youtube", "content", "video", "film", "music", "design", "art", "book", "write", "writing", "podcast", "story", "photo", "creator", "animation"]
  },
  service: {
    id: "service",
    label: "Craft & Service",
    terms: ["agency", "freelance", "coach", "coaching", "consult", "consulting", "repair", "service", "cleaning", "marketing", "editing", "tutor", "mentor", "clients"]
  },
  community: {
    id: "community",
    label: "Movement & Humanity",
    terms: ["community", "school", "teach", "teaching", "student", "students", "youth", "charity", "humanity", "water", "health", "mental health", "nonprofit", "village", "educate"]
  },
  personal: {
    id: "personal",
    label: "Personal Mastery",
    terms: ["career", "learn", "degree", "exam", "discipline", "habit", "habits", "job", "skill", "fitness", "study", "scholarship"]
  },
  general: {
    id: "general",
    label: "General Project",
    terms: []
  }
};
export function classifyVisionArchetype(title = "", why = "") {
  const text = `${title} ${why}`.trim();
  if (!text) return ARCHETYPES.general;
  let best = ARCHETYPES.general;
  let bestScore = 0;
  Object.values(ARCHETYPES).forEach((arch) => {
    if (arch.id === "general") return;
    let score = 0;
    arch.terms.forEach((term) => {
      if (hasWord(text, term)) score += term.includes(" ") ? 2 : 1;
    });
    if (score > bestScore) {
      bestScore = score;
      best = arch;
    }
  });
  return bestScore > 0 ? best : ARCHETYPES.general;
}
// 2. SMART STARTER SETUP (ARCHETYPE + WEATHER + BARRIER)
export function generateStarterSetup(visionTitle, visionWhy, weather = {}, barrier = "clarity") {
  const arch = classifyVisionArchetype(visionTitle, visionWhy);
  const v = shortVision(visionTitle, 36);
  const zeroCap = (weather.capital || "zero") === "zero";
  const stepByArch = {
    software: zeroCap
      ? `Sketch the single most important screen of "${v}" on paper and ask 2 real people if it solves their problem`
      : `Talk to 3 real people who face the problem "${v}" solves before writing complex features`,
    commerce: zeroCap
      ? `Describe or mock up 1 sample of "${v}" with $0 today and ask 3 potential buyers if they'd pay for it`
      : `Place 1 real sample of "${v}" in front of 3 buyers today and note every hesitation`,
    media: `Publish or share 1 raw, imperfect draft for "${v}" today without polishing aesthetics first`,
    service: `Write 1 plain sentence explaining who "${v}" helps and offer a small trial to 2 people today`,
    community: `Have an honest conversation with 2 people you want "${v}" to help—ask what stops them most right now`,
    personal: `Protect 20 distraction-free minutes today to practice the core skill inside "${v}"`,
    general: `Break "${v}" down to one tiny tangible piece someone else can react to within 24 hours`
  };
  let todayMoveText = stepByArch[arch.id] || stepByArch.general;
  if (barrier === "fear") {
    todayMoveText = `Do a messy 10-minute version of "${v}" and show it to 1 trusted person today`;
  } else if (barrier === "isolation") {
    todayMoveText = `Introduce "${v}" in #around-the-fire and write what help or skill swap you need`;
  }
  const milestones = [
    {
      title: `Speak with 3 real people who need "${v}" and note their exact pain`,
      dueDate: todayStr(3)
    },
    {
      title: `Create a rough Version 0.1 of "${v}" using available tools`,
      dueDate: todayStr(7)
    },
    {
      title: `Test "${v}" in real life and record what actually happened`,
      dueDate: todayStr(14)
    }
  ];
  const now = Date.now();
  return {
    todayMoveText,
    milestones: milestones.map((m, i) => ({
      id: `ms_${now}_${i}`,
      title: m.title,
      dueDate: m.dueDate,
      done: false
    }))
  };
}
// 3. COMPLETE 108-COMBINATION GROUND CHECK (ZERO FAKE % SCORES)
const STAGE_FEAR_MATRIX = {
  "idea|clarity": {
    holdingBack: "Unanchored Idea (Too Many Possibilities)",
    truth: "When an idea only lives in your head, every branch feels equally urgent. Clarity only arrives when you test one narrow slice on one real person."
  },
  "idea|perfectionism": {
    holdingBack: "Polishing an Unvalidated Idea",
    truth: "Trying to make an idea flawless before anyone sees it usually hides fear of rejection. Early versions are meant to look rough so reality can shape them."
  },
  "idea|judgment": {
    holdingBack: "Fear of Early Exposure & Background Doubt",
    truth: "Your identity or background feels louder than your vision right now. Start quietly with 1– 2 real users who judge only whether you solve their problem."
  },
  "idea|resources": {
    holdingBack: "Assuming You Need Money Before Proof",
    truth: "Almost no early idea needs capital first—it needs proof that real people care. You can prove demand using conversations, paper, and free tools."
  },
  "started|clarity": {
    holdingBack: "Mid-Build Drift (Lost the Core Thread)",
    truth: "You started moving, then multiple tasks blurred what actually matters. Cut away 80% of side tasks and finish one end-to-end piece."
  },
  "started|perfectionism": {
    holdingBack: "Endless Tweaking Without Shipping",
    truth: "You are stuck adjusting details nobody has tested yet. Put your unfinished draft in front of 2 people today to break the loop."
  },
  "started|judgment": {
    holdingBack: "Hesitating Right Before Being Seen",
    truth: "Progress slowed down as soon as the work got close to public eyes. Share it in a safe test with 1–3 honest people first."
  },
  "started|resources": {
    holdingBack: "Hitting a Tool or Budget Wall Mid-Project",
    truth: "Your plan assumed tools or money you don't currently hold. Re-angle the remaining steps around manual delivery or skill-swapping."
  },
  "built|clarity": {
    holdingBack: "Built Without a Distribution Channel",
    truth: "You know how to build, not yet how to reach people consistently. Shift 80% of your energy from building to direct outreach."
  },
  "built|perfectionism": {
    holdingBack: "Adding Extra Features Instead of Finding Users",
    truth: "More features will not fix low usage. Put what you already built in front of 5 real people and watch where they hesitate."
  },
  "built|judgment": {
    holdingBack: "Hiding Completed Work in the Shade",
    truth: "Your work is built, but fear of critique is keeping it invisible. Value hidden helps nobody —send 3 quiet invitations today."
  },
  "built|resources": {
    holdingBack: "Trying to Market With $0",
    truth: "Without ad money, growth comes from direct 1-on-1 conversations, useful content, and communities where your exact users already gather."
  }
};
export function runGroundCheck(userData, inputs) {
  const { capital, hours, stage, fear } = inputs;
  const key = `${stage}|${fear}`;
  const base = STAGE_FEAR_MATRIX[key] || STAGE_FEAR_MATRIX["idea|clarity"];
  const arch = classifyVisionArchetype(userData?.visionTitle, userData?.visionWhy);
  const postureParts = [];
  if (capital === "zero") postureParts.push("$0 Bootstrap");
  else if (capital === "micro") postureParts.push("Micro-Test Budget");
  else postureParts.push("Funded");
  if (hours === "low") postureParts.push("Light Time (<5h/wk)");
  else if (hours === "med") postureParts.push("Steady Build (5–15h/wk)");
  else postureParts.push("Deep Sprint (15h+/wk)");
  const step1 = stage === "built"
    ? `Put your existing ${arch.label.toLowerCase()} work in front of 3 real people today and ask what confused or blocked them.`
    : capital === "zero"
      ? `Prove the core promise of your goal manually for 1 human today using zero paid tools.`
      : `Build the smallest testable slice of your goal in 48 hours and test it with 2 real people.`;
  const step2 = hours === "low"
    ? "Protect one narrow 20-minute block daily—cut all extra features until this single step succeeds."
    : "Run at least 2 real-world assumption tests this week and record what actually changed.";
  const step3 = fear === "resources" || fear === "judgment"
    ? "Use The Forest's Skill Exchange or #in-the-shade to partner with someone strong where you feel blocked."
    : "Use 'Record what happened' every time you act so Tavirah updates your next move around real evidence.";
  return {
    posture: postureParts.join(" • "),
    holdingBack: base.holdingBack,
    truth: base.truth,
    steps: [step1, step2, step3],
    capital,
    hours,
    stage,
    fear,
    updatedAt: new Date().toISOString()
  };
}
// 4. THE SUNBEAM — SEMANTIC SIGNAL PARSING (ADAPTS TO ACTUAL USER ANSWERS)
export function getSunbeamContext(userData) {
  const arch = classifyVisionArchetype(userData?.visionTitle, userData?.visionWhy);
  const barrier = userData?.primaryBarrier || "clarity";
  const stage = userData?.weather?.stage || userData?.stressTest?.stage || "idea";
  const questions = {
    software: {
      idea: {
        q: "Forget features. Describe ONE real person, the painful moment they hate today, and what is currently blocking you from showing them a solution.",
        hint: "Be brutally specific about your real constraints right now."
      },
      started: {
        q: "What is happening right now with what you've started—are people confused, are you stuck coding, or has nobody seen it yet?",
        hint: "Name the exact bottleneck you hit this week."
      },
      built: {
        q: "Since you've already built something, what happened when real people tried to use it (or why haven't they tried it yet)?",
        hint: "Example: '20 users tried it and got stuck on signup' or 'I'm scared to share the link'."
      }
    },
    commerce: {
      idea: {
        q: "What is keeping you from putting 1 real sample or offer in front of a buyer by tomorrow?",
        hint: "Name the real constraint—money, materials, finding buyers, or doubt."
      },
      started: {
        q: "When people look at your product right now, where do they hesitate—price, trust, or simply never seeing it?",
        hint: "Tell Tavirah what real buyers actually said or did."
      },
      built: {
        q: "Where are your buyers right now, and what stopped your last attempt to reach them?",
        hint: "Specific places, objections, or logistics friction."
      }
    }
  };
  const fallbackByStage = {
    idea: {
      q: "What is actually stopping you today—lack of clarity on Step 1, zero resources/access, or fear of starting imperfectly?",
      hint: "Write honestly about your real day today (money, internet, time, people, or fear)."
    },
    started: {
      q: "Look at where your momentum stalled: what specifically happened the last time you tried to move forward?",
      hint: "Name the exact moment or feedback that made you pause."
    },
    built: {
      q: "What happens when real people encounter what you've created so far—and where does friction appear?",
      hint: "Share real reactions, silence, confusion, or doubts."
    }
  };
  const selected = (questions[arch.id] && questions[arch.id][stage]) || fallbackByStage[stage] ||fallbackByStage.idea;
  return {
    archetypeLabel: arch.label,
    weatherLabel: BARRIER_LABELS[barrier] || "Finding Clarity",
    question: selected.q,
    hint: selected.hint
  };
}
export function synthesizeSunbeamAction(userData, rawAnswer) {
  const clean = rawAnswer.trim();
  const focus = clean.length > 85 ? clean.slice(0, 82) + "…" : clean;
  // Detect real-world semantic signals inside the user's answer
  const isOfflineOrZero = /\b(no internet|offline|no data|no money|broke|zero|can't afford|cant afford|no cash|no capital|no laptop|phone only)\b/i.test(clean);
  const isUserConfusion = /\b(confus\w*|onboarding|sign up|signup|don't understand|dont understand|too hard|complicated|users|already have)\b/i.test(clean);
  const isNoReach = /\b(nobody|no one|no reply|ignored|views|traffic|reach|find people|customers|audience|silent)\b/i.test(clean);
  const isFear = /\b(scared|afraid|fear|laugh|judge|embarrass|perfect|not ready|doubt|shy|nervous)\b/i.test(clean);
  const isSkillGap = /\b(don't know how|dont know how|coding|design|skill|alone|partner|help me|team)\b/i.test(clean);
  if (isOfflineOrZero) {
    return {
      signal: "OFFLINE / ZERO-RESOURCE CONSTRAINT",
      diagnosis: "Your answer shows a physical access or money bottleneck right now. Do NOT choose tasks requiring paid software or heavy internet—shift to offline human action.",
      todayStep: "Have 2 direct in-person conversations or sketch your core solution on paper today—zero data and zero money required.",
      seedTest: "If I explain my solution face-to-face to 2 people near me today, at least 1 will describe how they currently suffer from this problem.",
      stone: "Validate real human interest offline before spending a cent on tools"
    };
  }
  if (isUserConfusion) {
    return {
      signal: "ONBOARDING / CLARITY FRICTION (DEMAND EXISTS)",
      diagnosis: "You already have people interested—that's huge! Do NOT build new features or look for more marketing yet. Fix where existing people get confused.",
      todayStep: `Ask 2 of those exact users what confused them first regarding "${focus}"—and remove or simplify 1 step today.`,
      seedTest: "If I simplify the confusing step and watch 2 new people try it, both should complete it without asking for help.",
      stone: "Eliminate the #1 confusion point reported by early users"
    };
  }
  if (isNoReach) {
    return {
      signal: "DISTRIBUTION / REACH BOTTLENECK",
      diagnosis: "You can't learn if your idea works while too few people have seen it. Stop tweaking inside your room and switch to direct 1-on-1 outreach.",
      todayStep: "Find 5 specific people who openly complain about this exact problem and send each a short, personal message.",
      seedTest: "If I message 5 targeted people personally instead of posting generally, at least 2 will reply with real feedback.",
      stone: "Reach 15 targeted people directly and track exact reply rate"
    };
  }
  if (isFear) {
    return {
      signal: "EXPOSURE & PERFECTIONISM BLOCK",
      diagnosis: "Nothing technical is stopping you—fear of judgment or imperfect output is freezing your hands. Lower the stakes intentionally today.",
      todayStep: `Spend 10 messy minutes creating the smallest draft around "${focus}" and show it to just 1 trusted peer in #in-the-shade.`,
      seedTest: "If I share an imperfect draft with 1 real person today, the worst case won't hurt me—and I'll get 1 useful insight.",
      stone: "Ship 3 imperfect versions publicly or to peers this week"
    };
  }
  if (isSkillGap) {
    return {
      signal: "SKILL OR COLLABORATION GAP",
      diagnosis: "Trying to master every missing skill alone slows you down for months. Either learn only the first 20% needed today or trade skills in The Forest.",
      todayStep: `Post the exact piece you need help with ("${focus}") in The Forest Skill Exchange and see who matches.`,
      seedTest: "If I ask clearly for 1 specific missing skill in #strength-swap, I can find 1 collaborator or workaround within 48 hours.",
      stone: "Close your primary skill gap via focused practice or skill swap"
    };
  }
  return {
    signal: "CUSTOM REALITY PATH",
    diagnosis: "Based on your specific situation, isolate the single smallest real-world test around what you wrote so reality gives you feedback fast.",
    todayStep: `Turn "${focus}" into one 20-minute real-world conversation or tangible prototype today.`,
    seedTest: `If I put a concrete piece of "${focus}" in front of 3 real humans within 48 hours, I'll see what works and what needs to change.`,
    stone: `Run 2 real-world tests centered on "${focus}"`
  };
}
// 5. OBSERVE -> UPDATE ENGINE (ADAPTS NEXT DECISION FROM REAL-WORLD EVIDENCE)
export function computeAdaptiveUpdate(userData, outcome, note = "") {
  const vision = shortVision(userData?.visionTitle || "your goal", 36);
  const cleanNote = note.trim();
  const shortNote = cleanNote.length > 75 ? cleanNote.slice(0, 72) + "…" : cleanNote;
  // Check if user note itself mentions confusion, money, or offline issues
  const mentionsConfusion = /\b(confus\w*|understand|hard to use|complicated)\b/
i.test(cleanNote);
  const mentionsPrice = /\b(expensive|price|afford|money|pay|cost)\b/i.test(cleanNote);
  if (outcome === "no_need") {
    return {
      headline: "Evidence says: The problem or offer needs re-centering",
      reason: `People saw what you put out for "${vision}" and didn't feel urgency. Pushing harder on the exact same pitch wastes energy—listen first before building more.`,
      nextStep: `Pause building. Ask 3 people what their #1 daily headache actually is instead of pitching "${vision}"`
    };
  }
  if (outcome === "no_reach") {
    return {
      headline: "Evidence says: This is a visibility gap, not a bad goal",
      reason: "Too few people saw your work to judge whether it works. Passive posting rarely works early—go directly to 1-on-1 conversations.",
      nextStep: `Message 5 specific people directly who struggle with the problem "${vision}" solves`
    };
  }
  if (outcome === "friction_cost") {
    if (mentionsConfusion) {
      return {
        headline: "Evidence says: Simplify where people got confused",
        reason: `People wanted what you offered, then got lost (${shortNote || "clarity friction"}). Fixing that single point of confusion unlocks momentum faster than anything else.`,
        nextStep: `Remove 1 confusing step from "${vision}" and re-test it with 2 fresh people tomorrow`
      };
    }
    if (mentionsPrice) {
      return {
        headline: "Evidence says: Lower the entry barrier first",
        reason: "Interest is real, but cost or trust stopped them. Offer a tiny free or micro-sized first experience so people can feel the value first.",
        nextStep: `Create a tiny $0 or low-risk starter version of "${vision}" for 2 people to try tomorrow`
      };
    }
    return {
      headline: "Evidence says: Remove the trust or access friction",
      reason: "Demand exists, but something blocked people from saying yes. Ask 1 person bluntly: 'What almost made you say no?'",
      nextStep: "Ask 2 hesitant people what single thing would make saying yes feel safe and easy"
    };
  }
  if (outcome === "blocked_self") {
    return {
      headline: "No judgment—let's adjust the step to match your energy",
      reason: "When a step stays undone, the step was either too big, too vague, or hit emotional fear. Forcing willpower backfires—shrink the threshold.",
      nextStep: `Do just 5 messy minutes on "${vision}" tomorrow—no perfection, stop after 5 minutes if needed`
    };
  }
  // outcome === "worked"
  return {
    headline: "Evidence is positive—double down on what just worked",
    reason: `Real progress happened (${shortNote || "people responded"}). Don't invent a totally new strategy yet—repeat the exact channel or behavior that just produced evidence.`,
    nextStep: `Repeat what worked today with 3x more people or build the immediate next piece of "${vision}"`
  };
}
// 6. SILENT FOREST PULSE (BEHAVIORAL RADAR)
export function analyzeForestPulse(userData) {
  if (!userData || !userData.visionTitle) return null;
  const today = todayStr(0);
  const proofs = Number(userData.totalProofs || 0);
  const milestones = userData.milestones || [];
  const experiments = userData.experiments || [];
  const lastProof = userData.lastProofDate || "";
  const moveDate = userData.todayMove?.updatedDate || "";
  const completedToday = moveDate === today && Boolean(userData.todayMove?.completedToday);
  if (completedToday) return null;
  if (lastProof && daysBetween(lastProof, today) >= 3) {
    return {
      badge: "GENTLE RETURN",
      title: "Welcome back—shrink today's step",
      message: `It's been ${daysBetween(lastProof, today)} days since your last logged action. Start small today with a calm 5-minute action instead of trying to catch up all at once.`,
      cta: "Shrink to 5-Min Step",
      actionType: "shrink"
    };
  }
  if (milestones.length >= 3 && proofs === 0 && experiments.length === 0) {
    return {
      badge: "REALITY CHECK",
      title: "Time to test something in real life",
      message: "You have milestones mapped out, but no real-world action logged yet. Even one 10-minute conversation or test today gives you real evidence.",
      cta: "Enter Focus Now",
      actionType: "focus"
    };
  }
  if (userData.todayMove?.text && moveDate && daysBetween(moveDate, today) >= 2) {
    return {
      badge: "STUCK STEP",
      title: "This step has waited 2 days—what's blocking it?",
      message: "When a step sits untouched, it's usually fear, fog, or wrong timing. Let's diagnose the real obstacle or shrink it.",
      cta: "Diagnose Obstacle",
      actionType: "rock-fear"
    };
  }
  if (proofs >= 3 && !userData.publicProfile) {
    return {
      badge: "THE FOREST",
      title: "Optional: Connect with aligned builders",
      message: `You've logged ${proofs} real actions. If you'd like skill swaps or peer support, you can opt into The Forest directory anytime.`,
      cta: "Open The Forest",
      actionType: "forest"
    };
  }
  if ((userData.streak || 0) >= 3) {
    return {
      badge: "MOMENTUM",
      title: `${userData.streak}-day execution rhythm`,
      message: "Your consistency is building real roots. Consider testing one bold assumption in real life today.",
      cta: "Test an Assumption",
      actionType: "rock-test"
    };
  }
  return null;
}
// 7. HONEST TREE MATH (ZERO DOUBLE-COUNTING, ZERO PREMATURE CREDIT)
export function computeTreeState(userData) {
  const roots = Number(userData?.totalProofs || 0);
  // Only count fears actually marked as faced (legacy items without status count as faced)
  const fearsArr = userData?.fearsConquered || [];
  const trunk = fearsArr.filter((f) => !f.status || f.status === "faced").length;
  // Only count assumptions whose outcome has actually been observed (validated or pivoted)
  const exps = userData?.experiments || [];
  const leaves = exps.filter((e) => e.status === "validated" || e.status === "pivoted").length;
  // 1:1 honest formula matching displayed metrics exactly
  const score = roots + trunk * 2 + leaves * 2;
  const rootDepthPct = Math.min(100, Math.round(roots * 8 + trunk * 10 + leaves * 10));
  let stage = {
    emoji: "🌱",
    name: "Seed in Dark Soil",
    subtitle: "Your goal is planted. Log your first real-world action to start growing underground roots."
  };
  if (score >= 25) {
    stage = {
      emoji: "🌳",
      name: "Living Canopy",
      subtitle: "Deep roots, faced fears, and observed real-world evidence. Share your strength in The Forest."
    };
  } else if (score >= 12) {
    stage = {
      emoji: "🌿",
      name: "Growing Sapling",
      subtitle: "Your goal has broken above ground through consistent action and real-world learning."
    };
  } else if (score >= 5) {
    stage = {
      emoji: "🪴",
      name: "Breaking the Soil",
      subtitle: "Early real actions are taking shape. Keep observing what reality teaches."
    };
  } else if (score >= 1) {
    stage = {
      emoji: "🌱",
      name: "Rooting Underground",
      subtitle: "Real actions build invisible roots before external results become obvious."
    };
  }
  return { roots, trunk, leaves, score, rootDepthPct, stage };
}
export function renderLivingTreeSVG(state) {
  const { roots, trunk, leaves, score } = state;
  const trunkWidth = Math.min(18, 5 + trunk * 2.2 + Math.floor(roots / 3));
  const treeHeight = Math.min(108, 22 + score * 3.4);
  const topY = 148 - treeHeight;
  const rootBranches = Math.min(8, 1 + Math.ceil(roots / 2));
  let rootsSvg = "";
  for (let i = 0; i < rootBranches; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    const spread = 18 + i * 13;
    const depth = 166 + Math.min(58, 14 + roots * 3.5 + (i % 3) * 10);
    rootsSvg += `<path d="M160 150 Q ${160 + dir * spread * 0.45} ${160 + i * 3}, ${160 + dir * spread} ${depth}" stroke="#34d399" stroke-opacity="${0.4 + (i % 2) * 0.25}" stroke-width="${Math.max(1.5, 3.2 - i * 0.25)}" fill="none" stroke-linecap="round" />`;
  }
  const leafCount = Math.min(18, score > 0 ? 2 + leaves * 3 + Math.floor(roots / 2) : 0);
  let leavesSvg = "";
  for (let i = 0; i < leafCount; i++) {
    const angle = (i * 137.5) * (Math.PI / 180);
    const radius = 10 + i * 3.1;
    const lx = 160 + Math.cos(angle) * Math.min(68, radius);
    const ly = (topY + 12) + Math.sin(angle) * Math.min(36, radius * 0.55);
    const fill = i % 3 === 0 ? "#fbbf24" : "#34d399";
    const r = 4.5 + (i % 3) * 1.8;
    leavesSvg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${r}" fill="${fill}" fill-opacity="0.78" />`;
  }
  return `
    <svg viewBox="0 0 320 240" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <line x1="24" y1="150" x2="296" y2="150" stroke="rgba(255,255,255,0.16)" stroke-width="1.5" stroke-dasharray="4 4" />
      <ellipse cx="160" cy="185" rx="90" ry="34" fill="rgba(52,211,153,0.08)" />
      ${rootsSvg}
      ${score === 0 ? `<circle cx="160" cy="158" r="7" fill="#fbbf24" />` : ""}
      ${score > 0 ? `<path d="M160 150 L160 ${topY}" stroke="#d6b48c" stroke-width="${trunkWidth}" stroke-linecap="round" />` : ""}
      ${score >= 5 ? `<path d="M160 ${topY + 26} Q136 ${topY + 14} 122 ${topY + 4}" stroke="#d6b48c" stroke-width="${Math.max(2.5, trunkWidth * 0.45)}" fill="none" stroke-linecap="round" />` : ""}
      ${score >= 8 ? `<path d="M160 ${topY + 20} Q184 ${topY + 8} 198 ${topY}" stroke="#d6b48c" stroke-width="${Math.max(2.5, trunkWidth * 0.45)}" fill="none" stroke-linecap="round" />` : ""}
      ${leavesSvg}
    </svg>
  `;
}
// 8. 3-TYPE MYCELIUM MATCHER (SKILL / EXPERIENCE / SUPPORT — STRICT OVERLAP!)
const STOP_WORDS = new Set(["and", "the", "for", "with", "help", "need", "some", "want", "find", "looking", "from", "into"]);
function extractSkillTokens(str = "") {
  return String(str)
    .toLowerCase()
    .split(/[\s,;./|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}
export function computeMyceliumMatches(userData, allBuilders, currentUid) {
  const myNeedTokens = extractSkillTokens(userData?.skillsNeed || "");
  const myOfferTokens = extractSkillTokens(userData?.skillsOffer || "");
  const others = allBuilders.filter((b) => b.uid && b.uid !== currentUid);
  const usedUids = new Set();
  // 1. STRICT SKILL MATCHES (Requires actual token overlap with skillsOffer)
  const skills = others
    .map((b) => {
      const offerTokens = extractSkillTokens(b.skillsOffer || "");
      const matched = myNeedTokens.filter((t) => offerTokens.some((ot) => ot === t ||ot.includes(t) || t.includes(ot)));
      return {
        builder: b,
        score: matched.length,
        reason: matched.length ? `Offers "${matched.join(", ")}"` : ""
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  skills.forEach((s) => usedUids.add(s.builder.uid));
  // 2. EXPERIENCE MATCHES (Same obstacle + higher execution proof)
  const myProofs = Number(userData?.totalProofs || 0);
  const experience = others
    .filter((b) => !usedUids.has(b.uid) && b.primaryBarrier === userData?.primaryBarrier && (b.totalProofs || 0) >= Math.max(3, myProofs + 1))
    .sort((a, b) => (b.totalProofs || 0) - (a.totalProofs || 0))
    .slice(0, 4)
    .map((b) => ({
      builder: b,
      reason: `${b.totalProofs} actions past ${BARRIER_LABELS[b.primaryBarrier] || "this obstacle"}`
    }));
  experience.forEach((e) => usedUids.add(e.builder.uid));
  // 3. SUPPORT MATCHES (Builders needing what you offer OR peers/saplings)
  const support = others
    .filter((b) => !usedUids.has(b.uid))
    .map((b) => {
      const needTokens = extractSkillTokens(b.skillsNeed || "");
      const canHelp = myOfferTokens.filter((t) => needTokens.some((nt) => nt === t ||nt.includes(t) || t.includes(nt)));
      let score = canHelp.length * 5;
      let reason = canHelp.length ? `Needs "${canHelp.join(", ")}" you offer` : "";
      if (!reason && (b.totalProofs || 0) <= 2 && myProofs >= 2) {
        score = 2;
        reason = "Early builder—encouragement helps";
      } else if (!reason && (b.totalProofs || 0) > 0) {
        score = 1;
        reason = "Active peer in The Forest";
      }
      return { builder: b, score, reason };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return { skills, experience, support };
}
