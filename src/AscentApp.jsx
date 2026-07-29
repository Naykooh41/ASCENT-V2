/* ASCENT — application complète (vraie app)
   Persistance localStorage · bascule de journée · IA via /api/claude · PWA
*/
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import {
  Flame, Droplets, Dumbbell, Smile, CheckCircle2, Puzzle, ChevronRight, ChevronLeft, Mountain, Map, Ghost,
  Lock, Sparkles, Sunrise, Sun, Sunset, Moon, PenLine, Feather, Plus, X, Timer, Trophy, Play, Check,
  Coffee, BedDouble, Trash2, Settings, ChevronUp, Wind, ListChecks, CalendarClock,
  BarChart3, Target, Heart, Copy, Download, Mail, Pencil, Camera, TrendingDown, TrendingUp,
  Mic, Volume2, VolumeX, BookOpen, HelpCircle, FileText, Wrench, Crown, Flag, Bot, Gift, DoorOpen
} from "lucide-react";
const WorldScene = lazy(() => import("./WorldScene.jsx")); /* three.js chargé seulement quand le Parcours s'ouvre */
const Companion3D = lazy(() => import("./Companion3D.jsx")); /* le compagnon 3D, chargé à l'ouverture de sa page */

/* ================= VRAIE APP : PERSISTANCE, JOURNÉE, IA ================= */
const STORAGE_KEY = "ascent-v2";
const todayKey = () => new Date().toISOString().slice(0, 10);

async function askAI({ prompt, maxTokens = 800, images = [] }) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens, images }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "IA indisponible");
  return d.text || "";
}
function jsonTolerant(t) {
  try { return JSON.parse(String(t).replace(/```json|```/g, "").trim()); } catch (e) {}
  const m = String(t).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

/* Score du jour — même formule que l'écran phare, utilisable au rollover */
function calculerScore(a) {
  const habAct = (a.habitudes || []).filter((h) => !(h.repos || []).includes(a.jour));
  const habPct = habAct.length ? habAct.filter((h) => h.fait).length / habAct.length : 1;
  const tacAct = (a.taches || []).filter((t) => !t.demain);
  const tacPct = tacAct.length ? tacAct.filter((t) => t.fait).length / tacAct.length : 1;
  const repasPct = (a.repas || []).length ? a.repas.filter((r) => r.fait).length / a.repas.length : 0;
  let s = 0;
  if (a.humeur != null) s += 15;
  if (a.seanceFaite) s += 25;
  s += habPct * 15;
  s += tacPct * 10;
  s += repasPct * 20;
  s += Math.min(1, (a.eau || 0) / (a.objEau || 8)) * 10;
  if ((a.journal || "").length > 10) s += 5;
  return Math.round(s);
}

/* Photographie de la journée écoulée, archivée à la bascule */
function resumeJour(a) {
  const habAct = (a.habitudes || []).filter((h) => !(h.repos || []).includes(a.jour));
  return {
    d: a.dateJour,
    score: calculerScore(a),
    humeur: a.humeur ?? null,
    seance: !!a.seanceFaite,
    hab: habAct.length ? Math.round((100 * habAct.filter((h) => h.fait).length) / habAct.length) : null,
    eau: a.eau || 0,
  };
}

/* Bascule de journée : streaks, semaine glissante, remise à zéro douce du quotidien */
function basculerJour(a) {
  const t = todayKey();
  const jourNow = new Date().getDay();
  if (a.dateJour === t) return { ...a, jour: jourNow };
  const hier = new Date(Date.now() - 86400000).getDay();
  const habitudes = (a.habitudes || []).map((h) => {
    const reposHier = (h.repos || []).includes(hier);
    const streak = h.fait ? (h.streak || 0) + 1 : reposHier ? h.streak || 0 : 0;
    const semaine = [...(h.semaine || [0,0,0,0,0,0,0]).slice(1), h.fait ? 1 : reposHier ? 2 : 0];
    return { ...h, fait: false, streak, semaine };
  });
  const taches = (a.taches || []).filter((x) => !x.fait).map((x) => ({ ...x, demain: false }));
  return {
    ...a,
    dateJour: t, jour: jourNow,
    humeur: null, eau: 0, cafe: 0,
    intention: "", energie: 0, victoire: "", difficulte: "", journal: "", gratitude: [],
    sommeil: { duree: "", qualite: 0 },
    repas: (a.repas || []).map((r) => ({ ...r, fait: false })),
    habitudes, taches,
    enigmes: Array.from({ length: 5 }, () => ({ fait: false, indice: false })),
    seanceFaite: false,
    coachBilan: a.coachBilan, coachLoad: false,
    historique: [...(a.historique || []), resumeJour(a)].slice(-400),
  };
}

function chargerEtat(defauts) {
  const secours = { app: defauts, modsOff: ["cycle"], skyMode: "auto", vibrOn: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return secours;
    const st = JSON.parse(raw);
    const sa = st.app || {};
    const app = {
      ...defauts, ...sa,
      cosm: { ...defauts.cosm, ...(sa.cosm || {}) },
      cycle: { ...defauts.cycle, ...(sa.cycle || {}) },
      sommeil: { ...defauts.sommeil, ...(sa.sommeil || {}) },
      photos: { ...defauts.photos, ...(sa.photos || {}) },
      niveauxC: { ...defauts.niveauxC, ...(sa.niveauxC || {}) },
      templates: { ...defauts.templates, ...(sa.templates || {}) },
      notesVocales: [],
    };
    return {
      app: basculerJour(app),
      modsOff: Array.isArray(st.modsOff) ? st.modsOff : ["cycle"],
      skyMode: st.skyMode || "auto",
      vibrOn: st.vibrOn !== false,
    };
  } catch (e) { return secours; }
}


/* ================= ASCENT — Prototype complet v3 =================
   6 pages swipables : Aujourd'hui · Corps · Esprit · Habitudes · Parcours · Compagnon
   Modules fonctionnels : score/altitude vivant, séance en direct (poids ± , repos auto,
   PR, récap), repas + calories, humeur/gratitude/journal privé, habitudes avec jours
   de repos, XP + balises, compagnon interactif, ciel selon l'heure, célébrations.
   NOTE prototype : données en mémoire (pas de persistance possible dans l'aperçu),
   IA non branchée (nécessite la route serveur Vercel). Décimales à virgule et champs
   vides gérés dans les saisies de poids/calories.
=================================================================== */

const C = {
  glacier: "#8FE3F0",
  aube: "#FFB86B",
  neige: "#EAF2FF",
  vert: "#9BE8B0",
  brume: "rgba(255,255,255,0.07)",
  bord: "rgba(255,255,255,0.13)",
  doux: "rgba(234,242,255,0.65)",
  encre: "#0A0F28",
};
const FONT_D = "'Unbounded', sans-serif";
const FONT_B = "'Outfit', sans-serif";

const SKIES = {
  aube: { label: "Aube", icon: Sunrise, grad: "linear-gradient(180deg,#191F4E 0%,#3A3E7A 42%,#A05E56 76%,#E8A45C 100%)", v1: "#3B3568", v2: "#2A2750", v3: "#1C1A3C", stars: 0.35, card: "rgba(34,28,64,0.78)", card2: "rgba(34,28,64,0.55)", orb: { color: "#FFD9A0", x: "22%", y: "30%", size: 90, blur: 30, op: 0.8 } },
  jour: { label: "Jour", icon: Sun, grad: "linear-gradient(180deg,#2A5AA8 0%,#4A85CC 55%,#8FBCE6 100%)", v1: "#4C6FA8", v2: "#37538A", v3: "#263A66", stars: 0, card: "rgba(22,40,78,0.78)", card2: "rgba(22,40,78,0.55)", orb: { color: "#FFF4D6", x: "78%", y: "14%", size: 70, blur: 24, op: 0.9 } },
  crepuscule: { label: "Crépuscule", icon: Sunset, grad: "linear-gradient(180deg,#141233 0%,#3E2658 55%,#B05E48 100%)", v1: "#45356A", v2: "#322650", v3: "#201838", stars: 0.55, card: "rgba(30,20,52,0.78)", card2: "rgba(30,20,52,0.55)", orb: { color: "#FF9E6B", x: "70%", y: "58%", size: 80, blur: 32, op: 0.7 } },
  nuit: { label: "Nuit", icon: Moon, grad: "linear-gradient(180deg,#070B1E 0%,#101736 40%,#1A2450 75%,#2A3866 100%)", v1: "#1C2752", v2: "#131B3E", v3: "#0C1230", stars: 1, card: "rgba(12,18,46,0.78)", card2: "rgba(12,18,46,0.55)", orb: { color: "#DCE8FF", x: "80%", y: "10%", size: 46, blur: 14, op: 0.65 } },
};
const SKY_ORDER = ["aube", "jour", "crepuscule", "nuit"];
const skyFromHour = (h) => (h >= 5 && h < 10 ? "aube" : h >= 10 && h < 17 ? "jour" : h >= 17 && h < 21 ? "crepuscule" : "nuit");

/* --- sentier --- */
const TRAIL = [[70,300],[122,258],[100,216],[162,182],[146,142],[218,112],[204,76],[288,46]];
const TRAIL_SEGS = (() => { const segs = []; let total = 0; for (let i = 1; i < TRAIL.length; i++) { const l = Math.hypot(TRAIL[i][0]-TRAIL[i-1][0], TRAIL[i][1]-TRAIL[i-1][1]); segs.push(l); total += l; } return { segs, total }; })();
function trailPoint(f) {
  let d = Math.max(0, Math.min(1, f)) * TRAIL_SEGS.total;
  for (let i = 0; i < TRAIL_SEGS.segs.length; i++) {
    const l = TRAIL_SEGS.segs[i];
    if (d <= l) { const t = d / l; return [TRAIL[i][0]+(TRAIL[i+1][0]-TRAIL[i][0])*t, TRAIL[i][1]+(TRAIL[i+1][1]-TRAIL[i][1])*t]; }
    d -= l;
  }
  return TRAIL[TRAIL.length-1];
}

const PHRASES = ["On grimpe bien aujourd'hui ✨","Chaque pas compte, tu sais.","Le sommet n'attend que nous.","T'as pensé à boire un verre d'eau ?","Fier de toi. Vraiment.","Encore un petit effort !"];
const JOURS = ["D","L","M","M","J","V","S"];
const TIPS = {
  auj: "Glisse ⟷ pour changer de carte · touche Nimbo, il réagit",
  corps: "Lance ta séance : chaque série cochée → poids puis repos auto",
  esprit: "Ton journal est strictement privé — jamais lu par l'IA",
  habitudes: "Glisse une ligne → pour faire · ← pour supprimer",
  parcours: "Ton XP fait avancer la balise · scelle une lettre à ton futur toi",
  stats: "Le point du jour est vivant — il monte avec tes actions",
  cycle: "Estimations indicatives, pas un avis médical",
  compagnon: "Ouvre le vestiaire, et choisis ton compagnon actif dans la cordée",
  defis: "Chaque +1 te rapproche de la récompense du défi",
  coach: "Le coach lit ta semaine — jamais ton journal privé",
};

/* --- utilitaires saisie --- */
const parseNum = (v) => { if (v === "" || v == null) return null; const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
const fmtKg = (n) => (n == null ? "—" : String(n).replace(".", ","));
let VIBR_ON = true;
const vibrate = (ms) => { try { VIBR_ON && navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ================= Compagnon 2D ================= */
const hatE = (id) => { const h = HATS.find((x) => x.id === id); return h ? h.e : null; };
const auraC = (id) => { const a = AURAS.find((x) => x.id === id); return a ? a.c : "#8FE3F0"; };
function Nimbo({ size = 56, mood = "calm", reacting = null, onTap, hat = null, aura = "#8FE3F0", body = "#E9F0FE" }) {
  const gid = "ng" + String(aura).replace(/[^a-zA-Z0-9]/g, "");
  const eyes = () => {
    if (mood === "happy") return (<g stroke="#2A335C" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M32 50 Q38 43 44 50" /><path d="M56 50 Q62 43 68 50" /></g>);
    if (mood === "surprised") return (<g fill="#2A335C"><circle cx="38" cy="49" r="6" /><circle cx="62" cy="49" r="6" /><circle cx="50" cy="66" r="4.5" fill="#3A4670" /></g>);
    if (mood === "wink") return (<g><ellipse cx="38" cy="50" rx="4" ry="5.5" fill="#2A335C" /><path d="M56 50 Q62 45 68 50" stroke="#2A335C" strokeWidth="4" fill="none" strokeLinecap="round" /></g>);
    if (mood === "sleepy") return (<g stroke="#2A335C" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M32 51 Q38 56 44 51" /><path d="M56 51 Q62 56 68 51" /><text x="74" y="34" fontSize="13" fill="#8FE3F0" fontFamily="sans-serif">z</text><text x="82" y="24" fontSize="10" fill="#8FE3F0" fontFamily="sans-serif">z</text></g>);
    if (mood === "focused") return (<g stroke="#2A335C" strokeWidth="4.5" strokeLinecap="round"><line x1="31" y1="49" x2="44" y2="51" /><line x1="56" y1="51" x2="69" y2="49" /></g>);
    if (mood === "proud") return (<g><path d="M32 50 Q38 43 44 50" stroke="#2A335C" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M56 50 Q62 43 68 50" stroke="#2A335C" strokeWidth="4" fill="none" strokeLinecap="round" /><text x="70" y="30" fontSize="12" fill="#FFB86B">✦</text></g>);
    return (<g className="nimbo-blink" style={{ transformOrigin: "50px 50px" }}><ellipse cx="38" cy="50" rx="4" ry="5.5" fill="#2A335C" /><ellipse cx="62" cy="50" rx="4" ry="5.5" fill="#2A335C" /></g>);
  };
  return (
    <div onClick={onTap} className={reacting ? `nimbo-${reacting}` : "nimbo-float"} style={{ position: "relative", width: size, height: size, cursor: onTap ? "pointer" : "default", touchAction: "manipulation" }} role={onTap ? "button" : undefined} aria-label="Nimbo">
      {hat && (
        <div style={{ position: "absolute", top: -size * 0.18, left: "50%", transform: "translateX(-50%) rotate(-8deg)", fontSize: size * 0.34, lineHeight: 1, zIndex: 2, pointerEvents: "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}>{hat}</div>
      )}
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs><radialGradient id={gid} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={aura} stopOpacity="0.55" /><stop offset="100%" stopColor={aura} stopOpacity="0" /></radialGradient></defs>
        <circle cx="50" cy="52" r="48" fill={`url(#${gid})`} />
        <path d="M50 10 C74 10 88 30 88 54 L88 76 C88 83 81 86 77 81 C73 77 69 86 63 84 C57 82 55 89 50 89 C45 89 43 82 37 84 C31 86 27 77 23 81 C19 86 12 83 12 76 L12 54 C12 30 26 10 50 10 Z" fill={body} />
        {eyes()}
        {mood !== "surprised" && <path d="M44 64 Q50 69 56 64" stroke="#3A4670" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
        <circle cx="28" cy="60" r="4.5" fill="#FFB6C9" opacity="0.55" /><circle cx="72" cy="60" r="4.5" fill="#FFB6C9" opacity="0.55" />
      </svg>
    </div>
  );
}

/* ================= Briques UI ================= */
function Glass({ children, style, className = "", onClick, pressable }) {
  return (
    <div onClick={onClick} className={"rounded-3xl " + (pressable || onClick ? "pressable " : "") + className}
      style={{ background: C.brume, border: `1px solid ${C.bord}`, ...style }}>
      {children}
    </div>
  );
}
function TitrePage({ children, sous }) {
  return (<div className="pt-5"><div style={{ fontFamily: FONT_D, fontSize: 17, color: C.neige }}>{children}</div>{sous && <div style={{ fontSize: 12.5, color: C.doux, marginTop: 3 }}>{sous}</div>}</div>);
}
function Bouton({ children, onClick, couleur = C.glacier, style }) {
  return (<button className="pressable" onClick={onClick} style={{ fontFamily: FONT_B, fontSize: 13, fontWeight: 700, color: C.encre, background: couleur, border: "none", borderRadius: 14, padding: "11px 16px", ...style }}>{children}</button>);
}
function Champ({ value, onChange, placeholder, type = "text", style }) {
  return (<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={type === "num" ? "decimal" : undefined}
    style={{ fontFamily: FONT_B, fontSize: 14, color: C.neige, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 12, padding: "11px 13px", outline: "none", width: "100%", ...style }} />);
}

/* --- Confettis --- */
function Confetti({ burst }) {
  const parts = useMemo(() => {
    if (!burst) return [];
    const cols = [C.glacier, C.aube, C.vert, "#FFB6C9", C.neige];
    return Array.from({ length: 26 }).map((_, i) => ({
      id: burst + "-" + i,
      x: (Math.random() - 0.5) * 260, y: -(120 + Math.random() * 220),
      r: Math.random() * 720 - 360, c: cols[i % cols.length],
      d: 0.9 + Math.random() * 0.5, s: 6 + Math.random() * 6,
    }));
  }, [burst]);
  if (!burst) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 60 }}>
      {parts.map((p) => (
        <div key={p.id} className="confetti" style={{
          left: "50%", top: "55%", width: p.s, height: p.s * 0.6, background: p.c, borderRadius: 2,
          "--tx": `${p.x}px`, "--ty": `${p.y}px`, "--rr": `${p.r}deg`, animationDuration: `${p.d}s`,
        }} />
      ))}
    </div>
  );
}

/* ================= PAGE : AUJOURD'HUI ================= */
function PageAujourdhui({ app, act, sky, skyKey, nimbo, phrase }) {
  const score = app.score;
  const pos = useMemo(() => trailPoint(score / 100), [score]);
  const summit = TRAIL[TRAIL.length - 1];
  const altitude = Math.round(score * 10);
  const cta = (skyKey === "crepuscule" || skyKey === "nuit")
    ? { icon: <Moon size={18} />, titre: "Écris ton ressenti du soir", sous: "2 minutes pour clore la journée", page: 2 }
    : skyKey === "aube"
    ? { icon: <Sunrise size={18} />, titre: "Pose ton intention du matin", sous: "Un cap clair avant de grimper", page: 2 }
    : { icon: <PenLine size={18} />, titre: "Note ton humeur", sous: "Comment tu te sens, là ?", page: 2 };

  const habActives = app.habitudes.filter((h) => !h.repos.includes(app.jour));
  const habFaites = habActives.filter((h) => h.fait).length;
  const repasFaits = app.repas.filter((r) => r.fait).length;

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: 28 }}>
      <div className="flex items-center justify-between px-5 pt-5" style={{ paddingRight: 64 }}>
        <div>
          <div style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: "0.3em", color: C.neige }}>ASCENT</div>
          <div style={{ fontSize: 12, color: C.doux, marginTop: 2 }}>{app.prenom ? `Salut ${app.prenom} · ` : ""}Mardi 28 juillet</div>
        </div>
        <Glass className="flex items-center gap-1 px-3 py-1" style={{ borderRadius: 999 }}>
          <Flame size={15} style={{ color: C.aube }} className="flame-pulse" /><span style={{ fontSize: 13, fontWeight: 700, color: C.neige }}>12</span>
        </Glass>
      </div>

      {/* Héros */}
      <div className="relative mx-2 mt-1" style={{ height: 330 }}>
        <svg viewBox="0 0 390 330" width="100%" height="330" style={{ position: "absolute", inset: 0 }}>
          <polygon points="0,190 70,120 140,170 210,90 290,150 340,110 390,160 390,330 0,330" fill={sky.v1} style={{ transition: "fill .8s ease" }} />
          <polygon points="196,102 210,90 224,102" fill={C.neige} opacity="0.85" /><polygon points="330,120 340,110 350,120" fill={C.neige} opacity="0.7" />
          <polygon points="0,230 60,170 130,215 200,140 270,200 330,160 390,210 390,330 0,330" fill={sky.v2} style={{ transition: "fill .8s ease" }} />
          <polygon points="0,280 80,225 160,265 240,205 320,255 390,225 390,330 0,330" fill={sky.v3} style={{ transition: "fill .8s ease" }} />
          <polyline points={TRAIL.map((p) => p.join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
          <polyline points={TRAIL.map((p) => p.join(",")).join(" ")} fill="none" stroke={C.glacier} strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${score} 100`} opacity="0.9" style={{ transition: "stroke-dasharray .6s ease" }} />
          <line x1={summit[0]} y1={summit[1]} x2={summit[0]} y2={summit[1]-20} stroke={C.neige} strokeWidth="2.5" strokeLinecap="round" />
          <polygon points={`${summit[0]},${summit[1]-20} ${summit[0]+14},${summit[1]-15} ${summit[0]},${summit[1]-10}`} fill={C.aube} />
          <circle cx={summit[0]} cy={summit[1]} r="10" fill={C.aube} opacity="0.18" className="balise-pulse" />
        </svg>
        <div style={{ position: "absolute", left: `${(pos[0]/390)*100}%`, top: `${(pos[1]/330)*100}%`, transform: "translate(-50%, -88%)", transition: "left .6s ease, top .6s ease" }}>
          <Nimbo size={48} mood={nimbo.mood} reacting={nimbo.reaction} onTap={act.tapNimbo} hat={hatE(app.cosm.hat)} aura={auraC(app.cosm.aura)} body={(COMPAGNONS.find((c) => c.id === app.compagnon) || COMPAGNONS[0]).body} />
          {phrase && <div className="phrase-pop" style={{ position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)", background: "rgba(12,18,48,0.92)", border: `1px solid ${C.bord}`, color: C.neige, fontSize: 11.5, padding: "7px 11px", borderRadius: 14, whiteSpace: "nowrap" }}>{phrase}</div>}
        </div>
        <div style={{ position: "absolute", left: 20, bottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.doux }}>Altitude du jour</div>
          <div style={{ fontFamily: FONT_D, fontSize: 42, color: C.neige, lineHeight: 1 }}>{altitude}<span style={{ fontSize: 18, color: C.glacier }}> m</span></div>
          <div style={{ fontSize: 12, color: C.doux, marginTop: 3 }}>{score} % du cap · Balise à 1 000 m · <span style={{ color: C.aube }}>{app.xp} XP</span></div>
        </div>
      </div>

      {/* Action du moment */}
      <Glass pressable onClick={() => act.goTo(cta.page)} className="mx-5 mt-2 p-4 flex items-center justify-between" style={{ background: "linear-gradient(90deg, rgba(255,184,107,0.16), rgba(255,255,255,0.06))" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 38, height: 38, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,184,107,0.22)", color: C.aube }}>{cta.icon}</div>
          <div><div style={{ fontSize: 13.5, fontWeight: 700, color: C.neige }}>{cta.titre}</div><div style={{ fontSize: 12, color: C.doux }}>{cta.sous}</div></div>
        </div>
        <ChevronRight size={18} style={{ color: C.doux }} />
      </Glass>

      {/* Résumé */}
      <div className="relative mt-3">
        <div className="flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: "none" }}>
          {[
            { i: <Smile size={16} />, l: "Humeur", v: app.humeur == null ? "—" : `${app.humeur}/10` },
            { i: <Dumbbell size={16} />, l: "Séance", v: app.seanceFaite ? "Faite ✓" : "À faire" },
            { i: <CheckCircle2 size={16} />, l: "Habitudes", v: `${habFaites}/${habActives.length}` },
            { i: <ListChecks size={16} />, l: "Tâches", v: `${app.taches.filter((t) => !t.demain && t.fait).length}/${app.taches.filter((t) => !t.demain).length}` },
            { i: <Sparkles size={16} />, l: "Repas", v: `${repasFaits}/${app.repas.length}` },
            { i: <Coffee size={16} />, l: "Caféine", v: `${app.cafe}/3` },
          ].map((c, k) => (
            <Glass key={k} className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 18, flex: "0 0 auto" }}>
              <span style={{ color: C.glacier }}>{c.i}</span>
              <div style={{ lineHeight: 1.1 }}><div style={{ fontSize: 10, color: C.doux }}>{c.l}</div><div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>{c.v}</div></div>
            </Glass>
          ))}
          <div style={{ flex: "0 0 12px" }} />
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(10,15,40,0.55))" }} />
      </div>

      {/* Hydratation */}
      <Glass className="mx-5 mt-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><Droplets size={16} style={{ color: C.glacier }} /><span style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Hydratation</span></div>
            <div className="flex gap-1 mt-2">{Array.from({ length: app.objEau }).map((_, i) => (<div key={i} style={{ width: 9, height: 14, borderRadius: 4, background: i < app.eau ? C.glacier : "rgba(255,255,255,0.12)", transition: "background .3s ease" }} />))}</div>
          </div>
          <Bouton onClick={act.addEau}>+ 1 verre</Bouton>
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div className="flex items-center gap-2"><Coffee size={15} style={{ color: C.aube }} /><span style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Caféine</span></div>
            <div className="flex gap-1 mt-2">{Array.from({ length: 3 }).map((_, i) => (<div key={i} style={{ width: 9, height: 14, borderRadius: 4, background: i < app.cafe ? C.aube : "rgba(255,255,255,0.12)", transition: "background .3s ease" }} />))}{app.cafe > 3 && <span style={{ fontSize: 11, color: "#FF9AA8", marginLeft: 4 }}>+{app.cafe - 3} au-delà</span>}</div>
          </div>
          <Bouton couleur={"rgba(255,184,107,0.85)"} onClick={act.addCafe}>+ 1 café</Bouton>
        </div>
      </Glass>

      {/* Quête */}
      <Glass className="mx-5 mt-3 p-4">
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Quête de la semaine</div>
          <div style={{ fontSize: 12, color: C.aube, fontWeight: 700 }}>{app.seanceFaite ? "3/3 🎉" : "2/3"}</div>
        </div>
        <div style={{ fontSize: 12, color: C.doux, marginTop: 2 }}>3 séances de sport · +120 XP</div>
        <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: app.seanceFaite ? "100%" : "66%", height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${C.aube}, #FFD9A8)`, transition: "width 1s ease" }} />
        </div>
      </Glass>

      {/* Cadeaux de fidélité */}
      <Glass className="mx-5 mt-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Gift size={16} style={{ color: C.aube }} /><span style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Cadeaux de fidélité</span></div>
          <span style={{ fontSize: 11.5, color: C.doux }}>Série : 12 j 🔥</span>
        </div>
        <div className="flex gap-2 mt-3">
          {[
            { j: 3, etat: "pris" },
            { j: 7, etat: app.cadeau7 ? "pris" : "dispo" },
            { j: 14, etat: "lock" },
            { j: 30, etat: "lock" },
          ].map((p) => (
            <button key={p.j} className="pressable" disabled={p.etat !== "dispo"} onClick={() => p.etat === "dispo" && act.openGacha()} style={{
              flex: 1, padding: "10px 4px", borderRadius: 14, border: `1px solid ${p.etat === "dispo" ? "rgba(255,184,107,.5)" : C.bord}`,
              background: p.etat === "dispo" ? "rgba(255,184,107,.16)" : "rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              opacity: p.etat === "lock" ? 0.45 : 1,
            }}>
              <span style={{ fontSize: 16 }}>{p.etat === "pris" ? "✓" : p.etat === "dispo" ? "🎁" : "🔒"}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: p.etat === "dispo" ? C.aube : C.doux, fontFamily: FONT_B }}>{p.j} j</span>
            </button>
          ))}
        </div>
      </Glass>

      {/* Insights croisés — calculés depuis ton vrai historique */}
      <Glass className="mx-5 mt-3 p-4">
        <div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Insights</div>
        {(() => {
          const hist = app.historique || [];
          const moy = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
          const lignes = [];
          const avecS = hist.filter((h) => h.seance && h.humeur != null);
          const sansS = hist.filter((h) => !h.seance && h.humeur != null);
          if (avecS.length >= 3 && sansS.length >= 3) {
            const a1 = moy(avecS, (h) => h.humeur), a0 = moy(sansS, (h) => h.humeur);
            if (a1 - a0 >= 0.4) lignes.push(
              <p key="s" style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>
                📈 Les jours de séance, ton humeur moyenne monte à <span style={{ color: C.glacier, fontWeight: 700 }}>{a1.toFixed(1).replace(".", ",")}</span> contre {a0.toFixed(1).replace(".", ",")} sans — le sport te porte.
              </p>
            );
          }
          const okEau = hist.filter((h) => (h.eau || 0) >= app.objEau);
          const koEau = hist.filter((h) => (h.eau || 0) < app.objEau);
          if (okEau.length >= 3 && koEau.length >= 3) {
            const s1 = moy(okEau, (h) => h.score), s0 = moy(koEau, (h) => h.score);
            if (s1 - s0 >= 4) lignes.push(
              <p key="e" style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>
                💧 Objectif d'eau atteint = <span style={{ color: C.glacier, fontWeight: 700 }}>+{Math.round(s1 - s0)} points</span> de score en moyenne.
              </p>
            );
          }
          if (hist.length >= 28) {
            const s14 = moy(hist.slice(-14), (h) => h.score), sAv = moy(hist.slice(-28, -14), (h) => h.score);
            if (s14 - sAv >= 5) lignes.push(
              <p key="t" style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>
                🏔 Tendance : <span style={{ color: C.glacier, fontWeight: 700 }}>+{Math.round(s14 - sAv)} points</span> de score moyen en deux semaines. Ça grimpe.
              </p>
            );
          }
          if (!lignes.length) return (
            <p style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>
              🔭 Encore quelques jours de données et je te montrerai ce qui te fait vraiment grimper — tout se calculera depuis ton vrai historique.
            </p>
          );
          return lignes;
        })()}
      </Glass>

      {/* Énigme */}
      <Glass pressable onClick={act.openEnigmes} className="mx-5 mt-3 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 38, height: 38, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,184,107,0.15)" }}><Puzzle size={18} style={{ color: C.aube }} /></div>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Énigmes du jour</div><div style={{ fontSize: 12, color: C.doux }}>{app.enigmes.filter((e) => e.fait).length}/5 résolues · jusqu'à +40 XP</div></div>
        </div>
        {app.enigmes.every((e) => e.fait)
          ? <span style={{ fontSize: 13, fontWeight: 700, color: C.vert }}>5/5 🎉</span>
          : <ChevronRight size={18} style={{ color: C.doux }} />}
      </Glass>
      <div style={{ textAlign: "center", fontSize: 11.5, color: C.doux, marginTop: 18 }}>← Glisse pour explorer →</div>
    </div>
  );
}

