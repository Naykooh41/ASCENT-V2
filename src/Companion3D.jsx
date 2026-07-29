import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ============= ASCENT — Compagnon 3D =============
   · 9 compagnons modélisés (corps + trait signature chacun)
   · Attrapable au doigt : suit le doigt, se lance, gravité,
     rebonds avec squash d'impact, retour élastique au perchoir
   · Chapeaux et tenues = vraies géométries 3D ancrées au corps
     (elles héritent squash, rotations, sauts — vraiment portées)
   · Auras, humeurs (7 visages), clignement, regard vers le doigt
================================================== */

const toon = (c, o) => new THREE.MeshToonMaterial({ color: c, ...(o || {}) });

/* ---------- Chapeaux 3D ---------- */
function chapeau3D(id) {
  const g = new THREE.Group();
  if (id === "cap") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8fe3f0));
    const visiere = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 20, 1, false, -Math.PI / 2.6, Math.PI / 1.3), toon(0x6fc5d4));
    visiere.position.set(0, 0.005, 0.06);
    g.add(dome, visiere);
  } else if (id === "top") {
    const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24), toon(0x1a2340));
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.22, 24), toon(0x1a2340));
    tube.position.y = 0.12;
    const ruban = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.13, 0.05, 24), toon(0xffb86b));
    ruban.position.y = 0.05;
    g.add(bord, tube, ruban);
  } else if (id === "party") {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 20), toon(0xff8ab0));
    cone.position.y = 0.14;
    const pompon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), toon(0xfff4d6));
    pompon.position.y = 0.3;
    g.add(cone, pompon);
  } else if (id === "grad") {
    const calotte = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.07, 20), toon(0x1a2340));
    const planche = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.34), toon(0x1a2340));
    planche.position.y = 0.05;
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), toon(0xffb86b));
    fil.position.set(0.16, -0.01, 0.16);
    const gland = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), toon(0xffb86b));
    gland.position.set(0.16, -0.08, 0.16);
    g.add(calotte, planche, fil, gland);
  } else if (id === "crown") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.09, 24), toon(0xffd45e));
    base.position.y = 0.045;
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pointe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), toon(0xffd45e));
      pointe.position.set(Math.cos(a) * 0.125, 0.13, Math.sin(a) * 0.125);
      g.add(pointe);
      const gemme = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), toon(0xff6b8a));
      gemme.position.set(Math.cos(a + 0.6) * 0.135, 0.05, Math.sin(a + 0.6) * 0.135);
      g.add(gemme);
    }
  } else if (id === "bow") {
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), toon(0xffb6c9));
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 12), toon(0xffb6c9));
    c1.rotation.z = Math.PI / 2; c1.position.x = 0.09;
    const c2 = c1.clone(); c2.rotation.z = -Math.PI / 2; c2.position.x = -0.09;
    g.add(centre, c1, c2);
    g.position.x = 0.08; g.rotation.z = -0.25;
  } else if (id === "helmet") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff6b5e));
    const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 24), toon(0xe25a4e));
    const crete = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.24), toon(0xe25a4e));
    crete.position.y = 0.14;
    g.add(dome, bord, crete);
  } else if (id === "star") {
    const bandeau = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 8, 24), toon(0xffd45e));
    bandeau.rotation.x = Math.PI / 2;
    g.add(bandeau);
    const etoile = new THREE.Group();
    const cœur = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), toon(0xffd45e));
    etoile.add(cœur);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 6), toon(0xffd45e));
      b.rotation.z = (i * Math.PI) / 2;
      b.position.set(Math.sin((i * Math.PI) / 2) * 0.06, Math.cos((i * Math.PI) / 2) * 0.06, 0);
      b.rotateX(0);
      b.rotation.z = (i * Math.PI) / 2 + Math.PI;
      etoile.add(b);
    }
    etoile.position.set(0, 0.1, 0.02);
    g.add(etoile);
  }
  return g;
}

