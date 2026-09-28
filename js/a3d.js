/* =========================================================
   AJUSTA — a3d.js
   O "A" metálico em WebGL (única cena 3D da página).
   Narrativa, não loop (guia Kairo, item 5): as duas pernas começam soltas e tortas,
   o scroll as encaixa, o impacto dá uma oscilação amortecida com leve achatamento,
   e o laser atravessa o A como no brand book.
   Sem WebGL, no celular, em máquinas fracas ou com movimento reduzido: fica o SVG de reserva.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const section = document.getElementById('compromisso');
const canvas = section?.querySelector('.commit-canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 640px)').matches;
const lowCore = (navigator.hardwareConcurrency || 8) < 4;

if (section && canvas && !reduce && !small && !lowCore) init();

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // fica o SVG
  }

  // Cores vêm dos tokens do CSS (nenhuma cor crua fora do :root)
  const css = getComputedStyle(document.documentElement);
  const token = name => new THREE.Color(css.getPropertyValue(name).trim());
  const METAL = token('--metal-hi');
  const LASER = token('--accent');

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  /* ---------- As duas pernas, a partir dos polígonos do logo (viewBox 0..100) ---------- */
  const S = 1 / 22;                      // escala: 100 unidades do SVG ≈ 4,5 unidades 3D
  const DEPTH = 0.5;
  const material = new THREE.MeshPhysicalMaterial({
    color: METAL, metalness: 1, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.18,
  });

  function makeLeg(points) {
    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => {
      const X = (x - cx) * S, Y = (cy - y) * S;
      i ? shape.lineTo(X, Y) : shape.moveTo(X, Y);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 5,
    });
    geo.translate(0, 0, -DEPTH / 2);
    const mesh = new THREE.Mesh(geo, material);
    // Centro do desenho da logo (viewBox -2 -2 104.4 93): x 50.2, y 44
    mesh.userData.home = new THREE.Vector3((cx - 50.2) * S, (44 - cy) * S, 0);
    mesh.position.copy(mesh.userData.home);
    return mesh;
  }

  const group = new THREE.Group();
  // Nova logo: hastes retas e paralelas no topo, que se abrem em diagonal
  const legL = makeLeg([[39.6, 0.8], [48.3, 0.8], [48.3, 28.7], [46.6, 33], [23.8, 87], [3, 87], [0.9, 85.2], [37.8, 3.2]]);
  const legR = makeLeg([[60.8, 0.8], [52.1, 0.8], [52.1, 28.7], [53.8, 33], [76.6, 87], [97.4, 87], [99.5, 85.2], [62.6, 3.2]]);
  group.add(legL, legR);
  scene.add(group);

  /* ---------- O laser ---------- */
  const laser = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.022, 0.022),
    new THREE.MeshBasicMaterial({ color: LASER, toneMapped: false, transparent: true }),
  );
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 0.22),
    new THREE.MeshBasicMaterial({ color: LASER, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  laser.add(core, glow);
  laser.position.z = 0.4;
  scene.add(laser);

  const laserLight = new THREE.PointLight(LASER, 0, 7, 1.6);
  laserLight.position.z = 1.4;
  scene.add(laserLight);

  const key = new THREE.DirectionalLight(METAL, 1.4);
  key.position.set(-3, 4, 6);
  scene.add(key);

  /* ---------- Estado da narrativa ---------- */
  const FROM = {
    L: { x: -1.1, y: 0.45, rz: 0.36, ry: -0.55 },
    R: { x: 1.05, y: -0.35, rz: -0.3, ry: 0.6 },
  };
  let pTarget = 0, p = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  if (window.ScrollTrigger) {
    ScrollTrigger.create({
      trigger: section, start: 'top 80%', end: 'center 45%',
      onUpdate: self => { pTarget = self.progress; },
      onRefresh: self => { pTarget = self.progress; },
    });
  } else {
    pTarget = 1;
  }

  if (matchMedia('(hover: hover)').matches) {
    section.addEventListener('pointermove', e => {
      const r = section.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    });
    section.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });
  }

  function apply(t, time) {
    // 1. Encaixe (0 → 0,72)
    const a = easeOut(Math.min(t / 0.72, 1));
    const k = 1 - a;
    // 2. Impacto (0,72 → 1): oscilação amortecida + achatamento no pico
    const u = Math.max(0, (t - 0.72) / 0.28);
    const wob = t > 0.72 ? 0.1 * Math.exp(-5 * u) * Math.cos(16 * u) : 0;
    const squash = t > 0.72 ? 0.05 * Math.exp(-6 * u) * Math.cos(14 * u) : 0;

    for (const [leg, f, sign] of [[legL, FROM.L, 1], [legR, FROM.R, -1]]) {
      leg.position.x = leg.userData.home.x + f.x * k;
      leg.position.y = leg.userData.home.y + f.y * k;
      leg.rotation.z = f.rz * k + wob * sign;
      leg.rotation.y = f.ry * k;
    }
    group.scale.set(1 + squash * 0.5, 1 - squash, 1);

    // 3. Laser desce do topo e para no terço inferior, cruzando o A
    const lt = Math.min(Math.max((t - 0.1) / 0.7, 0), 1);
    laser.position.y = 2.6 - easeOut(lt) * 3.25;
    const on = Math.min(Math.max((t - 0.05) / 0.12, 0), 1);
    core.material.opacity = on;
    glow.material.opacity = 0.22 * on;
    laserLight.intensity = 9 * on;
    laserLight.position.y = laser.position.y;

    // Respiração mínima para o metal não ficar estático
    group.position.y = Math.sin(time * 0.0009) * 0.04;
    group.rotation.y = mouse.x + Math.sin(time * 0.0005) * 0.05;
    group.rotation.x = mouse.y;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Só renderiza enquanto a seção está visível
  let visible = false, raf = 0;
  function frame(time) {
    p += (pTarget - p) * 0.08;
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    apply(p, time);
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(frame) : 0;
  }
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }, { rootMargin: '100px' }).observe(section);

  apply(0, 0);
  renderer.render(scene, camera);
  section.classList.add('is-3d');
}