/* ================= PAGE : CORPS (Sport · Repas · Planning · Courses) ================= */
const TEMPLATES_INFO = { Push: "Pectoraux & épaules", Pull: "Dos & biceps", Legs: "Jambes" };
const JOURS_FULL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const RAYONS_ORDRE = ["Fruits & légumes", "Viande & poisson", "Frais", "Épicerie", "Surgelés", "Boissons", "Autre"];
const RAYONS_MOTS = {
  "Fruits & légumes": ["pomme", "banane", "tomate", "salade", "carotte", "courgette", "brocoli", "avocat", "citron", "oignon", "ail", "poivron", "fraise", "myrtille", "épinard", "patate", "concombre", "champignon", "orange", "kiwi", "haricot", "chou"],
  "Viande & poisson": ["poulet", "bœuf", "boeuf", "steak", "dinde", "saumon", "thon", "crevette", "jambon", "porc", "cabillaud", "merlu", "agneau", "veau"],
  "Frais": ["lait", "yaourt", "skyr", "fromage", "beurre", "œuf", "oeuf", "crème", "creme", "mozzarella", "feta", "tofu"],
  "Épicerie": ["riz", "pâtes", "pates", "avoine", "farine", "huile", "sel", "poivre", "miel", "café", "cafe", "thé", "the", "chocolat", "amande", "noix", "lentille", "pois chiche", "sauce", "conserve", "pain", "sucre", "céréale", "cereale"],
  "Surgelés": ["surgelé", "surgele", "glace", "frites"],
  "Boissons": ["eau", "jus", "soda", "bière", "biere", "vin", "kombucha"],
};
function detectRayon(nom) {
  const n = nom.toLowerCase();
  for (const r of RAYONS_ORDRE) {
    const mots = RAYONS_MOTS[r];
    if (mots && mots.some((m) => n.includes(m))) return r;
  }
  return "Autre";
}

function PageCorps({ app, act }) {
  const [onglet, setOnglet] = useState("sport");
  const [nomRepas, setNomRepas] = useState("");
  const [kcalRepas, setKcalRepas] = useState("");
  const [jourSel, setJourSel] = useState(app.jour);
  const [copie, setCopie] = useState(false);
  const [nomPlan, setNomPlan] = useState("");
  const [nomC, setNomC] = useState("");
  const [qteC, setQteC] = useState("");
  const [poidsVal, setPoidsVal] = useState("");
  const [estim, setEstim] = useState(false);
  const photoRepas = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!app.premium) { act.note("Photo → calories : fonctionnalité Premium 👑"); return; }
    setEstim(true);
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const t = await askAI({
        prompt: 'Estime ce repas en calories. Réponds UNIQUEMENT en JSON strict : {"nom":"nom court du plat en français","kcal":nombre_entier}',
        maxTokens: 200,
        images: [data],
      });
      const j = jsonTolerant(t);
      if (j && j.nom) { act.addRepas(String(j.nom), Math.round(j.kcal || 0)); act.note(`≈ ${Math.round(j.kcal || 0)} kcal — « ${j.nom} » ajouté 📷`); }
      else act.note("Estimation illisible — réessaie avec une photo plus nette");
    } catch (err) { act.note("IA indisponible — vérifie la clé sur Vercel"); }
    setEstim(false);
  };
  const chargerPhoto = (slot) => (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => act.setPhoto(slot, r.result);
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const kcalTotal = app.repas.filter((r) => r.fait).reduce((s, r) => s + (r.kcal || 0), 0);
  const plan = app.planning[jourSel];
  const tpl = app.templates[app.templateNom];

  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Sport, nutrition, planning et courses — au même camp.">Corps</TitrePage>
      <div className="flex gap-2 mt-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {[{ k: "sport", l: "Séance" }, { k: "repas", l: "Repas" }, { k: "planning", l: "Planning" }, { k: "courses", l: "Courses" }, { k: "suivi", l: "Suivi" }].map((o) => (
          <button key={o.k} className="pressable" onClick={() => setOnglet(o.k)} style={{
            fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 999, flex: "0 0 auto",
            border: `1px solid ${onglet === o.k ? "rgba(143,227,240,.4)" : C.bord}`,
            background: onglet === o.k ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: onglet === o.k ? C.glacier : C.doux,
          }}>{o.l}</button>
        ))}
      </div>

      {/* ---------- SÉANCE ---------- */}
      {onglet === "sport" && (
        <div className="mt-4">
          {!app.seanceFaite ? (
            <>
              <div className="flex gap-2 mb-3">
                {Object.keys(app.templates).map((n) => (
                  <button key={n} className="pressable" onClick={() => act.setTemplateNom(n)} style={{
                    fontFamily: FONT_B, fontSize: 12.5, fontWeight: 700, padding: "8px 15px", borderRadius: 999,
                    border: `1px solid ${app.templateNom === n ? "rgba(255,184,107,.45)" : C.bord}`,
                    background: app.templateNom === n ? "rgba(255,184,107,.16)" : "rgba(255,255,255,.06)",
                    color: app.templateNom === n ? C.aube : C.doux,
                  }}>{n}</button>
                ))}
              </div>
              <Glass className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.neige }}>{app.templateNom} — {TEMPLATES_INFO[app.templateNom]}</div>
                    <div style={{ fontSize: 12.5, color: C.doux, marginTop: 3 }}>{tpl.length} exercices · {tpl.reduce((n, e) => n + e.series.length, 0)} séries</div>
                  </div>
                  <Dumbbell size={22} style={{ color: C.glacier }} />
                </div>
                <div className="mt-3" style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.7 }}>{tpl.map((e) => e.nom).join(" · ")}</div>
                <Bouton onClick={act.startSeance} style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Play size={16} /> Lancer la séance
                </Bouton>
              </Glass>
            </>
          ) : (
            <Glass className="p-5" style={{ borderColor: "rgba(155,232,176,.35)" }}>
              <div className="flex items-center gap-2"><Trophy size={18} style={{ color: C.vert }} /><span style={{ fontSize: 14.5, fontWeight: 700, color: C.neige }}>Séance faite aujourd'hui</span></div>
              <div style={{ fontSize: 12.5, color: C.doux, marginTop: 4 }}>{app.dernierRecap ? `${app.dernierRecap.nom} · ${app.dernierRecap.series} séries · ${fmtKg(app.dernierRecap.volume)} kg · ${app.dernierRecap.duree}` : ""}</div>
              {app.dernierRecap && app.dernierRecap.prs.length > 0 && (
                <div style={{ fontSize: 12.5, color: C.aube, marginTop: 6 }}>🏔 Record{app.dernierRecap.prs.length > 1 ? "s" : ""} : {app.dernierRecap.prs.join(", ")}</div>
              )}
            </Glass>
          )}
          <Glass pressable onClick={act.openBiblio} className="p-4 mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 38, height: 38, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(143,227,240,0.14)" }}><BookOpen size={18} style={{ color: C.glacier }} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Bibliothèque d'exercices</div>
                <div style={{ fontSize: 12, color: C.doux }}>{14 + app.mesExos.length} fiches · recherche · exercices persos</div>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: C.doux }} />
          </Glass>
          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Records personnels</div>
          {Object.entries(app.pr).map(([nom, kg]) => (
            <Glass key={nom} className="p-3 px-4 mb-2 flex items-center justify-between">
              <span style={{ fontSize: 13, color: C.neige }}>{nom}</span>
              <span style={{ fontFamily: FONT_D, fontSize: 12, color: C.aube }}>{fmtKg(kg)} kg</span>
            </Glass>
          ))}
        </div>
      )}

      {/* ---------- REPAS ---------- */}
      {onglet === "repas" && (
        <div className="mt-4">
          <Glass className="p-4">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Calories du jour</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: kcalTotal > app.objKcal ? C.aube : C.glacier }}>{kcalTotal} / {app.objKcal} kcal</span>
            </div>
            <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (kcalTotal / app.objKcal) * 100)}%`, height: "100%", borderRadius: 99, background: C.glacier, transition: "width .5s ease" }} />
            </div>
          </Glass>
          {app.repas.map((r, i) => (
            <Glass key={i} pressable onClick={() => act.toggleRepas(i)} className="p-4 mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div style={{ width: 22, height: 22, borderRadius: 8, border: `2px solid ${r.fait ? C.vert : C.bord}`, background: r.fait ? "rgba(155,232,176,.2)" : "transparent", display: "grid", placeItems: "center" }}>
                  {r.fait && <Check size={13} style={{ color: C.vert }} />}
                </div>
                <span style={{ fontSize: 13.5, color: C.neige }}>{r.nom}</span>
              </div>
              <span style={{ fontSize: 12.5, color: C.doux }}>{r.kcal != null ? `${r.kcal} kcal` : "—"}</span>
            </Glass>
          ))}
          <div className="flex gap-2 mt-3">
            <Champ value={nomRepas} onChange={setNomRepas} placeholder="Ajouter un repas…" style={{ flex: 2 }} />
            <Champ value={kcalRepas} onChange={setKcalRepas} placeholder="kcal" type="num" style={{ flex: 1 }} />
            <Bouton onClick={() => { if (nomRepas.trim()) { act.addRepas(nomRepas.trim(), parseNum(kcalRepas)); setNomRepas(""); setKcalRepas(""); } }}><Plus size={16} /></Bouton>
          </div>
          <label className="pressable" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10,
            padding: "12px 16px", borderRadius: 14, cursor: "pointer",
            border: `1px solid rgba(255,184,107,.35)`, background: "rgba(255,184,107,0.14)",
            color: C.aube, fontSize: 13, fontWeight: 700, fontFamily: FONT_B,
          }}>
            <Camera size={15} className={estim ? "flame-pulse" : ""} /> {estim ? "L'IA regarde ton assiette…" : "Photo → calories (Premium)"}
            <input type="file" accept="image/*" capture="environment" onChange={photoRepas} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {/* ---------- PLANNING HEBDO ---------- */}
      {onglet === "planning" && (
        <div className="mt-4">
          <div className="flex gap-1">
            {JOURS_FULL.map((j, d) => (
              <button key={d} className="pressable" onClick={() => { setJourSel(d); setCopie(false); }} style={{
                flex: 1, padding: "9px 0", borderRadius: 12, border: "none", fontFamily: FONT_B, fontSize: 11.5, fontWeight: 700,
                background: jourSel === d ? "rgba(143,227,240,.2)" : "rgba(255,255,255,0.06)",
                color: jourSel === d ? C.glacier : d === app.jour ? C.aube : C.doux,
              }}>{j}{d === app.jour ? " •" : ""}</button>
            ))}
          </div>

          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Séance prévue</div>
          <div className="flex gap-2">
            {[...Object.keys(app.templates), null].map((n) => (
              <button key={n ?? "aucune"} className="pressable" onClick={() => act.setPlanSeance(jourSel, n)} style={{
                fontFamily: FONT_B, fontSize: 12.5, fontWeight: 700, padding: "9px 15px", borderRadius: 999,
                border: `1px solid ${plan.seance === n ? "rgba(255,184,107,.45)" : C.bord}`,
                background: plan.seance === n ? "rgba(255,184,107,.16)" : "rgba(255,255,255,.06)",
                color: plan.seance === n ? C.aube : C.doux,
              }}>{n ?? "Repos"}</button>
            ))}
          </div>

          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Repas prévus</div>
          {plan.repas.length === 0 && <div style={{ fontSize: 12.5, color: C.doux }}>Rien de prévu pour ce jour.</div>}
          {plan.repas.map((r, i) => (
            <Glass key={i} className="p-3 px-4 mb-2 flex items-center justify-between">
              <span style={{ fontSize: 13, color: C.neige }}>{r}</span>
              <button className="pressable" onClick={() => act.delPlanRepas(jourSel, i)} style={{ background: "none", border: "none", color: C.doux, padding: 4 }}><Trash2 size={15} /></button>
            </Glass>
          ))}
          <div className="flex gap-2 mt-2">
            <Champ value={nomPlan} onChange={setNomPlan} placeholder="Prévoir un repas…" />
            <Bouton onClick={() => { if (nomPlan.trim()) { act.addPlanRepas(jourSel, nomPlan.trim()); setNomPlan(""); } }}><Plus size={16} /></Bouton>
          </div>

          <div className="flex gap-2 mt-5">
            <Bouton onClick={() => setCopie((c) => !c)} couleur={"rgba(255,255,255,0.14)"} style={{ color: C.neige, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Copy size={15} /> Copier ce jour vers…
            </Bouton>
            {jourSel === app.jour && (
              <Bouton onClick={() => act.chargerJour(jourSel)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Download size={15} /> Charger aujourd'hui
              </Bouton>
            )}
          </div>
          {copie && (
            <div className="flex gap-1 mt-2">
              {JOURS_FULL.map((j, d) => (
                <button key={d} className="pressable" disabled={d === jourSel} onClick={() => { act.copierJour(jourSel, d); setCopie(false); }} style={{
                  flex: 1, padding: "9px 0", borderRadius: 12, border: `1px dashed ${C.bord}`, fontFamily: FONT_B, fontSize: 11.5, fontWeight: 700,
                  background: "rgba(255,255,255,0.05)", color: d === jourSel ? "rgba(234,242,255,0.25)" : C.glacier,
                }}>{j}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- COURSES ---------- */}
      {onglet === "courses" && (
        <div className="mt-4">
          <Bouton onClick={act.genCourses} couleur={"rgba(255,184,107,0.2)"} style={{ color: C.aube, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px solid rgba(255,184,107,.35)` }}>
            <Sparkles size={15} /> Générer depuis les repas planifiés — Premium
          </Bouton>
          {RAYONS_ORDRE.map((rayon) => {
            const items = app.courses.map((c, i) => ({ ...c, i })).filter((c) => c.rayon === rayon);
            if (items.length === 0) return null;
            return (
              <div key={rayon}>
                <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.glacier, marginTop: 18, marginBottom: 8 }}>{rayon}</div>
                {items.map((c) => (
                  <Glass key={c.i} className="p-3 px-4 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                      <button className="pressable" onClick={() => act.toggleCourse(c.i)} style={{
                        width: 22, height: 22, borderRadius: 8, border: `2px solid ${c.fait ? C.vert : C.bord}`,
                        background: c.fait ? "rgba(155,232,176,.2)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0,
                      }}>{c.fait && <Check size={13} style={{ color: C.vert }} />}</button>
                      <span style={{ fontSize: 13.5, color: C.neige, textDecoration: c.fait ? "line-through" : "none", opacity: c.fait ? 0.55 : 1 }}>{c.nom}</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      {c.qte && <span style={{ fontSize: 12, color: C.doux }}>{c.qte}</span>}
                      <button className="pressable" onClick={() => act.delCourse(c.i)} style={{ background: "none", border: "none", color: C.doux, padding: 4 }}><Trash2 size={15} /></button>
                    </div>
                  </Glass>
                ))}
              </div>
            );
          })}
          <div className="flex gap-2 mt-4">
            <Champ value={nomC} onChange={setNomC} placeholder="Ajouter (ex : brocoli)…" style={{ flex: 2 }} />
            <Champ value={qteC} onChange={setQteC} placeholder="Qté" style={{ flex: 1 }} />
            <Bouton onClick={() => { if (nomC.trim()) { act.addCourse(nomC.trim(), qteC.trim()); setNomC(""); setQteC(""); } }}><Plus size={16} /></Bouton>
          </div>
          <div style={{ fontSize: 11.5, color: C.doux, marginTop: 10 }}>Le rayon est détecté automatiquement (~250 aliments reconnus en production).</div>
        </div>
      )}

      {/* ---------- SUIVI : POIDS & PHOTOS ---------- */}
      {onglet === "suivi" && (
        <div className="mt-4">
          {(() => {
            const dernier = app.poids[app.poids.length - 1];
            const premier = app.poids[0];
            const delta = dernier && premier ? Math.round((dernier.v - premier.v) * 10) / 10 : 0;
            const vals = app.poids.map((p) => p.v);
            const minV = Math.min(...vals) - 0.5, maxV = Math.max(...vals) + 0.5;
            const norm = vals.map((v) => ((v - minV) / Math.max(0.1, maxV - minV)) * 80 + 10);
            return (
              <>
                <Glass className="p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.doux }}>Poids actuel</div>
                      <div style={{ fontFamily: FONT_D, fontSize: 34, color: C.neige, lineHeight: 1.1, marginTop: 4 }}>
                        {fmtKg(dernier.v)}<span style={{ fontSize: 16, color: C.glacier }}> kg</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: delta <= 0 ? C.vert : C.aube, paddingBottom: 4 }}>
                      {delta <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{delta > 0 ? "+" : ""}{fmtKg(delta)} kg</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <MiniChart labels={app.poids.map((p) => p.d)} series={[{ name: `De ${fmtKg(premier.v)} à ${fmtKg(dernier.v)} kg`, color: C.glacier, values: norm }]} height={110} />
                  </div>
                </Glass>
                <div className="flex gap-2 mt-3">
                  <Champ value={poidsVal} onChange={setPoidsVal} placeholder="Ex : 77,2" type="num" />
                  <Bouton onClick={() => { const v = parseNum(poidsVal); if (v != null && v > 0) { act.addPoids(v); setPoidsVal(""); } }}>Enregistrer</Bouton>
                </div>
                <div style={{ fontSize: 11.5, color: C.doux, marginTop: 8 }}>Virgule acceptée (77,2) — un enregistrement par pesée.</div>
              </>
            );
          })()}

          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 10 }}>Photos de progression</div>
          <div className="grid grid-cols-2 gap-3">
            {[["avant", "Avant"], ["apres", "Maintenant"]].map(([slot, titre]) => (
              <div key={slot}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.doux, marginBottom: 6, textAlign: "center" }}>{titre}</div>
                {app.photos[slot] ? (
                  <div style={{ position: "relative" }}>
                    <img src={app.photos[slot]} alt={titre} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 18, border: `1px solid ${C.bord}` }} />
                    <button className="pressable" onClick={() => act.delPhoto(slot)} style={{
                      position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 999,
                      background: "rgba(10,15,40,0.8)", border: `1px solid ${C.bord}`, color: C.neige, display: "grid", placeItems: "center",
                    }}><Trash2 size={14} /></button>
                  </div>
                ) : (
                  <label className="pressable" style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                    aspectRatio: "3/4", borderRadius: 18, border: `1.5px dashed ${C.bord}`,
                    background: "rgba(255,255,255,0.04)", color: C.doux, cursor: "pointer",
                  }}>
                    <Camera size={22} style={{ color: C.glacier }} />
                    <span style={{ fontSize: 12, fontFamily: FONT_B }}>Ajouter</span>
                    <input type="file" accept="image/*" onChange={chargerPhoto(slot)} style={{ display: "none" }} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: C.doux, marginTop: 10, lineHeight: 1.5 }}>
            🔒 Tes photos sont stockées localement sur ton appareil. Seule l'analyse « Ma transformation » (Coach, Premium) les envoie ponctuellement à l'IA, sans conservation.
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= SÉANCE EN DIRECT (overlay) ================= */
function SeanceOverlay({ seance, act }) {
  const [confirm, setConfirm] = useState(null); // {e, s, poids: string}
  const [rest, setRest] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - seance.t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [seance.t0]);

  useEffect(() => {
    if (rest <= 0) return;
    const iv = setInterval(() => setRest((r) => r - 1), 1000);
    return () => clearInterval(iv);
  }, [rest > 0]);

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const totalSeries = seance.exos.reduce((n, e) => n + e.series.length, 0);
  const faites = seance.exos.reduce((n, e) => n + e.series.filter((s) => s.fait).length, 0);

  const openConfirm = (ei, si) => {
    const s = seance.exos[ei].series[si];
    if (s.fait) return;
    setConfirm({ e: ei, s: si, poids: s.poids == null ? "" : String(s.poids).replace(".", ",") });
    vibrate(10);
  };
  const adjust = (d) => setConfirm((c) => { const n = (parseNum(c.poids) ?? 0) + d; return { ...c, poids: String(Math.max(0, n)).replace(".", ",") }; });
  const valider = () => {
    const p = parseNum(confirm.poids);
    act.checkSerie(confirm.e, confirm.s, p);
    setConfirm(null);
    setRest(90);
    vibrate(20);
  };

  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#070B1E,#101736)", zIndex: 40, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button className="pressable" onClick={act.quitSeance} style={{ background: "none", border: "none", color: C.doux }}><X size={22} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_D, fontSize: 13, color: C.neige }}>{seance.nom}</div>
          <div style={{ fontSize: 11.5, color: C.doux }}>{mmss(elapsed)} · {faites}/{totalSeries} séries</div>
        </div>
        <Bouton onClick={() => act.finishSeance(elapsed)} couleur={C.vert} style={{ padding: "8px 13px", fontSize: 12 }}>Terminer</Bouton>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${(faites / totalSeries) * 100}%`, height: "100%", background: C.glacier, transition: "width .4s ease" }} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ paddingBottom: 120 }}>
        {seance.exos.map((exo, ei) => (
          <div key={ei} className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 14, fontWeight: 700, color: C.neige }}>{exo.nom}</div>
              {seance.prsBattus.includes(exo.nom) && <span style={{ fontSize: 11, color: C.aube, fontWeight: 700 }}>🏔 RECORD !</span>}
            </div>
            {exo.series.map((s, si) => (
              <Glass key={si} pressable onClick={() => openConfirm(ei, si)} className="p-3 px-4 mb-2 flex items-center justify-between" style={{ borderColor: s.fait ? "rgba(155,232,176,.35)" : C.bord, opacity: s.fait ? 0.85 : 1 }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 24, height: 24, borderRadius: 9, border: `2px solid ${s.fait ? C.vert : C.bord}`, background: s.fait ? "rgba(155,232,176,.2)" : "transparent", display: "grid", placeItems: "center" }}>
                    {s.fait && <Check size={14} style={{ color: C.vert }} />}
                  </div>
                  <span style={{ fontSize: 13, color: C.neige }}>Série {si + 1} · {s.reps} reps</span>
                </div>
                <span style={{ fontFamily: FONT_D, fontSize: 11.5, color: s.fait ? C.vert : C.glacier }}>{fmtKg(s.poids)} kg</span>
              </Glass>
            ))}
          </div>
        ))}
      </div>

      {/* Repos auto */}
      {rest > 0 && !confirm && (
        <div className="absolute left-5 right-5 slide-up" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}>
          <Glass className="p-4 flex items-center justify-between" style={{ background: "rgba(12,18,48,0.95)" }}>
            <div className="flex items-center gap-3">
              <Timer size={20} style={{ color: C.glacier }} className="flame-pulse" />
              <div><div style={{ fontSize: 12, color: C.doux }}>Repos</div><div style={{ fontFamily: FONT_D, fontSize: 18, color: C.neige }}>{mmss(rest)}</div></div>
            </div>
            <button className="pressable" onClick={() => setRest(0)} style={{ background: "rgba(255,255,255,.08)", border: `1px solid ${C.bord}`, color: C.doux, borderRadius: 12, padding: "9px 14px", fontSize: 12.5, fontFamily: FONT_B }}>Passer</button>
          </Glass>
        </div>
      )}

      {/* Confirmation poids */}
      {confirm && (
        <div className="absolute inset-0" style={{ background: "rgba(5,8,20,0.7)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={() => setConfirm(null)}>
          <div className="w-full slide-up" onClick={(e) => e.stopPropagation()} style={{ background: "#101736", borderRadius: "24px 24px 0 0", padding: "22px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)", border: `1px solid ${C.bord}`, borderBottom: "none" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.neige, textAlign: "center" }}>{seance.exos[confirm.e].nom} · Série {confirm.s + 1}</div>
            <div className="flex items-center justify-center gap-2 mt-4">
              {[-5, -2.5].map((d) => (<button key={d} className="pressable" onClick={() => adjust(d)} style={{ background: "rgba(255,255,255,.08)", border: `1px solid ${C.bord}`, color: C.doux, borderRadius: 12, padding: "12px 13px", fontSize: 13, fontFamily: FONT_B }}>{d}</button>))}
              <input value={confirm.poids} onChange={(e) => setConfirm((c) => ({ ...c, poids: e.target.value }))} inputMode="decimal"
                style={{ width: 90, textAlign: "center", fontFamily: FONT_D, fontSize: 20, color: C.neige, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 14, padding: "12px 8px", outline: "none" }} />
              {[2.5, 5].map((d) => (<button key={d} className="pressable" onClick={() => adjust(d)} style={{ background: "rgba(255,255,255,.08)", border: `1px solid ${C.bord}`, color: C.doux, borderRadius: 12, padding: "12px 13px", fontSize: 13, fontFamily: FONT_B }}>+{d}</button>))}
            </div>
            <div style={{ fontSize: 11.5, color: C.doux, textAlign: "center", marginTop: 8 }}>Virgule acceptée (17,5) · champ vide autorisé</div>
            <Bouton onClick={valider} style={{ width: "100%", marginTop: 14 }}>Valider la série</Bouton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= RÉCAP DE SÉANCE ================= */
function RecapOverlay({ recap, onClose }) {
  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0B1332,#1A2450)", zIndex: 45, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Nimbo size={90} mood="happy" />
      <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.neige, marginTop: 14 }}>Cap franchi 🎉</div>
      <div style={{ fontSize: 13, color: C.doux, marginTop: 4 }}>Séance {recap.nom} terminée</div>
      <div className="grid grid-cols-3 gap-3 mt-6 w-full" style={{ maxWidth: 340 }}>
        {[{ l: "Durée", v: recap.duree }, { l: "Séries", v: recap.series }, { l: "Volume", v: `${fmtKg(recap.volume)} kg` }].map((s, i) => (
          <Glass key={i} className="p-3 text-center">
            <div style={{ fontFamily: FONT_D, fontSize: 15, color: C.glacier }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.doux, marginTop: 3 }}>{s.l}</div>
          </Glass>
        ))}
      </div>
      {recap.prs.length > 0 && (
        <Glass className="p-4 mt-3 w-full" style={{ maxWidth: 340, borderColor: "rgba(255,184,107,.4)" }}>
          <div className="flex items-center gap-2"><Trophy size={16} style={{ color: C.aube }} /><span style={{ fontSize: 13, fontWeight: 700, color: C.aube }}>Nouveau{recap.prs.length > 1 ? "x" : ""} record{recap.prs.length > 1 ? "s" : ""} !</span></div>
          <div style={{ fontSize: 12.5, color: C.neige, marginTop: 4 }}>{recap.prs.join(" · ")}</div>
        </Glass>
      )}
      <div style={{ fontSize: 13, color: C.aube, fontWeight: 700, marginTop: 16 }}>+60 XP · +25 m d'altitude</div>
      <Bouton onClick={onClose} style={{ marginTop: 18, minWidth: 200 }}>Retour au camp</Bouton>
    </div>
  );
}

/* ================= RESPIRATION ================= */
const TECHNIQUES = {
  coherence: { nom: "Cohérence cardiaque", phases: [["Inspire", 5], ["Expire", 5]] },
  box: { nom: "Box breathing", phases: [["Inspire", 4], ["Bloque", 4], ["Expire", 4], ["Bloque", 4]] },
  quatre78: { nom: "4-7-8", phases: [["Inspire", 4], ["Bloque", 7], ["Expire", 8]] },
};
function Respiration({ onDone }) {
  const [tech, setTech] = useState("coherence");
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(0);
  const [totalLeft, setTotalLeft] = useState(60);
  const [scale, setScale] = useState(1);
  const [dur, setDur] = useState(1);
  const phases = TECHNIQUES[tech].phases;
  const totalRef = useRef(60);
  const phaseRef = useRef(0);
  const phaseIdxRef = useRef(0);
  const [son, setSon] = useState(true);
  const audioRef = useRef(null);
  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 164;
    g.gain.value = 0; osc.connect(g); g.connect(ctx.destination); osc.start();
    audioRef.current = { ctx, g };
    return audioRef.current;
  };
  const rampe = (cible, secs) => {
    const a = audioRef.current; if (!a || !son) return;
    const t = a.ctx.currentTime;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.setValueAtTime(a.g.gain.value, t);
    a.g.gain.linearRampToValueAtTime(cible, t + Math.max(0.2, secs * 0.9));
  };
  const couperSon = () => {
    const a = audioRef.current; if (!a) return;
    const t = a.ctx.currentTime;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.setValueAtTime(a.g.gain.value, t);
    a.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
  };
  useEffect(() => () => { const a = audioRef.current; if (a) { try { a.ctx.close(); } catch (e) {} } }, []);

  const applyPhase = (i) => {
    const [nom, secs] = phases[i];
    phaseIdxRef.current = i; phaseRef.current = secs;
    setPhaseIdx(i); setPhaseLeft(secs); setDur(secs);
    if (nom === "Inspire") { setScale(1.35); rampe(0.12, secs); }
    else if (nom === "Expire") { setScale(0.75); rampe(0.02, secs); }
    /* Bloque : le cercle (et la nappe) restent où ils sont */
  };
  const start = () => {
    const a = ensureAudio();
    if (a && a.ctx.state === "suspended") a.ctx.resume();
    totalRef.current = 60; setTotalLeft(60); setRunning(true); applyPhase(0); vibrate(10);
  };
  const stop = () => { setRunning(false); setScale(1); setDur(0.6); couperSon(); };

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      totalRef.current -= 1;
      phaseRef.current -= 1;
      if (totalRef.current <= 0) {
        setTotalLeft(0);
        stop();
        onDone();
        return;
      }
      if (phaseRef.current <= 0) {
        applyPhase((phaseIdxRef.current + 1) % phases.length);
        vibrate(8);
      } else {
        setPhaseLeft(phaseRef.current);
      }
      setTotalLeft(totalRef.current);
    }, 1000);
    return () => clearInterval(iv);
  }, [running, tech]);

  return (
    <div className="mt-4">
      <div className="flex gap-2 flex-wrap">
        {Object.entries(TECHNIQUES).map(([k, t]) => (
          <button key={k} className="pressable" disabled={running} onClick={() => setTech(k)} style={{
            fontFamily: FONT_B, fontSize: 12, fontWeight: 600, padding: "8px 13px", borderRadius: 999,
            border: `1px solid ${tech === k ? "rgba(143,227,240,.4)" : C.bord}`,
            background: tech === k ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)",
            color: tech === k ? C.glacier : C.doux, opacity: running && tech !== k ? 0.4 : 1,
          }}>{t.nom}</button>
        ))}
      </div>
      <div className="flex flex-col items-center mt-6 mb-2">
        <div style={{ position: "relative", width: 190, height: 190, display: "grid", placeItems: "center" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 999, border: `1px solid ${C.bord}`,
            background: "radial-gradient(circle, rgba(143,227,240,0.10), transparent 70%)",
          }} />
          <div style={{
            width: 120, height: 120, borderRadius: 999,
            background: `radial-gradient(circle at 40% 35%, rgba(143,227,240,0.55), rgba(143,227,240,0.15))`,
            border: "1px solid rgba(143,227,240,0.5)",
            transform: `scale(${scale})`,
            transition: `transform ${dur}s ease-in-out`,
            display: "grid", placeItems: "center",
          }}>
            {running && <div style={{ fontFamily: FONT_D, fontSize: 13, color: C.neige, textAlign: "center" }}>{phases[phaseIdx][0]}<div style={{ fontSize: 18, marginTop: 2 }}>{phaseLeft}</div></div>}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: C.doux, marginTop: 10 }}>{running ? `${totalLeft} s restantes · +15 XP à la fin` : "Séance rapide · 1 minute"}</div>
        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          <Bouton onClick={running ? stop : start} couleur={running ? "#FFB6C9" : C.glacier} style={{ minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Wind size={16} /> {running ? "Arrêter" : "Commencer"}
          </Bouton>
          <button className="pressable" onClick={() => { setSon((s) => { if (s) couperSon(); return !s; }); }} aria-label="Son"
            style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${C.bord}`, background: son ? "rgba(143,227,240,.14)" : "rgba(255,255,255,0.07)", color: son ? C.glacier : C.doux, display: "grid", placeItems: "center" }}>
            {son ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: C.doux, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>Nappe sonore synchronisée 🔊 : elle monte à l'inspiration, descend à l'expiration.</div>
      </div>
    </div>
  );
}