/* ---------- Tenues 3D ---------- */
function tenue3D(id) {
  const g = new THREE.Group();
  if (id === "echarpe") {
    const tour = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 24), toon(0x8fe3f0));
    tour.rotation.x = Math.PI / 2;
    tour.position.y = -0.02;
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.03), toon(0x6fc5d4));
    pan.position.set(0.1, -0.16, 0.16);
    pan.rotation.z = -0.15;
    g.add(tour, pan);
    g.userData.type = "cou";
  } else if (id === "cape") {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.58, 6, 6), toon(0xffb86b, { side: THREE.DoubleSide }));
    cape.position.set(0, -0.22, -0.2);
    cape.rotation.x = 0.28;
    g.add(cape);
    const attache = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 24), toon(0xe8a45c));
    attache.rotation.x = Math.PI / 2;
    attache.position.y = 0.02;
    g.add(attache);
    g.userData.type = "dos";
    g.userData.cape = cape;
  } else if (id === "noeudpap") {
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), toon(0x2a335c));
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 10), toon(0x3a4670));
    c1.rotation.z = Math.PI / 2; c1.position.x = 0.065;
    const c2 = c1.clone(); c2.rotation.z = -Math.PI / 2; c2.position.x = -0.065;
    g.add(centre, c1, c2);
    g.position.set(0, -0.1, 0.29);
    g.userData.type = "torse";
  } else if (id === "sac") {
    const sac = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.13), toon(0x8a6a4a));
    sac.position.set(0, -0.12, -0.26);
    const poche = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), toon(0x7a5a40));
    poche.position.set(0, -0.2, -0.33);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.02), toon(0x6b4a2e));
    s1.position.set(0.1, -0.08, 0.24);
    const s2 = s1.clone(); s2.position.x = -0.1;
    g.add(sac, poche, s1, s2);
    g.userData.type = "dos";
  }
  return g;
}

/* ---------- Traits signature des 9 compagnons ---------- */
function signature3D(id) {
  const g = new THREE.Group();
  if (id === "pip") {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), toon(0xff9d4d));
    fl.position.y = 0.06;
    const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 8), toon(0xffd45e));
    fl2.position.y = 0.1;
    g.add(fl, fl2);
    g.userData.flamme = true;
  } else if (id === "gaspard") {
    const barbe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 12), toon(0xd8e2f4));
    barbe.rotation.x = Math.PI;
    barbe.position.set(0, -0.32, 0.22);
    g.add(barbe);
    g.userData.bas = true;
  } else if (id === "boum") {
    const meche = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 16, Math.PI * 1.4), toon(0x3a2a20));
    meche.position.y = 0.05;
    meche.rotation.x = 0.4;
    const etincelle = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), toon(0xffd45e));
    etincelle.position.set(0.045, 0.1, 0);
    g.add(meche, etincelle);
    g.userData.etincelle = etincelle;
  } else if (id === "zaza") {
    [-1, 1].forEach((s) => {
      const oreille = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 10), toon(0xc9a7ff));
      oreille.position.set(0.14 * s, 0.02, 0);
      oreille.rotation.z = -0.5 * s;
      g.add(oreille);
    });
  } else if (id === "rocky") {
    [[0.18, -0.05, 0.14, 0.055], [-0.16, 0.1, 0.1, 0.045], [0.05, 0.14, -0.12, 0.05]].forEach(([x, y, z, r]) => {
      const roc = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), toon(0x6b7a99));
      roc.position.set(x, y - 0.3, z);
      g.add(roc);
    });
    g.userData.bas = true;
  } else if (id === "fen") {
    const feuille = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), toon(0x4faf62));
    feuille.scale.z = 0.35;
    feuille.rotation.z = 0.5;
    feuille.position.set(0.03, 0.07, 0);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.06, 6), toon(0x2e7d57));
    tige.position.y = -0.01;
    g.add(tige, feuille);
  } else if (id === "sol") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rayon = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 6), toon(0xffd45e));
      rayon.position.set(Math.cos(a) * 0.24, 0.12 + Math.sin(a) * 0.24, -0.02);
      rayon.rotation.z = a + Math.PI / 2;
      g.add(rayon);
    }
    g.userData.halo = true;
  }
  return g;
}

