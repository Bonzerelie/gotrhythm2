/* =========================
   /script.js
   Got Rhythm
   - audio/kick1.mp3, audio/snare1.mp3
   - required for metronome: audio/metronomehigh.mp3, audio/metronomelow.mp3
   - preserves iframe sizing + scroll forwarding
   ========================= */
   (() => {
    "use strict";
  
    const AUDIO_DIR = "audio";
  
    // ---------------- Tunables ----------------
    const SCHED_AHEAD_SEC = 0.14;
    const SCHED_TICK_MS = 25;
  
    const CAPTURE_EARLY_BEATS = 0.5;
    const CAPTURE_LATE_BEATS = 0.5;
  
    const SCORING = {
      MATCH_MAX_MS: 180,
      TIER_5_MS: 55,
      TIER_4_MS: 90,
      TIER_3_MS: 125,
      TIER_2_MS: 165,
    };
  
    const BEAT_FLASH_MS = 120;
  
    const METRONOME_GAIN = 0.55;
    const DRUM_GAIN = 0.95;


    const UI_GAIN = 0.85;
  
    // Prevent "click" after touch/pointer from double-firing
    const GHOST_CLICK_BLOCK_MS = 700;
  
    // ---------------- DOM ----------------
    const $ = (id) => document.getElementById(id);
  
    const beginBtn = $("beginBtn");
    const pauseBtn = $("pauseBtn");
    const stopBtn = $("stopBtn");
    const downloadScoreBtn = $("downloadScoreBtn");
  
    const difficultySel = $("difficultySel");
    const rhythmSettingsBtn = $("rhythmSettingsBtn");
  
    const rhythmSettingsModal = $("rhythmSettingsModal");
    const difficultyOptions = $("difficultyOptions");
    const rhythmSettingsClose = $("rhythmSettingsClose");
    const bpmRange = $("bpmRange");
    const bpmNum = $("bpmNum");
  
    const timeSigSel = $("timeSigSel");
    const rhythmLenSel = $("rhythmLenSel");
    const gapsToggle = $("gapsToggle");
  
    const kickBtn = $("kickBtn");
    const snareBtn = $("snareBtn");
  
    const phaseTitle = $("phaseTitle");
    const phaseSub = $("phaseSub");
    const feedbackOut = $("feedbackOut");
    const scoreBar = $("scoreBar"); // kept for compatibility (hidden in CSS)
    const feedbackCard = $("feedbackCard");
  
    const avgScoreOut = $("avgScoreOut");
    const lastScoreOut = $("lastScoreOut");
    const roundsOut = $("roundsOut");
    const avgMsOut = $("avgMsOut");
  
    const beatDots = [
      $("beatDot1"),
      $("beatDot2"),
      $("beatDot3"),
      $("beatDot4"),
      $("beatDot5"),
      $("beatDot6"),
      $("beatDot7"),
      $("beatDot8"),
    ];
  
    const infoBtn = $("infoBtn");
    const infoModal = $("infoModal");
    const infoOk = $("infoOk");

    const introModal = $("introModal");
    const introGotIt = $("introGotIt");
    const introSettings = $("introSettings");
  
    const summaryModal = $("summaryModal");
    const summaryBody = $("summaryBody");
    const summaryClose = $("summaryClose");
    const summaryDownload = $("summaryDownload");
  
    if (
      !beginBtn ||
      !pauseBtn ||
      !stopBtn ||
      !downloadScoreBtn ||
      !difficultySel ||
      !rhythmSettingsBtn ||
      !rhythmSettingsModal ||
      !difficultyOptions ||
      !rhythmSettingsClose ||
      !bpmRange ||
      !bpmNum ||
      !timeSigSel ||
      !rhythmLenSel ||
      !gapsToggle ||
      !kickBtn ||
      !snareBtn ||
      !phaseTitle ||
      !phaseSub ||
      !feedbackOut ||
      !scoreBar ||
      !feedbackCard ||
      !avgScoreOut ||
      !lastScoreOut ||
      !roundsOut ||
      !avgMsOut ||
      beatDots.some((d) => !d) ||
      !summaryModal ||
      !summaryBody ||
      !summaryClose ||
      !summaryDownload
    ) {
      alert("UI mismatch: required elements missing. Ensure index.html matches script.js ids.");
      return;
    }
  
    // ---------------- Settings ----------------
    const LS_KEYS = {
      timeSig: "gr_time_sig",
      rhythmLen: "gr_rhythm_len",
      gaps: "gr_gaps",
    };
  
    function loadSettings() {
      const ts = localStorage.getItem(LS_KEYS.timeSig);
      if (ts === "3/4" || ts === "4/4") timeSigSel.value = ts;
  
      const rl = localStorage.getItem(LS_KEYS.rhythmLen);
      if (rl === "1" || rl === "2") rhythmLenSel.value = rl;
  
      const g = localStorage.getItem(LS_KEYS.gaps);
      if (g === "0" || g === "1") gapsToggle.checked = g === "1";
    }
  
    function saveSettings() {
      localStorage.setItem(LS_KEYS.timeSig, timeSigValue());
      localStorage.setItem(LS_KEYS.rhythmLen, String(rhythmBars()));
      localStorage.setItem(LS_KEYS.gaps, gapsEnabled() ? "1" : "0");
    }
  
    function rhythmBars() {
      const v = Number(rhythmLenSel.value);
      return v === 2 ? 2 : 1;
    }
  
    function gapsEnabled() {
      return !!gapsToggle.checked;
    }
  
    // ---------------- Difficulty UI helpers ----------------
    const DIFFICULTY_LABEL = {
      simple: "Simple",
      medium: "Medium",
      difficult: "Difficult",
      complex: "Complex",
    };
  
    function difficulty() {
      return String(difficultySel.value || "simple");
    }
  
    function difficultyLabel(d = difficulty()) {
      return DIFFICULTY_LABEL[d] || "Simple";
    }
  
    function syncSettingsButtonA11y() {
      const label = difficultyLabel();
      const bpm = bpmValue();
      const ts = timeSigLabel();
      const rl = rhythmBars();
      const gaps = gapsEnabled() ? "in-between ON" : "in-between OFF";
      rhythmSettingsBtn.setAttribute(
        "aria-label",
        `Rhythm settings. Time signature: ${ts}. Rhythm length: ${rl} bar. Difficulty: ${label}. Tempo: ${bpm} bpm. ${gaps}. Click to change.`
      );
    }
  
    // ---------------- iframe sizing (preserved) ----------------
    let lastHeight = 0;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.ceil(entry.contentRect.height);
        if (height !== lastHeight) {
          parent.postMessage({ iframeHeight: height }, "*");
          lastHeight = height;
        }
      }
    });
    ro.observe(document.documentElement);
  
    function postHeightNow() {
      try {
        const h = Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        );
        parent.postMessage({ iframeHeight: h }, "*");
      } catch {}
    }
  
    window.addEventListener("load", () => {
      setTimeout(postHeightNow, 250);
      setTimeout(postHeightNow, 1000);
    });
  
    window.addEventListener("orientationchange", () => {
      setTimeout(postHeightNow, 100);
      setTimeout(postHeightNow, 500);
    });
  
    
    // ---------------- Audio ----------------
    let audioCtx = null;
    let masterGain = null;
  
    const bufferCache = new Map();
    const activeVoices = new Set();
  
    function ensureAudio() {
      if (audioCtx) return audioCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        alert("Your browser doesn’t support Web Audio (required for playback).");
        return null;
      }
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioCtx.destination);
      return audioCtx;
    }
  
    async function resumeAudioIfNeeded() {
      const ctx = ensureAudio();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }
    }
  
    function trackVoice(src, gain) {
      const voice = { src, gain };
      activeVoices.add(voice);
      src.onended = () => activeVoices.delete(voice);
      return voice;
    }
  
    function stopAllAudio(fadeSec = 0.06) {
      const ctx = ensureAudio();
      if (!ctx) return;
  
      const now = ctx.currentTime;
      const fade = Math.max(0.02, Number.isFinite(fadeSec) ? fadeSec : 0.06);
  
      for (const v of Array.from(activeVoices)) {
        try {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setTargetAtTime(0, now, fade / 6);
          v.src.stop(now + fade + 0.02);
        } catch {}
      }
    }
  
    function urlFor(name) {
      return `${AUDIO_DIR}/${name}`;
    }
  
    async function loadBuffer(url) {
      if (bufferCache.has(url)) return bufferCache.get(url);
  
      const p = (async () => {
        const ctx = ensureAudio();
        if (!ctx) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const ab = await res.arrayBuffer();
          return await ctx.decodeAudioData(ab);
        } catch {
          return null;
        }
      })();
  
      bufferCache.set(url, p);
      return p;
    }
  
    function playOneShot(buffer, whenSec, gainValue) {
      const ctx = ensureAudio();
      if (!ctx || !masterGain || !buffer) return;
  
      const src = ctx.createBufferSource();
      src.buffer = buffer;
  
      const g = ctx.createGain();
      const gVal = Math.max(0, gainValue);
  
      const dur = Math.max(0.01, buffer.duration);
      const fadeTail = Math.min(0.04, dur * 0.25);
      const endTime = whenSec + dur;
  
      g.gain.setValueAtTime(gVal, whenSec);
      g.gain.setValueAtTime(gVal, Math.max(whenSec, endTime - fadeTail));
      g.gain.linearRampToValueAtTime(0, endTime);
  
      src.connect(g);
      g.connect(masterGain);
  
      trackVoice(src, g);
      src.start(whenSec);
      src.stop(endTime + 0.05);
    }
  
    let kickBuf = null;
    let snareBuf = null;
  
    let metroHighBuf = null;
    let metroLowBuf = null;


    let selectBuf = null;
    let backBuf = null;
  
    async function preloadAudio() {
      await resumeAudioIfNeeded();
      const [k, s, mh, ml, sel, back] = await Promise.all([
        loadBuffer(urlFor("kick1.mp3")),
        loadBuffer(urlFor("snare1.mp3")),
        loadBuffer(urlFor("metronomehigh.mp3")),
        loadBuffer(urlFor("metronomelow.mp3")),
        loadBuffer(urlFor("select1.mp3")),
        loadBuffer(urlFor("back1.mp3")),
      ]);
      kickBuf = k;
      snareBuf = s;
      metroHighBuf = mh;
      metroLowBuf = ml;
      selectBuf = sel;
      backBuf = back;
    }
  
    // ---------------- Game model ----------------
    const PHASE = {
      COUNTIN: "countin",
      LISTEN: "listen",
      READY: "ready",
      PLAY: "play",
      SCORE: "score",
    };
  
    const scoreState = {
      rounds: 0,
      last: null,
      total: 0,
      avg: 0,
      history: [],
      totalAvgErrMs: 0,
      avgErrMs: 0,
      lastErrMs: null,
    };
  
    let lastScorecardSnapshot = null;
  
    function clamp(v, lo, hi) {
      return Math.max(lo, Math.min(hi, v));
    }
  
    function bpmValue() {
      const v = Number(bpmNum.value);
      return clamp(Number.isFinite(v) ? v : 70, 40, 140);
    }
  
    function timeSigValue() {
      return String(timeSigSel.value || "4/4");
    }
  
    function beatsPerBar() {
      return timeSigValue() === "3/4" ? 3 : 4;
    }
  
    function timeSigLabel() {
      return timeSigValue();
    }
  
    function beatDurSec() {
      return 60 / bpmValue();
    }
  
    function listenBeats() {
      return beatsPerBar() * rhythmBars();
    }
  
    function readyBeats() {
      return gapsEnabled() ? beatsPerBar() : 0;
    }
  
    function playBeats() {
      return beatsPerBar() * rhythmBars();
    }
  
    function scoreBeats() {
      return gapsEnabled() ? beatsPerBar() : 0;
    }
  
    function cycleBeats() {
      return listenBeats() + readyBeats() + playBeats() + scoreBeats();
    }
  
    const SCORE_WORD = { 1: "Poor", 2: "Okay", 3: "Good!", 4: "Very Good!", 5: "Excellent!" };
  
    const FEEDBACK_TEXT = {
      1: "Hmmm, give it another go! 🧐",
      2: "A good start! Keep going! 💪",
      3: "That's good! Let's get to 5 though! 👏",
      4: "Very good! That was pretty accurate! 🧐",
      5: "Brilliant! 🤩 You've got rhythm! 🥁🫡🎉",
    };
  
    const FINAL_AVG_TEXT = (avg) => {
      const rounded = Math.round(avg);
      if (rounded <= 1)
        return "You scored an average of 1/5 - You're down but you're not out! Give it another go and see if you can improve ☝️";
      if (rounded === 2)
        return "You scored an average of 2/5 - That's not a bad way to begin, but I reckon you've got a higher score in you!";
      if (rounded === 3)
        return "You scored an average of 3/5 - That's not bad at all, though the higher scores are calling your name 😉";
      if (rounded === 4)
        return "You scored an average of 4/5 - That's pretty great! A score to be proud of, but can you go one further? 💪🧐";
  
      const opts = [
        "You scored an average of 5/5 - Hey that's awesome! The local Samba band called by to ask when you can start 😉 If you haven't already, try upping the difficulty!",
        "You scored an average of 5/5 - A top result! 🎉💯 Kesha stopped by and said you're heart beats to the beat of the drum, and she was definitely on to something! ❤️🥁 If you haven't already, try upping the difficulty!",
        "You scored an average of 5/5 - Excellent - you've got real skills! 🎉💯 Apparently The New Radicals wrote a song with lyrics about you back in 1998 and it's 5/5 worth a listen ❤️ If you haven't already, try upping the difficulty!",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    };
  
    function makeScorecardSnapshot() {
      const avg = scoreState.rounds ? scoreState.avg : 0;
      return {
        rounds: scoreState.rounds,
        avg,
        avgText: scoreState.rounds ? `${avg.toFixed(1)}/5` : "—",
        last: scoreState.last,
        lastText: scoreState.last != null ? `${scoreState.last}/5` : "—",
        avgErrMsText: scoreState.rounds ? `${Math.round(scoreState.avgErrMs)}ms` : "—",
        bpm: bpmValue(),
        difficultyValue: difficulty(),
        difficultyText: difficultyLabel(),
        finalText: FINAL_AVG_TEXT(avg),
      };
    }
  
    function getBestScorecardSnapshot() {
      if (!summaryModal.classList.contains("hidden") && lastScorecardSnapshot) return lastScorecardSnapshot;
      if (scoreState.rounds) return makeScorecardSnapshot();
      return lastScorecardSnapshot || makeScorecardSnapshot();
    }
  
    function setScoreUI() {
      roundsOut.textContent = String(scoreState.rounds);
      lastScoreOut.textContent = scoreState.last != null ? `${scoreState.last}/5` : "—";
      avgScoreOut.textContent = scoreState.rounds ? `${scoreState.avg.toFixed(1)}/5` : "—";
      avgMsOut.textContent = scoreState.rounds ? `${Math.round(scoreState.avgErrMs)}ms` : "—";
    }
  
    function setFeedback(html) {
      feedbackOut.innerHTML = html || "";
    }
  
    function setPhase(title, sub) {
      phaseTitle.textContent = title;
      phaseSub.innerHTML = sub || "";
    }
  
    function setFeedbackGlow(score1to5) {
      if (!score1to5) {
        delete feedbackCard.dataset.score;
        scoreBar.style.width = "0%";
        scoreBar.style.background = "var(--score3)";
        return;
      }
      feedbackCard.dataset.score = String(score1to5);
      scoreBar.style.width = "100%";
      const c =
        score1to5 === 1
          ? "var(--score1)"
          : score1to5 === 2
          ? "var(--score2)"
          : score1to5 === 3
          ? "var(--score3)"
          : score1to5 === 4
          ? "var(--score4)"
          : "var(--score5)";
      scoreBar.style.background = c;
    }
  
    // ---------------- Beat dots UI ----------------
    function dotsCountForCurrentPhase(ph) {
      const bpb = beatsPerBar();
      if (rhythmBars() === 2 && (ph === PHASE.LISTEN || ph === PHASE.PLAY)) return bpb * 2;
      return bpb;
    }
  
    function dotColorForIndex(idx, ph) {
      const bpb = beatsPerBar();
      if (rhythmBars() === 2 && (ph === PHASE.LISTEN || ph === PHASE.PLAY)) {
        return idx < bpb ? "purple" : "orange";
      }
      return "green";
    }
  
    function syncBeatDotsUI(ph = phase) {
      const count = dotsCountForCurrentPhase(ph);
      beatDots.forEach((d, i) => {
        d.classList.toggle("hidden", i >= count);
        if (i < count) d.dataset.color = dotColorForIndex(i, ph);
        d.classList.remove("on");
      });
    }
  
    function computeDotIndexForBeat(beatIdx, phForBeat = phase) {
  const bpb = beatsPerBar();

  if (phForBeat === PHASE.COUNTIN) return ((beatIdx % bpb) + bpb) % bpb;

  const cb = cycleBeatOffset(beatIdx);

  if (phForBeat === PHASE.LISTEN) {
    if (rhythmBars() === 2) return cb % (2 * bpb);
    return cb % bpb;
  }

  if (phForBeat === PHASE.READY) {
    return cb % bpb;
  }

  if (phForBeat === PHASE.PLAY) {
    const start = listenBeats() + readyBeats();
    const within = cb - start;
    if (rhythmBars() === 2) return within % (2 * bpb);
    return within % bpb;
  }

  if (phForBeat === PHASE.SCORE) {
    return cb % bpb;
  }

  return ((beatIdx % bpb) + bpb) % bpb;
}
  
    // ---------------- Pattern library ----------------
    // Defensive: never crash the whole game because a pattern string is off by a few chars.
    function normalizeGridString(raw, slots, label) {
      const s = String(raw ?? "").replace(/\s/g, "");
      if (s.length === slots) return s;
  
      const fixed =
        s.length < slots ? s.padEnd(slots, "-") : s.slice(0, slots);
  
      console.warn(
        `[GotRhythm] Pattern "${label}" length ${s.length} != ${slots}. Auto-fixed to ${slots}.`
      );
      return fixed;
    }
  
    // Patterns are defined on a 16th-note grid:
    // 4/4: 16 slots per bar, 2 bars -> 32 slots
    // 3/4: 12 slots per bar, 2 bars -> 24 slots
    function gridSlots(kickStr, snareStr, slotsPerBar, label = "unnamed") {
      const slots = Number(slotsPerBar);
      if (!Number.isFinite(slots) || slots <= 0) throw new Error("slotsPerBar must be a positive number.");
  
      const kRaw = normalizeGridString(kickStr, slots, `${label}:kick`);
      const sRaw = normalizeGridString(snareStr, slots, `${label}:snare`);
  
      // Never schedule kick + snare on the same 16th: drop kick if both.
      const k = Array.from(kRaw);
      const s = Array.from(sRaw);
      for (let idx = 0; idx < slots; idx++) {
        if (k[idx]?.toLowerCase() === "x" && s[idx]?.toLowerCase() === "x") k[idx] = "-";
      }
  
      const evs = [];
      for (let idx = 0; idx < slots; idx++) {
        const t = idx / 4; // 16th grid: 4 slots per beat
        if (k[idx]?.toLowerCase() === "x") evs.push({ t, i: "K" });
        if (s[idx]?.toLowerCase() === "x") evs.push({ t, i: "S" });
      }
      return evs;
    }
  
    function grid16(kick16, snare16, label) {
      return gridSlots(kick16, snare16, 16, label);
    }
  
    function grid12(kick12, snare12, label) {
      return gridSlots(kick12, snare12, 12, label);
    }
  
    function grid32(kick32, snare32, label) {
      return gridSlots(kick32, snare32, 32, label);
    }
  
    function grid24(kick24, snare24, label) {
      return gridSlots(kick24, snare24, 24, label);
    }
  
    // 1-bar libraries
    const PATTERNS_44 = {
      simple: [
        grid16("x-------x-------", "----x-------x---", "44:s1"),
        grid16("x-------x---x---", "----x-------x---", "44:s2"),
        grid16("x---x---x-------", "----x-------x---", "44:s3"),
        grid16("x-------x-------", "----x-----------", "44:s4"),
        grid16("x-----------x---", "----x-------x---", "44:s5"),
        grid16("x-------x-------", "------------x---", "44:s6"),
        grid16("x-----------x---", "--------x-------", "44:s7"),
        grid16("x---x-------x---", "----x-------x---", "44:s8"),
        grid16("x-------x-------", "----x---x---x---", "44:s9"),
        grid16("x-------x-------", "----x-------x-x-", "44:s10"),
      ],
      medium: [
        grid16("x-------x-------", "----x-------x---", "44:m1"),
        grid16("x-----x-x-------", "----x-------x---", "44:m2"),
        grid16("x-------x---x---", "----x-------x---", "44:m3"),
        grid16("x---x---x---x---", "----x-------x---", "44:m4"),
        grid16("x---x-----x-x---", "----x-------x---", "44:m5"),
        grid16("x---x---x---x-x-", "----x-------x---", "44:m6"),
        grid16("x-------x-x-----", "----x-------x---", "44:m7"),
        grid16("x---x---x-------", "----x-------x---", "44:m8"),
        grid16("x---x-x-x---x---", "----x-------x---", "44:m9"),
        grid16("x-------x-------", "----x---x---x---", "44:m10"),
        grid16("x-------x-------", "----x---x-x-x---", "44:m11"),
        grid16("x--x----x-x-----", "----x-------x---", "44:m12"),
        grid16("x-x-----x-------", "----x-------x---", "44:m13"),
        grid16("x-------x-xx----", "----x-------x---", "44:m14"),
        grid16("xx------x--x----", "----x-------x---", "44:m15"),
        grid16("x-------xx--x---", "----x---x-------", "44:m16"),
        grid16("x-x----xx-------", "----x-------x---", "44:m17"),
        grid16("x-------xxx-----", "----x-------x---", "44:m18"),
        grid16("x-----x-x----x--", "----x------x----", "44:m19"),
      ],
      difficult: [
        grid16("x-x---x-x-x-x---", "----x-------x---", "44:d1"),
        grid16("x--x--x---x-x-x-", "----x-------x---", "44:d2"),
        grid16("x-xx---x--x-x---", "----x-------x---", "44:d3"),
        grid16("x---x-x-x---x-x-", "----x-------x---", "44:d4"),
        grid16("x-x---x--xx-x---", "----x-------x---", "44:d5"),
        grid16("x--x----x-x-x-x-", "----x-------x---", "44:d6"),
        grid16("x-xx--x---x---x-", "----x-------x---", "44:d7"),
        grid16("x---x--x-x-x-x--", "----x-------x---", "44:d8"),
        grid16("x-x---x-x-x-x---", "----x---x---x---", "44:d9"),
        grid16("x--x--x---x-x-x-", "----x-------x-x-", "44:d10"),
        grid16("x-xx---x--x-x---", "----x---x---x-x-", "44:d11"),
        grid16("x---x-x-x---x-x-", "----x--x----x---", "44:d12"),
        grid16("x-x---x--xx-x---", "----x---x---x---", "44:d13"),
      ],
      complex: [
        grid16("x-xx--x-x-xx-x-x", "----x---x---x---", "44:c1"),
        grid16("x-xx-x-x-xx-xx-x", "----x-------x-x-", "44:c2"),
        grid16("xx-x-xx-x-xx-x-x", "----x---x---x---", "44:c3"),
        grid16("x-xx--x---xx-xx-", "----x--x----x-x-", "44:c4"),
        grid16("x-xxx-x-x-xx-x-x", "----x---x-x-x---", "44:c5"),
        grid16("x-xx--x-x-xx-xx-", "----x--x----x-x-", "44:c6"),
        grid16("x-xx-x-xx-xx-x-x", "----x---x---x---", "44:c7"),
        grid16("x-xxx-x-x-xx-xx-", "----x---x-x-x-x-", "44:c8"),
        grid16("x-xx--x-x-xx-xxx", "----x--x--x-x-x-", "44:c9"),
      ],
    };
  
    const PATTERNS_34 = {
      simple: [
        grid12("x-----------", "----x---x---", "34:s1"),
        grid12("x-------x---", "----x---x---", "34:s2"),
        grid12("x-----------", "----x-------", "34:s3"),
        grid12("x-----------", "--------x---", "34:s4"),
        grid12("x---x-------", "----x---x---", "34:s5"),
        grid12("x-------x---", "----x-------", "34:s6"),
        grid12("x---x---x---", "----x---x---", "34:s7"),
        grid12("x-----------", "----x-x-x---", "34:s8"),
      ],
      medium: [
        grid12("x---x---x---", "----x---x---", "34:m1"),
        grid12("x-------x---", "----x-x-x---", "34:m2"),
        grid12("x---x-------", "----x---x---", "34:m3"),
        grid12("x-----x-x---", "----x---x---", "34:m4"),
        grid12("x---x---x---", "----x-x-x---", "34:m5"),
        grid12("x---x-----x-", "----x---x---", "34:m6"),
        grid12("x---x---x---", "----x---x-x-", "34:m7"),
        grid12("x-----x---x-", "----x---x---", "34:m8"),
        grid12("x---x-----x-", "----x-x-x---", "34:m9"),
        grid12("x-----x-x---", "----x-x-x---", "34:m10"),
        grid12("x---x---x---", "----x---x-x-", "34:m11"),
      ],
      difficult: [
        grid12("x--x--x-x---", "----x---x---", "34:d1"),
        grid12("x-x---x-x-x-", "----x---x---", "34:d2"),
        grid12("x--x-x---x--", "----x---x---", "34:d3"),
        grid12("x-x---x--x-x", "----x---x---", "34:d4"),
        grid12("x--x--x-x---", "----x-x-x---", "34:d5"),
        grid12("x-x---x-x-x-", "----x-x-x---", "34:d6"),
        grid12("x--x-x---x--", "----x-x-x---", "34:d7"),
        grid12("x---x-x---x-", "----x---x---", "34:d8"),
        grid12("x---x--x--x-", "----x---x---", "34:d9"),
        grid12("x-x---x--x--", "----x---x-x-", "34:d10"),
        grid12("x--x--x---x-", "----x---x-x-", "34:d11"),
      ],
      complex: [
        grid12("x-xx--x-x-xx", "----x---x---", "34:c1"),
        grid12("x-xx-x-x-xx-", "----x---x-x-", "34:c2"),
        grid12("xx-x-xx-x-x-", "----x-x-x---", "34:c3"),
        grid12("x-xxx-x-x-xx", "----x---x-x-", "34:c4"),
        grid12("x-xx--x---xx", "----x-x-x-x-", "34:c5"),
        grid12("x-xx-x-xx-xx", "----x---x---", "34:c6"),
        grid12("x-xxx-x-xx-x", "----x-x-x---", "34:c7"),
        grid12("x-xx--x-x-xx", "----x--x-x--", "34:c8"),
        grid12("x-xx-x-x-xxx", "----x-x-x-x-", "34:c9"),
      ],
    };
  
    // 2-bar libraries (FIXED lengths)
    // 4/4 two bars => 32 chars; 3/4 two bars => 24 chars
    const PATTERNS_44_2BAR = {
      simple: [
        // Rock: bar2 adds &4 pickup kick
        grid32(
          "x-------x-------" + "x-------x-----x-",
          "----x-------x---" + "----x-------x---",
          "44_2:s1"
        ),
        // Pop: kick 1, &2, 3; bar2 adds &4
        grid32(
          "x-----x-x-------" + "x-----x-x-----x-",
          "----x-------x---" + "----x-------x---",
          "44_2:s2"
        ),
        // Half-time then normal
        grid32(
          "x-----------x---" + "x-------x-------",
          "--------x-------" + "----x-------x---",
          "44_2:s3"
        ),
        // Simple funk-ish (bar2 variation)
        grid32(
          "x---x---x---x---" + "x---x---x--x----",
          "----x-------x---" + "----x-------x---",
          "44_2:s4"
        ),
      ],
      medium: [
        // More kick movement + small pickup
        grid32(
          "x---x---x---x---" + "x---x---x--xx---",
          "----x-------x---" + "----x-------x---",
          "44_2:m1"
        ),
        // Bar2 snare fill at end
        grid32(
          "x-------x---x---" + "x-------x---x---",
          "----x-------x---" + "----x-------xxxx",
          "44_2:m2"
        ),
        // Four-on-the-floor-ish kick, backbeat snare (steady)
        grid32(
          "x---x---x---x---" + "x---x---x---x---",
          "----x-------x---" + "----x-------x---",
          "44_2:m3"
        ),
        // Pop syncopation bar2
        grid32(
          "x-----x---x-x---" + "x-----x---x-xx--",
          "----x-------x---" + "----x-------x---",
          "44_2:m4"
        ),
      ],
      difficult: [
        // Denser syncopation
        grid32(
          "x-x---x-x-x-x---" + "x-x---x-x-xx-x--",
          "----x-------x---" + "----x-------x---",
          "44_2:d1"
        ),
        // Extra snare notes (ghost-ish)
        grid32(
          "x--x--x---x-x-x-" + "x--x--x---x-xx--",
          "----x---x---x---" + "----x---x---x-x-",
          "44_2:d2"
        ),
        // Bar2 fill
        grid32(
          "x-x---x--xx-x---" + "x-x---x--xx-x---",
          "----x-------x---" + "----x---x-xxxx--",
          "44_2:d3"
        ),
        // Busy funk
        grid32(
          "x-xx--x-x-x--x-x" + "x-xx--x-x-xx-x---",
          "----x-------x---" + "----x---x---x---",
          "44_2:d4"
        ),
      ],
      complex: [
        // Very dense
        grid32(
          "x-xx--x-x-xx-x-x" + "x-xx--x-x-xx-xx-",
          "----x---x---x---" + "----x--x--x-x-x-",
          "44_2:c1"
        ),
        // Alternating density
        grid32(
          "xx-x-xx-x-xx-x-x" + "x-xxx-x-x-xx-xx-",
          "----x-------x-x-" + "----x---x-x-x---",
          "44_2:c2"
        ),
        // Heavy ending fill
        grid32(
          "x-xxx-x-x-xx-xx-" + "x-xx--x-x-xx-xxx",
          "----x--x----x-x-" + "----x--x--xxxxxx",
          "44_2:c3"
        ),
        // Max density
        grid32(
          "x-xx-x-xx-xx-x-x" + "x-xx-x-xx-xx-xx-",
          "----x---x---x---" + "----x--x--x-x-x-",
          "44_2:c4"
        ),
      ],
    };
  
    const PATTERNS_34_2BAR = {
      simple: [
        // Waltz-ish, bar2 adds beat 3 kick
        grid24(
          "x-----------" + "x-------x---",
          "----x---x---" + "----x---x---",
          "34_2:s1"
        ),
        // Snare on 2 in both bars
        grid24(
          "x-----------" + "x-----------",
          "----x-------" + "----x-------",
          "34_2:s2"
        ),
        // Beat3 snare then beat2 snare
        grid24(
          "x-----------" + "x-----------",
          "--------x---" + "----x-------",
          "34_2:s3"
        ),
      ],
      medium: [
        // More kicks (8ths-ish)
        grid24(
          "x---x---x---" + "x---x---x---",
          "----x---x---" + "----x---x---",
          "34_2:m1"
        ),
        // Bar2 snare variation
        grid24(
          "x-------x---" + "x---x---x---",
          "----x---x---" + "----x-x-x---",
          "34_2:m2"
        ),
        // Syncopated kicks
        grid24(
          "x---x-----x-" + "x-x---x-----",
          "----x---x---" + "----x---x---",
          "34_2:m3"
        ),
      ],
      difficult: [
        // Denser kicks + extra snare
        grid24(
          "x--x--x-x---" + "x-x---x-x-x-",
          "----x---x---" + "----x-x-x---",
          "34_2:d1"
        ),
        // Bar2 mini fill
        grid24(
          "x-x---x--x--" + "x-x---x--x--",
          "----x---x---" + "----x---x-xx",
          "34_2:d2"
        ),
        // Busy
        grid24(
          "x-xx--x-x-xx" + "x-xx--x-x-xx",
          "----x---x---" + "----x--x-x--",
          "34_2:d3"
        ),
      ],
      complex: [
        // Very dense
        grid24(
          "x-xx-x-xx-xx-" + "x-xx-x-xx-xx-",
          "----x---x-x-" + "----x-x-x-x-",
          "34_2:c1"
        ),
        // Alternating + fill end
        grid24(
          "xx-x-xx-x-xxx" + "x-xxx-x-xx-x",
          "----x---x---" + "----x--x-xxx",
          "34_2:c2"
        ),
        // Max
        grid24(
          "x-xxx-xx-xxx-" + "x-xxx-xx-xxx-",
          "----x-x-x-x-" + "----x-x-xxxx",
          "34_2:c3"
        ),
      ],
    };
  
    function patternsForTimeSignatureAndLength() {
      const ts34 = timeSigValue() === "3/4";
      if (rhythmBars() === 2) return ts34 ? PATTERNS_34_2BAR : PATTERNS_44_2BAR;
      return ts34 ? PATTERNS_34 : PATTERNS_44;
    }
  
    function pickPattern() {
      const d = difficulty();
      const lib = patternsForTimeSignatureAndLength();
      const list = lib[d] || lib.simple;
      const p = list[Math.floor(Math.random() * list.length)];
      return p.map((x) => ({ t: x.t, i: x.i }));
    }
  
    function patternTimesSec(pattern, phraseStartSec) {
      const bd = beatDurSec();
      return pattern.map((ev) => {
        const bt = ev.t;
        return { when: phraseStartSec + bt * bd, i: ev.i, beatT: bt };
      });
    }
  
    // ---------------- Scheduler / timeline ----------------
    let started = false;
    let paused = false;
  
    let schedTimer = null;
    let nextBeatTimeSec = 0;
    let globalBeatIndex = 0;
    let phase = PHASE.COUNTIN;
    let countInRemaining = beatsPerBar();
  
    let currentPattern = [];
    let expectedPlayEvents = [];
  
    let roundHits = []; // {tSec, i}
  
    let prePlayHits = []; // {tSec, i} hits recorded before PLAY starts

    let captureWindow = null; // { startSec, endSec }

    const gameTimeoutIds = new Set();

    function setGameTimeout(fn, delayMs) {
      const id = window.setTimeout(() => {
        gameTimeoutIds.delete(id);
        fn();
      }, delayMs);
      gameTimeoutIds.add(id);
      return id;
    }

    function clearGameTimeouts() {
      gameTimeoutIds.forEach((id) => window.clearTimeout(id));
      gameTimeoutIds.clear();
    }
  
    function setControls() {
      beginBtn.hidden = started;
      beginBtn.classList.toggle("pulse", !started);
      rhythmSettingsBtn.classList.toggle("pulse", !started);
      pauseBtn.disabled = !started;
      stopBtn.disabled = false;
  
      const canHit = started && !paused;
      kickBtn.disabled = !canHit;
      snareBtn.disabled = !canHit;
    }

    let beatFlashToken = 0;

    function flashBeatDot(dotIdx, phForBeat = phase) {
      const count = dotsCountForCurrentPhase(phForBeat);
      beatFlashToken += 1;
      const token = beatFlashToken;

      beatDots.forEach((d, i) => {
        if (i >= count) {
          d.classList.remove("on");
          return;
        }
        d.classList.toggle("on", i === dotIdx);
      });

      setGameTimeout(() => {
        if (token !== beatFlashToken) return;
        beatDots.forEach((d) => d.classList.remove("on"));
      }, BEAT_FLASH_MS);
    }

    function playMetronomeClick(whenSec, isDownbeat) {
      const buf = isDownbeat ? metroHighBuf : metroLowBuf;
      if (!buf) return;
      playOneShot(buf, whenSec, METRONOME_GAIN);
    }
  
    function playDrum(i, whenSec) {
      const buf = i === "K" ? kickBuf : snareBuf;
      if (!buf) return;
      playOneShot(buf, whenSec, DRUM_GAIN);
    }


    async function ensureUiBuffers() {
      // Lazy-load UI sounds so they work before the game begins.
      await resumeAudioIfNeeded();
      if (selectBuf && backBuf) return;
      const [sel, back] = await Promise.all([
        selectBuf ? Promise.resolve(selectBuf) : loadBuffer(urlFor("select1.mp3")),
        backBuf ? Promise.resolve(backBuf) : loadBuffer(urlFor("back1.mp3")),
      ]);
      if (!selectBuf) selectBuf = sel;
      if (!backBuf) backBuf = back;
    }

    async function playUiSelect() {
      await ensureUiBuffers();
      const ctx = ensureAudio();
      if (!ctx || !selectBuf) return;
      playOneShot(selectBuf, ctx.currentTime + 0.01, UI_GAIN);
    }

    async function playUiBack() {
      await ensureUiBuffers();
      const ctx = ensureAudio();
      if (!ctx || !backBuf) return;
      playOneShot(backBuf, ctx.currentTime + 0.01, UI_GAIN);
    }
  
    let countInAnchorBeat = 0;

    // When finishing COUNTIN we schedule LISTEN at the next beat.
    // The scheduler would otherwise also treat that same beat as a LISTEN boundary and re-enter LISTEN twice.
    let skipPhaseBoundaryBeatIdx = null;

    // When gaps are disabled we score at the end of PLAY; show that feedback on the next LISTEN.
    let pendingInlineFeedbackResult = null;
  
    function cycleBeatOffset(beatIdx) {
      const cb = cycleBeats();
      return ((beatIdx - countInAnchorBeat) % cb + cb) % cb;
    }
  
    function computePhaseFromCycleBeat(cb) {
      const lb = listenBeats();
      const rb = readyBeats();
      const pb = playBeats();
      const sb = scoreBeats();
  
      if (cb < lb) return PHASE.LISTEN;
      if (rb > 0 && cb < lb + rb) return PHASE.READY;
      if (cb < lb + rb + pb) return PHASE.PLAY;
      return sb > 0 ? PHASE.SCORE : PHASE.LISTEN;
    }
function formatInlineFeedbackHtml(result) {
  const word = SCORE_WORD[result.score] || "";
  const txt = FEEDBACK_TEXT[result.score] || "";
  return `<div class="scoreBigWrap">
            <div class="scoreBigLine">${result.score}/5</div>
            <div class="scoreBigWord">${word}</div>
          </div>
          <div class="scoreBelow">
            ${txt}<br/>
            <span class="dim">${result.summaryLine}</span>
          </div>`;
}

function phaseForCycleBeat(cb) {
  const lb = listenBeats();
  const rb = readyBeats();
  const pb = playBeats();
  const sb = scoreBeats();

  if (cb === 0) return PHASE.LISTEN;
  if (cb === lb) return rb > 0 ? PHASE.READY : PHASE.PLAY;
  if (cb === lb + rb) return PHASE.PLAY;
  if (cb === lb + rb + pb) return sb > 0 ? PHASE.SCORE : PHASE.LISTEN;

  return computePhaseFromCycleBeat(cb);
}


  
    function scoreAndUpdateUI(result, mode) {
  scoreState.rounds += 1;
  scoreState.last = result.score;
  scoreState.total += result.score;
  scoreState.avg = scoreState.total / scoreState.rounds;

  scoreState.lastErrMs = result.avgErrMs;
  scoreState.totalAvgErrMs += result.avgErrMs;
  scoreState.avgErrMs = scoreState.totalAvgErrMs / scoreState.rounds;

  scoreState.history.push({
    score: result.score,
    details: result,
    bpm: bpmValue(),
    difficulty: difficulty(),
    rhythmBars: rhythmBars(),
    gapsEnabled: gapsEnabled(),
    timeSig: timeSigValue(),
  });

  setScoreUI();
  setFeedbackGlow(result.score);

  if (mode === "inline") setFeedback(formatInlineFeedbackHtml(result));
}


function scheduleAtAudioTime(targetSec, fn) {
      const ctx = ensureAudio();
      if (!ctx) {
        fn();
        return;
      }
      const delayMs = Math.max(0, (targetSec - ctx.currentTime) * 1000);
      setGameTimeout(fn, delayMs);
    }

    function onPhaseEnter(newPhase, phaseStartSec) {
      if (newPhase === PHASE.LISTEN) {
        currentPattern = pickPattern();
        expectedPlayEvents = [];
        roundHits = [];
        prePlayHits = [];
        captureWindow = null;

        const bars = rhythmBars();
        const pending = !gapsEnabled() ? pendingInlineFeedbackResult : null;
        pendingInlineFeedbackResult = null;

        scheduleAtAudioTime(phaseStartSec, () => {
          setFeedbackGlow(!gapsEnabled() && pending ? pending.score : null);
          setPhase("Listen", "Listen to the rhythm…");

          if (!gapsEnabled() && pending) {
            const fb = formatInlineFeedbackHtml(pending);
            setFeedback(
              `${fb}<div class="dim" style="margin-top:10px">Now listen to the ${bars}-bar rhythm.</div>`
            );
          } else {
            setFeedback(`Listen to the ${bars}-bar rhythm.`);
          }
        });

        const evs = patternTimesSec(currentPattern, phaseStartSec);
        for (const ev of evs) playDrum(ev.i, ev.when);
        return;
      }

      if (newPhase === PHASE.READY) {
        setFeedbackGlow(null);
        setPhase("Get ready!", "Get ready! Next bar is yours.");
        setFeedback("<strong>Get ready!</strong> (you can tap early — we’ll catch it)");
        return;
      }

      if (newPhase === PHASE.PLAY) {
        setFeedbackGlow(null);
        setPhase("Your turn", "Play it back now: Kick (⬅️) / Snare (➡️).");
        setFeedback("Your turn — copy the rhythm!");

        expectedPlayEvents = patternTimesSec(currentPattern, phaseStartSec);

        const bd = beatDurSec();
        const durBeats = playBeats();
        captureWindow = {
          startSec: phaseStartSec - CAPTURE_EARLY_BEATS * bd,
          endSec: phaseStartSec + durBeats * bd + CAPTURE_LATE_BEATS * bd,
        };

        // Backfill hits that occurred just before PLAY started.
        if (prePlayHits.length) {
          roundHits = prePlayHits.filter(
            (h) => h.tSec >= captureWindow.startSec && h.tSec <= captureWindow.endSec
          );
          prePlayHits = [];
        } else {
          roundHits = [];
        }

        setControls();
        return;
      }

      if (newPhase === PHASE.SCORE) {
        setPhase("Score", "Scoring…");
        const result = scoreRound(expectedPlayEvents, roundHits);
        scoreAndUpdateUI(result, "inline");
        setPhase("Score", "Take a breath… next round is coming.");
        setControls();
      }
    }

    function scoreRound(expected, actual) {
      const exp = expected.map((e) => ({ t: e.when, i: e.i })).sort((a, b) => a.t - b.t);
      const act = actual.map((a) => ({ t: a.tSec, i: a.i })).sort((a, b) => a.t - b.t);
  
      const maxMs = SCORING.MATCH_MAX_MS;
  
      const usedAct = new Set();
      const matches = [];
  
      for (let ei = 0; ei < exp.length; ei++) {
        const e = exp[ei];
        let bestIdx = -1;
        let bestErr = Infinity;
  
        for (let ai = 0; ai < act.length; ai++) {
          if (usedAct.has(ai)) continue;
          const a = act[ai];
          if (a.i !== e.i) continue;
  
          const errMs = Math.abs(a.t - e.t) * 1000;
          if (errMs <= maxMs && errMs < bestErr) {
            bestErr = errMs;
            bestIdx = ai;
          }
        }
  
        if (bestIdx >= 0) {
          usedAct.add(bestIdx);
          matches.push({ errMs: bestErr, i: e.i });
        }
      }
  
      const misses = exp.length - matches.length;
      const extras = act.length - usedAct.size;
  
      const avgErrMs = matches.length
        ? matches.reduce((s, m) => s + m.errMs, 0) / matches.length
        : maxMs;
  
      const totalExpected = Math.max(1, exp.length);
      const missPenalty = misses / totalExpected;
      const extraPenalty = extras / totalExpected;
  
      const effectiveErr = avgErrMs * (1 + 0.85 * missPenalty + 0.55 * extraPenalty);
  
      let score = 1;
      if (effectiveErr <= SCORING.TIER_5_MS && misses === 0 && extras === 0) score = 5;
      else if (effectiveErr <= SCORING.TIER_4_MS) score = 4;
      else if (effectiveErr <= SCORING.TIER_3_MS) score = 3;
      else if (effectiveErr <= SCORING.TIER_2_MS) score = 2;
  
      const summaryLine = `Matched ${matches.length}/${exp.length}, Missed ${misses}, Extra ${extras}, Avg timing error ~${Math.round(
        avgErrMs
      )}ms`;
  
      return { score, matches, misses, extras, avgErrMs, effectiveErr, summaryLine };
    }
  
    function scheduleTick() {
      const ctx = ensureAudio();
      if (!ctx || !started) return;
  
      while (nextBeatTimeSec < ctx.currentTime + SCHED_AHEAD_SEC) {
        const thisBeatTimeSec = nextBeatTimeSec;
        const beatIdx = globalBeatIndex;
  
        const bpb = beatsPerBar();
        const inBarIdx = ((beatIdx % bpb) + bpb) % bpb;
        const isDownbeat = inBarIdx === 0;
  
        playMetronomeClick(thisBeatTimeSec, isDownbeat);
  
        const dtMs = Math.max(0, (thisBeatTimeSec - ctx.currentTime) * 1000);
        const phaseForThisBeat = phase === PHASE.COUNTIN ? PHASE.COUNTIN : phaseForCycleBeat(cycleBeatOffset(beatIdx));

        setGameTimeout(() => {
          syncBeatDotsUI(phaseForThisBeat);
          const dotIdx = computeDotIndexForBeat(beatIdx, phaseForThisBeat);
          flashBeatDot(dotIdx, phaseForThisBeat);
        }, dtMs);
  
        if (phase === PHASE.COUNTIN) {
          const shown = Math.max(0, countInRemaining);
          setGameTimeout(() => {
            setPhase("Starting", `Beginning in <strong>${shown}</strong>…`);
            setFeedback(`Beginning in <strong>${shown}</strong>…`);
          }, dtMs);
  
          countInRemaining -= 1;
  
          if (countInRemaining <= 0) {
            phase = PHASE.LISTEN;
            countInAnchorBeat = beatIdx + 1;
            skipPhaseBoundaryBeatIdx = countInAnchorBeat;
            setGameTimeout(() => onPhaseEnter(PHASE.LISTEN, thisBeatTimeSec + beatDurSec()), dtMs);
          }
        } else {
          const cb = cycleBeatOffset(beatIdx);
          const newPhase = computePhaseFromCycleBeat(cb);
  
          const lb = listenBeats();
          const rb = readyBeats();
          const pb = playBeats();
          const sb = scoreBeats();
  
          const boundaryListen = cb === 0;
          const boundaryReadyOrPlay = cb === lb;
          const boundaryPlay = cb === lb + rb;
          const boundaryScoreOrListen = cb === lb + rb + pb;
  
          const isPhaseBoundary =
            (boundaryListen && newPhase === PHASE.LISTEN) ||
            (boundaryReadyOrPlay && (rb > 0 ? newPhase === PHASE.READY : newPhase === PHASE.PLAY)) ||
            (boundaryPlay && newPhase === PHASE.PLAY) ||
            (boundaryScoreOrListen && (sb > 0 ? newPhase === PHASE.SCORE : newPhase === PHASE.LISTEN));

          const skipThisBeatBoundary = skipPhaseBoundaryBeatIdx != null && beatIdx === skipPhaseBoundaryBeatIdx;
          if (skipThisBeatBoundary) skipPhaseBoundaryBeatIdx = null;
  
          if (isPhaseBoundary && !(skipThisBeatBoundary && boundaryListen)) {
            setGameTimeout(() => {
              const prevPhase = phase;
              const endOfPlayNoGaps =
                !gapsEnabled() && boundaryListen && newPhase === PHASE.LISTEN && prevPhase === PHASE.PLAY;

              if (endOfPlayNoGaps) {
                const result = scoreRound(expectedPlayEvents, roundHits);
                scoreAndUpdateUI(result, "silent");
                pendingInlineFeedbackResult = result;
              }

              phase = newPhase;
              onPhaseEnter(newPhase, thisBeatTimeSec);
              setControls();
            }, dtMs);
          }
        }
  
        globalBeatIndex += 1;
        nextBeatTimeSec += beatDurSec();
      }
    }
  
    function startScheduler() {
      if (schedTimer) window.clearInterval(schedTimer);
      schedTimer = window.setInterval(scheduleTick, SCHED_TICK_MS);
    }
  
    function stopScheduler() {
      if (schedTimer) window.clearInterval(schedTimer);
      schedTimer = null;
    }
  
    // ---------------- Input ----------------
    function flashPad(btn) {
      btn.classList.remove("flash");
      btn.offsetWidth;
      btn.classList.add("flash");
    }
  
    function isWithinCaptureWindow(nowSec) {
      if (!captureWindow) return false;
      return nowSec >= captureWindow.startSec && nowSec <= captureWindow.endSec;
    }
  
    
function registerHit(i) {
      const ctx = ensureAudio();
      if (!ctx || !started || paused) return;

      const now = ctx.currentTime;

      playDrum(i, now);
      if (i === "K") flashPad(kickBtn);
      else flashPad(snareBtn);

      // Buffer hits before PLAY so "early" taps right before the PLAY bar still count.
      if (!captureWindow) {
        prePlayHits.push({ tSec: now, i });
        if (prePlayHits.length > 256) prePlayHits.shift();
      }

      if (isWithinCaptureWindow(now)) {
        roundHits.push({ tSec: now, i });
      }
    }

    // Immediate touch/pointer input for pads
    let ignoreClicksUntilTs = 0;
  
    function shouldIgnoreClickNow() {
      return performance.now() < ignoreClicksUntilTs;
    }
  
    function bindImmediatePad(btn, instrument) {
      btn.addEventListener(
        "pointerdown",
        async (e) => {
          if (btn.disabled) return;
  
          e.preventDefault();
          e.stopPropagation();
  
          ignoreClicksUntilTs = performance.now() + GHOST_CLICK_BLOCK_MS;
  
          await resumeAudioIfNeeded();
  
          try {
            if (btn.setPointerCapture && e.pointerId != null) btn.setPointerCapture(e.pointerId);
          } catch {}
  
          registerHit(instrument);
        },
        { passive: false }
      );
  
      btn.addEventListener("click", (e) => {
        if (shouldIgnoreClickNow()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        registerHit(instrument);
      });
    }

    function returnToStartScreen() {
      // 1) stop running stuff
      stopMetronome?.();
      stopPlayback?.();
      clearAllTimers?.(); // if you have one
    
      // 2) reset state
      resetGameState?.(); // or resetGame(), whichever you have
    
      // 3) close other modals (optional, but nice)
      closeModal?.("settingsModal");
      closeModal?.("infoModal");
    
      // 4) show intro
      openModal("introModal");
    
      // 5) ensure the game doesn't instantly resume
      setPaused?.(true); // only if your game uses pause state
    }
  
    // ---------------- Modals ----------------
    async function showInfo() {
      await playUiSelect();
      infoModal?.classList.remove("hidden");
    }
    function hideInfo() {
      infoModal?.classList.add("hidden");
    }
  
    infoBtn?.addEventListener("click", showInfo);
    infoOk?.addEventListener("click", hideInfo);
    infoModal?.addEventListener("click", (e) => {
      if (e.target === infoModal) hideInfo();
    });


    // Intro modal (start screen)
    function showIntro() {
      introModal?.classList.remove("hidden");
      introGotIt?.focus?.();
      postHeightNow();
    }
    function hideIntro() {
      introModal?.classList.add("hidden");
      beginBtn?.focus?.();
      postHeightNow();
    }

    introGotIt?.addEventListener("click", () => {
      hideIntro();
    });

    introSettings?.addEventListener("click", async () => {
      hideIntro();
      await openRhythmSettings();
    });

    introModal?.addEventListener("click", (e) => {
      if (e.target === introModal) hideIntro();
    });

    window.addEventListener("load", () => {
      // Show the start screen once the layout is stable.
      setTimeout(showIntro, 80);
    });
  

function isRhythmSettingsOpen() {
  return !rhythmSettingsModal.classList.contains("hidden");
}

const SETTINGS_CLOSE_LABEL = "Close";
const SETTINGS_RESTART_LABEL = "Restart Game With New Settings";

let settingsModalCommitted = null;
let settingsModalWasStarted = false;
let settingsModalWasPaused = false;
let settingsModalPausedByUs = false;

function readSettingsSnapshot() {
  return {
    timeSig: timeSigValue(),
    rhythmLen: String(rhythmBars()),
    gaps: gapsEnabled(),
    difficulty: difficulty(),
    bpm: bpmValue(),
  };
}

function applySettingsSnapshot(s) {
  if (!s) return;
  timeSigSel.value = s.timeSig;
  rhythmLenSel.value = s.rhythmLen;
  gapsToggle.checked = !!s.gaps;
  difficultySel.value = s.difficulty;
  bpmRange.value = String(s.bpm);
  bpmNum.value = String(s.bpm);
}

function settingsEqual(a, b) {
  if (!a || !b) return true;
  return (
    a.timeSig === b.timeSig &&
    a.rhythmLen === b.rhythmLen &&
    !!a.gaps === !!b.gaps &&
    a.difficulty === b.difficulty &&
    Number(a.bpm) === Number(b.bpm)
  );
}

function updateRhythmSettingsCloseLabel() {
  const current = readSettingsSnapshot();
  const dirty = settingsModalCommitted ? !settingsEqual(current, settingsModalCommitted) : false;
  rhythmSettingsClose.textContent = dirty ? SETTINGS_RESTART_LABEL : SETTINGS_CLOSE_LABEL;
  return dirty;
}

async function openRhythmSettings() {
  settingsModalCommitted = readSettingsSnapshot();
  settingsModalWasStarted = started;
  settingsModalWasPaused = paused;
  settingsModalPausedByUs = false;

  syncSettingsButtonA11y();
  syncSettingsButtonsUI();

  if (started && !paused) {
    settingsModalPausedByUs = true;
    await pauseGame("settings");
  }

  await playUiSelect();

  updateRhythmSettingsCloseLabel();
  rhythmSettingsModal.classList.remove("hidden");
  rhythmSettingsClose.focus();
}

async function cancelRhythmSettings() {
  if (!isRhythmSettingsOpen()) return;

  applySettingsSnapshot(settingsModalCommitted);
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  updateRhythmSettingsCloseLabel();

  rhythmSettingsModal.classList.add("hidden");

  const shouldResume = settingsModalPausedByUs && !settingsModalWasPaused;

  settingsModalCommitted = null;
  settingsModalWasStarted = false;
  settingsModalWasPaused = false;
  settingsModalPausedByUs = false;

  if (shouldResume) await resumeGame();
}

async function commitRhythmSettings() {
  const dirty = updateRhythmSettingsCloseLabel();

  rhythmSettingsModal.classList.add("hidden");

  const wasStarted = settingsModalWasStarted;
  const wasPaused = settingsModalWasPaused;
  const pausedByUs = settingsModalPausedByUs;

  settingsModalCommitted = null;
  settingsModalWasStarted = false;
  settingsModalWasPaused = false;
  settingsModalPausedByUs = false;

  if (!dirty) {
    if (pausedByUs && !wasPaused) await resumeGame();
    return;
  }


  saveSettings();
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  syncBeatDotsUI();
  setFeedback("Restarting game with new settings…");

  if (wasStarted) {
    await restartGame();
    if (wasPaused) await pauseGame("user");
  } else {
    hardResetState();
    syncBpmInputs(bpmNum);
  }
}
    function syncSettingsButtonsUI() {
      const ts = timeSigValue();
      const rl = String(rhythmBars());
      const g = gapsEnabled() ? "1" : "0";
      const d = difficulty();

      rhythmSettingsModal
        .querySelectorAll("button[data-ts]")
        .forEach((b) => {
          const v = b.getAttribute("data-ts");
          const on = v === ts;
          b.classList.toggle("selected", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });

      rhythmSettingsModal
        .querySelectorAll("button[data-rl]")
        .forEach((b) => {
          const v = b.getAttribute("data-rl");
          const on = v === rl;
          b.classList.toggle("selected", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });

      rhythmSettingsModal
        .querySelectorAll("button[data-gaps]")
        .forEach((b) => {
          const v = b.getAttribute("data-gaps");
          const on = v === g;
          b.classList.toggle("selected", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });

      difficultyOptions
        .querySelectorAll("button[data-diff]")
        .forEach((b) => {
          const v = b.getAttribute("data-diff");
          b.classList.toggle("selected", v === d);
        });
    }

  
    rhythmSettingsBtn.addEventListener("click", openRhythmSettings);
    rhythmSettingsClose.addEventListener("click", commitRhythmSettings);
    
    rhythmSettingsModal.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("button") : null;
      if (!btn) return;

      const ts = btn.getAttribute("data-ts");
      if (ts === "3/4" || ts === "4/4") {
        timeSigSel.value = ts;
        timeSigSel.dispatchEvent(new Event("change", { bubbles: true }));
        syncSettingsButtonsUI();
        return;
      }

      const rl = btn.getAttribute("data-rl");
      if (rl === "1" || rl === "2") {
        rhythmLenSel.value = rl;
        rhythmLenSel.dispatchEvent(new Event("change", { bubbles: true }));
        syncSettingsButtonsUI();
        return;
      }

      const g = btn.getAttribute("data-gaps");
      if (g === "0" || g === "1") {
        gapsToggle.checked = g === "1";
        gapsToggle.dispatchEvent(new Event("change", { bubbles: true }));
        syncSettingsButtonsUI();
        return;
      }
    });

rhythmSettingsModal.addEventListener("click", (e) => {
      if (e.target === rhythmSettingsModal) cancelRhythmSettings();
    });
  
    difficultyOptions.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("button[data-diff]") : null;
      const d = btn?.getAttribute("data-diff");
      if (!d) return;
  
      difficultySel.value = d;
      difficultySel.dispatchEvent(new Event("change", { bubbles: true }));
      syncSettingsButtonA11y();
      syncSettingsButtonsUI();
      updateRhythmSettingsCloseLabel();
    });
  
    // ---------------- Scorecard PNG ----------------
    function downloadBlob(blob, filename) {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  
    function canvasToPngBlob(canvas) {
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    }
  
    function drawCardBase(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fbfbfc";
      ctx.fillRect(0, 0, w, h);
  
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
  
      ctx.fillStyle = "#111";
      ctx.fillRect(8, 8, w - 16, 74);
    }
  
    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = String(text).split(/\s+/);
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x, y);
    }
  
    function getPlayerName() {
      const prev = localStorage.getItem("hol_player_name") || "";
      const name = window.prompt("Enter your name for the score card:", prev) ?? "";
      const trimmed = String(name).trim();
      if (trimmed) localStorage.setItem("hol_player_name", trimmed);
      return trimmed || "Player";
    }
  
    async function downloadScoreCardPng(playerName, snapshot) {
      const w = 760;
      const h = 560;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
  
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
  
      drawCardBase(ctx, w, h);
  
      ctx.fillStyle = "#fff";
      ctx.font = "900 30px Arial";
      ctx.fillText("Got Rhythm — Scorecard", 28, 56);
  
      const bodyX = 28;
      const bodyY = 130;
  
      ctx.fillStyle = "#111";
      ctx.font = "900 22px Arial";
      ctx.fillText("Summary", bodyX, bodyY);
  
      ctx.font = "700 20px Arial";
      const snap = snapshot || getBestScorecardSnapshot();
  
      const lines = [
        `Name: ${playerName}`,
        `Difficulty: ${snap.difficultyText}`,
        `Metronome: ${snap.bpm} bpm`,
        `Rounds played: ${snap.rounds}`,
        `Average score: ${snap.avgText}`,
        `Last score: ${snap.lastText}`,
        `Avg ms accuracy: ${snap.avgErrMsText}`,
      ];
  
      let y = bodyY + 44;
      for (const ln of lines) {
        if (ln === "") {
          y += 16;
          continue;
        }
        if (y > h - 90) break;
        drawWrappedText(ctx, ln, bodyX, y, w - 56, 28);
        y += 32;
      }
  
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.font = "700 16px Arial";
      ctx.fillText("Downloaded from www.eartraininglab.com 🥁", bodyX, h - 36);
  
      const blob = await canvasToPngBlob(canvas);
      if (blob) downloadBlob(blob, "Got Rhythm Scorecard.png");
    }
  
    async function onDownloadScoreCard() {
      const name = getPlayerName();
      const snap = getBestScorecardSnapshot();
      await downloadScoreCardPng(name, snap);
    }
  
    // ---------------- Controls / lifecycle ----------------
    function hardResetState() {
      started = false;
      paused = false;
  
      stopScheduler();
      stopAllAudio(0.06);
  
      phase = PHASE.COUNTIN;
      countInRemaining = beatsPerBar();
      globalBeatIndex = 0;
      countInAnchorBeat = 0;
  
      currentPattern = [];
      expectedPlayEvents = [];
      roundHits = [];
      prePlayHits = [];

      captureWindow = null;

      pendingInlineFeedbackResult = null;
  
      scoreState.rounds = 0;
      scoreState.last = null;
      scoreState.total = 0;
      scoreState.avg = 0;
      scoreState.history = [];
      scoreState.totalAvgErrMs = 0;
      scoreState.avgErrMs = 0;
      scoreState.lastErrMs = null;
  
      setScoreUI();
      setFeedbackGlow(null);
  
      setPhase("Ready", "Press <strong>Begin Game</strong> to start.");
      setFeedback("Press <strong>Begin Game</strong> to start.");
      beatDots.forEach((d) => d.classList.remove("on"));
  
      beginBtn.hidden = false;
      beginBtn.textContent = "Begin Game";
      pauseBtn.textContent = "Pause (Space)";
      beginBtn.classList.add("pulse");
  
      syncBeatDotsUI(PHASE.COUNTIN);
      setControls();
    }
  
    async function beginGame() {
      await preloadAudio();
      await resumeAudioIfNeeded();
  
      const ctx = ensureAudio();
      if (!ctx) return;
  
      started = true;
      paused = false;
  
      beginBtn.hidden = true;
      beginBtn.classList.remove("pulse");
  
      phase = PHASE.COUNTIN;
      countInRemaining = beatsPerBar();
      globalBeatIndex = 0;
      countInAnchorBeat = 0;
  
      currentPattern = [];
      expectedPlayEvents = [];
      roundHits = [];
      prePlayHits = [];

      captureWindow = null;

      pendingInlineFeedbackResult = null;
  
      nextBeatTimeSec = ctx.currentTime + 0.10;
  
      setScoreUI();
      setFeedbackGlow(null);
      setPhase("Starting", `Beginning in <strong>${beatsPerBar()}</strong>…`);
      setFeedback(`Beginning in <strong>${beatsPerBar()}</strong>…`);
  
      syncBeatDotsUI(PHASE.COUNTIN);
      setControls();
      startScheduler();
    }
  
    async function restartGame() {
      stopAllAudio(0.06);
      stopScheduler();
  
      scoreState.rounds = 0;
      scoreState.last = null;
      scoreState.total = 0;
      scoreState.avg = 0;
      scoreState.history = [];
      scoreState.totalAvgErrMs = 0;
      scoreState.avgErrMs = 0;
      scoreState.lastErrMs = null;
  
      setScoreUI();
      setFeedbackGlow(null);
  
      await beginGame();
    }