/* ================= FOCUS ================= */
function Focus({ onDone }) {
  const [min, setMin] = useState(15);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(0);
  const leftRef = useRef(0);
  const totalRef = useRef(1);

  const start = () => { totalRef.current = min * 60; leftRef.current = min * 60; setLeft(min * 60); setRunning(true); vibrate(10); };
  const stop = () => setRunning(false);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      leftRef.current -= 1;
      if (leftRef.current <= 0) { setLeft(0); setRunning(false); onDone(min); return; }
      setLeft(leftRef.current);
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const R = 70, CIRC = 2 * Math.PI * R;
  const prog = running ? 1 - left / totalRef.current : 0;

  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="flex gap-2 flex-wrap justify-center">
        {[1, 10, 15, 25].map((m) => (
          <button key={m} className="pressable" disabled={running} onClick={() => setMin(m)} style={{
            fontFamily: FONT_B, fontSize: 12.5, fontWeight: 700, padding: "8px 15px", borderRadius: 999,
            border: `1px solid ${min === m ? "rgba(143,227,240,.4)" : C.bord}`,
            background: min === m ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)",
            color: min === m ? C.glacier : C.doux, opacity: running && min !== m ? 0.4 : 1,
          }}>{m === 1 ? "1 min (démo)" : `${m} min`}</button>
        ))}
      </div>
      <div style={{ position: "relative", width: 180, height: 180, marginTop: 22 }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
          <circle cx="90" cy="90" r={R} fill="none" stroke={C.glacier} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - prog)}
            transform="rotate(-90 90 90)" style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FONT_D, fontSize: 26, color: C.neige }}>{running ? mmss(left) : `${min}:00`}</div>
            <div style={{ fontSize: 11.5, color: C.doux, marginTop: 2 }}>{running ? "Concentration…" : "Prêt à grimper"}</div>
          </div>
        </div>
      </div>
      <Bouton onClick={running ? stop : start} couleur={running ? "#FFB6C9" : C.glacier} style={{ marginTop: 16, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Target size={16} /> {running ? "Abandonner" : "Commencer"}
      </Bouton>
      <div style={{ fontSize: 11.5, color: C.doux, marginTop: 12, textAlign: "center" }}>Termine la session pour gagner l'XP ({min * 2} XP). Quitter avant ne rapporte rien — sans culpabilisation.</div>
    </div>
  );
}

/* ================= PAGE : ESPRIT ================= */
function PageEsprit({ app, act }) {
  const [grat, setGrat] = useState("");
  const [onglet, setOnglet] = useState("journal");
  const [rec, setRec] = useState(false);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const toggleRec = async () => {
    if (rec) { recRef.current && recRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        act.addNoteVocale(URL.createObjectURL(blob));
        setRec(false);
      };
      recRef.current = mr; mr.start(); setRec(true); vibrate(10);
    } catch (e) { act.micRefuse(); }
  };
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Humeur, journal, respiration et focus — ton versant intérieur.">Esprit</TitrePage>
      <div className="flex gap-2 mt-4">
        {[{ k: "journal", l: "Journal" }, { k: "respiration", l: "Respiration" }, { k: "focus", l: "Focus" }].map((o) => (
          <button key={o.k} className="pressable" onClick={() => setOnglet(o.k)} style={{
            fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 999, border: `1px solid ${onglet === o.k ? "rgba(143,227,240,.4)" : C.bord}`,
            background: onglet === o.k ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: onglet === o.k ? C.glacier : C.doux,
          }}>{o.l}</button>
        ))}
      </div>

      {onglet === "respiration" && <Respiration onDone={act.breathDone} />}
      {onglet === "focus" && <Focus onDone={act.focusDone} />}

      {onglet === "journal" && (<>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Rituel du matin</div>
      <Glass className="p-4">
        <Champ value={app.intention} onChange={act.setIntention} placeholder="Mon intention du jour…" />
        <div className="flex items-center justify-between mt-3">
          <span style={{ fontSize: 12.5, color: C.doux }}>Énergie ressentie</span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} className="pressable" onClick={() => act.setEnergie(i + 1)} style={{ background: "none", border: "none", padding: 2, fontSize: 16, opacity: i < app.energie ? 1 : 0.25 }}>⚡</button>
            ))}
          </div>
        </div>
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Humeur du jour</div>
      <Glass className="p-4">
        <div className="flex justify-between">
          {Array.from({ length: 10 }).map((_, i) => (
            <button key={i} className="pressable" onClick={() => act.setHumeur(i + 1)} style={{
              width: 28, height: 34, borderRadius: 10, border: "none", fontFamily: FONT_B, fontSize: 12.5, fontWeight: 700,
              background: app.humeur === i + 1 ? C.glacier : "rgba(255,255,255,0.08)", color: app.humeur === i + 1 ? C.encre : C.doux, transition: "all .2s ease",
            }}>{i + 1}</button>
          ))}
        </div>
        {app.humeur != null && <div style={{ fontSize: 12.5, color: C.vert, marginTop: 10, textAlign: "center" }}>Humeur notée : {app.humeur}/10 · +5 XP</div>}
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Sommeil de la nuit</div>
      <Glass className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble size={17} style={{ color: C.glacier }} />
          <div className="flex items-center gap-2">
            <input value={app.sommeil.duree} onChange={(e) => act.setSommeil({ duree: e.target.value })} placeholder="7,5" inputMode="decimal"
              style={{ width: 58, textAlign: "center", fontFamily: FONT_D, fontSize: 14, color: C.glacier, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 12, padding: "9px 4px", outline: "none" }} />
            <span style={{ fontSize: 12.5, color: C.doux }}>heures</span>
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} className="pressable" onClick={() => act.setSommeil({ qualite: i + 1 })} style={{ background: "none", border: "none", padding: 2, color: i < app.sommeil.qualite ? C.aube : "rgba(234,242,255,0.25)" }}>
              <Moon size={17} fill={i < app.sommeil.qualite ? C.aube : "none"} />
            </button>
          ))}
        </div>
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Gratitude</div>
      {app.gratitude.map((g, i) => (
        <Glass key={i} className="p-3 px-4 mb-2 flex items-center gap-3"><Sparkles size={14} style={{ color: C.aube }} /><span style={{ fontSize: 13, color: C.neige }}>{g}</span></Glass>
      ))}
      <div className="flex gap-2">
        <Champ value={grat} onChange={setGrat} placeholder="Aujourd'hui, je suis reconnaissant pour…" />
        <Bouton onClick={() => { if (grat.trim()) { act.addGratitude(grat.trim()); setGrat(""); } }}><Plus size={16} /></Bouton>
      </div>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Victoire & difficulté</div>
      <Champ value={app.victoire} onChange={act.setVictoire} placeholder="Ma victoire du jour 🏔" />
      <div style={{ height: 8 }} />
      <Champ value={app.difficulte} onChange={act.setDifficulte} placeholder="Ma difficulté du jour" />

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 6 }}>Journal privé</div>
      <div style={{ fontSize: 11.5, color: C.doux, marginBottom: 8 }}>🔒 Strictement privé — jamais transmis au Coach IA.</div>
      <textarea value={app.journal} onChange={(e) => act.setJournal(e.target.value)} placeholder="Écris librement…" rows={5}
        style={{ fontFamily: FONT_B, fontSize: 14, color: C.neige, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 14, padding: "12px 14px", outline: "none", width: "100%", resize: "none", lineHeight: 1.6 }} />
      {app.journal.length > 0 && <div style={{ fontSize: 12, color: C.vert, marginTop: 6 }}>Enregistré au fil de l'eau ✓</div>}

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Notes vocales</div>
      {app.notesVocales.map((n, i) => (
        <Glass key={i} className="p-3 px-4 mb-2 flex items-center gap-3">
          <audio controls src={n} style={{ flex: 1, height: 34 }} />
          <button className="pressable" onClick={() => act.delNoteVocale(i)} style={{ background: "none", border: "none", color: C.doux, padding: 4, flexShrink: 0 }}><Trash2 size={15} /></button>
        </Glass>
      ))}
      <button className="pressable" onClick={toggleRec} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 16px", borderRadius: 14, fontFamily: FONT_B, fontSize: 13, fontWeight: 700,
        border: `1px solid ${rec ? "rgba(255,122,138,.5)" : C.bord}`,
        background: rec ? "rgba(255,122,138,.16)" : "rgba(255,255,255,0.08)",
        color: rec ? "#FF9AA8" : C.neige,
      }}>
        <Mic size={16} className={rec ? "flame-pulse" : ""} /> {rec ? "Enregistrement… touche pour terminer" : "Enregistrer une note vocale"}
      </button>
      </>)}
    </div>
  );
}

/* ================= LIGNE SWIPABLE (→ faire · ← supprimer) =================
   Arbitrage des gestes : la ligne revendique le geste horizontal AVANT le
   carrousel (seuil 6 px < 8 px du pager) et stoppe la propagation ; un geste
   vertical est rendu au scroll natif ; un geste refusé rend la main au pager. */
