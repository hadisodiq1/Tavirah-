export function esc(str = "") {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const BARRIER_LABELS = {
  clarity: "Lack of Clarity",
  fear: "Fear / Perfectionism",
  capital: "Zero Capital / Tools",
  identity: "Circumstance / Identity",
  isolation: "Building Alone"
};

export const UNBLOCK_ADVICE = {
  fear: "Perfectionism is fear wearing a smart disguise. Drop the standard by 70% right now: build the ugliest working version in 10 minutes. Nobody can improve a blank page.",
  clarity: "Fog happens when you try to see Step 20 before taking Step 1. Ignore the 5-year picture for the next 60 minutes. What is ONE concrete thing a stranger could look at or test today?",
  capital: "Lack of money only blocks expensive habits, not real value. Trade sweat, free digital tools, or direct 1-on-1 conversations to prove someone actually wants your idea before spending a cent.",
  isolation: "Carrying a big vision in silence tricks your brain into thinking it's impossible. Drop one honest sentence about where you're stuck into #unstuck-sos below—let other builders carry weight with you."
};

// ENGINE 1: REALITY STRESS-TESTER
export function runStressDiagnostic(userData, inputs) {
  const { capital, hours, stage, fear } = inputs;
  let score = 72;
  let bottleneck = "";
  let diagnosis = "";
  let steps = [];

  if (stage === "idea" && fear === "perfectionism") {
    score -= 22;
    bottleneck = "Premature Optimization & Analysis Paralysis";
    diagnosis = "You are polishing a vision in your imagination instead of colliding it with reality. Ideas mutate fast once real humans touch them.";
    steps = [
      "Cut your scope by 80% until you have a 48-hour testable version.",
      "Share a rough sketch, note, or voice demo with 3 real people before fixing aesthetics.",
      "Log your first real-world reaction inside Experiment Lab."
    ];
  } else if (stage === "built" && fear === "judgment") {
    score -= 18;
    bottleneck = "Invisible Builder Syndrome (Distribution Block)";
    diagnosis = "Your barrier isn't skill or product—it is hiding what you built behind identity fear. Value kept secret helps zero people.";
    steps = [
      "Identify 5 specific humans who suffer from the exact problem you solve.",
      "Send a direct, honest message asking for blunt feedback—not applause.",
      "Post your ugly build inside #daily-proof to break the silence barrier today."
    ];
  } else if (capital === "zero" && hours === "low") {
    score -= 15;
    bottleneck = "Scope Overreach Under Extreme Constraint";
    diagnosis = "With $0 and under 5 hours/week, trying to build a massive complex system will cause burnout by Day 10. You need a razor-thin wedge.";
    steps = [
      "Deliver the core promise manually for 1 person using free tools before automating anything.",
      "Protect one non-negotiable 45-minute block daily—consistency beats marathon weekends.",
      "Use Tavirah's Skill-Swap Network to trade strengths instead of doing everything alone."
    ];
  } else if (fear === "clarity") {
    score -= 16;
    bottleneck = "Unanchored Vision (Missing Feedback Loop)";
    diagnosis = "You are carrying too many branches at once. Clarity comes from running small experiments, not from thinking harder.";
    steps = [
      "Pick ONE target outcome for the next 7 days and pause every side idea.",
      "Add 2 concrete milestones in the Reverse-Timeline Architect.",
      "Lock Today's Unbreakable Move to take 1 physical action before midnight."
    ];
  } else if (capital === "zero" && fear === "resources") {
    score -= 12;
    bottleneck = "Resource Substitution Blindspot";
    diagnosis = "Money is a shortcut, not the engine. Most early traction requires proof of usefulness, which can be created with zero capital.";
    steps = [
      "List what you CAN create purely with time, communication, and free browser tools.",
      "Pre-validate demand: get 3 people to commit attention or feedback before building infrastructure.",
      "Check Builder Network to partner with someone who holds the missing skill."
    ];
  } else {
    score += 8;
    bottleneck = "Execution Consistency & Distribution Leverage";
    diagnosis = "Your fundamentals are viable. Your primary risk now is losing daily cadence or failing to iterate fast enough on real feedback.";
    steps = [
      "Keep an unbroken 14-day Proof-of-Reality streak.",
      "Run at least 2 real-world hypothesis tests per week in Experiment Lab.",
      "Recruit 1 peer in #skill-swap to stress-test your next milestone."
    ];
  }

  score = Math.max(25, Math.min(96, score));

  const customPrompt = buildSynthesizedPrompt(userData, {
    score,
    bottleneck,
    diagnosis,
    capital,
    hours,
    stage,
    fear
  });

  return {
    score,
    bottleneck,
    diagnosis,
    mvpPath: steps,
    customPrompt,
    updatedAt: new Date().toISOString()
  };
}

// ENGINE 6: HYPER-PERSONALIZED AI CO-FOUNDER PROMPT SYNTHESIZER
export function buildSynthesizedPrompt(userData, stressOverride = null) {
  const st = stressOverride || userData?.stressTest || {};
  const vision = userData?.visionTitle || "[Not defined yet]";
  const why = userData?.visionWhy || "[Not defined yet]";
  const barrier = BARRIER_LABELS[userData?.primaryBarrier] || "Not specified";
  const streak = userData?.streak || 0;
  const proofs = userData?.totalProofs || 0;
  const activeMilestones = (userData?.milestones || [])
    .filter((m) => !m.done)
    .slice(0, 3)
    .map((m) => `- ${m.title} (${m.targetDays}d target)`)
    .join("\n") || "- None set yet";

  const activeExps = (userData?.experiments || [])
    .filter((e) => e.status === "running")
    .slice(0, 2)
    .map((e) => `- ${e.hypothesis}`)
    .join("\n") || "- None running";

  return `Act as my ruthless, deeply practical Co-Founder & Execution Strategist inside Tavirah OS. Do not give generic motivation.

MY CURRENT REALITY:
- North Star Vision: ${vision}
- Why it matters: ${why}
- Primary Barrier: ${barrier}
- Execution Track Record: ${proofs} real proofs logged (${streak}-day streak)
- Stress-Test Bottleneck: ${st.bottleneck || "Not run yet"}
- Constraints: Capital=${st.capital || "unknown"}, Hours/wk=${st.hours || "unknown"}, Stage=${st.stage || "unknown"}

ACTIVE MILESTONES:
${activeMilestones}

RUNNING EXPERIMENTS:
${activeExps}

YOUR JOB RIGHT NOW:
1. Challenge any blind spots in my approach based on my bottleneck.
2. Give me the smartest zero-waste move I can execute in the next 45 minutes to push this vision into physical reality today.
3. Help me design a fast real-world test so I stop guessing and start getting evidence.`;
}
