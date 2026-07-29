import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ================= ASCENT — Monde 3D du Parcours =================
   Diorama coloré façon carte de mondes : 5 îlots-biomes (vallée, forêt,
   alpage, neige, sommet) posés sur l'eau, sentier qui serpente, balises
   tapables, compagnon qui grimpe selon ta progression, nuages, orbite
   douce au doigt. Rendu en pause hors de la page Parcours.
=================================================================== */

const NODE_T = [0.1, 0.36, 0.64, 0.96]; // position des 4 balises le long du sentier
const COL = {
  glacier: 0x8fe3f0, aube: 0xffb86b, neige: 0xeaf2ff, gris: 0x55607f,
  eau: 0x3e7fd6, eauClair: 0x6fb4f2,
};

function toon(color) { return new THREE.MeshToonMaterial({ color }); }

function ilot(x, y, z, r, hauteur, topColor, sideColor) {
  const g = new THREE.Group();
  const side = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, hauteur, 24), toon(sideColor));
  side.position.y = hauteur / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.92, 0.14, 24), toon(topColor));
  top.position.y = hauteur + 0.07;
  g.add(side, top);
  g.position.set(x, y, z);
  g.userData.topY = y + hauteur + 0.14;
  return g;
}
function arbre(x, z, y) {
  const g = new THREE.Group();
  const tronc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), toon(0x7a5230));
  tronc.position.y = 0.1;
  const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), toon(0x4faf62));
  f1.position.y = 0.3;
  const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), toon(0x63c777));
  f2.position.y = 0.44;
  g.add(tronc, f1, f2);
  g.position.set(x, y, z);
  return g;
}
function sapin(x, z, y, enneige) {
  const g = new THREE.Group();
  const tronc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), toon(0x6b4a2e));
  tronc.position.y = 0.07;
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 10), toon(enneige ? 0x2e6b52 : 0x2e7d57));
  c.position.y = 0.3;
  g.add(tronc, c);
  if (enneige) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.14, 10), toon(0xeaf2ff));
    s.position.y = 0.44;
    g.add(s);
  }
  g.position.set(x, y, z);
  return g;
}
function rocher(x, z, y, r) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), toon(0x8b95ac));
  m.position.set(x, y + r * 0.7, z);
  m.rotation.set(Math.random(), Math.random(), 0);
  return m;
}
function nuage(x, y, z, s) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  [[0, 0, 0, 0.3], [0.28, 0.04, 0.05, 0.22], [-0.26, 0.02, -0.04, 0.2], [0.06, 0.14, 0, 0.19]].forEach(([dx, dy, dz, r]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), mat);
    b.position.set(dx, dy, dz);
    g.add(b);
  });
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  return g;
}
function drapeau(couleur) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: couleur, side: THREE.DoubleSide });
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 16), toon(0xd8e2f4));
  socle.position.y = 0.03;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), toon(0xeaf2ff));
  pole.position.y = 0.23;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), mat);
  fl.position.set(0.11, 0.36, 0);
  g.add(socle, pole, fl);
  g.userData.flagMat = mat;
  g.userData.socle = socle;
  return g;
}
function miniCompagnon() {
  const g = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), toon(0xe9f0fe));
  corps.scale.set(1, 1.15, 0.95);
  const oeilMat = toon(0x2a335c);
  [-0.055, 0.055].forEach((dx) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), oeilMat);
    o.position.set(dx, 0.03, 0.145);
    g.add(o);
  });
  g.add(corps);
  return g;
}