function SwipeRow({ onRight, onLeft, disabled, children }) {
  const [dx, setDx] = useState(0);
  const drag = useRef(false);
  const claimed = useRef(false);
  const sx = useRef(0);
  const sy = useRef(0);

  const down = (e) => { drag.current = true; claimed.current = false; sx.current = e.clientX; sy.current = e.clientY; };
  const move = (e) => {
    if (!drag.current) return;
    const ddx = e.clientX - sx.current, ddy = e.clientY - sy.current;
    if (!claimed.current) {
      if (Math.abs(ddx) > 6 && Math.abs(ddx) > Math.abs(ddy)) claimed.current = true;
      else if (Math.abs(ddy) > 6) { drag.current = false; return; }
      else return;
    }
    e.stopPropagation();
    let v = ddx;
    if (disabled && v > 0) v = v / 4;
    setDx(Math.max(-120, Math.min(120, v)));
  };
  const up = (e) => {
    if (!drag.current) { setDx(0); return; }
    drag.current = false;
    if (claimed.current) {
      e.stopPropagation();
      if (dx > 70 && !disabled && onRight) { onRight(); vibrate(15); }
      else if (dx < -70 && onLeft) { onLeft(); vibrate(15); }
    }
    claimed.current = false;
    setDx(0);
  };

  const ratio = Math.min(1, Math.abs(dx) / 70);
  return (
    <div
      style={{ position: "relative", marginBottom: 10, touchAction: "pan-y" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
    >
      <div style={{
        position: "absolute", inset: 0, borderRadius: 24,
        display: "flex", alignItems: "center",
        justifyContent: dx > 0 ? "flex-start" : "flex-end",
        padding: "0 20px",
        background: dx > 0 ? `rgba(155,232,176,${0.12 + ratio * 0.18})` : dx < 0 ? `rgba(255,122,138,${0.12 + ratio * 0.18})` : "transparent",
        opacity: dx === 0 ? 0 : 1,
      }}>
        {dx > 0 ? (
          <Check size={20} style={{ color: C.vert, transform: `scale(${0.7 + ratio * 0.5})` }} />
        ) : dx < 0 ? (
          <Trash2 size={19} style={{ color: "#FF9AA8", transform: `scale(${0.7 + ratio * 0.5})` }} />
        ) : null}
      </div>
      <div style={{
        transform: `translateX(${dx}px)`,
        transition: drag.current && claimed.current ? "none" : "transform .3s cubic-bezier(.22,1,.36,1)",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ================= SÉLECTEUR D'EMOJI LIBRE ================= */
function EmojiPick({ emoji, setEmoji, suggestions }) {
  const isCustom = emoji && !suggestions.includes(emoji);
  return (
    <div>
      <div className="flex gap-1 mb-2 flex-wrap items-center">
        {suggestions.map((e) => (
          <button key={e} className="pressable" onClick={() => setEmoji(e)} style={{
            width: 38, height: 38, borderRadius: 12, border: `2px solid ${emoji === e ? C.glacier : "transparent"}`,
            background: "rgba(255,255,255,0.07)", fontSize: 17,
          }}>{e}</button>
        ))}
        <input
          value={isCustom ? emoji : ""}
          onChange={(e) => { const v = e.target.value; if (v === "") { setEmoji(suggestions[0]); return; } setEmoji(Array.from(v).slice(-4).join("").trim() || suggestions[0]); }}
          placeholder="＋"
          aria-label="Ton propre emoji"
          style={{
            width: 52, height: 38, borderRadius: 12, textAlign: "center", fontSize: 16, outline: "none",
            border: `2px solid ${isCustom ? C.aube : C.bord}`,
            background: isCustom ? "rgba(255,184,107,0.12)" : "rgba(255,255,255,0.07)",
            color: C.neige, fontFamily: FONT_B,
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: C.doux, marginBottom: 8 }}>Touche la case ＋ et tape n'importe quel emoji de ton clavier 🏔🔥🎯</div>
    </div>
  );
}

/* ================= PAGE : HABITUDES & TÂCHES ================= */
function PageHabitudes({ app, act }) {
  const [onglet, setOnglet] = useState("habitudes");
  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💧");
  const [nomT, setNomT] = useState("");
  const [emojiT, setEmojiT] = useState("📌");
  const [editRepos, setEditRepos] = useState(null);
  const SUGG_HAB = ["💧", "📖", "🏃", "🧘", "🥦", "😴", "☀️", "✍️", "💪", "🪷"];
  const SUGG_TAC = ["📌", "📞", "🛒", "💼", "🧹", "📧", "🎨", "📦"];

  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Glisse une ligne → pour faire, ← pour supprimer.">Habitudes & tâches</TitrePage>
      <div className="flex gap-2 mt-4">
        {[{ k: "habitudes", l: "Habitudes" }, { k: "taches", l: "Tâches du jour" }].map((o) => (
          <button key={o.k} className="pressable" onClick={() => setOnglet(o.k)} style={{
            fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 999, border: `1px solid ${onglet === o.k ? "rgba(143,227,240,.4)" : C.bord}`,
            background: onglet === o.k ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: onglet === o.k ? C.glacier : C.doux,
          }}>{o.l}</button>
        ))}
      </div>

      {onglet === "habitudes" && (<>
      <div className="mt-4">
        {app.habitudes.map((h, i) => {
          const repos = h.repos.includes(app.jour);
          return (
            <SwipeRow key={i} disabled={repos} onRight={() => act.toggleHabit(i)} onLeft={() => act.delHabit(i)}>
            <Glass className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button className="pressable" disabled={repos} onClick={() => !repos && act.toggleHabit(i)} style={{
                    width: 40, height: 40, borderRadius: 14, border: `2px solid ${repos ? "rgba(255,255,255,0.15)" : h.fait ? C.vert : C.bord}`,
                    background: h.fait && !repos ? "rgba(155,232,176,.2)" : "rgba(255,255,255,0.05)", fontSize: 18, display: "grid", placeItems: "center",
                    opacity: repos ? 0.5 : 1, cursor: repos ? "default" : "pointer",
                  }}>{h.emoji}</button>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.neige }}>{h.nom}</div>
                    <div style={{ fontSize: 11.5, color: repos ? C.aube : C.doux }}>
                      {repos ? "😴 Jour de repos — la série est protégée" : <><Flame size={11} style={{ display: "inline", color: C.aube, verticalAlign: "-1px" }} /> {h.streak + (h.fait ? 1 : 0)} jours</>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {h.fait && !repos && <Check size={18} style={{ color: C.vert }} />}
                  <button className="pressable" onClick={() => setEditRepos(editRepos === i ? null : i)} style={{ background: "none", border: "none", color: editRepos === i ? C.glacier : C.doux, padding: 4 }}><BedDouble size={17} /></button>
                  <button className="pressable" onClick={() => act.delHabit(i)} style={{ background: "none", border: "none", color: C.doux, padding: 4 }}><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                {h.semaine.map((v, d) => (
                  <div key={d} style={{ flex: 1, height: 6, borderRadius: 4, background: v === 2 ? "rgba(255,184,107,0.5)" : v === 1 ? C.vert : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
              {editRepos === i && (
                <div className="mt-3">
                  <div style={{ fontSize: 11.5, color: C.doux, marginBottom: 8 }}>Jours de repos (ne comptent ni réussite ni échec) :</div>
                  <div className="flex gap-1">
                    {JOURS.map((j, d) => (
                      <button key={d} className="pressable" onClick={() => act.toggleRepos(i, d)} style={{
                        flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontFamily: FONT_B, fontSize: 12, fontWeight: 700,
                        background: h.repos.includes(d) ? "rgba(255,184,107,0.25)" : "rgba(255,255,255,0.07)",
                        color: h.repos.includes(d) ? C.aube : C.doux,
                      }}>{j}</button>
                    ))}
                  </div>
                </div>
              )}
            </Glass>
            </SwipeRow>
          );
        })}
      </div>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 8, marginBottom: 10 }}>Nouvelle habitude</div>
      <EmojiPick emoji={emoji} setEmoji={setEmoji} suggestions={SUGG_HAB} />
      <div className="flex gap-2">
        <Champ value={nom} onChange={setNom} placeholder="Nom de l'habitude…" />
        <Bouton onClick={() => { if (nom.trim()) { act.addHabit(emoji, nom.trim()); setNom(""); } }}><Plus size={16} /></Bouton>
      </div>
      </>)}

      {onglet === "taches" && (<>
      <div className="mt-4">
        {app.taches.length === 0 && (
          <Glass className="p-5 text-center"><div style={{ fontSize: 13, color: C.doux }}>Aucune tâche pour l'instant. Ajoute ta première ci-dessous — chaque tâche faite, c'est un pas de plus vers le sommet.</div></Glass>
        )}
        {app.taches.map((t, i) => (
          <SwipeRow key={i} disabled={t.demain} onRight={() => act.toggleTache(i)} onLeft={() => act.delTache(i)}>
          <Glass className="p-3 px-4 flex items-center justify-between" style={{ opacity: t.demain ? 0.55 : 1 }}>
            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <button className="pressable" disabled={t.demain} onClick={() => !t.demain && act.toggleTache(i)} style={{
                width: 38, height: 38, borderRadius: 13, border: `2px solid ${t.fait ? C.vert : C.bord}`,
                background: t.fait ? "rgba(155,232,176,.2)" : "rgba(255,255,255,0.05)", fontSize: 17, display: "grid", placeItems: "center", flexShrink: 0,
              }}>{t.emoji}</button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: C.neige, textDecoration: t.fait ? "line-through" : "none", opacity: t.fait ? 0.6 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nom}</div>
                {t.demain && <div style={{ fontSize: 11, color: C.aube }}>→ Reportée à demain</div>}
              </div>
            </div>
            <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
              <button className="pressable" onClick={() => act.demainTache(i)} title={t.demain ? "Ramener à aujourd'hui" : "Reporter à demain"} style={{ background: "none", border: "none", color: t.demain ? C.aube : C.doux, padding: 5 }}><CalendarClock size={17} /></button>
              <button className="pressable" onClick={() => act.delTache(i)} style={{ background: "none", border: "none", color: C.doux, padding: 5 }}><Trash2 size={16} /></button>
            </div>
          </Glass>
          </SwipeRow>
        ))}
      </div>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 14, marginBottom: 10 }}>Nouvelle tâche</div>
      <EmojiPick emoji={emojiT} setEmoji={setEmojiT} suggestions={SUGG_TAC} />
      <div className="flex gap-2">
        <Champ value={nomT} onChange={setNomT} placeholder="Nom de la tâche…" />
        <Bouton onClick={() => { if (nomT.trim()) { act.addTache(emojiT, nomT.trim()); setNomT(""); } }}><Plus size={16} /></Bouton>
      </div>
      <div style={{ fontSize: 11.5, color: C.doux, marginTop: 10 }}>En production : glisser une tâche pour la faire / reporter / supprimer (swipe), avec haptique.</div>
      </>)}
    </div>
  );
}

/* ================= PAGE : PARCOURS ================= */
function PageParcours({ app, act, active }) {
  const [lettre, setLettre] = useState("");
  const [dureeL, setDureeL] = useState(30);
  const [editP, setEditP] = useState(false);
  const camps = app.gate1
    ? [
      { nom: "Sommet des Brumes", alt: "2 000 m", xp: `${app.xp} / 3 400 XP`, etat: "encours", pct: Math.min(100, (app.xp / 3400) * 100) },
      { nom: "Balise du Col", alt: "1 500 m", xp: "Porte franchie 🚪", etat: "fait" },
      { nom: "Camp de l'Alpage", alt: "1 200 m", xp: "Franchi", etat: "fait" },
      { nom: "Camp de la Forêt", alt: "850 m", xp: "Franchi", etat: "fait" },
    ]
    : [
      { nom: "Sommet des Brumes", alt: "2 000 m", xp: "3 400 XP", etat: "loin" },
      { nom: "Balise du Col", alt: "1 500 m", xp: `${app.xp} / 2 600 XP`, etat: "encours", pct: Math.min(100, (app.xp / 2600) * 100), porte: app.xp >= 2600 },
      { nom: "Camp de l'Alpage", alt: "1 200 m", xp: "Franchi", etat: "fait" },
      { nom: "Camp de la Forêt", alt: "850 m", xp: "Franchi", etat: "fait" },
    ];
  const fiertes = [
    { t: "Record : Développé couché", v: `${fmtKg(app.pr["Développé couché"])} kg` },
    { t: "Plus longue série", v: "12 jours" },
    { t: "Séances totales", v: app.seanceFaite ? "48" : "47" },
  ];
  const ORDRE = [3, 2, 1, 0]; /* camps (haut→bas) → nœuds du monde (bas→haut) */
  const [selCamp, setSelCamp] = useState(() => { const k = camps.findIndex((c) => c.etat === "encours"); return k < 0 ? 1 : k; });
  useEffect(() => { const k = camps.findIndex((c) => c.etat === "encours"); if (k >= 0) setSelCamp(k); }, [app.gate1]);
  const NT = [0.1, 0.36, 0.64, 0.96];
  const progress = app.gate1
    ? NT[2] + Math.min(1, app.xp / 3400) * (NT[3] - NT[2])
    : NT[1] + Math.min(1, app.xp / 2600) * (NT[2] - NT[1]);
  const noeuds = ORDRE.map((k) => camps[k]);
  const sel = camps[selCamp] || camps[1];

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: 28 }}>
      <div className="px-5"><TitrePage sous="Glisse pour tourner le monde · touche une balise.">Parcours</TitrePage></div>

      {/* Monde 3D */}
      <div style={{ margin: "6px 2px 0" }}>
        <Suspense fallback={<div style={{ height: 350, display: "grid", placeItems: "center", color: C.doux, fontSize: 12.5 }}>Le monde se dessine…</div>}>
          <WorldScene
            noeuds={noeuds}
            progress={progress}
            selected={ORDRE.indexOf(selCamp)}
            onSelect={(i) => { setSelCamp(ORDRE[i]); vibrate(8); }}
            actif={active !== false}
          />
        </Suspense>
      </div>

      {/* Balise sélectionnée */}
      <div className="px-5">
      <Glass className="p-4" style={{ marginTop: -6, borderColor: sel.etat === "encours" ? "rgba(255,184,107,.4)" : C.bord }}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 14, fontWeight: 700, color: C.neige }}>{sel.etat === "fait" ? "⭐ " : sel.etat === "encours" ? "🚩 " : "🔒 "}{sel.nom}</div>
          <div style={{ fontFamily: FONT_D, fontSize: 11.5, color: sel.etat === "encours" ? C.aube : C.glacier }}>{sel.alt}</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.doux, marginTop: 4 }}>{sel.xp}</div>
        {sel.etat === "encours" && (
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 9, overflow: "hidden" }}>
            <div style={{ width: `${sel.pct}%`, height: "100%", background: C.aube, borderRadius: 99, transition: "width .6s ease" }} />
          </div>
        )}
        {sel.porte && (
          <Bouton couleur={C.aube} onClick={act.openGate} style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <DoorOpen size={15} /> Franchir la porte — énigme du gardien
          </Bouton>
        )}
      </Glass>
      </div>

      <div className="px-5">

      {/* Pourquoi profond */}
      <Glass className="p-4 mt-4" style={{ background: "linear-gradient(90deg, rgba(255,184,107,0.12), rgba(255,255,255,0.05))" }}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.aube }}>Ton pourquoi profond</div>
          <button className="pressable" onClick={() => setEditP((e) => !e)} style={{ background: "none", border: "none", color: editP ? C.glacier : C.doux, padding: 3 }}><Pencil size={14} /></button>
        </div>
        {editP ? (
          <textarea value={app.pourquoi} onChange={(e) => act.setPourquoi(e.target.value)} rows={2}
            style={{ fontFamily: FONT_B, fontSize: 13.5, color: C.neige, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 12, padding: "10px 12px", outline: "none", width: "100%", resize: "none", marginTop: 8, lineHeight: 1.55 }} />
        ) : (
          <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.55, marginTop: 6, fontStyle: "italic" }}>« {app.pourquoi} »</p>
        )}
      </Glass>

      {/* Coffre mensuel */}
      <Glass className="p-4 mt-3 flex items-center justify-between" style={{ borderColor: app.coffreJuillet ? C.bord : "rgba(255,184,107,.4)" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,184,107,0.15)", fontSize: 19 }}>{app.coffreJuillet ? "📭" : "🎁"}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Coffre de juillet</div>
            <div style={{ fontSize: 11.5, color: C.doux }}>{app.coffreJuillet ? "Ouvert — rendez-vous en août" : "1 récompense surprise du mois"}</div>
          </div>
        </div>
        {!app.coffreJuillet && <Bouton couleur={C.aube} onClick={act.ouvrirCoffre} style={{ padding: "10px 14px" }}>Ouvrir</Bouton>}
      </Glass>

      {/* Saison en cours */}
      <Glass className="p-4 mt-3">
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 13, fontWeight: 700, color: C.neige }}>🔥 Saison : Été de Feu</div>
          <span style={{ fontSize: 11.5, color: C.doux }}>J-34</span>
        </div>
        <div style={{ fontSize: 12, color: C.doux, marginTop: 3 }}>Récompense de saison : aura Braise + chapeau Étoile</div>
        <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 9, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(4, Math.min(100, ((app.xp - 2000) / 1000) * 100))}%`, height: "100%", background: "linear-gradient(90deg,#FF8A6B,#FFB86B)", borderRadius: 99, transition: "width .6s ease" }} />
        </div>
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 10, marginBottom: 10 }}>Fiertés</div>
      {fiertes.map((f, i) => (
        <Glass key={i} className="p-3 px-4 mb-2 flex items-center justify-between">
          <span style={{ fontSize: 13, color: C.neige }}>{f.t}</span>
          <span style={{ fontFamily: FONT_D, fontSize: 12, color: C.aube }}>{f.v}</span>
        </Glass>
      ))}

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 10 }}>Milestones cachés</div>
      {[
        { t: "100 séances", v: app.seanceFaite ? 48 : 47, max: 100 },
        { t: "1 000 verres d'eau", v: 812 + app.eau, max: 1000 },
        { t: "30 jours de série", v: 12, max: 30 },
      ].map((m, i) => (
        <Glass key={i} className="p-3 px-4 mb-2">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, color: C.neige }}>{m.t}</span>
            <span style={{ fontSize: 12, color: C.doux }}>{m.v}/{m.max}</span>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 7, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (m.v / m.max) * 100)}%`, height: "100%", background: C.glacier, borderRadius: 99 }} />
          </div>
        </Glass>
      ))}

      {/* Lettres au futur */}
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 10 }}>Lettres à ton futur toi</div>
      {app.lettres.map((l, i) => (
        <Glass key={i} className="p-4 mb-2 flex items-center gap-3" style={{ borderColor: "rgba(255,184,107,.3)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,184,107,0.15)", flexShrink: 0 }}>
            <Mail size={17} style={{ color: C.aube }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.neige }}>Lettre scellée 🔏</div>
            <div style={{ fontSize: 11.5, color: C.doux }}>S'ouvre dans {l.jours} jours — patience, elle t'attend au sommet.</div>
          </div>
        </Glass>
      ))}
      <Glass className="p-4">
        <textarea value={lettre} onChange={(e) => setLettre(e.target.value)} placeholder="Cher futur moi, aujourd'hui je te promets…" rows={3}
          style={{ fontFamily: FONT_B, fontSize: 13.5, color: C.neige, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.bord}`, borderRadius: 12, padding: "11px 13px", outline: "none", width: "100%", resize: "none", lineHeight: 1.55 }} />
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            {[30, 90].map((d) => (
              <button key={d} className="pressable" onClick={() => setDureeL(d)} style={{
                fontFamily: FONT_B, fontSize: 12, fontWeight: 700, padding: "8px 13px", borderRadius: 999,
                border: `1px solid ${dureeL === d ? "rgba(255,184,107,.45)" : C.bord}`,
                background: dureeL === d ? "rgba(255,184,107,.16)" : "rgba(255,255,255,.06)", color: dureeL === d ? C.aube : C.doux,
              }}>{d} jours</button>
            ))}
          </div>
          <Bouton couleur={C.aube} onClick={() => { if (lettre.trim()) { act.scellerLettre(lettre.trim(), dureeL); setLettre(""); } }}>Sceller ✉️</Bouton>
        </div>
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 10 }}>Journal d'XP</div>
      {app.ledger.length === 0 && <div style={{ fontSize: 12.5, color: C.doux }}>Tes gains d'XP s'afficheront ici, pas après pas.</div>}
      {app.ledger.map((l, i) => (
        <Glass key={i} className="p-3 px-4 mb-2 flex items-center justify-between">
          <span style={{ fontSize: 12.5, color: C.neige }}>{l.msg}</span>
          <span style={{ fontFamily: FONT_D, fontSize: 11, color: C.aube }}>+{l.xp}</span>
        </Glass>
      ))}
      </div>
    </div>
  );
}

/* ================= PAGE : COMPAGNON ================= */
function PageCompagnon({ app, act, nimbo, phrase }) {
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage>Compagnon</TitrePage>
      {(() => { const actif = COMPAGNONS.find((c) => c.id === app.compagnon) || COMPAGNONS[0]; return (
      <div className="flex flex-col items-center mt-2 relative">
        {phrase && <div className="phrase-pop2" style={{ position: "absolute", top: 4, zIndex: 3, background: "rgba(12,18,48,0.92)", border: `1px solid ${C.bord}`, color: C.neige, fontSize: 12.5, padding: "8px 13px", borderRadius: 14 }}>{phrase}</div>}
        <div style={{ width: "100%", margin: "0 -8px" }}>
          <Suspense fallback={<div style={{ height: 300, display: "grid", placeItems: "center", color: C.doux, fontSize: 12.5 }}>{actif.nom} arrive…</div>}>
            <Companion3D
              compagnonId={actif.id}
              body={actif.body}
              hatId={app.cosm.hat}
              tenueId={app.cosm.tenue}
              aura={auraC(app.cosm.aura)}
              mood={nimbo.mood}
              onTap={act.tapNimbo}
            />
          </Suspense>
        </div>
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige, marginTop: 2 }}>{actif.nom}</div>
        <div style={{ fontSize: 12.5, color: C.doux }}>{actif.sous} · Niveau {app.niveauxC[actif.id]}</div>
        <div style={{ width: 180, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: "62%", height: "100%", background: C.glacier, borderRadius: 99 }} />
        </div>
        <div style={{ fontSize: 11, color: C.doux, marginTop: 4 }}>Attrape-le au doigt, lance-le, il rebondit — et revient toujours.</div>
      </div>
      ); })()}
      <Glass className="p-4 mt-5">
        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.glacier }}>Son histoire</div>
        <p style={{ fontSize: 13, color: C.neige, lineHeight: 1.55, marginTop: 6 }}>
          {(COMPAGNONS.find((c) => c.id === app.compagnon) || COMPAGNONS[0]).lore}
        </p>
      </Glass>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Vestiaire · Chapeaux</div>
      <div className="grid grid-cols-4 gap-2">
        <button className="pressable" onClick={() => act.setHat(null)} style={{ height: 58, borderRadius: 16, border: `2px solid ${app.cosm.hat === null ? C.glacier : C.bord}`, background: "rgba(255,255,255,0.05)", color: C.doux, fontSize: 11, fontFamily: FONT_B }}>Aucun</button>
        {HATS.map((h) => {
          const ok = app.cosm.hats.includes(h.id);
          return (
            <button key={h.id} className="pressable" disabled={!ok} onClick={() => ok && act.setHat(app.cosm.hat === h.id ? null : h.id)} style={{
              height: 58, borderRadius: 16, position: "relative", fontSize: 22,
              border: `2px solid ${app.cosm.hat === h.id ? C.glacier : C.bord}`,
              background: "rgba(255,255,255,0.05)", opacity: ok ? 1 : 0.45,
            }}>
              {h.e}
              {!ok && <Lock size={11} style={{ position: "absolute", bottom: 5, right: 6, color: C.doux }} />}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.doux, marginTop: 6 }}>Les chapeaux verrouillés se gagnent en grimpant (balises, séries, saisons) — 24 modèles en production.</div>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Vestiaire · Auras</div>
      <div className="flex gap-3 flex-wrap">
        {AURAS.map((a) => {
          const ok = app.cosm.auras.includes(a.id);
          return (
            <button key={a.id} className="pressable" disabled={!ok} onClick={() => ok && act.setAura(a.id)} style={{
              width: 44, height: 44, borderRadius: 999, position: "relative", border: "none",
              background: a.c, boxShadow: `0 0 16px ${a.c}66`,
              outline: app.cosm.aura === a.id ? `3px solid ${C.neige}` : "none", outlineOffset: 2,
              opacity: ok ? 1 : 0.35,
            }}>
              {!ok && <Lock size={12} style={{ position: "absolute", top: 14, left: 15, color: "#0A0F28" }} />}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Vestiaire · Tenues</div>
      <div className="grid grid-cols-4 gap-2">
        <button className="pressable" onClick={() => act.setTenue(null)} style={{ height: 58, borderRadius: 16, border: `2px solid ${app.cosm.tenue === null ? C.glacier : C.bord}`, background: "rgba(255,255,255,0.05)", color: C.doux, fontSize: 11, fontFamily: FONT_B }}>Aucune</button>
        {TENUES.map((t) => {
          const ok = app.cosm.tenues.includes(t.id);
          return (
            <button key={t.id} className="pressable" disabled={!ok} onClick={() => ok && act.setTenue(app.cosm.tenue === t.id ? null : t.id)} style={{
              height: 58, borderRadius: 16, position: "relative", fontSize: 21,
              border: `2px solid ${app.cosm.tenue === t.id ? C.glacier : C.bord}`,
              background: "rgba(255,255,255,0.05)", opacity: ok ? 1 : 0.45,
            }}>
              {t.e}
              {!ok && <Lock size={11} style={{ position: "absolute", bottom: 5, right: 6, color: C.doux }} />}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.doux, marginTop: 6 }}>Écharpe, cape, sac… portés pour de vrai : ancrés au corps, ils bougent, sautent et s'écrasent avec lui.</div>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Villages débloqués</div>
      {VILLAGES.map((v, i) => {
        const ok = app.villages.includes(v.id);
        return (
          <Glass key={i} className="p-3 px-4 mb-2 flex items-center justify-between" style={{ opacity: ok ? 1 : 0.55 }}>
            <span style={{ fontSize: 13, color: C.neige }}>{ok ? "⭐ " : "🔒 "}{v.nom}</span>
            <span style={{ fontFamily: FONT_D, fontSize: 11, color: ok ? C.glacier : C.doux }}>{v.alt}</span>
          </Glass>
        );
      })}

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>La cordée · {app.compagnons.length}/9 débloqués</div>
      <div className="grid grid-cols-3 gap-3">
        {COMPAGNONS.map((c) => {
          const ok = app.compagnons.includes(c.id);
          return (
            <Glass key={c.id} pressable onClick={() => act.setCompagnon(c.id)} className="flex flex-col items-center justify-center gap-1" style={{ height: 92, borderColor: app.compagnon === c.id ? "rgba(143,227,240,.55)" : C.bord, opacity: ok ? 1 : 0.55, padding: "6px 4px" }}>
              {ok
                ? <div style={{ width: 30, height: 30, borderRadius: 99, background: c.body, boxShadow: `0 0 16px ${c.body}66` }} />
                : <Lock size={15} style={{ color: C.doux }} />}
              <span style={{ fontSize: 11, fontWeight: 700, color: app.compagnon === c.id ? C.glacier : ok ? C.neige : C.doux, fontFamily: FONT_B, textAlign: "center" }}>{c.nom}{ok ? ` · Nv ${app.niveauxC[c.id]}` : ""}</span>
              {!ok && c.cond && <span style={{ fontSize: 9, color: C.doux, fontFamily: FONT_B, textAlign: "center", lineHeight: 1.25 }}>{c.cond}</span>}
            </Glass>
          );
        })}
      </div>
    </div>
  );
}

/* ================= MINI-GRAPHIQUE SVG ================= */
function MiniChart({ series, labels, height = 140 }) {
  const W = 330, H = height, P = 14;
  const n = labels.length;
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, n - 1);
  const y = (v) => H - P - (Math.max(0, Math.min(100, v)) / 100) * (H - 2 * P);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {[0, 50, 100].map((g) => (
          <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}
        {series.map((s, k) => {
          const segments = [];
          let cur = [];
          s.values.forEach((v, i) => {
            if (v == null) { if (cur.length > 1) segments.push(cur); cur = []; }
            else cur.push([i, v]);
          });
          if (cur.length > 1) segments.push(cur);
          return (
            <g key={k}>
              {segments.map((sg, j) => (
                <polyline key={j} points={sg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {s.values.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 4 : 2.5} fill={s.color} />))}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between" style={{ padding: "0 6px" }}>
        {labels.map((l, i) => (
          <span key={i} style={{ fontSize: 10, color: i === n - 1 ? C.glacier : C.doux, fontWeight: i === n - 1 ? 700 : 400 }}>{l}</span>
        ))}
      </div>
      <div className="flex gap-4 justify-center mt-2">
        {series.map((s, k) => (
          <div key={k} className="flex items-center gap-1">
            <div style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11, color: C.doux }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= PAGE : STATISTIQUES ================= */
function HeatmapAnnuelle({ app }) {
  const scrollRef = useRef(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollLeft = el.scrollWidth; }, []);
  const parJour = {};
  (app.historique || []).forEach((h) => { parJour[h.d] = h.score; });
  parJour[todayKey()] = app.score;
  const auj = new Date();
  const decal = (auj.getDay() + 6) % 7; /* lundi = ligne 0 */
  const semaines = [];
  for (let w = 51; w >= 0; w--) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(auj.getTime() - (w * 7 + (decal - r)) * 86400000);
      if (d.getTime() > auj.getTime() + 3600000) { col.push(null); continue; }
      const dk = d.toISOString().slice(0, 10);
      col.push({ v: parJour[dk] ?? null, today: dk === todayKey() });
    }
    semaines.push(col);
  }
  const JLBL = ["L", "", "M", "", "V", "", "D"];
  return (
    <div className="flex gap-2">
      <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
        {JLBL.map((l, i) => <span key={i} style={{ fontSize: 8.5, color: C.doux, height: 10, lineHeight: "10px" }}>{l}</span>)}
      </div>
      <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarWidth: "none", flex: 1 }}>
        <div style={{ display: "flex", gap: 3, width: "max-content", padding: "2px 2px 4px" }}>
          {semaines.map((col, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {col.map((c, j) => (
                <div key={j} style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: !c || c.v == null ? "rgba(255,255,255,0.055)" : `rgba(143,227,240,${0.14 + (c.v / 100) * 0.62})`,
                  outline: c && c.today ? `1.5px solid ${C.aube}` : "none",
                  outlineOffset: c && c.today ? 1 : 0,
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageStats({ app }) {
  const hist = app.historique || [];
  const pts = [...hist.slice(-13), { d: todayKey(), score: app.score, humeur: app.humeur, seance: app.seanceFaite, hab: null, eau: app.eau }];
  const labels = pts.map((p, i) => (i === pts.length - 1 ? "Auj" : i % 2 === 0 ? String(parseInt(p.d.slice(8), 10)) : ""));
  const scores = pts.map((p) => p.score);
  const humeurs = pts.map((p) => (p.humeur != null ? p.humeur * 10 : null));
  const h7 = hist.slice(-6); /* 6 jours archivés + aujourd'hui = fenêtre de 7 */
  const seances7 = h7.filter((h) => h.seance).length + (app.seanceFaite ? 1 : 0);
  const hu7 = [...h7.filter((h) => h.humeur != null).map((h) => h.humeur), ...(app.humeur != null ? [app.humeur] : [])];
  const humMoy = hu7.length ? (hu7.reduce((s, v) => s + v, 0) / hu7.length).toFixed(1) : "—";
  const hab7 = h7.filter((h) => h.hab != null);
  const habMoy = hab7.length ? Math.round(hab7.reduce((s, h) => s + h.hab, 0) / hab7.length) + " %" : "—";
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Ta montée, en vrais chiffres.">Statistiques</TitrePage>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[["Séances · 7 j", seances7], ["Humeur moy. · 7 j", humMoy], ["Habitudes · 7 j", habMoy]].map(([t, v]) => (
          <Glass key={t} className="p-3 flex flex-col items-center gap-1">
            <span style={{ fontFamily: FONT_D, fontSize: 16, color: C.glacier }}>{v}</span>
            <span style={{ fontSize: 9.5, color: C.doux, textAlign: "center", lineHeight: 1.3 }}>{t}</span>
          </Glass>
        ))}
      </div>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>14 derniers jours</div>
      <Glass className="p-4">
        <MiniChart labels={labels} series={[
          { name: "Score du jour", color: C.glacier, values: scores },
          { name: "Humeur ×10", color: C.aube, values: humeurs },
        ]} />
        {hist.length < 3 && <div style={{ fontSize: 11.5, color: C.doux, marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>Tes courbes se dessinent jour après jour — la montagne s'en souvient. 🌱</div>}
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Ton année d'ascension</div>
      <Glass className="p-4">
        <HeatmapAnnuelle app={app} />
        <div style={{ fontSize: 11, color: C.doux, marginTop: 9, textAlign: "center" }}>52 semaines · plus la case est claire, plus tu as grimpé · aujourd'hui cerclé d'or</div>
      </Glass>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Par exercice</div>
      {Object.entries(app.pr).map(([nom, kg]) => (
        <Glass key={nom} className="p-3 px-4 mb-2 flex items-center justify-between">
          <span style={{ fontSize: 13, color: C.neige }}>{nom}</span>
          <span style={{ fontFamily: FONT_D, fontSize: 12, color: C.aube }}>PR {fmtKg(kg)} kg</span>
        </Glass>
      ))}
      {app.dernierRecap && (
        <Glass className="p-3 px-4 mb-2 flex items-center justify-between" style={{ borderColor: "rgba(143,227,240,.3)" }}>
          <span style={{ fontSize: 13, color: C.neige }}>Dernière séance ({app.dernierRecap.nom})</span>
          <span style={{ fontFamily: FONT_D, fontSize: 12, color: C.glacier }}>{fmtKg(app.dernierRecap.volume)} kg</span>
        </Glass>
      )}
    </div>
  );
}

/* ================= PAGE : CYCLE ================= */
function PageCycle({ app, act }) {
  const { debutOffset, lenCycle, lenRegles } = app.cycle;
  const jourCycle = debutOffset + 1;
  const phase = debutOffset < lenRegles ? "Règles" : debutOffset < 13 ? "Phase folliculaire" : debutOffset < 16 ? "Ovulation" : "Phase lutéale";
  const reste = Math.max(0, lenCycle - debutOffset);
  const Stepper = ({ label, value, min, max, onChange, unite }) => (
    <div className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ fontSize: 13.5, color: C.neige }}>{label}</span>
      <div className="flex items-center gap-3">
        <button className="pressable" onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.07)", color: C.neige, fontSize: 16 }}>−</button>
        <span style={{ fontFamily: FONT_D, fontSize: 13, color: C.glacier, minWidth: 44, textAlign: "center" }}>{value} {unite}</span>
        <button className="pressable" onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.07)", color: C.neige, fontSize: 16 }}>+</button>
      </div>
    </div>
  );
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Suivi, prédictions et repères — en douceur.">Cycle</TitrePage>

      <Glass className="p-5 mt-4 text-center">
        <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.doux }}>{phase}</div>
        <div style={{ fontFamily: FONT_D, fontSize: 30, color: C.neige, marginTop: 6 }}>Jour {jourCycle}</div>
        <div style={{ fontSize: 12.5, color: C.doux, marginTop: 4 }}>Prochaines règles estimées dans <span style={{ color: C.aube, fontWeight: 700 }}>{reste} jour{reste > 1 ? "s" : ""}</span></div>
        <div className="flex gap-1 mt-4 justify-center flex-wrap">
          {Array.from({ length: lenCycle }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 99,
              background: i < lenRegles ? "rgba(255,182,201,0.8)" : i >= 12 && i <= 15 ? "rgba(255,184,107,0.7)" : "rgba(143,227,240,0.3)",
              outline: i === debutOffset ? `2px solid ${C.neige}` : "none", outlineOffset: 1,
            }} />
          ))}
        </div>
        <div className="flex gap-4 justify-center mt-3">
          {[["Règles", "rgba(255,182,201,0.8)"], ["Ovulation", "rgba(255,184,107,0.7)"], ["Autres", "rgba(143,227,240,0.3)"]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1"><div style={{ width: 8, height: 8, borderRadius: 99, background: c }} /><span style={{ fontSize: 10.5, color: C.doux }}>{l}</span></div>
          ))}
        </div>
      </Glass>

      <Bouton onClick={act.cycleStart} couleur={"rgba(255,182,201,0.85)"} style={{ width: "100%", marginTop: 12 }}>Mes règles commencent aujourd'hui</Bouton>

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 2 }}>Paramètres</div>
      <Stepper label="Longueur du cycle" value={lenCycle} min={21} max={40} unite="j" onChange={(v) => act.setCycle({ lenCycle: v })} />
      <Stepper label="Durée des règles" value={lenRegles} min={2} max={10} unite="j" onChange={(v) => act.setCycle({ lenRegles: v })} />

      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 22, marginBottom: 10 }}>Historique</div>
      {["30 juin — cycle de 29 j", "1 juin — cycle de 28 j", "4 mai — cycle de 28 j"].map((h, i) => (
        <Glass key={i} className="p-3 px-4 mb-2"><span style={{ fontSize: 13, color: C.neige }}>{h}</span></Glass>
      ))}
      <div style={{ fontSize: 11.5, color: C.doux, marginTop: 8, lineHeight: 1.5 }}>Les prédictions sont des estimations, pas un avis médical ni un moyen de contraception.</div>
    </div>
  );
}

/* ================= ÉNIGMES DU JOUR ================= */
const ENIGMES = [
  {
    diff: "Facile", xp: 4, type: "num",
    q: "Complète la suite : 2, 4, 8, 16, … ?",
    indice: "Chaque nombre est le double du précédent.",
    reponse: (v) => parseNum(v) === 32, solution: "32",
  },
  {
    diff: "Facile", xp: 6, type: "texte",
    q: "Anagramme : remets les lettres dans l'ordre → T · N · E · M · O · S",
    indice: "C'est là où mène toute ascension.",
    reponse: (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "").toUpperCase() === "SOMMET",
    solution: "SOMMET",
  },
  {
    diff: "Moyen", xp: 8, type: "qcm",
    q: "Plus j'avance, plus j'en laisse derrière moi. Qui suis-je ?",
    choix: ["Le vent", "Mes pas", "Mon ombre", "Le temps"],
    indice: "Regarde le sol derrière toi sur le sentier.",
    reponse: (v) => v === "Mes pas", solution: "Mes pas",
  },
  {
    diff: "Difficile", xp: 10, type: "num",
    q: "Un alpiniste grimpe 300 m par jour mais glisse de 100 m chaque nuit. Le sommet est à 1 000 m. En combien de jours l'atteint-il ?",
    indice: "Le dernier jour, il atteint le sommet avant la nuit — il ne glisse pas.",
    reponse: (v) => parseNum(v) === 5, solution: "5 jours",
  },
  {
    diff: "Extrême", xp: 12, type: "num",
    q: "Un névé double de surface chaque jour. Au jour 20, il couvre tout le glacier. Quel jour en couvrait-il la moitié ?",
    indice: "Raisonne à rebours depuis le jour 20.",
    reponse: (v) => parseNum(v) === 19, solution: "Jour 19",
  },
];

function EnigmesOverlay({ app, act, onClose }) {
  const [vals, setVals] = useState(Array(ENIGMES.length).fill(""));
  const [erreurs, setErreurs] = useState(Array(ENIGMES.length).fill(0));
  const faites = app.enigmes.filter((e) => e.fait).length;
  const gagne = app.enigmes.reduce((s, e, i) => s + (e.fait ? (e.indice ? Math.floor(ENIGMES[i].xp / 2) : ENIGMES[i].xp) : 0), 0);

  const valider = (i, valeur) => {
    if (ENIGMES[i].reponse(valeur)) {
      act.solveEnigme(i);
    } else {
      setErreurs((e) => e.map((n, k) => (k === i ? n + 1 : n)));
      vibrate(30);
    }
  };

  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0A1028,#131B3E)", zIndex: 48, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige }}>Énigmes du jour</div>
          <div style={{ fontSize: 12, color: C.doux, marginTop: 2 }}>{faites}/5 résolues · <span style={{ color: C.aube }}>+{gagne} XP gagnés</span></div>
        </div>
        <button className="pressable" onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", color: C.neige }}><X size={18} /></button>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${(faites / 5) * 100}%`, height: "100%", background: C.aube, transition: "width .4s ease" }} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        {ENIGMES.map((e, i) => {
          const st = app.enigmes[i];
          const xpAffiche = st.indice ? Math.floor(e.xp / 2) : e.xp;
          return (
            <Glass key={i} className={"p-4 mb-3" + (erreurs[i] > 0 && !st.fait ? " shake-" + (erreurs[i] % 2) : "")} style={{ borderColor: st.fait ? "rgba(155,232,176,.4)" : C.bord }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: e.diff === "Extrême" ? "#FF9AA8" : e.diff === "Difficile" ? C.aube : C.glacier }}>
                  {i + 1} · {e.diff}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: st.fait ? C.vert : C.aube }}>
                  {st.fait ? `+${xpAffiche} XP ✓` : `+${xpAffiche} XP${st.indice ? " (indice)" : ""}`}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.55, marginTop: 8 }}>{e.q}</p>

              {st.fait ? (
                <div style={{ fontSize: 13, color: C.vert, marginTop: 10, fontWeight: 600 }}>Réponse : {e.solution} 🎉</div>
              ) : (
                <>
                  {st.indice && <div style={{ fontSize: 12.5, color: C.aube, marginTop: 8, fontStyle: "italic" }}>💡 {e.indice}</div>}

                  {e.type === "qcm" ? (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {e.choix.map((c) => (
                        <button key={c} className="pressable" onClick={() => valider(i, c)} style={{
                          fontFamily: FONT_B, fontSize: 12.5, fontWeight: 600, padding: "11px 8px", borderRadius: 13,
                          border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.06)", color: C.neige,
                        }}>{c}</button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <Champ value={vals[i]} onChange={(v) => setVals((a) => a.map((x, k) => (k === i ? v : x)))}
                        placeholder={e.type === "num" ? "Ta réponse (nombre)…" : "Ta réponse…"} type={e.type === "num" ? "num" : "text"} />
                      <Bouton onClick={() => valider(i, vals[i])}>OK</Bouton>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    {!st.indice ? (
                      <button className="pressable" onClick={() => act.indiceEnigme(i)} style={{ background: "none", border: "none", color: C.doux, fontSize: 12, fontFamily: FONT_B, textDecoration: "underline", padding: 0 }}>
                        Prendre un indice (XP ÷ 2)
                      </button>
                    ) : <span />}
                    {erreurs[i] > 0 && <span style={{ fontSize: 12, color: "#FF9AA8" }}>Pas encore… réessaie 🧗</span>}
                  </div>
                </>
              )}
            </Glass>
          );
        })}
        {faites === 5 && (
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <div style={{ fontFamily: FONT_D, fontSize: 15, color: C.aube }}>Les 5 énigmes du jour sont tombées 🏔</div>
            <div style={{ fontSize: 12.5, color: C.doux, marginTop: 4 }}>Reviens demain pour une nouvelle cordée de casse-têtes.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= COMPAGNONS (cordée jouable) ================= */
const COMPAGNONS = [
  { id: "nimbo", nom: "Nimbo", body: "#E9F0FE", sous: "Petit fantôme des cimes", cond: null, lore: "Né du souffle du sommet un matin de première neige, Nimbo est descendu dans la vallée pour trouver quelqu'un qui rêve de grimper. Il ne juge jamais un jour raté : il souffle un peu de brume dessus, et repart avec toi le lendemain." },
  { id: "pip", nom: "Pip", body: "#FFD9A8", sous: "Étincelle des sentiers", cond: null, lore: "Pip est né d'une étincelle de feu de camp restée allumée toute une nuit d'orage. Vif, impatient, toujours premier au réveil — c'est lui qui te tire du lit les matins de séance. Sa petite flamme frémit quand tu bats un record." },
  { id: "gaspard", nom: "Gaspard", body: "#B8F0C8", sous: "Sage des alpages", cond: null, lore: "Gaspard médite depuis si longtemps sur son alpage que la mousse a poussé sur ses pensées. Il parle peu, respire beaucoup, et t'apprend que la montagne se gravit aussi assis, les yeux fermés. Sa barbe de brume frissonne au vent." },
  { id: "boum", nom: "Boum", body: "#FF9D8A", sous: "Cœur volcanique", cond: "Franchis la Porte du Col", lore: "Boum a dormi mille ans dans le cratère avant qu'un tambour de fête ne le réveille. Il déborde d'énergie brute — c'est lui qu'on appelle pour les derniers mètres, quand les jambes brûlent et que le sommet nargue. Son étincelle crépite au-dessus de sa mèche." },
  { id: "zaza", nom: "Zaza", body: "#C9A7FF", sous: "Rêveuse des crêtes", cond: "Série de 21 jours", lore: "Zaza n'a jamais marché : elle rebondit. Ses grandes oreilles captent les chansons que le vent compose entre les crêtes, et elle te les fredonne les soirs où la motivation flanche." },
  { id: "lumen", nom: "Lumen", body: "#FFF4D6", sous: "Lueur des refuges", cond: "10 respirations guidées", lore: "Lumen est la lumière qu'on aperçoit au refuge quand la nuit tombe trop vite. Douce et constante, elle veille sur tes rituels du soir et s'illumine quand tu écris ta gratitude." },
  { id: "rocky", nom: "Rocky", body: "#B9C2D8", sous: "Gardien de la paroi", cond: "50 séances de sport", lore: "Taillé dans la moraine, Rocky avance lentement mais n'a jamais reculé. Ses épaules de galets portent la mémoire de toutes tes séances — il grossit d'un caillou à chaque record battu." },
  { id: "fen", nom: "Fen", body: "#A7E8B8", sous: "Pousse des sous-bois", cond: "30 jours d'habitudes", lore: "Fen a germé dans l'empreinte d'un pas, preuve qu'un petit geste répété fait pousser des forêts. Sa feuille sur la tête se redresse à chaque habitude tenue — et penche les jours de repos, pour te rappeler qu'ils comptent aussi." },
  { id: "sol", nom: "Sol", body: "#FFCF7A", sous: "Éclat du plein midi", cond: "Saison Été de Feu", lore: "Sol est un rayon qui a refusé de se coucher. Il rayonne littéralement — ses pointes dorées tournent doucement autour de lui — et te promet que même les jours gris, le soleil grimpe derrière les nuages." },
];

const COMPANION_LINES = {
  matin: ["Le soleil se lève sur ton versant ☀️", "Nouvelle journée, nouveaux mètres à gravir.", "Pose ton intention, je m'occupe du reste.", "L'air est frais, parfait pour grimper."],
  midi: ["Mi-parcours — pense à boire un verre d'eau.", "On tient un bon rythme aujourd'hui.", "Un pas après l'autre, comme toujours."],
  soir: ["Le crépuscule tombe, écris ton ressenti ✨", "Regarde tout ce qu'on a gravi aujourd'hui.", "Le camp est proche, finis en douceur.", "Une pensée de gratitude avant la nuit ?"],
  seance: ["Quelle séance ! Je suis épaté 💪", "Tes muscles chantent, je les entends d'ici.", "Le sommet se rapproche à chaque série."],
  encouragement: ["Je crois en toi, même les jours gris.", "Un jour raté n'efface pas l'ascension.", "Chaque pas compte, tu sais.", "Fier de grimper à tes côtés."],
};
function companionLine(cat) {
  const lines = COMPANION_LINES[cat] || COMPANION_LINES.encouragement;
  const d = new Date();
  const slot = Math.floor(d.getHours() / 4);
  return lines[(d.getDate() + slot) % lines.length];
}
function pickMoodCtx(seanceFaite) {
  const h = new Date().getHours();
  if (h < 6 || h >= 23) return "sleepy";
  if (seanceFaite) return "proud";
  if (h >= 14 && h < 17) return "focused";
  if (h < 11) return "happy";
  return "calm";
}
function companionCat(seanceFaite) {
  const h = new Date().getHours();
  if (seanceFaite) return "seance";
  if (h < 11) return "matin";
  if (h >= 18) return "soir";
  if (h >= 11 && h < 15) return "midi";
  return "encouragement";
}

/* ================= CADEAUX DE FIDÉLITÉ (gacha au choix) ================= */
function GachaSheet({ act, onClose }) {
  const CHOIX = [
    { id: "aura-rose", e: "🌸", nom: "Aura Rosée", sous: "Cosmétique compagnon" },
    { id: "xp40", e: "⚡", nom: "+40 XP", sous: "Directement sur ta balise" },
    { id: "hat-bow", e: "🎀", nom: "Chapeau Nœud", sous: "Cosmétique compagnon" },
  ];
  return (
    <div className="absolute inset-0" style={{ background: "rgba(5,8,20,0.75)", zIndex: 55, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="w-full slide-up" onClick={(e) => e.stopPropagation()} style={{ background: "#101736", borderRadius: "24px 24px 0 0", padding: "22px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)", border: `1px solid ${C.bord}`, borderBottom: "none" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.aube }}>Cadeau de fidélité · 7 jours 🎁</div>
          <div style={{ fontSize: 12.5, color: C.doux, marginTop: 4 }}>Choisis ta récompense — pas de hasard subi, c'est toi qui décides.</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5">
          {CHOIX.map((c) => (
            <button key={c.id} className="pressable" onClick={() => act.choisirCadeau7(c.id)} style={{
              padding: "16px 6px", borderRadius: 18, border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            }}>
              <span style={{ fontSize: 26 }}>{c.e}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.neige, fontFamily: FONT_B }}>{c.nom}</span>
              <span style={{ fontSize: 10, color: C.doux, fontFamily: FONT_B }}>{c.sous}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= PORTE À ÉNIGME (franchir une balise) ================= */
const GATE_RIDDLE = {
  q: "On me franchit sans me toucher, on me voit sans jamais m'atteindre. Du sommet, je recule encore. Qui suis-je ?",
  choix: ["Le vent", "L'horizon", "Le nuage", "L'écho"],
  bonne: "L'horizon",
};
function GateSheet({ act, onClose }) {
  const [err, setErr] = useState(0);
  return (
    <div className="absolute inset-0" style={{ background: "rgba(5,8,20,0.78)", zIndex: 55, display: "flex", alignItems: "center", padding: 20 }} onClick={onClose}>
      <Glass className={"w-full p-5" + (err ? " shake-" + (err % 2) : "")} onClick={(e) => e.stopPropagation()} style={{ background: "rgba(16,23,54,0.98)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24 }}>🚪</div>
          <div style={{ fontFamily: FONT_D, fontSize: 15, color: C.aube, marginTop: 6 }}>La Porte du Col</div>
          <div style={{ fontSize: 12, color: C.doux, marginTop: 3 }}>Réponds à l'énigme du gardien pour franchir la balise.</div>
        </div>
        <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.6, marginTop: 14, textAlign: "center", fontStyle: "italic" }}>« {GATE_RIDDLE.q} »</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {GATE_RIDDLE.choix.map((c) => (
            <button key={c} className="pressable" onClick={() => { if (c === GATE_RIDDLE.bonne) act.franchirPorte(); else { setErr((e) => e + 1); vibrate(30); } }} style={{
              fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "12px 8px", borderRadius: 13,
              border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.06)", color: C.neige,
            }}>{c}</button>
          ))}
        </div>
        {err > 0 && <div style={{ fontSize: 12, color: "#FF9AA8", textAlign: "center", marginTop: 10 }}>Le gardien secoue la tête… réessaie 🧗</div>}
      </Glass>
    </div>
  );
}

/* ================= PAGE : DÉFIS ================= */
function PageDefis({ app, act }) {
  const [nom, setNom] = useState("");
  const [obj, setObj] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const SUGG = ["🎯", "🍭", "📚", "🏃", "🧊", "💤", "📵", "🥶"];
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Des objectifs à relever, un cran à la fois.">Défis</TitrePage>
      <div className="mt-4">
        {app.defis.map((d, i) => {
          const fini = d.cur >= d.obj;
          return (
            <Glass key={i} className="p-4 mb-3" style={{ borderColor: fini ? "rgba(155,232,176,.4)" : C.bord }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.06)", fontSize: 18 }}>{d.emoji}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.neige }}>{d.nom}</div>
                    <div style={{ fontSize: 11.5, color: fini ? C.vert : C.doux }}>{fini ? `Relevé ! +${d.xp} XP 🎉` : `${d.cur}/${d.obj} · +${d.xp} XP à la clé`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!fini && <Bouton onClick={() => act.incDefi(i)} style={{ padding: "9px 14px" }}>+1</Bouton>}
                  {fini && <Trophy size={18} style={{ color: C.aube }} />}
                  <button className="pressable" onClick={() => act.delDefi(i)} style={{ background: "none", border: "none", color: C.doux, padding: 4 }}><Trash2 size={15} /></button>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginTop: 11, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (d.cur / d.obj) * 100)}%`, height: "100%", borderRadius: 99, background: fini ? C.vert : C.aube, transition: "width .4s ease" }} />
              </div>
            </Glass>
          );
        })}
      </div>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 8, marginBottom: 10 }}>Nouveau défi</div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {SUGG.map((e) => (
          <button key={e} className="pressable" onClick={() => setEmoji(e)} style={{ width: 38, height: 38, borderRadius: 12, border: `2px solid ${emoji === e ? C.glacier : "transparent"}`, background: "rgba(255,255,255,0.07)", fontSize: 17 }}>{e}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Champ value={nom} onChange={setNom} placeholder="Ex : 7 jours sans sucre…" style={{ flex: 2 }} />
        <Champ value={obj} onChange={setObj} placeholder="Obj." type="num" style={{ flex: 0.8 }} />
        <Bouton onClick={() => { const o = parseNum(obj); if (nom.trim() && o > 0) { act.addDefi(emoji, nom.trim(), Math.round(o)); setNom(""); setObj(""); } }}><Plus size={16} /></Bouton>
      </div>
    </div>
  );
}

/* ================= PAGE : COACH IA ================= */
function PageCoach({ app, act }) {
  return (
    <div className="h-full overflow-y-auto px-5" style={{ paddingBottom: 28 }}>
      <TitrePage sous="Ton guide de cordée, nourri par tes données — jamais par ton journal.">Coach IA</TitrePage>

      {!app.premium ? (
        <Glass className="p-5 mt-4" style={{ background: "linear-gradient(90deg, rgba(255,184,107,0.14), rgba(255,255,255,0.05))", borderColor: "rgba(255,184,107,.35)" }}>
          <div className="flex items-center gap-2"><Crown size={17} style={{ color: C.aube }} /><span style={{ fontSize: 14, fontWeight: 700, color: C.neige }}>Le Coach est une fonctionnalité Premium</span></div>
          <p style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>Bilan hebdomadaire personnalisé, analyse de transformation, programmes sur mesure. Essai 7 jours, résiliable en un geste.</p>
          <Bouton couleur={C.aube} onClick={act.buyPremium} style={{ width: "100%", marginTop: 12 }}>Essayer 7 jours gratuits</Bouton>
        </Glass>
      ) : (
        <>
          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 18, marginBottom: 10 }}>Bilan hebdomadaire</div>
          <Glass className="p-4">
            {app.coachBilan ? (
              <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.65, whiteSpace: "pre-line" }}>{app.coachBilan}</p>
            ) : (
              <p style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6 }}>Le coach lit ta semaine (séances, habitudes, humeur, hydratation) et t'écrit un bilan honnête avec un cap pour la suite.</p>
            )}
            <Bouton onClick={act.genBilan} style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} couleur={app.coachLoad ? "rgba(255,255,255,0.18)" : C.glacier}>
              <Sparkles size={15} className={app.coachLoad ? "flame-pulse" : ""} /> {app.coachLoad ? "Le coach observe ta cordée…" : app.coachBilan ? "Régénérer le bilan" : "Générer mon bilan"}
            </Bouton>
          </Glass>

          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 20, marginBottom: 10 }}>Ma transformation</div>
          <Glass className="p-4">
            {!app.photos.avant || !app.photos.apres ? (
              <p style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6 }}>Ajoute tes photos « Avant » et « Maintenant » dans Corps → Suivi, puis le coach analysera ton évolution physique avec bienveillance.</p>
            ) : app.coachTransfo ? (
              <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.65 }}>{app.coachTransfo}</p>
            ) : (
              <p style={{ fontSize: 12.5, color: C.doux }}>Tes deux photos sont prêtes.</p>
            )}
            {app.photos.avant && app.photos.apres && (
              <Bouton onClick={act.genTransfo} style={{ width: "100%", marginTop: 12 }}>Analyser ma transformation</Bouton>
            )}
          </Glass>

          <div style={{ fontSize: 11.5, color: C.doux, marginTop: 14, lineHeight: 1.6 }}>
            🔒 Ton journal privé n'est jamais transmis au coach. Les analyses passent par ta route serveur /api/claude — clé cachée côté serveur, photos jamais conservées.
          </div>
        </>
      )}
    </div>
  );
}

/* ================= COSMÉTIQUES & VILLAGES ================= */
const HATS = [
  { id: "cap", e: "🧢", nom: "Casquette", lock: false },
  { id: "top", e: "🎩", nom: "Haut-de-forme", lock: false },
  { id: "party", e: "🎉", nom: "Fête", lock: false },
  { id: "grad", e: "🎓", nom: "Diplômé", lock: true, cond: "Balise 1 500 m" },
  { id: "crown", e: "👑", nom: "Couronne", lock: true, cond: "Sommet 2 000 m" },
  { id: "bow", e: "🎀", nom: "Nœud", lock: true, cond: "Série 30 j" },
  { id: "helmet", e: "⛑️", nom: "Casque", lock: true, cond: "100 séances" },
  { id: "star", e: "🌟", nom: "Étoile", lock: true, cond: "Saison Été de Feu" },
];
const AURAS = [
  { id: "glacier", c: "#8FE3F0", nom: "Glacier", lock: false },
  { id: "aube", c: "#FFB86B", nom: "Aube", lock: false },
  { id: "rose", c: "#FFB6C9", nom: "Rosée", lock: true, cond: "Quête hebdo" },
  { id: "vert", c: "#9BE8B0", nom: "Sous-bois", lock: true, cond: "21 j d'habitudes" },
  { id: "violet", c: "#C9A7FF", nom: "Lavande", lock: true, cond: "10 respirations" },
  { id: "braise", c: "#FF8A6B", nom: "Braise", lock: true, cond: "Saison Été de Feu" },
];
const TENUES = [
  { id: "echarpe", e: "🧣", nom: "Écharpe", lock: false },
  { id: "noeudpap", e: "🎀", nom: "Nœud pap'", lock: false },
  { id: "cape", e: "🦸", nom: "Cape", lock: true, cond: "Saison Été de Feu" },
  { id: "sac", e: "🎒", nom: "Sac de cordée", lock: true, cond: "100 séances" },
];
const VILLAGES = [
  { id: "etoiles", nom: "Village sous les étoiles", alt: "850 m" },
  { id: "neige", nom: "Village enneigé", alt: "1 500 m" },
  { id: "foret", nom: "Village de la forêt", alt: "1 800 m" },
  { id: "cote", nom: "Village de la côte", alt: "2 000 m" },
];

/* ================= AIDE ================= */
function AideOverlay({ onClose }) {
  const SECTIONS = [
    { t: "Naviguer", c: "Glisse horizontalement pour passer d'une carte à l'autre — c'est le geste roi. Le bouton en bas ouvre les raccourcis, le rouage en haut à droite ouvre les Réglages." },
    { t: "L'altitude du jour", c: "Ton score (0-100 %) devient des mètres gravis : humeur notée, séance, habitudes, tâches, repas, eau et journal font grimper Nimbo sur le sentier vers la balise." },
    { t: "La séance en direct", c: "Coche chaque série → confirme le poids (± 2,5 / 5, virgule acceptée) → repos automatique. Bats un record : célébration. Termine : récapitulatif complet." },
    { t: "Habitudes bienveillantes", c: "Configure des jours de repos par habitude (icône lit) : ils ne cassent jamais ta série. Glisse une ligne → pour faire, ← pour supprimer." },
    { t: "Le journal est privé", c: "Ce que tu écris dans le journal n'est jamais transmis au Coach IA, ni à personne. Les photos de progression restent sur ton appareil." },
    { t: "Compagnon & cosmétiques", c: "Touche Nimbo, il réagit. Équipe chapeaux et auras dans le vestiaire — les autres se débloquent en grimpant, jamais en payant seul." },
  ];
  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0A1028,#131B3E)", zIndex: 52, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige }}>Manuel de l'ascension</div>
        <button className="pressable" onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", color: C.neige }}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        {SECTIONS.map((s, i) => (
          <Glass key={i} className="p-4 mb-3">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.glacier }}>{s.t}</div>
            <p style={{ fontSize: 13, color: C.neige, lineHeight: 1.6, marginTop: 6 }}>{s.c}</p>
          </Glass>
        ))}
      </div>
    </div>
  );
}

/* ================= LÉGAL ================= */
function LegalOverlay({ page, onClose }) {
  const PAGES = {
    conf: { t: "Confidentialité", c: "Tes données t'appartiennent. Le journal privé n'est jamais transmis à l'IA ni à des tiers. Les photos de progression restent sur ton appareil. Les données de suivi sont stockées localement ; en production, une sauvegarde chiffrée optionnelle sera proposée. Aucune revente de données, jamais." },
    cond: { t: "Conditions d'utilisation", c: "ASCENT est un outil de développement personnel, pas un dispositif médical : les informations (cycle, nutrition, sport) sont indicatives et ne remplacent pas un avis professionnel. Le premium est un abonnement mensuel résiliable en un geste, avec essai gratuit sans piège. Version prototype — conditions complètes rédigées avec la structure juridique avant lancement." },
    apropos: { t: "À propos", c: "ASCENT — l'ascension de soi, un pas à la fois. Conçue comme une app satisfaisante et magnétique, jamais manipulatoire : pas de fausse rareté, pas de culpabilisation, pas de dark patterns. Le sommet, c'est toi. 🏔" },
  };
  const p = PAGES[page] || PAGES.apropos;
  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0A1028,#131B3E)", zIndex: 52, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige }}>{p.t}</div>
        <button className="pressable" onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", color: C.neige }}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: 24 }}>
        <p style={{ fontSize: 13.5, color: C.neige, lineHeight: 1.7 }}>{p.c}</p>
      </div>
    </div>
  );
}

/* ================= BIBLIOTHÈQUE D'EXERCICES ================= */
const BIBLIO = [
  { nom: "Développé couché", groupe: "Pectoraux", muscles: "Grand pectoral, triceps, deltoïde antérieur", exec: ["Allongé, pieds ancrés au sol, omoplates serrées.", "Descends la barre au niveau des pectoraux, coudes ~45°.", "Pousse en expirant sans verrouiller brutalement."], erreurs: ["Rebondir la barre sur la poitrine", "Décoller les fesses du banc"], materiel: "Barre + banc" },
  { nom: "Développé incliné haltères", groupe: "Pectoraux", muscles: "Haut des pectoraux, deltoïdes", exec: ["Banc incliné 30-45°, haltères au niveau des épaules.", "Pousse en arc léger jusqu'à presque tendre.", "Redescends contrôlé en 2-3 secondes."], erreurs: ["Incliner le banc trop haut (épaules dominent)", "Cogner les haltères en haut"], materiel: "Haltères + banc inclinable" },
  { nom: "Écarté poulie", groupe: "Pectoraux", muscles: "Grand pectoral (étirement)", exec: ["Poulies hauteur épaules, un pas en avant.", "Ramène les mains devant toi, coudes légèrement fléchis.", "Contrôle le retour en sentant l'étirement."], erreurs: ["Plier/tendre les coudes pendant le mouvement", "Charger trop lourd"], materiel: "Poulies vis-à-vis" },
  { nom: "Dips", groupe: "Pectoraux", muscles: "Pectoraux inférieurs, triceps", exec: ["Buste légèrement penché en avant.", "Descends jusqu'à ~90° de flexion des coudes.", "Remonte en poussant fort dans les paumes."], erreurs: ["Descendre trop bas (épaules)", "Rester trop vertical si cible pectoraux"], materiel: "Barres parallèles" },
  { nom: "Tractions", groupe: "Dos", muscles: "Grand dorsal, biceps, trapèzes", exec: ["Prise pronation un peu plus large que les épaules.", "Tire les coudes vers le bas, poitrine vers la barre.", "Descends complètement bras tendus, sans balancier."], erreurs: ["S'aider par élan (kipping non voulu)", "Amplitude partielle en bas"], materiel: "Barre fixe" },
  { nom: "Rowing barre", groupe: "Dos", muscles: "Grand dorsal, rhomboïdes, lombaires", exec: ["Buste penché ~45°, dos plat, genoux fléchis.", "Tire la barre vers le nombril, coudes le long du corps.", "Redescends sans arrondir le dos."], erreurs: ["Arrondir le bas du dos", "Tirer avec les bras plutôt que les coudes"], materiel: "Barre" },
  { nom: "Tirage vertical", groupe: "Dos", muscles: "Grand dorsal, biceps", exec: ["Assis, cuisses calées, prise large.", "Tire la barre vers le haut de la poitrine.", "Remonte contrôlé, épaules basses."], erreurs: ["Tirer derrière la nuque", "Se pencher exagérément en arrière"], materiel: "Poulie haute" },
  { nom: "Squat", groupe: "Jambes", muscles: "Quadriceps, fessiers, gainage", exec: ["Barre sur trapèzes, pieds largeur épaules.", "Descends hanches en arrière, genoux dans l'axe des pieds.", "Remonte en poussant le sol, buste gainé."], erreurs: ["Genoux qui rentrent vers l'intérieur", "Talons qui décollent"], materiel: "Barre + rack" },
  { nom: "Presse à cuisses", groupe: "Jambes", muscles: "Quadriceps, fessiers", exec: ["Pieds largeur épaules sur le plateau.", "Descends jusqu'à ~90° sans décoller le bas du dos.", "Pousse sans verrouiller les genoux."], erreurs: ["Amplitude trop courte", "Verrouiller brutalement les genoux"], materiel: "Machine presse" },
  { nom: "Soulevé de terre roumain", groupe: "Jambes", muscles: "Ischio-jambiers, fessiers, lombaires", exec: ["Barre contre les cuisses, genoux légèrement fléchis.", "Descends en poussant les hanches en arrière, dos plat.", "Remonte en serrant les fessiers."], erreurs: ["Arrondir le dos", "Éloigner la barre du corps"], materiel: "Barre" },
  { nom: "Développé militaire", groupe: "Épaules", muscles: "Deltoïdes, triceps, gainage", exec: ["Debout, barre au niveau des clavicules.", "Pousse au-dessus de la tête dans l'axe.", "Redescends contrôlé au menton."], erreurs: ["Cambrer excessivement le dos", "Pousser devant plutôt qu'au-dessus"], materiel: "Barre" },
  { nom: "Élévations latérales", groupe: "Épaules", muscles: "Deltoïde moyen", exec: ["Haltères le long du corps, coudes souples.", "Monte jusqu'à l'horizontale, petits doigts légèrement plus hauts.", "Redescends lentement sans élan."], erreurs: ["Charger trop lourd et tricher à l'élan", "Monter au-dessus des épaules"], materiel: "Haltères légers" },
  { nom: "Curl haltères", groupe: "Bras", muscles: "Biceps, avant-bras", exec: ["Coudes collés au buste.", "Monte en supination sans balancer.", "Redescends complètement en 2-3 s."], erreurs: ["Balancer le buste", "Amplitude partielle en bas"], materiel: "Haltères" },
  { nom: "Extension triceps poulie", groupe: "Bras", muscles: "Triceps", exec: ["Coudes fixes le long du corps.", "Tends les bras vers le bas complètement.", "Remonte contrôlé jusqu'à 90°."], erreurs: ["Écarter les coudes du corps", "Utiliser les épaules"], materiel: "Poulie haute + corde" },
];
const GROUPES = ["Tous", "Pectoraux", "Dos", "Jambes", "Épaules", "Bras", "Mes exercices"];

function BiblioOverlay({ app, act, onClose }) {
  const [q, setQ] = useState("");
  const [groupe, setGroupe] = useState("Tous");
  const [sel, setSel] = useState(null);
  const [nomP, setNomP] = useState("");
  const [groupeP, setGroupeP] = useState("Pectoraux");
  const [ficheIA, setFicheIA] = useState(null);
  const [ficheLoad, setFicheLoad] = useState(false);
  const genFiche = async () => {
    if (ficheLoad || !sel) return;
    setFicheLoad(true);
    try {
      const t = await askAI({
        prompt: `Fiche d'exercice de musculation « ${sel.nom} » (groupe : ${sel.groupe || "libre"}). Réponds en français, concis, format : MUSCLES CIBLÉS : … / EXÉCUTION : 3 étapes numérotées / ERREURS FRÉQUENTES : 2 / MATÉRIEL : …`,
        maxTokens: 500,
      });
      setFicheIA(t.trim());
    } catch (e) { setFicheIA("IA indisponible — vérifie ANTHROPIC_API_KEY sur Vercel."); }
    setFicheLoad(false);
  };

  const tous = [...BIBLIO, ...app.mesExos.map((e) => ({ ...e, perso: true }))];
  const liste = tous.filter((e) =>
    (groupe === "Tous" || (groupe === "Mes exercices" ? e.perso : e.groupe === groupe)) &&
    e.nom.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0A1028,#131B3E)", zIndex: 48, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige }}>{sel ? sel.nom : "Bibliothèque d'exercices"}</div>
        <button className="pressable" onClick={() => (sel ? setSel(null) : onClose())} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", color: C.neige }}>
          {sel ? <ChevronLeft size={18} /> : <X size={18} />}
        </button>
      </div>

      {!sel ? (
        <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
          <Champ value={q} onChange={setQ} placeholder="🔎 Rechercher un exercice…" />
          <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {GROUPES.map((g) => (
              <button key={g} className="pressable" onClick={() => setGroupe(g)} style={{
                fontFamily: FONT_B, fontSize: 12, fontWeight: 700, padding: "8px 13px", borderRadius: 999, flex: "0 0 auto",
                border: `1px solid ${groupe === g ? "rgba(143,227,240,.4)" : C.bord}`,
                background: groupe === g ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: groupe === g ? C.glacier : C.doux,
              }}>{g}</button>
            ))}
          </div>
          <div className="mt-3">
            {liste.map((e, i) => (
              <Glass key={i} pressable onClick={() => { setSel(e); setFicheIA(null); }} className="p-3 px-4 mb-2 flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.neige }}>{e.nom}{e.perso ? " ✦" : ""}</div>
                  <div style={{ fontSize: 11.5, color: C.doux }}>{e.perso ? "Mes exercices" : e.groupe}</div>
                </div>
                <ChevronRight size={16} style={{ color: C.doux }} />
              </Glass>
            ))}
            {liste.length === 0 && <div style={{ fontSize: 12.5, color: C.doux, textAlign: "center", padding: 16 }}>Rien trouvé — ajoute-le ci-dessous, il rejoindra "Mes exercices" durablement.</div>}
          </div>

          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 16, marginBottom: 10 }}>Ajouter un exercice perso</div>
          <div className="flex gap-2 flex-wrap mb-2">
            {GROUPES.slice(1, 6).map((g) => (
              <button key={g} className="pressable" onClick={() => setGroupeP(g)} style={{
                fontFamily: FONT_B, fontSize: 11.5, fontWeight: 700, padding: "7px 12px", borderRadius: 999,
                border: `1px solid ${groupeP === g ? "rgba(255,184,107,.45)" : C.bord}`,
                background: groupeP === g ? "rgba(255,184,107,.16)" : "rgba(255,255,255,.06)", color: groupeP === g ? C.aube : C.doux,
              }}>{g}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Champ value={nomP} onChange={setNomP} placeholder="Nom de l'exercice…" />
            <Bouton onClick={() => { if (nomP.trim()) { act.addMonExo(nomP.trim(), groupeP); setNomP(""); } }}><Plus size={16} /></Bouton>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
          <div style={{ fontSize: 12, color: C.glacier, fontWeight: 700 }}>{sel.perso ? "Mes exercices ✦" : sel.groupe}</div>
          {sel.perso ? (
            <div style={{ marginTop: 12 }}>
              {ficheIA ? (
                <p style={{ fontSize: 13, color: C.neige, lineHeight: 1.65, whiteSpace: "pre-line" }}>{ficheIA}</p>
              ) : (
                <p style={{ fontSize: 13, color: C.doux, lineHeight: 1.6 }}>Exercice perso — génère sa fiche complète (muscles, exécution, erreurs, matériel) avec l'IA.</p>
              )}
              <Bouton onClick={genFiche} style={{ width: "100%", marginTop: 10 }} couleur={ficheLoad ? "rgba(255,255,255,0.18)" : C.glacier}>
                {ficheLoad ? "Le coach rédige…" : ficheIA ? "Régénérer la fiche" : "✨ Générer la fiche IA"}
              </Bouton>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 14, marginBottom: 6 }}>Muscles ciblés</div>
              <p style={{ fontSize: 13, color: C.neige, lineHeight: 1.5 }}>{sel.muscles}</p>
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 16, marginBottom: 6 }}>Exécution</div>
              {sel.exec.map((s, i) => (
                <p key={i} style={{ fontSize: 13, color: C.neige, lineHeight: 1.55, marginBottom: 5 }}><span style={{ color: C.glacier, fontWeight: 700 }}>{i + 1}.</span> {s}</p>
              ))}
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 16, marginBottom: 6 }}>Erreurs fréquentes</div>
              {sel.erreurs.map((s, i) => (
                <p key={i} style={{ fontSize: 13, color: "#FF9AA8", lineHeight: 1.55, marginBottom: 5 }}>✗ {s}</p>
              ))}
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 16, marginBottom: 6 }}>Matériel</div>
              <p style={{ fontSize: 13, color: C.neige }}>{sel.materiel}</p>
            </>
          )}
          <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(sel.nom + " technique")}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.1)", border: `1px solid ${C.bord}`, color: C.neige, fontSize: 13, fontWeight: 700, fontFamily: FONT_B, textDecoration: "none" }}>
            <Play size={15} /> Voir la technique en vidéo
          </a>
          <Bouton onClick={() => { act.addExoToTemplate(sel.nom); setSel(null); }} style={{ width: "100%", marginTop: 10 }}>
            Ajouter à la séance {app.templateNom}
          </Bouton>
        </div>
      )}
    </div>
  );
}