function rewindOneScheduledBeatIfNeeded(ctx) {
  const bd = beatDurSec();
  const lastBeatTimeSec = nextBeatTimeSec - bd;
  if (!Number.isFinite(lastBeatTimeSec)) return;
  if (ctx && lastBeatTimeSec > ctx.currentTime + 0.002) {
    nextBeatTimeSec = lastBeatTimeSec;
    globalBeatIndex = Math.max(0, globalBeatIndex - 1);
  }
}

async function pauseGame(reason = "user") {
  if (!started || paused) return;

  const ctx = ensureAudio();
  paused = true;
  pauseBtn.textContent = "Continue";

  clearGameTimeouts();
  stopScheduler();
  if (ctx) rewindOneScheduledBeatIfNeeded(ctx);

  if (reason === "settings") {
    setPhase("Paused", "Game paused while you change settings.");
    setFeedback("Paused for settings.");
  } else {
    setPhase("Paused", "Press <strong>Continue</strong> to resume exactly where you left off.");
    setFeedback("Paused.");
  }

  setControls();

  if (reason === "settings") {
    // Don't suspend the AudioContext here; it can delay UI sounds.
    stopAllAudio(0.03);
    return;
  }

  try { if (ctx) await ctx.suspend(); } catch {}
}

async function resumeGame() {
  if (!started || !paused) return;

  const ctx = ensureAudio();
  try { if (ctx) await ctx.resume(); } catch {}

  paused = false;
  pauseBtn.textContent = "Pause (Space)";
  setControls();

  if (ctx) nextBeatTimeSec = Math.max(nextBeatTimeSec, ctx.currentTime + 0.02);
  startScheduler();
}  