/* ---------- Yeux / humeurs ---------- */
function visages() {
  const noir = toon(0x2a335c);
  const groupes = {};
  const mk = (nom, build) => { const g = new THREE.Group(); build(g); g.visible = false; groupes[nom] = g; };
  const oeil = (x, sy) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), noir); o.position.set(x, 0.05, 0.3); o.scale.set(1, sy, 0.5); return o; };
  const arc = (x, inv) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI), noir); a.position.set(x, 0.045, 0.3); if (inv) a.rotation.z = Math.PI; return a; };
  mk("calm", (g) => { g.add(oeil(-0.12, 1.5), oeil(0.12, 1.5)); g.userData.blink = true; });
  mk("happy", (g) => { g.add(arc(-0.12), arc(0.12)); });
  mk("surprised", (g) => { const a = oeil(-0.12, 1); a.scale.set(1.4, 1.4, 0.5); const b = oeil(0.12, 1); b.scale.set(1.4, 1.4, 0.5); g.add(a, b); });
  mk("wink", (g) => { g.add(oeil(-0.12, 1.5), arc(0.12)); });
  mk("sleepy", (g) => { g.add(arc(-0.12, true), arc(0.12, true)); });
  mk("focused", (g) => { const l = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), noir); m.position.set(x, 0.05, 0.3); return m; }; g.add(l(-0.12), l(0.12)); });
  mk("proud", (g) => { g.add(arc(-0.12), arc(0.12)); const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), toon(0xffb86b)); s.position.set(0.22, 0.16, 0.26); g.add(s); });
  const bouche = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.013, 8, 16, Math.PI), toon(0x3a4670));
  bouche.position.set(0, -0.05, 0.3);
  bouche.rotation.z = Math.PI;
  const boucheO = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), toon(0x3a4670));
  boucheO.position.set(0, -0.06, 0.3);
  boucheO.scale.set(1, 1.25, 0.5);
  boucheO.visible = false;
  return { groupes, bouche, boucheO };
}