/* ================= ONBOARDING ================= */
function OnboardingOverlay({ defaultPourquoi, onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState("");
  const [objectifs, setObjectifs] = useState([]);
  const [pourquoi, setPourquoi] = useState("");
  const [modsOffSel, setModsOffSel] = useState(["cycle"]);
  const [habSel, setHabSel] = useState(["💧 Boire 2 L d'eau", "📖 Lire 20 minutes"]);

  const OBJS = ["💪 Forme physique", "🎯 Discipline", "🧘 Sérénité", "😴 Meilleur sommeil", "🥦 Nutrition", "🌟 Confiance"];
  const MODS = [
    { key: "corps", nom: "Corps — sport, repas, planning, courses" },
    { key: "esprit", nom: "Esprit — journal, respiration, focus" },
    { key: "habitudes", nom: "Habitudes & tâches" },
    { key: "parcours", nom: "Parcours & fiertés" },
    { key: "stats", nom: "Statistiques" },
    { key: "cycle", nom: "Cycle menstruel" },
    { key: "compagnon", nom: "Compagnon" },
  ];
  const HABS = ["💧 Boire 2 L d'eau", "📖 Lire 20 minutes", "🧘 Méditer", "🚶 Marcher 30 min", "😴 Coucher avant 23 h", "✍️ Écrire 3 gratitudes"];

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const N = 6;
  const suivant = () => setStep((s) => Math.min(N - 1, s + 1));
  const finir = () => onFinish({ prenom: prenom.trim(), objectifs, pourquoi: pourquoi.trim() || defaultPourquoi, modsOff: modsOffSel, habitudes: habSel });

  const Chip = ({ on, onTap, children, wide }) => (
    <button className="pressable" onClick={onTap} style={{
      fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: wide ? "12px 14px" : "10px 15px", borderRadius: wide ? 15 : 999,
      border: `1px solid ${on ? "rgba(143,227,240,.45)" : C.bord}`, textAlign: "left",
      background: on ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: on ? C.glacier : C.neige,
      width: wide ? "100%" : "auto",
    }}>{children}</button>
  );

  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#070B1E,#131B3E)", zIndex: 70, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex gap-1">
          {Array.from({ length: N }).map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 99, background: i <= step ? C.glacier : "rgba(255,255,255,0.15)", transition: "all .3s ease" }} />
          ))}
        </div>
        <button className="pressable" onClick={onSkip} style={{ background: "none", border: "none", color: C.doux, fontSize: 12.5, fontFamily: FONT_B, textDecoration: "underline" }}>Passer</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6" style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 20 }}>
        {step === 0 && (
          <div className="text-center">
            <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: "0.3em", color: C.glacier }}>ASCENT</div>
            <div style={{ fontFamily: FONT_D, fontSize: 24, color: C.neige, marginTop: 14, lineHeight: 1.3 }}>Ta montagne<br />t'attend.</div>
            <p style={{ fontSize: 13.5, color: C.doux, marginTop: 12, lineHeight: 1.6 }}>Corps et esprit, un pas à la fois.<br />Comment veux-tu qu'on t'appelle ?</p>
            <div style={{ maxWidth: 260, margin: "22px auto 0" }}>
              <Champ value={prenom} onChange={setPrenom} placeholder="Ton prénom (optionnel)" style={{ textAlign: "center" }} />
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 19, color: C.neige }}>Quels sommets vises-tu{prenom ? `, ${prenom}` : ""} ?</div>
            <p style={{ fontSize: 12.5, color: C.doux, marginTop: 6 }}>Choisis-en autant que tu veux.</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {OBJS.map((o) => <Chip key={o} on={objectifs.includes(o)} onTap={() => toggle(objectifs, setObjectifs, o)}>{o}</Chip>)}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 19, color: C.neige }}>Ton pourquoi profond</div>
            <p style={{ fontSize: 12.5, color: C.doux, marginTop: 6, lineHeight: 1.55 }}>La vraie raison de ton ascension. Elle ressortira aux moments où tu en auras besoin.</p>
            <textarea value={pourquoi} onChange={(e) => setPourquoi(e.target.value)} placeholder={defaultPourquoi} rows={3}
              style={{ fontFamily: FONT_B, fontSize: 14, color: C.neige, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 14, padding: "13px 14px", outline: "none", width: "100%", resize: "none", lineHeight: 1.6, marginTop: 16 }} />
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 19, color: C.neige }}>Ton camp de base</div>
            <p style={{ fontSize: 12.5, color: C.doux, marginTop: 6 }}>Active seulement ce qui t'intéresse — modifiable à tout moment dans Réglages.</p>
            <div className="flex flex-col gap-2 mt-5">
              {MODS.map((m) => (
                <Chip key={m.key} wide on={!modsOffSel.includes(m.key)} onTap={() => toggle(modsOffSel, setModsOffSel, m.key)}>
                  {!modsOffSel.includes(m.key) ? "✓ " : ""}{m.nom}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 19, color: C.neige }}>Tes premières habitudes</div>
            <p style={{ fontSize: 12.5, color: C.doux, marginTop: 6 }}>Commence petit — deux ou trois suffisent pour lancer la cordée.</p>
            <div className="flex flex-col gap-2 mt-5">
              {HABS.map((h) => <Chip key={h} wide on={habSel.includes(h)} onTap={() => toggle(habSel, setHabSel, h)}>{habSel.includes(h) ? "✓ " : ""}{h}</Chip>)}
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="text-center flex flex-col items-center">
            <Nimbo size={110} mood="happy" />
            <div style={{ fontFamily: FONT_D, fontSize: 19, color: C.neige, marginTop: 14 }}>Voici Nimbo.</div>
            <p style={{ fontSize: 13.5, color: C.doux, marginTop: 10, lineHeight: 1.65, maxWidth: 290 }}>
              Petit fantôme des cimes, il grimpera chaque jour à tes côtés. Il ne juge jamais un jour raté —
              il souffle un peu de brume dessus, et repart avec toi le lendemain.
            </p>
          </div>
        )}
      </div>

      <div className="px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        <Bouton onClick={step === N - 1 ? finir : suivant} style={{ width: "100%", padding: "15px 16px", fontSize: 14 }}>
          {step === 0 ? "Commencer" : step === N - 1 ? "Commencer l'ascension 🏔" : "Continuer"}
        </Bouton>
      </div>
    </div>
  );
}