export default function WorldScene({ noeuds, progress, selected, onSelect, actif }) {
  const mountRef = useRef(null);
  const st = useRef({ ready: false }).current;
  const propsRef = useRef({ noeuds, progress, selected, actif });
  propsRef.current = { noeuds, progress, selected, actif };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x141c3e, 13, 24);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const cible = new THREE.Vector3(0.5, 1.3, -0.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    /* lumières */
    scene.add(new THREE.HemisphereLight(0xdce8ff, 0x2a3160, 1.05));
    const soleil = new THREE.DirectionalLight(0xfff1dd, 1.0);
    soleil.position.set(4, 7, 5);
    scene.add(soleil);

    /* eau */
    const eau = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshToonMaterial({ color: COL.eau }));
    eau.rotation.x = -Math.PI / 2;
    eau.position.y = -0.35;
    scene.add(eau);
    [[-2.6, 3.4, 1.1], [2.2, 2.2, 0.8], [4.6, -0.6, 1.3], [-4.4, -0.8, 0.9], [0.4, 4.6, 0.7]].forEach(([x, z, r]) => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshToonMaterial({ color: COL.eauClair, transparent: true, opacity: 0.45 }));
      b.rotation.x = -Math.PI / 2;
      b.position.set(x, -0.34, z);
      b.scale.y = 0.6;
      scene.add(b);
    });

    /* îlots-biomes */
    const iVallee = ilot(-3.3, 0, 2.3, 1.5, 0.7, 0x79c76b, 0x8a6a4a);
    const iForet = ilot(-1.2, 0, 0.9, 1.15, 1.1, 0x4f9e5c, 0x7a5a40);
    const iAlpage = ilot(0.8, 0, -0.2, 1.05, 1.7, 0xa8d46b, 0x8f7350);
    const iNeige = ilot(2.5, 0, -1.5, 1.15, 2.4, 0xf2f6fc, 0x6b7a99);
    scene.add(iVallee, iForet, iAlpage, iNeige);

    iVallee.add(arbre(-0.5, 0.3, 0.84), arbre(0.45, -0.4, 0.84), arbre(0.1, 0.65, 0.84));
    iForet.add(sapin(-0.35, 0.25, 1.24), sapin(0.35, -0.15, 1.24), sapin(0, 0.45, 1.24));
    iAlpage.add(rocher(-0.35, 0.2, 1.84, 0.12), rocher(0.3, -0.3, 1.84, 0.09), arbre(0.3, 0.4, 1.84));
    iNeige.add(sapin(-0.35, 0.2, 2.54, true), sapin(0.3, -0.25, 2.54, true), rocher(0.35, 0.4, 2.54, 0.1));

    /* le sommet : grand pic */
    const sommet = new THREE.Group();
    const pic = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.6, 5), toon(0x223055));
    pic.position.y = 1.3;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.95, 5), toon(0xeaf2ff));
    cap.position.y = 2.15;
    sommet.add(pic, cap);
    sommet.position.set(4.1, 1.35, -2.9);
    scene.add(sommet);
    const glow = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const ctx = c.getContext("2d");
      const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,184,107,0.8)"); gr.addColorStop(1, "rgba(255,184,107,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      sp.scale.setScalar(1.6);
      sp.position.set(4.1, 4.15, -2.9);
      return sp;
    })();
    scene.add(glow);

    /* sentier */
    const ancres = [
      new THREE.Vector3(-3.3, iVallee.userData.topY + 0.03, 2.3),
      new THREE.Vector3(-2.2, 0.75, 1.75),
      new THREE.Vector3(-1.2, iForet.userData.topY + 0.03, 0.9),
      new THREE.Vector3(-0.15, 1.45, 0.3),
      new THREE.Vector3(0.8, iAlpage.userData.topY + 0.03, -0.2),
      new THREE.Vector3(1.7, 2.1, -0.85),
      new THREE.Vector3(2.5, iNeige.userData.topY + 0.03, -1.5),
      new THREE.Vector3(3.3, 3.1, -2.2),
      new THREE.Vector3(4.1, 3.95, -2.9),
    ];
    const courbe = new THREE.CatmullRomCurve3(ancres, false, "catmullrom", 0.35);
    const tubeFond = new THREE.Mesh(new THREE.TubeGeometry(courbe, 140, 0.05, 8, false), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
    scene.add(tubeFond);
    let tubeProg = null;
    const setProgress = (p) => {
      if (tubeProg) { scene.remove(tubeProg); tubeProg.geometry.dispose(); }
      const n = Math.max(2, Math.round(140 * Math.max(0.02, Math.min(1, p))));
      const pts = courbe.getPoints(140).slice(0, n);
      tubeProg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.055, 8, false), toon(COL.glacier));
      scene.add(tubeProg);
      const pos = courbe.getPointAt(Math.max(0.001, Math.min(1, p)));
      comp.position.set(pos.x, pos.y + 0.26, pos.z);
      st.compBase = pos.y + 0.26;
    };

    /* balises (drapeaux tapables) */
    const flags = NODE_T.map((t, i) => {
      const f = drapeau(0x55607f);
      const p = courbe.getPointAt(t);
      f.position.copy(p);
      f.userData.noeud = i;
      scene.add(f);
      return f;
    });
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 10, 28), toon(0xffffff));
    anneau.rotation.x = -Math.PI / 2;
    scene.add(anneau);
    const setStates = (noeudsN, sel) => {
      flags.forEach((f, i) => {
        const nd = noeudsN[i] || {};
        const c = nd.etat === "fait" ? COL.glacier : nd.etat === "encours" ? COL.aube : COL.gris;
        f.userData.flagMat.color.setHex(c);
        f.userData.pulse = nd.etat === "encours";
      });
      const p = courbe.getPointAt(NODE_T[Math.max(0, Math.min(3, sel))]);
      anneau.position.set(p.x, p.y + 0.02, p.z);
    };

    /* compagnon */
    const comp = miniCompagnon();
    scene.add(comp);

    /* nuages */
    const nuages = [nuage(-3.6, 2.6, -0.6, 1), nuage(1.4, 3.3, 1.8, 0.8), nuage(4.6, 2.2, 0.6, 0.7), nuage(-0.8, 3.9, -2.2, 0.9)];
    nuages.forEach((n) => scene.add(n));

    /* caméra orbitale douce */
    let theta = 0.78, thetaCible = 0.78;
    const placerCam = (t) => {
      const R = 10.2, phi = 1.06;
      camera.position.set(
        cible.x + R * Math.sin(phi) * Math.sin(t),
        cible.y + R * Math.cos(phi),
        cible.z + R * Math.sin(phi) * Math.cos(t)
      );
      camera.lookAt(cible);
    };

    /* interactions : orbite horizontale (revendiquée avant le carrousel) + tap balise */
    let down = false, claimed = false, sx = 0, sy = 0, lastX = 0, moved = 0;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onDown = (e) => { down = true; claimed = false; moved = 0; sx = lastX = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      moved = Math.max(moved, Math.abs(dx), Math.abs(dy));
      if (!claimed) {
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) claimed = true;
        else if (Math.abs(dy) > 6) { down = false; return; }
        else return;
      }
      e.stopPropagation();
      thetaCible = Math.max(0.42, Math.min(1.14, thetaCible + (e.clientX - lastX) * 0.004));
      lastX = e.clientX;
    };
    const onUp = (e) => {
      if (!down) return;
      down = false;
      if (claimed) { e.stopPropagation(); return; }
      if (moved > 8) return;
      const r = mount.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(flags, true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && o.userData.noeud === undefined) o = o.parent;
        if (o) { onSelect(o.userData.noeud); }
      }
    };
    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("pointerup", onUp);
    mount.addEventListener("pointercancel", () => { down = false; });

    /* boucle */
    let raf = null, running = true;
    const clock = new THREE.Clock();
    let t = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!propsRef.current.actif && st.dejaRendu) return; // page inactive : on fige (1er rendu conservé)
      t += dt;
      theta += (thetaCible - theta) * Math.min(1, dt * 6);
      placerCam(theta + Math.sin(t * 0.2) * 0.02);
      comp.position.y = (st.compBase || 1) + Math.sin(t * 2.2) * 0.05;
      comp.rotation.y = Math.sin(t * 0.8) * 0.3;
      nuages.forEach((n, i) => { n.position.x += dt * (0.06 + i * 0.02); if (n.position.x > 6.5) n.position.x = -6.5; });
      flags.forEach((f) => { const s = f.userData.pulse ? 1 + Math.sin(t * 3) * 0.1 : 1; f.userData.socle.scale.setScalar(s); });
      glow.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.25;
      renderer.render(scene, camera);
      st.dejaRendu = true;
    };
    animate();
    const onVis = () => { running = document.visibilityState === "visible"; if (!running && raf) cancelAnimationFrame(raf); else if (running) { clock.getDelta(); animate(); } };
    document.addEventListener("visibilitychange", onVis);

    st.setProgress = setProgress;
    st.setStates = setStates;
    st.ready = true;
    setProgress(propsRef.current.progress);
    setStates(propsRef.current.noeuds, propsRef.current.selected);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerup", onUp);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      st.ready = false;
    };
  }, []);

  useEffect(() => { if (st.ready) st.setProgress(progress); }, [progress]);
  useEffect(() => { if (st.ready) st.setStates(noeuds, selected); }, [noeuds, selected]);

  return <div ref={mountRef} style={{ height: 350, touchAction: "pan-y", cursor: "grab" }} aria-label="Monde de ton ascension" />;
}