function texAura(couleur) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const gr = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, couleur + "77");
  gr.addColorStop(1, couleur + "00");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export default function Companion3D({ compagnonId, body, hatId, tenueId, aura, mood, onTap }) {
  const mountRef = useRef(null);
  const st = useRef({}).current;
  const propsRef = useRef({});
  propsRef.current = { mood, onTap };

  /* ---- scène (une fois) ---- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0.35, 4.4);
    camera.lookAt(0, 0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const resize = () => { renderer.setSize(mount.clientWidth, mount.clientHeight); camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); };
    resize();
    window.addEventListener("resize", resize);

    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3160, 1.05));
    const key = new THREE.DirectionalLight(0xfff1dd, 0.95); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fe3f0, 0.45); rim.position.set(-3, 1, -2); scene.add(rim);

    /* aura + ombre */
    const auraSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAura("#8FE3F0"), transparent: true, depthWrite: false }));
    auraSprite.scale.setScalar(3.2);
    scene.add(auraSprite);
    const ombre = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    ombre.rotation.x = -Math.PI / 2;
    ombre.position.y = -1.02;
    scene.add(ombre);

    /* racine + corps */
    const racine = new THREE.Group();
    scene.add(racine);
    const corpsG = new THREE.Group();
    racine.add(corpsG);
    st.slots = { corpsG, teteAnchor: null, couAnchor: null, dosAnchor: null, torseAnchor: null, corpsMesh: null, frills: [], signature: null, chapeau: null, tenue: null, visage: null };

    const construireCorps = (couleur) => {
      /* nettoie l'ancien */
      while (corpsG.children.length) {
        const c = corpsG.children[0];
        corpsG.remove(c);
        c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
      }
      const mat = toon(couleur);
      const corps = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 28), mat);
      corps.scale.set(1, 1.12, 0.95);
      corpsG.add(corps);
      st.slots.corpsMesh = corps;
      st.slots.frills = [-0.26, -0.09, 0.09, 0.26].map((x) => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 14), mat);
        f.position.set(x, -0.4, 0.02);
        corpsG.add(f);
        return f;
      });
      [-0.24, 0.24].forEach((x) => {
        const joue = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffb6c9, transparent: true, opacity: 0.55 }));
        joue.position.set(x, -0.03, 0.32);
        joue.scale.set(1, 0.7, 0.4);
        corpsG.add(joue);
      });
      const v = visages();
      const visageG = new THREE.Group();
      Object.values(v.groupes).forEach((gr) => visageG.add(gr));
      visageG.add(v.bouche, v.boucheO);
      corpsG.add(visageG);
      st.slots.visage = v;
      /* ancres portées par le corps → tout ce qui y est attaché bouge avec lui */
      const tete = new THREE.Group(); tete.position.y = 0.42; corpsG.add(tete);
      const cou = new THREE.Group(); cou.position.y = 0.08; corpsG.add(cou);
      const dos = new THREE.Group(); corpsG.add(dos);
      const torse = new THREE.Group(); corpsG.add(torse);
      st.slots.teteAnchor = tete; st.slots.couAnchor = cou; st.slots.dosAnchor = dos; st.slots.torseAnchor = torse;
    };

    st.setCompagnon = (id, couleur) => {
      construireCorps(couleur);
      if (st.slots.signature) { st.slots.corpsG.remove(st.slots.signature); }
      const sig = signature3D(id);
      (sig.userData.bas ? st.slots.corpsG : st.slots.teteAnchor).add(sig);
      st.slots.signature = sig;
      st.reposeChapeau();
      st.reposeTenue();
      st.setMood(propsRef.current.mood || "calm");
    };
    st.setChapeau = (id) => { st.chapeauId = id; st.reposeChapeau(); };
    st.reposeChapeau = () => {
      if (st.slots.chapeau) { st.slots.chapeau.parent && st.slots.chapeau.parent.remove(st.slots.chapeau); st.slots.chapeau = null; }
      if (!st.chapeauId) return;
      const h = chapeau3D(st.chapeauId);
      h.position.y = 0.02;
      st.slots.teteAnchor.add(h); /* fixé à la tête → hérite squash/rotations : vraiment porté */
      st.slots.chapeau = h;
    };
    st.setTenue = (id) => { st.tenueId = id; st.reposeTenue(); };
    st.reposeTenue = () => {
      if (st.slots.tenue) { st.slots.tenue.parent && st.slots.tenue.parent.remove(st.slots.tenue); st.slots.tenue = null; }
      if (!st.tenueId) return;
      const t = tenue3D(st.tenueId);
      const slot = t.userData.type === "cou" ? st.slots.couAnchor : t.userData.type === "dos" ? st.slots.dosAnchor : st.slots.torseAnchor;
      slot.add(t);
      st.slots.tenue = t;
    };
    st.setAura = (hex) => {
      if (st.auraHex === hex) return;
      st.auraHex = hex;
      const old = auraSprite.material.map;
      auraSprite.material.map = texAura(hex);
      auraSprite.material.needsUpdate = true;
      if (old) old.dispose();
    };
    st.setMood = (m) => {
      const v = st.slots.visage;
      if (!v) return;
      Object.entries(v.groupes).forEach(([k, g]) => { g.visible = k === m; });
      v.bouche.visible = m !== "surprised";
      v.boucheO.visible = m === "surprised";
      st.mood = m;
    };

    /* ---- physique du doigt ---- */
    const HOME = new THREE.Vector3(0, 0.15, 0);
    const SOL = -0.6, MURX = 1.5, PLAFOND = 1.55;
    const pos = HOME.clone();
    const vel = new THREE.Vector3();
    const cible = new THREE.Vector3();
    let grab = false, moved = 0, downT = 0;
    let squash = 1, squashV = 0;
    let overrideMood = null, overrideFin = 0;

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plan = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const versMonde = (e, out) => {
      const r = mount.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plan, out);
      return out;
    };
    const p3 = new THREE.Vector3();
    const pointeur = { x: 0, y: 0 };
    const onDown = (e) => {
      versMonde(e, p3);
      if (p3.distanceTo(pos) < 0.62) {
        grab = true; moved = 0; downT = performance.now();
        cible.copy(p3);
        e.stopPropagation();
        try { mount.setPointerCapture(e.pointerId); } catch (err) {}
        overrideMood = "surprised"; overrideFin = Infinity;
      }
    };
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      pointeur.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointeur.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!grab) return;
      e.stopPropagation();
      versMonde(e, p3);
      moved = Math.max(moved, cible.distanceTo(p3) * 60);
      cible.set(Math.max(-MURX, Math.min(MURX, p3.x)), Math.max(SOL + 0.1, Math.min(PLAFOND, p3.y)), 0);
    };
    const onUp = (e) => {
      if (!grab) return;
      grab = false;
      e.stopPropagation();
      overrideFin = performance.now() + 900;
      overrideMood = "happy";
      if (moved < 6 && performance.now() - downT < 350) {
        /* tap simple : réaction + phrase côté parent */
        vel.y += 2.6;
        propsRef.current.onTap && propsRef.current.onTap();
      }
    };
    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("pointerup", onUp);
    mount.addEventListener("pointercancel", onUp);

    /* ---- boucle ---- */
    let raf = null, running = true;
    const clock = new THREE.Clock();
    let t = 0, blinkT = -1, nextBlink = 2.5;
    const prev = pos.clone();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);
      t += dt;

      if (grab) {
        prev.copy(pos);
        pos.lerp(cible, Math.min(1, dt * 16));
        vel.copy(pos).sub(prev).divideScalar(Math.max(dt, 0.001));
        vel.clampLength(0, 9);
      } else {
        vel.y -= 9.5 * dt;
        /* rappel élastique vers le perchoir */
        vel.x += (HOME.x - pos.x) * 4.5 * dt;
        vel.y += (HOME.y - pos.y) * 3.2 * dt;
        vel.multiplyScalar(Math.max(0, 1 - 2.4 * dt));
        pos.addScaledVector(vel, dt);
        if (pos.y < SOL) { pos.y = SOL; if (vel.y < -0.6) { squashV -= Math.min(2.4, -vel.y) * 0.35; overrideMood = "happy"; overrideFin = performance.now() + 700; } vel.y = -vel.y * 0.42; vel.x *= 0.85; }
        if (pos.x > MURX) { pos.x = MURX; vel.x = -vel.x * 0.5; }
        if (pos.x < -MURX) { pos.x = -MURX; vel.x = -vel.x * 0.5; }
        if (pos.y > PLAFOND) { pos.y = PLAFOND; vel.y = -vel.y * 0.4; }
      }

      /* squash & stretch ressort */
      const etirement = Math.max(-0.32, Math.min(0.32, vel.y * 0.045));
      squashV += (1 + etirement - squash) * dt * 40;
      squashV *= Math.max(0, 1 - 12 * dt);
      squash += squashV * dt * 10;
      squash = Math.max(0.6, Math.min(1.45, squash));

      racine.position.set(pos.x, pos.y + Math.sin(t * 1.6) * (grab ? 0 : 0.045), pos.z);
      corpsG.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      corpsG.rotation.z = Math.max(-0.45, Math.min(0.45, -vel.x * 0.09));
      /* regard vers le doigt (hors préhension violente) */
      corpsG.rotation.y += ((pointeur.x * 0.5) - corpsG.rotation.y) * Math.min(1, dt * 5);
      corpsG.rotation.x += ((-pointeur.y * 0.22) - corpsG.rotation.x) * Math.min(1, dt * 5);

      auraSprite.position.copy(racine.position);
      const hSol = Math.max(0.1, 1 - (pos.y - SOL) * 0.35);
      ombre.scale.setScalar(hSol);
      ombre.material.opacity = 0.1 + hSol * 0.2;
      ombre.position.x = pos.x;

      /* humeur : override physique > prop */
      if (overrideMood && performance.now() > overrideFin) overrideMood = null;
      const voulu = overrideMood || propsRef.current.mood || "calm";
      if (voulu !== st.mood) st.setMood(voulu);

      /* clignement (calme) */
      const v = st.slots.visage;
      if (v && v.groupes.calm.visible) {
        if (blinkT < 0 && t > nextBlink) { blinkT = t; nextBlink = t + 2.5 + Math.random() * 2.5; }
        if (blinkT >= 0) {
          const bp = (t - blinkT) / 0.2;
          const sy = bp >= 1 ? 1.5 : 1.5 * Math.abs(1 - 2 * Math.min(1, bp)) + 0.1;
          v.groupes.calm.children.forEach((o) => (o.scale.y = sy));
          if (bp >= 1) blinkT = -1;
        }
      }
      /* signatures vivantes */
      const sig = st.slots.signature;
      if (sig) {
        if (sig.userData.flamme) sig.rotation.z = Math.sin(t * 7) * 0.16;
        if (sig.userData.etincelle) sig.userData.etincelle.material.color.setHex(Math.sin(t * 9) > 0 ? 0xffd45e : 0xff9d4d);
        if (sig.userData.halo) sig.rotation.z = t * 0.4;
      }
      const ten = st.slots.tenue;
      if (ten && ten.userData.cape) ten.userData.cape.rotation.x = 0.28 + Math.sin(t * 1.8) * 0.08 - vel.x * 0.04;

      renderer.render(scene, camera);
    };
    animate();
    const onVis = () => { running = document.visibilityState === "visible"; if (!running && raf) cancelAnimationFrame(raf); else if (running) { clock.getDelta(); animate(); } };
    document.addEventListener("visibilitychange", onVis);

    st.ready = true;
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerup", onUp);
      mount.removeEventListener("pointercancel", onUp);
      renderer.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      st.ready = false;
    };
  }, []);

  /* ---- mises à jour de props ---- */
  useEffect(() => { if (st.ready) st.setCompagnon(compagnonId, body); }, [compagnonId, body]);
  useEffect(() => { if (st.ready) st.setChapeau(hatId || null); }, [hatId]);
  useEffect(() => { if (st.ready) st.setTenue(tenueId || null); }, [tenueId]);
  useEffect(() => { if (st.ready) st.setAura(aura || "#8FE3F0"); }, [aura]);

  return <div ref={mountRef} style={{ height: 300, touchAction: "none", cursor: "grab" }} aria-label="Ton compagnon en 3D — attrape-le" />;
}