/* ================= RÉGLAGES (panneau) ================= */
function ReglagesOverlay({ skyMode, setSkyMode, app, act, modsOff, toggleMod, vibrOn, setVibrOn, onClose }) {
  const [kcal, setKcal] = useState(String(app.objKcal));
  const MODULES = [
    { key: "corps", nom: "Corps (sport & repas)", icon: Dumbbell },
    { key: "esprit", nom: "Esprit (journal & respiration)", icon: Feather },
    { key: "habitudes", nom: "Habitudes & tâches", icon: ListChecks },
    { key: "defis", nom: "Défis", icon: Flag },
    { key: "parcours", nom: "Parcours", icon: Map },
    { key: "stats", nom: "Statistiques", icon: BarChart3 },
    { key: "coach", nom: "Coach IA", icon: Bot },
    { key: "cycle", nom: "Cycle menstruel", icon: Heart },
    { key: "compagnon", nom: "Compagnon", icon: Ghost },
  ];
  const Ligne = ({ children }) => (<div className="flex items-center justify-between" style={{ padding: "13px 0", borderBottom: `1px solid rgba(255,255,255,0.07)` }}>{children}</div>);
  const Toggle = ({ on, onTap }) => (
    <button className="pressable" onClick={onTap} style={{ width: 46, height: 27, borderRadius: 999, border: "none", background: on ? C.glacier : "rgba(255,255,255,0.15)", position: "relative", transition: "background .25s ease" }}>
      <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: on ? C.encre : C.neige, transition: "left .25s ease" }} />
    </button>
  );
  return (
    <div className="absolute inset-0 slide-up" style={{ background: "linear-gradient(180deg,#0A1028,#131B3E)", zIndex: 48, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: C.neige }}>Réglages</div>
        <button className="pressable" onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", color: C.neige }}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 10, marginBottom: 10 }}>Ambiance</div>
        <div className="flex gap-2 flex-wrap">
          {[["auto", "Auto", Sun], ...SKY_ORDER.map((k) => [k, SKIES[k].label, SKIES[k].icon])].map(([k, l, Icon]) => (
            <button key={k} className="pressable" onClick={() => setSkyMode(k)} style={{
              fontFamily: FONT_B, fontSize: 12, fontWeight: 600, padding: "9px 13px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6,
              border: `1px solid ${skyMode === k ? "rgba(143,227,240,.4)" : C.bord}`,
              background: skyMode === k ? "rgba(143,227,240,.16)" : "rgba(255,255,255,.06)", color: skyMode === k ? C.glacier : C.doux,
            }}><Icon size={13} />{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: C.doux, marginTop: 8 }}>Auto : le ciel suit l'heure réelle (aube, jour, crépuscule, nuit).</div>

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Objectifs</div>
        <Ligne>
          <span style={{ fontSize: 13.5, color: C.neige }}>Verres d'eau / jour</span>
          <div className="flex items-center gap-3">
            <button className="pressable" onClick={() => act.setObjEau(Math.max(2, app.objEau - 1))} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.07)", color: C.neige, fontSize: 16 }}>−</button>
            <span style={{ fontFamily: FONT_D, fontSize: 14, color: C.glacier, minWidth: 24, textAlign: "center" }}>{app.objEau}</span>
            <button className="pressable" onClick={() => act.setObjEau(Math.min(15, app.objEau + 1))} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.bord}`, background: "rgba(255,255,255,0.07)", color: C.neige, fontSize: 16 }}>+</button>
          </div>
        </Ligne>
        <Ligne>
          <span style={{ fontSize: 13.5, color: C.neige }}>Calories / jour</span>
          <input value={kcal} onChange={(e) => setKcal(e.target.value)} onBlur={() => { const n = parseNum(kcal); if (n) act.setObjKcal(Math.round(n)); else setKcal(String(app.objKcal)); }} inputMode="decimal"
            style={{ width: 90, textAlign: "center", fontFamily: FONT_D, fontSize: 13, color: C.glacier, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.bord}`, borderRadius: 12, padding: "9px 6px", outline: "none" }} />
        </Ligne>
        <Ligne>
          <span style={{ fontSize: 13.5, color: C.neige }}>Vibrations (haptique)</span>
          <Toggle on={vibrOn} onTap={() => setVibrOn(!vibrOn)} />
        </Ligne>

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Modules visibles</div>
        <div style={{ fontSize: 11.5, color: C.doux, marginBottom: 4 }}>L'app s'adapte : tu ne vois que ce qui t'intéresse. Aujourd'hui reste toujours actif.</div>
        {MODULES.map((m) => (
          <Ligne key={m.key}>
            <div className="flex items-center gap-3"><m.icon size={17} style={{ color: C.glacier }} /><span style={{ fontSize: 13.5, color: C.neige }}>{m.nom}</span></div>
            <Toggle on={!modsOff.includes(m.key)} onTap={() => toggleMod(m.key)} />
          </Ligne>
        ))}

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 10 }}>ASCENT Premium</div>
        <Glass className="p-4" style={{ background: "linear-gradient(90deg, rgba(255,184,107,0.14), rgba(255,255,255,0.05))", borderColor: "rgba(255,184,107,.35)" }}>
          <div className="flex items-center gap-2"><Crown size={16} style={{ color: C.aube }} /><span style={{ fontSize: 13.5, fontWeight: 700, color: C.neige }}>{app.premium ? "Premium actif ✓" : "Essai gratuit 7 jours"}</span></div>
          <p style={{ fontSize: 12.5, color: C.doux, lineHeight: 1.6, marginTop: 6 }}>Coach IA · stats avancées · 9 compagnons + cosmétiques · courses IA · programmes IA · zéro pub. Résiliable en un geste, sans carte piège.</p>
          {!app.premium && <Bouton couleur={C.aube} onClick={act.buyPremium} style={{ width: "100%", marginTop: 10 }}>Essayer 7 jours gratuits</Bouton>}
        </Glass>

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Personnalisation</div>
        <Ligne>
          <span style={{ fontSize: 13.5, color: C.neige }}>Taille du texte</span>
          <div className="flex gap-1">
            {[["S", 0.9], ["M", 1], ["L", 1.1]].map(([l, v]) => (
              <button key={l} className="pressable" onClick={() => act.setTextScale(v)} style={{
                width: 36, height: 32, borderRadius: 10, border: "none", fontFamily: FONT_B, fontWeight: 700,
                fontSize: l === "S" ? 11 : l === "M" ? 13 : 15,
                background: app.textScale === v ? "rgba(143,227,240,.2)" : "rgba(255,255,255,0.07)",
                color: app.textScale === v ? C.glacier : C.doux,
              }}>{l}</button>
            ))}
          </div>
        </Ligne>
        <Ligne>
          <span style={{ fontSize: 13.5, color: C.neige }}>Langue</span>
          <div className="flex gap-1">
            <button className="pressable" style={{ padding: "7px 13px", borderRadius: 10, border: "none", fontFamily: FONT_B, fontSize: 12, fontWeight: 700, background: "rgba(143,227,240,.2)", color: C.glacier }}>Français</button>
            <button className="pressable" onClick={act.langueBientot} style={{ padding: "7px 13px", borderRadius: 10, border: "none", fontFamily: FONT_B, fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.07)", color: C.doux }}>English</button>
          </div>
        </Ligne>

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Packs de sons</div>
        {[["Cimes", false, "Actif"], ["Forêt", true, "Balise 1 500 m"], ["Cristal", true, "Premium"]].map(([nom, lock, info]) => (
          <Ligne key={nom}>
            <span style={{ fontSize: 13.5, color: C.neige }}>{lock ? "🔒 " : "🔊 "}{nom}</span>
            <span style={{ fontSize: 12, color: lock ? C.doux : C.glacier }}>{info}</span>
          </Ligne>
        ))}

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Aide & informations</div>
        {[["Manuel de l'ascension", HelpCircle, () => act.openAide()], ["Exporter mes données (JSON)", Download, () => act.exportData()], ["Confidentialité", FileText, () => act.openLegal("conf")], ["Conditions d'utilisation", FileText, () => act.openLegal("cond")], ["À propos d'ASCENT", Mountain, () => act.openLegal("apropos")]].map(([nom, Icon, fn]) => (
          <Ligne key={nom}>
            <button className="pressable flex items-center gap-3" onClick={fn} style={{ background: "none", border: "none", padding: 0, color: C.neige, fontSize: 13.5, fontFamily: FONT_B }}>
              <Icon size={16} style={{ color: C.glacier }} /> {nom}
            </button>
            <ChevronRight size={15} style={{ color: C.doux }} />
          </Ligne>
        ))}

        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.doux, marginTop: 24, marginBottom: 4 }}>Mode développeur</div>
        <Ligne>
          <div className="flex items-center gap-3"><Wrench size={16} style={{ color: C.glacier }} /><span style={{ fontSize: 13.5, color: C.neige }}>Outils de test</span></div>
          <Toggle on={app.dev} onTap={act.toggleDev} />
        </Ligne>
        {app.dev && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Bouton onClick={act.devXP} couleur={"rgba(255,255,255,0.14)"} style={{ color: C.neige }}>+100 XP</Bouton>
            <Bouton onClick={act.devSeed} couleur={"rgba(255,255,255,0.14)"} style={{ color: C.neige }}>Semer 90 j d'historique</Bouton>
            <Bouton onClick={act.devUnlock} couleur={"rgba(255,255,255,0.14)"} style={{ color: C.neige }}>Tout débloquer</Bouton>
            <Bouton onClick={act.devOnboard} couleur={"rgba(255,255,255,0.14)"} style={{ color: C.neige }}>Revoir l'onboarding</Bouton>
            <Bouton onClick={act.resetAll} couleur={"rgba(255,122,138,0.22)"} style={{ color: "#FF9AA8" }}>Tout réinitialiser</Bouton>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: C.doux, marginTop: 24, lineHeight: 1.6 }}>
          Prototype complet — restent pour la production : paiement réel, sauvegarde chiffrée, notifications choisies, et le branchement IA via ta route serveur.
        </div>
      </div>
    </div>
  );
}