async function togglePause() {
  if (!started) return;
  if (paused) await resumeGame();
  else await pauseGame("user");
}
    function showSummary() {
      lastScorecardSnapshot = makeScorecardSnapshot();
      const snap = lastScorecardSnapshot;
  
      const lines = [
        `Rounds played: ${snap.rounds}`,
        `Average score: ${snap.avgText}`,
        "",
        snap.finalText,
      ];
  
      summaryBody.textContent = lines.join("\n");
      summaryModal.classList.remove("hidden");
      summaryClose.focus();
    }
  
    function hideSummary() {
      summaryModal.classList.add("hidden");
    }
  
    function stopAndReset() {
      playUiBack();
hardResetState();
      showIntro();
    }
  
    // ---------------- Events ----------------
    function syncBpmInputs(from) {
      const v = clamp(Number(from.value), 40, 140);
      bpmRange.value = String(v);
      bpmNum.value = String(v);
  
      syncSettingsButtonA11y();
      if (isRhythmSettingsOpen()) {
        updateRhythmSettingsCloseLabel();
        return;
      }
      const ctx = ensureAudio();
      if (ctx && started && !paused) {
        nextBeatTimeSec = Math.max(nextBeatTimeSec, ctx.currentTime + 0.05);
      }
    }
  
    bpmRange.addEventListener("input", () => syncBpmInputs(bpmRange));
    bpmNum.addEventListener("input", () => syncBpmInputs(bpmNum));
  
    beginBtn.addEventListener("click", async () => {
      if (!started) await beginGame();
    });
  
    pauseBtn.addEventListener("click", togglePause);
    stopBtn.addEventListener("click", stopAndReset);
  
    downloadScoreBtn.addEventListener("click", onDownloadScoreCard);
    summaryDownload.addEventListener("click", onDownloadScoreCard);
  
    bindImmediatePad(kickBtn, "K");
    bindImmediatePad(snareBtn, "S");
  
    function isTypingTarget(t) {
      return t instanceof Element && !!t.closest("input, textarea, select, [contenteditable='true']");
    }
  
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && started && !isTypingTarget(e.target)) {
        e.preventDefault();
        togglePause();
        return;
      }
  
      if (e.repeat) return;
      if (!started || paused) return;
  
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        registerHit("K");
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        registerHit("S");
        return;
      }
    });
  
    timeSigSel.addEventListener("change", async () => {
  if (isRhythmSettingsOpen()) {
    syncSettingsButtonA11y();
    syncSettingsButtonsUI();
    updateRhythmSettingsCloseLabel();
    return;
  }
  saveSettings();
  syncBeatDotsUI();
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  setFeedback("Time signature updated — restarting game to apply it.");
  if (started) await restartGame();
  else {
    hardResetState();
    syncBpmInputs(bpmNum);
  }
});
  
    rhythmLenSel.addEventListener("change", async () => {
  if (isRhythmSettingsOpen()) {
    syncSettingsButtonA11y();
    syncSettingsButtonsUI();
    updateRhythmSettingsCloseLabel();
    return;
  }
  saveSettings();
  syncBeatDotsUI();
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  setFeedback("Rhythm length updated — restarting game to apply it.");
  if (started) await restartGame();
  else {
    hardResetState();
    syncBpmInputs(bpmNum);
  }
});
  
    gapsToggle.addEventListener("change", async () => {
  if (isRhythmSettingsOpen()) {
    syncSettingsButtonA11y();
    syncSettingsButtonsUI();
    updateRhythmSettingsCloseLabel();
    return;
  }
  saveSettings();
  syncBeatDotsUI();
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  setFeedback("In-between bars updated — restarting game to apply it.");
  if (started) await restartGame();
  else {
    hardResetState();
    syncBpmInputs(bpmNum);
  }
});
  
    difficultySel.addEventListener("change", () => {
  syncSettingsButtonA11y();
  syncSettingsButtonsUI();
  updateRhythmSettingsCloseLabel();
  if (!isRhythmSettingsOpen()) {
    setFeedback("Difficulty updated — it will apply from the next round.");
  }
});
  
    summaryClose.addEventListener("click", hideSummary);
    summaryModal.addEventListener("click", (e) => {
      if (e.target === summaryModal) hideSummary();
    });
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (infoModal && !infoModal.classList.contains("hidden")) hideInfo();
        if (!rhythmSettingsModal.classList.contains("hidden")) cancelRhythmSettings();
        if (!summaryModal.classList.contains("hidden")) hideSummary();
      }
    });
  
    // ---------------- Init ----------------
    loadSettings();
    hardResetState();
    syncBeatDotsUI(PHASE.COUNTIN);
    syncSettingsButtonA11y();
    syncSettingsButtonsUI();
    syncBpmInputs(bpmNum);
  })();
  