/* ================= RACINE ================= */
export default function AscentApp() {
  const jour = new Date().getDay();
  const DEFAUTS = {
    dateJour: todayKey(),
    jour,
    xp: 2480, eau: 3, cafe: 1,
    humeur: null, gratitude: [], journal: "", victoire: "", difficulte: "",
    habitudes: [
      { emoji: "💧", nom: "Boire 2 L d'eau", fait: false, streak: 8, repos: [], semaine: [1,1,1,0,1,1,1] },
      { emoji: "📖", nom: "Lire 20 minutes", fait: false, streak: 4, repos: [0], semaine: [2,1,1,1,0,1,1] },
      { emoji: "🧘", nom: "Méditer", fait: true, streak: 12, repos: [], semaine: [1,1,1,1,1,1,1] },
    ],
    repas: [
      { nom: "Petit-déj — skyr, avoine, fruits", kcal: 450, fait: true },
      { nom: "Déjeuner — poulet, riz, brocoli", kcal: 650, fait: false },
      { nom: "Dîner — saumon, patate douce", kcal: 600, fait: false },
    ],
    objKcal: 2200, objEau: 8,
    taches: [
      { emoji: "📞", nom: "Appeler la banque", fait: false, demain: false },
      { emoji: "📦", nom: "Préparer le colis retour", fait: true, demain: false },
    ],
    templates: {
      Push: [
        { nom: "Développé couché", series: [{ reps: 8, poids: 40, fait: false }, { reps: 8, poids: 40, fait: false }, { reps: 8, poids: 40, fait: false }] },
        { nom: "Développé incliné haltères", series: [{ reps: 10, poids: 16, fait: false }, { reps: 10, poids: 16, fait: false }, { reps: 10, poids: 16, fait: false }] },
        { nom: "Dips", series: [{ reps: 12, poids: 0, fait: false }, { reps: 12, poids: 0, fait: false }, { reps: 12, poids: 0, fait: false }] },
        { nom: "Élévations latérales", series: [{ reps: 15, poids: 8, fait: false }, { reps: 15, poids: 8, fait: false }, { reps: 15, poids: 8, fait: false }] },
      ],
      Pull: [
        { nom: "Tractions", series: [{ reps: 8, poids: 0, fait: false }, { reps: 8, poids: 0, fait: false }, { reps: 8, poids: 0, fait: false }] },
        { nom: "Rowing barre", series: [{ reps: 10, poids: 50, fait: false }, { reps: 10, poids: 50, fait: false }, { reps: 10, poids: 50, fait: false }] },
        { nom: "Curl haltères", series: [{ reps: 12, poids: 12, fait: false }, { reps: 12, poids: 12, fait: false }, { reps: 12, poids: 12, fait: false }] },
      ],
      Legs: [
        { nom: "Squat", series: [{ reps: 8, poids: 60, fait: false }, { reps: 8, poids: 60, fait: false }, { reps: 8, poids: 60, fait: false }] },
        { nom: "Presse à cuisses", series: [{ reps: 10, poids: 120, fait: false }, { reps: 10, poids: 120, fait: false }, { reps: 10, poids: 120, fait: false }] },
        { nom: "Leg curl", series: [{ reps: 12, poids: 35, fait: false }, { reps: 12, poids: 35, fait: false }, { reps: 12, poids: 35, fait: false }] },
      ],
    },
    templateNom: "Push",
    planning: (() => {
      const p = Array.from({ length: 7 }, () => ({ seance: null, repas: [] }));
      p[jour] = { seance: "Push", repas: ["Déjeuner — poulet, riz, brocoli", "Dîner — saumon, patate douce"] };
      p[(jour + 1) % 7] = { seance: "Pull", repas: ["Bowl saumon avocat"] };
      return p;
    })(),
    courses: [
      { nom: "Poulet", qte: "1 kg", rayon: "Viande & poisson", fait: false },
      { nom: "Skyr", qte: "×4", rayon: "Frais", fait: false },
      { nom: "Brocoli", qte: "2", rayon: "Fruits & légumes", fait: false },
      { nom: "Riz basmati", qte: "1 kg", rayon: "Épicerie", fait: true },
    ],
    sommeil: { duree: "", qualite: 0 },
    cycle: { debutOffset: 12, lenCycle: 28, lenRegles: 5 },
    lettres: [],
    pourquoi: "Devenir la version de moi que mon futur me remerciera d'avoir construite.",
    enigmes: Array.from({ length: 5 }, () => ({ fait: false, indice: false })),
    poids: [
      { d: "1 juil", v: 79.2 },
      { d: "8 juil", v: 78.6 },
      { d: "15 juil", v: 78.1 },
      { d: "22 juil", v: 77.4 },
    ],
    photos: { avant: null, apres: null },
    prenom: "", onboarded: false, objectifs: [],
    intention: "", energie: 0,
    mesExos: [],
    cosm: { hat: null, aura: "glacier", hats: ["cap", "top", "party"], auras: ["glacier", "aube"], tenue: null, tenues: ["echarpe", "noeudpap"] },
    premium: false, dev: false,
    historique: [],
    ledger: [], notesVocales: [], tipsSeen: [],
    textScale: 1,
    compagnon: "nimbo",
    compagnons: ["nimbo", "pip", "gaspard"],
    niveauxC: { nimbo: 4, pip: 2, gaspard: 1, boum: 1, zaza: 1, lumen: 1, rocky: 1, fen: 1, sol: 1 },
    defis: [
      { emoji: "🍭", nom: "7 jours sans sucre", cur: 4, obj: 7, xp: 80 },
      { emoji: "📚", nom: "Lire 5 chapitres", cur: 1, obj: 5, xp: 60 },
    ],
    cadeau7: false, coffreJuillet: false, gate1: false,
    villages: ["etoiles"],
    coachBilan: null, coachLoad: false, coachTransfo: null,
    pr: { "Développé couché": 45, "Développé incliné haltères": 18, "Élévations latérales": 10, "Squat": 70, "Rowing barre": 55 },
    seance: null, seanceFaite: false, dernierRecap: null, recapVisible: null,
  };
  const boot = useMemo(() => chargerEtat(DEFAUTS), []);
  VIBR_ON = boot.vibrOn;
  const [app, setApp] = useState(boot.app);

  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0); const startY = useRef(0); const lockedH = useRef(false);
  const containerRef = useRef(null);
  const [cw, setCw] = useState(390);

  const [skyMode, setSkyMode] = useState(boot.skyMode);
  const skyKey = skyMode === "auto" ? skyFromHour(new Date().getHours()) : skyMode;
  const sky = SKIES[skyKey];

  const [regOpen, setRegOpen] = useState(false);
  const [enigOpen, setEnigOpen] = useState(false);
  const [biblioOpen, setBiblioOpen] = useState(false);
  const [aideOpen, setAideOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modsOff, setModsOff] = useState(boot.modsOff);
  const [vibrOn, setVibrOnState] = useState(boot.vibrOn);
  const setVibrOn = (v) => { VIBR_ON = v; setVibrOnState(v); };
  const toggleMod = (k) => { setModsOff((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k])); setIdx(0); };

  const [nimbo, setNimbo] = useState({ mood: "calm", reaction: null });
  const [phrase, setPhrase] = useState(null);
  const [toast, setToast] = useState(null);
  const [burst, setBurst] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    const measure = () => containerRef.current && setCw(containerRef.current.offsetWidth);
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* salutation contextuelle du compagnon (catégorie + humeur selon l'heure, index stable par créneau de 4 h) */
  useEffect(() => {
    if (!app.onboarded) return;
    const t1 = setTimeout(() => {
      setNimbo({ mood: pickMoodCtx(app.seanceFaite), reaction: null });
      setPhrase(companionLine(companionCat(app.seanceFaite)));
    }, 1400);
    const t2 = setTimeout(() => { setPhrase(null); setNimbo({ mood: "calm", reaction: null }); }, 6200);
    timers.current.push(t1, t2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [app.onboarded]);

  /* sauvegarde locale — débouncée */
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const { notesVocales, ...persist } = app;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ app: persist, modsOff, skyMode, vibrOn }));
      } catch (e) { /* quota dépassé : photos trop lourdes — IndexedDB en piste v2 */ }
    }, 400);
    return () => clearTimeout(id);
  }, [app, modsOff, skyMode, vibrOn]);

  /* --- score dérivé --- */
  const score = useMemo(() => calculerScore(app), [app]);
  const appWithScore = { ...app, score };

  const undoRef = useRef(null);
  const notif = (msg, undo) => {
    setToast({ msg, undo });
    timers.current.push(setTimeout(() => setToast(null), undo ? 4500 : 2200));
  };
  const gainXP = (n, msg) => {
    const m = msg || `+${n} XP`;
    setApp((a) => ({ ...a, xp: a.xp + n, ledger: [{ msg: m.replace(/ ·.*$/, ""), xp: n }, ...a.ledger].slice(0, 12) }));
    notif(m);
  };

  /* --- actions --- */
  const act = {
    goTo: (i) => setIdx(i),
    setObjEau: (n) => setApp((a) => ({ ...a, objEau: n })),
    setObjKcal: (n) => setApp((a) => ({ ...a, objKcal: n })),
    breathDone: () => { gainXP(15, "Respiration · +15 XP"); vibrate(20); },
    toggleTache: (i) => {
      setApp((a) => ({ ...a, taches: a.taches.map((t, k) => (k === i ? { ...t, fait: !t.fait } : t)) }));
      if (!app.taches[i].fait) { gainXP(5, `${app.taches[i].emoji} Tâche faite · +5 XP`); vibrate(12); }
    },
    addTache: (emoji, nom) => setApp((a) => ({ ...a, taches: [...a.taches, { emoji, nom, fait: false, demain: false }] })),
    delTache: (i) => setApp((a) => ({ ...a, taches: a.taches.filter((_, k) => k !== i) })),
    demainTache: (i) => setApp((a) => ({ ...a, taches: a.taches.map((t, k) => (k === i ? { ...t, demain: !t.demain, fait: false } : t)) })),
    tapNimbo: () => {
      const reactions = ["hop", "wiggle", "hop"];
      const moods = ["happy", "surprised", "wink", "happy"];
      const r = reactions[Math.floor(Math.random() * reactions.length)];
      const m = moods[Math.floor(Math.random() * moods.length)];
      setNimbo({ mood: m, reaction: null });
      requestAnimationFrame(() => setNimbo({ mood: m, reaction: r }));
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
      vibrate(10);
      timers.current.push(setTimeout(() => setNimbo((s) => ({ ...s, reaction: null })), 700));
      timers.current.push(setTimeout(() => { setPhrase(null); setNimbo({ mood: "calm", reaction: null }); }, 2400));
    },
    addEau: () => { setApp((a) => ({ ...a, eau: Math.min(8, a.eau + 1) })); vibrate(8); },
    setHumeur: (v) => { const first = app.humeur == null; setApp((a) => ({ ...a, humeur: v })); if (first) gainXP(5, "Humeur notée · +5 XP"); },
    addGratitude: (g) => { setApp((a) => ({ ...a, gratitude: [...a.gratitude, g] })); gainXP(5, "Gratitude · +5 XP"); },
    setJournal: (v) => setApp((a) => ({ ...a, journal: v })),
    setVictoire: (v) => setApp((a) => ({ ...a, victoire: v })),
    setDifficulte: (v) => setApp((a) => ({ ...a, difficulte: v })),
    toggleHabit: (i) => {
      setApp((a) => {
        const hs = a.habitudes.map((h, k) => (k === i ? { ...h, fait: !h.fait } : h));
        return { ...a, habitudes: hs };
      });
      if (!app.habitudes[i].fait) { gainXP(10, `${app.habitudes[i].emoji} +10 XP`); vibrate(12); }
    },
    addHabit: (emoji, nom) => setApp((a) => ({ ...a, habitudes: [...a.habitudes, { emoji, nom, fait: false, streak: 0, repos: [], semaine: [0,0,0,0,0,0,0] }] })),
    delHabit: (i) => setApp((a) => ({ ...a, habitudes: a.habitudes.filter((_, k) => k !== i) })),
    toggleRepos: (i, d) => setApp((a) => ({ ...a, habitudes: a.habitudes.map((h, k) => (k === i ? { ...h, repos: h.repos.includes(d) ? h.repos.filter((x) => x !== d) : [...h.repos, d] } : h)) })),
    addRepas: (nom, kcal) => setApp((a) => ({ ...a, repas: [...a.repas, { nom, kcal, fait: false }] })),
    toggleRepas: (i) => {
      setApp((a) => ({ ...a, repas: a.repas.map((r, k) => (k === i ? { ...r, fait: !r.fait } : r)) }));
      if (!app.repas[i].fait) gainXP(5, "Repas noté · +5 XP");
    },
    startSeance: () => setApp((a) => ({ ...a, seance: { t0: Date.now(), nom: a.templateNom, exos: JSON.parse(JSON.stringify(a.templates[a.templateNom])), prsBattus: [] } })),
    setTemplateNom: (n) => setApp((a) => ({ ...a, templateNom: n })),
    setPlanSeance: (d, n) => setApp((a) => ({ ...a, planning: a.planning.map((p, k) => (k === d ? { ...p, seance: n } : p)) })),
    addPlanRepas: (d, nom) => setApp((a) => ({ ...a, planning: a.planning.map((p, k) => (k === d ? { ...p, repas: [...p.repas, nom] } : p)) })),
    delPlanRepas: (d, i) => setApp((a) => ({ ...a, planning: a.planning.map((p, k) => (k === d ? { ...p, repas: p.repas.filter((_, j) => j !== i) } : p)) })),
    copierJour: (from, to) => { setApp((a) => ({ ...a, planning: a.planning.map((p, k) => (k === to ? JSON.parse(JSON.stringify(a.planning[from])) : p)) })); notif(`Copié vers ${["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][to]}. ✓`); },
    chargerJour: (d) => {
      setApp((a) => {
        undoRef.current = { repas: a.repas, templateNom: a.templateNom };
        const p = a.planning[d];
        return {
          ...a,
          templateNom: p.seance || a.templateNom,
          repas: p.repas.length ? p.repas.map((nom) => ({ nom, kcal: null, fait: false })) : a.repas,
        };
      });
      notif("Journée chargée ✓", () => {
        if (undoRef.current) setApp((a) => ({ ...a, repas: undoRef.current.repas, templateNom: undoRef.current.templateNom }));
      });
      vibrate(15);
    },
    addCourse: (nom, qte) => setApp((a) => ({ ...a, courses: [...a.courses, { nom, qte, rayon: detectRayon(nom), fait: false }] })),
    toggleCourse: (i) => setApp((a) => ({ ...a, courses: a.courses.map((c, k) => (k === i ? { ...c, fait: !c.fait } : c)) })),
    delCourse: (i) => setApp((a) => ({ ...a, courses: a.courses.filter((_, k) => k !== i) })),
    genCourses: () => notif("Premium — l'IA n'est pas branchée dans le prototype"),
    focusDone: (min) => { gainXP(min * 2, `Focus ${min} min · +${min * 2} XP`); vibrate(25); setBurst(Date.now()); },
    setSommeil: (patch) => setApp((a) => ({ ...a, sommeil: { ...a.sommeil, ...patch } })),
    setCycle: (patch) => setApp((a) => ({ ...a, cycle: { ...a.cycle, ...patch } })),
    cycleStart: () => { setApp((a) => ({ ...a, cycle: { ...a.cycle, debutOffset: 0 } })); notif("Cycle mis à jour ✓"); },
    scellerLettre: (texte, jours) => { setApp((a) => ({ ...a, lettres: [...a.lettres, { texte, jours, date: Date.now() }] })); gainXP(20, "Lettre scellée ✉️ · +20 XP"); },
    setPourquoi: (v) => setApp((a) => ({ ...a, pourquoi: v })),
    solveEnigme: (i) => {
      const xp = app.enigmes[i].indice ? Math.floor(ENIGMES[i].xp / 2) : ENIGMES[i].xp;
      setApp((a) => ({ ...a, enigmes: a.enigmes.map((e, k) => (k === i ? { ...e, fait: true } : e)) }));
      gainXP(xp, `Énigme ${i + 1} résolue · +${xp} XP`);
      vibrate(20);
      if (app.enigmes.filter((e) => e.fait).length === 4) setBurst(Date.now());
    },
    indiceEnigme: (i) => { setApp((a) => ({ ...a, enigmes: a.enigmes.map((e, k) => (k === i ? { ...e, indice: true } : e)) })); vibrate(8); },
    openEnigmes: () => setEnigOpen(true),
    addPoids: (v) => {
      setApp((a) => ({ ...a, poids: [...a.poids, { d: "Auj", v }] }));
      gainXP(5, `Poids noté : ${fmtKg(v)} kg · +5 XP`);
    },
    setPhoto: (slot, data) => { setApp((a) => ({ ...a, photos: { ...a.photos, [slot]: data } })); notif("Photo ajoutée 📸"); },
    delPhoto: (slot) => setApp((a) => ({ ...a, photos: { ...a.photos, [slot]: null } })),
    addCafe: () => { setApp((a) => ({ ...a, cafe: Math.min(6, a.cafe + 1) })); vibrate(8); },
    setIntention: (v) => setApp((a) => ({ ...a, intention: v })),
    setEnergie: (v) => setApp((a) => ({ ...a, energie: v })),
    addNoteVocale: (url) => { setApp((a) => ({ ...a, notesVocales: [...a.notesVocales, url] })); notif("Note vocale enregistrée 🎙"); },
    delNoteVocale: (i) => setApp((a) => ({ ...a, notesVocales: a.notesVocales.filter((_, k) => k !== i) })),
    micRefuse: () => notif("Micro non autorisé 🎙"),
    addMonExo: (nom, groupe) => { setApp((a) => ({ ...a, mesExos: [...a.mesExos, { nom, groupe }] })); notif(`« ${nom} » ajouté à Mes exercices ✦`); },
    addExoToTemplate: (nom) => {
      setApp((a) => ({ ...a, templates: { ...a.templates, [a.templateNom]: [...a.templates[a.templateNom], { nom, series: [{ reps: 10, poids: null, fait: false }, { reps: 10, poids: null, fait: false }, { reps: 10, poids: null, fait: false }] }] } }));
      notif(`Ajouté à la séance ${app.templateNom} ✓`);
    },
    openBiblio: () => setBiblioOpen(true),
    openAide: () => { setAideOpen(true); },
    openLegal: (k) => { setLegalOpen(k); },
    setHat: (id) => { setApp((a) => ({ ...a, cosm: { ...a.cosm, hat: id } })); vibrate(8); },
    setAura: (id) => { setApp((a) => ({ ...a, cosm: { ...a.cosm, aura: id } })); vibrate(8); },
    setTenue: (id) => { setApp((a) => ({ ...a, cosm: { ...a.cosm, tenue: id } })); vibrate(8); },
    setTextScale: (v) => setApp((a) => ({ ...a, textScale: v })),
    langueBientot: () => notif("English — bientôt 🌍"),
    buyPremium: () => { setApp((a) => ({ ...a, premium: true })); notif("Premium activé (prototype — paiement non branché) 👑"); setBurst(Date.now()); },
    toggleDev: () => setApp((a) => ({ ...a, dev: !a.dev })),
    devXP: () => gainXP(100, "Dev · +100 XP"),
    devSeed: () => {
      const jours = [];
      for (let i = 90; i >= 1; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const vague = 0.5 + 0.5 * Math.sin(i / 9);
        const seance = [1, 3, 5].includes(d.getDay()) && Math.random() > 0.25;
        const humeur = Math.random() > 0.12 ? Math.max(3, Math.min(10, Math.round(5.3 + (seance ? 1.4 : 0) + (Math.random() * 3 - 1.5)))) : null;
        const hab = Math.min(100, Math.round(38 + vague * 50 + Math.random() * 12));
        const eau = Math.round(3 + vague * 3 + Math.random() * 4);
        const score = Math.max(8, Math.min(98, Math.round(26 + (seance ? 22 : 0) + hab * 0.32 + Math.random() * 14)));
        jours.push({ d: d.toISOString().slice(0, 10), score, humeur, seance, hab, eau });
      }
      setApp((a) => ({ ...a, historique: jours }));
      notif("Historique de test semé 🌱 (90 jours)");
    },
    devUnlock: () => { setApp((a) => ({ ...a, premium: true, compagnons: COMPAGNONS.map((c) => c.id), cosm: { ...a.cosm, hats: HATS.map((h) => h.id), auras: AURAS.map((x) => x.id), tenues: TENUES.map((t) => t.id) } })); notif("Tout est débloqué 🛠"); },
    devOnboard: () => { setApp((a) => ({ ...a, onboarded: false, tipsSeen: [] })); setRegOpen(false); },
    seenTip: (k) => setApp((a) => ({ ...a, tipsSeen: [...a.tipsSeen, k] })),
    note: (m) => notif(m),
    resetAll: () => { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} location.reload(); },
    setCompagnon: (id) => {
      const c = COMPAGNONS.find((x) => x.id === id);
      if (!app.compagnons.includes(id)) { notif(`${c.nom} 🔒 — ${c.cond}`); vibrate(15); return; }
      setApp((a) => ({ ...a, compagnon: id })); vibrate(8); notif(`${c.nom} prend la tête de cordée`);
    },
    addDefi: (emoji, nom, obj) => setApp((a) => ({ ...a, defis: [...a.defis, { emoji, nom, cur: 0, obj, xp: Math.max(30, obj * 10) }] })),
    delDefi: (i) => setApp((a) => ({ ...a, defis: a.defis.filter((_, k) => k !== i) })),
    incDefi: (i) => {
      const d = app.defis[i];
      const fini = d.cur + 1 >= d.obj;
      setApp((a) => ({ ...a, defis: a.defis.map((x, k) => (k === i ? { ...x, cur: x.cur + 1 } : x)) }));
      if (fini) { gainXP(d.xp, `Défi relevé ${d.emoji} · +${d.xp} XP`); setBurst(Date.now()); vibrate(30); } else vibrate(10);
    },
    openGacha: () => setGachaOpen(true),
    choisirCadeau7: (id) => {
      setGachaOpen(false);
      setApp((a) => {
        let n = { ...a, cadeau7: true };
        if (id === "aura-rose") n = { ...n, cosm: { ...a.cosm, auras: [...new Set([...a.cosm.auras, "rose"])], aura: "rose" } };
        if (id === "hat-bow") n = { ...n, cosm: { ...a.cosm, hats: [...new Set([...a.cosm.hats, "bow"])], hat: "bow" } };
        return n;
      });
      if (id === "xp40") gainXP(40, "Cadeau de fidélité · +40 XP");
      else notif(id === "aura-rose" ? "Aura Rosée débloquée et équipée 🌸" : "Chapeau Nœud débloqué et équipé 🎀");
      setBurst(Date.now());
    },
    ouvrirCoffre: () => {
      const lots = ["xp80", "aura-vert", "hat-helmet"];
      const lot = lots[Math.floor(Math.random() * lots.length)];
      setApp((a) => {
        let n = { ...a, coffreJuillet: true };
        if (lot === "aura-vert") n = { ...n, cosm: { ...a.cosm, auras: [...new Set([...a.cosm.auras, "vert"])] } };
        if (lot === "hat-helmet") n = { ...n, cosm: { ...a.cosm, hats: [...new Set([...a.cosm.hats, "helmet"])] } };
        return n;
      });
      if (lot === "xp80") gainXP(80, "Coffre de juillet · +80 XP");
      else notif(lot === "aura-vert" ? "Coffre : aura Sous-bois débloquée 🌿" : "Coffre : chapeau Casque débloqué ⛑️");
      setBurst(Date.now());
      vibrate(25);
    },
    openGate: () => setGateOpen(true),
    franchirPorte: () => {
      setGateOpen(false);
      setApp((a) => ({
        ...a, gate1: true,
        villages: [...new Set([...a.villages, "neige"])],
        cosm: { ...a.cosm, hats: [...new Set([...a.cosm.hats, "grad"])] },
      }));
      gainXP(150, "Porte du Col franchie 🚪 · +150 XP");
      setBurst(Date.now());
      vibrate(40);
    },
    genBilan: async () => {
      if (app.coachLoad) return;
      setApp((a) => ({ ...a, coachLoad: true }));
      const habAct = app.habitudes.filter((h) => !h.repos.includes(app.jour));
      const h7c = (app.historique || []).slice(-7);
      const hu7c = h7c.filter((h) => h.humeur != null);
      const bilan7 = h7c.length
        ? ` Sur les 7 derniers jours (réels) : ${h7c.filter((h) => h.seance).length + (app.seanceFaite ? 1 : 0)} séance(s), score moyen ${Math.round(h7c.reduce((s, h) => s + h.score, 0) / h7c.length)}/100, humeur moyenne ${hu7c.length ? (hu7c.reduce((s, h) => s + h.humeur, 0) / hu7c.length).toFixed(1) : "—"}/10.`
        : "";
      const resume = `Prénom: ${app.prenom || "—"}.${bilan7} Séance aujourd'hui: ${app.seanceFaite ? "oui" : "non"}${app.dernierRecap ? ` (${app.dernierRecap.nom}, ${app.dernierRecap.series} séries, ${app.dernierRecap.volume} kg)` : ""}. Humeur: ${app.humeur ?? "non notée"}/10. Habitudes: ${habAct.filter((h) => h.fait).length}/${habAct.length}. Tâches faites: ${app.taches.filter((t) => t.fait).length}. Eau: ${app.eau}/${app.objEau} verres. XP total: ${app.xp}. Objectifs: ${app.objectifs.join(", ") || "—"}. Pourquoi profond: ${app.pourquoi}`;
      try {
        const t = await askAI({
          prompt: `Tu es le coach bienveillant de l'app ASCENT (métaphore de l'ascension en montagne, tutoiement, français). Données du grimpeur — SANS son journal privé : ${resume}\nÉcris un bilan court (5 à 7 phrases), chaleureux et honnête, qui se termine par UN cap concret pour demain. Prose uniquement, pas de listes.`,
          maxTokens: 600,
        });
        setApp((a) => ({ ...a, coachLoad: false, coachBilan: t.trim() }));
      } catch (e) {
        setApp((a) => ({ ...a, coachLoad: false }));
        notif("Coach indisponible — vérifie ANTHROPIC_API_KEY sur Vercel");
      }
    },
    genTransfo: async () => {
      if (!app.photos.avant || !app.photos.apres) return;
      notif("Analyse en cours… 📸");
      try {
        const t = await askAI({
          prompt: "Compare ces deux photos de progression physique (photo 1 = avant, photo 2 = maintenant) avec bienveillance : 3 à 4 phrases en français, tutoiement, les évolutions visibles et un encouragement concret. Aucun jugement négatif, aucun commentaire sur le poids chiffré.",
          maxTokens: 400,
          images: [app.photos.avant, app.photos.apres],
        });
        setApp((a) => ({ ...a, coachTransfo: t.trim() }));
      } catch (e) { notif("IA indisponible — vérifie la clé sur Vercel"); }
    },
    exportData: () => {
      try {
        const { photos, notesVocales, ...donnees } = app;
        const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
        const u = URL.createObjectURL(blob);
        const el = document.createElement("a");
        el.href = u; el.download = "ascent-donnees.json"; el.click();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        notif("Données exportées 📦");
      } catch (e) { notif("Export impossible ici"); }
    },
    quitSeance: () => setApp((a) => ({ ...a, seance: null })),
    checkSerie: (ei, si, poids) => {
      setApp((a) => {
        const exos = a.seance.exos.map((e, k) => (k === ei ? { ...e, series: e.series.map((s, j) => (j === si ? { ...s, fait: true, poids } : s)) } : e));
        const nom = exos[ei].nom;
        let pr = a.pr; let prsBattus = a.seance.prsBattus;
        if (poids != null && poids > (a.pr[nom] || 0)) {
          pr = { ...a.pr, [nom]: poids };
          if (!prsBattus.includes(nom)) prsBattus = [...prsBattus, nom];
          setBurst(Date.now());
        }
        return { ...a, pr, seance: { ...a.seance, exos, prsBattus } };
      });
    },
    finishSeance: (elapsed) => {
      setApp((a) => {
        const faites = a.seance.exos.flatMap((e) => e.series).filter((s) => s.fait);
        const volume = Math.round(faites.reduce((v, s) => v + (s.poids || 0) * s.reps, 0) * 10) / 10;
        const recap = {
          nom: a.seance.nom,
          duree: `${Math.max(1, Math.floor(elapsed / 60))} min`,
          series: faites.length, volume, prs: a.seance.prsBattus,
        };
        return { ...a, seance: null, seanceFaite: true, dernierRecap: recap, recapVisible: recap, xp: a.xp + 60 };
      });
      setBurst(Date.now());
      vibrate(30);
    },
    closeRecap: () => setApp((a) => ({ ...a, recapVisible: null })),
  };

  /* --- swipe --- */
  const onPointerDown = (e) => { if (app.seance || app.recapVisible || regOpen || enigOpen || biblioOpen || aideOpen || legalOpen || !app.onboarded) return; dragging.current = true; lockedH.current = false; startX.current = e.clientX; startY.current = e.clientY; };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current, dy = e.clientY - startY.current;
    if (!lockedH.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        lockedH.current = true;
        setMenuOpen(false);
        if (e.pointerType === "mouse" && containerRef.current) { try { containerRef.current.setPointerCapture(e.pointerId); } catch (err) {} }
      } else if (Math.abs(dy) > 8) { dragging.current = false; return; }
      else return;
    }
    let d = dx;
    if ((idx === 0 && d > 0) || (idx === N_PAGES - 1 && d < 0)) d = d / 3;
    setDrag(d);
  };
  const onPointerEnd = () => {
    if (!dragging.current) { setDrag(0); return; }
    dragging.current = false;
    if (lockedH.current) {
      if (drag < -60 && idx < N_PAGES - 1) setIdx(idx + 1);
      else if (drag > 60 && idx > 0) setIdx(idx - 1);
    }
    setDrag(0);
  };

  const pagerOffset = idx * cw - drag;
  const skyShift = -pagerOffset * 0.08;

  const PAGE_DEFS = [
    { key: "auj", label: "Aujourd'hui", icon: Mountain, render: (active) => <PageAujourdhui app={appWithScore} act={act} sky={sky} skyKey={skyKey} nimbo={nimbo} phrase={active ? phrase : null} /> },
    { key: "corps", label: "Corps", icon: Dumbbell, render: () => <PageCorps app={appWithScore} act={act} /> },
    { key: "esprit", label: "Esprit", icon: Feather, render: () => <PageEsprit app={appWithScore} act={act} /> },
    { key: "habitudes", label: "Habitudes", icon: ListChecks, render: () => <PageHabitudes app={appWithScore} act={act} /> },
    { key: "defis", label: "Défis", icon: Flag, render: () => <PageDefis app={appWithScore} act={act} /> },
    { key: "parcours", label: "Parcours", icon: Map, render: (active) => <PageParcours app={appWithScore} act={act} active={active} /> },
    { key: "stats", label: "Stats", icon: BarChart3, render: () => <PageStats app={appWithScore} /> },
    { key: "coach", label: "Coach", icon: Bot, render: () => <PageCoach app={appWithScore} act={act} /> },
    { key: "cycle", label: "Cycle", icon: Heart, render: () => <PageCycle app={appWithScore} act={act} /> },
    { key: "compagnon", label: "Compagnon", icon: Ghost, render: (active) => <PageCompagnon app={appWithScore} act={act} nimbo={nimbo} phrase={active ? phrase : null} /> },
  ];
  const visibles = PAGE_DEFS.filter((p) => p.key === "auj" || !modsOff.includes(p.key));
  const N_PAGES = visibles.length;
  const idxSafe = Math.min(idx, N_PAGES - 1);
  const pageActive = visibles[idxSafe];
  const IconActive = pageActive.icon;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto overflow-hidden"
      style={{ maxWidth: 430, height: "100dvh", minHeight: "100vh", fontFamily: FONT_B, background: sky.grad, transition: "background 0.8s ease", userSelect: "none", touchAction: "pan-y", zoom: app.textScale }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600&family=Outfit:wght@400;500;600;700&display=swap');
        @keyframes nfloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes nhop { 0% { transform: translateY(0); } 30% { transform: translateY(-16px) scale(1.06); } 60% { transform: translateY(0) scale(.96); } 80% { transform: translateY(-5px); } 100% { transform: translateY(0); } }
        @keyframes nwiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
        @keyframes nblink { 0%, 91%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
        @keyframes twinkle { 0%,100% { opacity: .2; } 50% { opacity: .85; } }
        @keyframes rise { 0% { transform: translateY(0); opacity: .65; } 100% { transform: translateY(-46vh); opacity: 0; } }
        .particle { animation: rise linear infinite; }
        @keyframes bpulse { 0%,100% { opacity: .15; transform: scale(1); } 50% { opacity: .4; transform: scale(1.35); } }
        @keyframes fpulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes ppop { 0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(.9); } 100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        @keyframes ppop2 { 0% { opacity: 0; transform: translateY(6px) scale(.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideup { 0% { transform: translateY(24px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes confl { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rr)); opacity: 0; } }
        @keyframes shakeA { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }
        @keyframes shakeB { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }
        @keyframes toastin { 0% { transform: translate(-50%, 10px); opacity: 0; } 100% { transform: translate(-50%, 0); opacity: 1; } }
        .nimbo-float { animation: nfloat 3.2s ease-in-out infinite; }
        .nimbo-hop { animation: nhop .65s ease-out; }
        .nimbo-wiggle { animation: nwiggle .55s ease-in-out; }
        .nimbo-blink { animation: nblink 4.5s infinite; }
        .star { animation: twinkle 3s ease-in-out infinite; }
        .balise-pulse { animation: bpulse 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .flame-pulse { animation: fpulse 1.8s ease-in-out infinite; }
        .phrase-pop { animation: ppop .25s ease-out both; }
        .phrase-pop2 { animation: ppop2 .25s ease-out both; }
        .slide-up { animation: slideup .3s ease-out both; }
        .confetti { position: absolute; animation: confl ease-out both; }
        .toast { animation: toastin .25s ease-out both; }
        .shake-0 { animation: shakeA .3s ease; }
        .shake-1 { animation: shakeB .3s ease; }
        .pressable { transition: transform .15s ease; cursor: pointer; }
        .pressable:active { transform: scale(.96); }
        input::placeholder, textarea::placeholder { color: rgba(234,242,255,.35); }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ciel en parallaxe */}
      <div className="absolute pointer-events-none" style={{ top: 0, bottom: 0, left: "-30%", width: "160%", transform: `translateX(${skyShift}px)`, transition: dragging.current && lockedH.current ? "none" : "transform .42s cubic-bezier(.22,1,.36,1)", zIndex: 0 }}>
        <div style={{ position: "absolute", left: sky.orb.x, top: sky.orb.y, width: sky.orb.size, height: sky.orb.size, borderRadius: 999, background: sky.orb.color, opacity: sky.orb.op, filter: `blur(${sky.orb.blur}px)`, transition: "all .8s ease" }} />
        {skyKey === "nuit" && (
          <div style={{ position: "absolute", left: "16%", top: "7%", width: 26, height: 26, borderRadius: 999, boxShadow: "9px 4px 0 0 #DCE8FF", opacity: 0.75, transform: "rotate(-18deg)" }} />
        )}
        {skyKey === "aube" && [18, 34, 52, 66, 80, 44].map((x, i) => (
          <div key={"p" + i} className="particle" style={{ position: "absolute", left: `${x}%`, bottom: "8%", width: i % 2 ? 4 : 3, height: i % 2 ? 4 : 3, borderRadius: 99, background: "#FFD9A0", animationDelay: `${i * 1.1}s`, animationDuration: `${7 + (i % 3) * 2}s` }} />
        ))}
        {[[8,6],[22,14],[40,4],[58,10],[74,7],[90,15],[15,22],[68,20],[85,26],[33,17],[50,24],[95,5]].map((s, i) => (
          <div key={i} className="star" style={{ position: "absolute", left: `${s[0]}%`, top: `${s[1]}%`, width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2, borderRadius: 99, background: C.neige, opacity: sky.stars, animationDelay: `${(i * .4) % 3}s`, transition: "opacity .8s ease" }} />
        ))}
      </div>

      {/* pager — deck de cartes : chaque page est une vraie carte qui pivote, plonge et s'estompe */}
      <div
        className="flex h-full"
        style={{
          width: `${N_PAGES * 100}%`,
          transform: `translateX(calc(-${idxSafe * (100 / N_PAGES)}% + ${drag}px))`,
          transition: dragging.current && lockedH.current ? "none" : "transform .42s cubic-bezier(.22,1,.36,1)",
          position: "relative", zIndex: 1,
          perspective: "900px",
        }}
      >
        {visibles.map((p, i) => {
          const delta = Math.max(-1.2, Math.min(1.2, i - (idxSafe - drag / Math.max(1, cw))));
          const rot = -delta * 26;
          const sc = 1 - Math.min(0.16, Math.abs(delta) * 0.14);
          const dropY = Math.abs(delta) * 26;
          const op = 1 - Math.min(0.35, Math.abs(delta) * 0.3);
          const shift = -delta * 64; /* rapproche les voisines → elles dépassent au repos (peek) */
          const proche = Math.abs(i - idxSafe) <= 1;
          const pageTrans = dragging.current && lockedH.current ? "none" : "transform .42s cubic-bezier(.22,1,.36,1), opacity .42s ease";
          return (
            <div key={p.key} style={{ width: `${100 / N_PAGES}%`, height: "100%", padding: "10px 10px 96px", boxSizing: "border-box" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 28,
                  overflow: "hidden",
                  background: `linear-gradient(180deg, ${sky.card}, ${sky.card2})`,
                  border: `1px solid rgba(255,255,255,${0.14 - Math.abs(delta) * 0.06})`,
                  boxShadow: "0 18px 44px rgba(2,4,14,0.5)",
                  transform: `translateX(${shift}px) rotateY(${rot}deg) scale(${sc}) translateY(${dropY}px)`,
                  opacity: op,
                  transition: pageTrans,
                  transformOrigin: "center center",
                  willChange: proche ? "transform, opacity" : "auto",
                }}
              >
                {proche ? p.render(i === idxSafe) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Réglages : endroit fixe, en haut à droite sur toutes les pages */}
      <button
        className="pressable"
        onClick={() => { setRegOpen(true); setMenuOpen(false); }}
        aria-label="Réglages"
        style={{
          position: "absolute", top: 22, right: 22, zIndex: 12,
          width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center",
          background: "rgba(10,15,40,0.72)", border: `1px solid ${C.bord}`, color: C.doux,
        }}
      >
        <Settings size={18} />
      </button>

      {/* Astuce première visite de la page */}
      {app.onboarded && TIPS[pageActive.key] && !app.tipsSeen.includes(pageActive.key) && (
        <div className="slide-up" style={{ position: "absolute", top: 16, left: 22, right: 70, zIndex: 11 }}>
          <div className="flex items-center gap-2" style={{ background: "rgba(10,15,40,0.9)", border: `1px solid rgba(143,227,240,.35)`, borderRadius: 14, padding: "9px 12px" }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ fontSize: 11.5, color: C.neige, lineHeight: 1.4, flex: 1 }}>{TIPS[pageActive.key]}</span>
            <button className="pressable" onClick={() => act.seenTip(pageActive.key)} style={{ background: "none", border: "none", color: C.doux, padding: 2, flexShrink: 0 }}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* nav : un seul bouton visible, il change avec le swipe */}
      <div className="absolute left-0 right-0 flex flex-col items-center" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", zIndex: 10, gap: 9 }}>
        {menuOpen && (
          <Glass className="p-2 slide-up" style={{ background: "rgba(10,15,40,0.9)", borderRadius: 20 }}>
            <div className="grid grid-cols-3 gap-2">
              {visibles.map((p, i) => {
                const Icon = p.icon;
                return (
                  <button key={p.key} className="pressable" onClick={() => { setIdx(i); setMenuOpen(false); vibrate(8); }} style={{
                    width: 88, padding: "11px 4px", borderRadius: 15, border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    background: i === idxSafe ? "rgba(143,227,240,.16)" : "rgba(255,255,255,0.05)",
                    color: i === idxSafe ? C.glacier : C.doux,
                  }}>
                    <Icon size={18} />
                    <span style={{ fontFamily: FONT_B, fontSize: 10.5, fontWeight: 600 }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </Glass>
        )}
        <div className="flex gap-1">
          {visibles.map((p, i) => (
            <div key={p.key} style={{ width: i === idxSafe ? 16 : 5, height: 5, borderRadius: 99, background: i === idxSafe ? C.glacier : "rgba(255,255,255,0.25)", transition: "all .3s ease" }} />
          ))}
        </div>
        <Glass pressable onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 px-4 py-2" style={{ borderRadius: 999, background: "rgba(10,15,40,0.78)" }}>
          <IconActive size={18} style={{ color: C.glacier }} />
          <span style={{ fontFamily: FONT_B, fontSize: 13, fontWeight: 700, color: C.neige }}>{pageActive.label}</span>
          <ChevronUp size={15} style={{ color: C.doux, transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .25s ease" }} />
        </Glass>
      </div>

      {/* toast XP / undo */}
      {toast && (
        <div className="toast flex items-center gap-3" style={{ position: "absolute", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)", zIndex: 20, background: "rgba(12,18,48,0.95)", border: `1px solid rgba(255,184,107,.4)`, color: C.aube, fontSize: 12.5, fontWeight: 700, padding: "9px 16px", borderRadius: 999, whiteSpace: "nowrap" }}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button className="pressable" onClick={() => { toast.undo(); setToast(null); }} style={{ background: "rgba(255,255,255,0.12)", border: `1px solid ${C.bord}`, color: C.neige, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontFamily: FONT_B, fontWeight: 700 }}>
              Annuler
            </button>
          )}
        </div>
      )}

      {/* overlays */}
      {!app.onboarded && (
        <OnboardingOverlay
          defaultPourquoi={app.pourquoi}
          onFinish={(p) => {
            setApp((a) => ({
              ...a,
              prenom: p.prenom, objectifs: p.objectifs, pourquoi: p.pourquoi, onboarded: true,
              habitudes: p.habitudes.length
                ? p.habitudes.map((h) => { const parts = h.split(" "); return { emoji: parts[0], nom: parts.slice(1).join(" "), fait: false, streak: 0, repos: [], semaine: [0, 0, 0, 0, 0, 0, 0] }; })
                : a.habitudes,
            }));
            setModsOff(p.modsOff);
            setIdx(0);
            notif(p.prenom ? `Bienvenue, ${p.prenom} 🏔` : "Bienvenue 🏔");
          }}
          onSkip={() => setApp((a) => ({ ...a, onboarded: true }))}
        />
      )}
      {biblioOpen && <BiblioOverlay app={appWithScore} act={act} onClose={() => setBiblioOpen(false)} />}
      {aideOpen && <AideOverlay onClose={() => setAideOpen(false)} />}
      {legalOpen && <LegalOverlay page={legalOpen} onClose={() => setLegalOpen(null)} />}
      {gachaOpen && <GachaSheet act={act} onClose={() => setGachaOpen(false)} />}
      {gateOpen && <GateSheet act={act} onClose={() => setGateOpen(false)} />}
      {enigOpen && <EnigmesOverlay app={appWithScore} act={act} onClose={() => setEnigOpen(false)} />}
      {regOpen && <ReglagesOverlay skyMode={skyMode} setSkyMode={setSkyMode} app={appWithScore} act={act} modsOff={modsOff} toggleMod={toggleMod} vibrOn={vibrOn} setVibrOn={setVibrOn} onClose={() => setRegOpen(false)} />}
      {app.seance && <SeanceOverlay seance={app.seance} act={act} />}
      {app.recapVisible && <RecapOverlay recap={app.recapVisible} onClose={act.closeRecap} />}
      <Confetti burst={burst} />
    </div>
  );
}
