/* ============================================================
   NEXUS SPACE — ЭТАП 1: КОРАБЛЬ И КОСМОНАВТ
   Изометрический 3D-экшен на Three.js
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

const VERSION   = 'v2.1 · build 12';
const PLAYER_R  = 0.62;    // радиус космонавта
const MOVE_SPEED = 6.4;

/* ============================================================
   0. УСТРОЙСТВО И КАЧЕСТВО ГРАФИКИ
   Игра рассчитана на телефонный браузер — качество подбирается
   автоматически, чтобы держать стабильный FPS.
   ============================================================ */
const IS_TOUCH  = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = IS_TOUCH && Math.min(window.innerWidth, window.innerHeight) < 900;
const CORES     = navigator.hardwareConcurrency || 4;
const QUALITY   = !IS_MOBILE ? 'high' : (CORES <= 4 ? 'low' : 'mid');
const PR_CAP    = QUALITY === 'low' ? 1.0 : QUALITY === 'mid' ? 1.25 : 1.5;
const SHADOWS   = QUALITY === 'high';
// Блум (UnrealBloomPass) даёт «дорогое» свечение, но это 3 полноэкранных прохода.
// Включаем только там, где GPU тянет; при просадке FPS гасится на ходу.
let BLOOM_ON    = QUALITY !== 'low';

/* ============================================================
   1. РЕНДЕР
   ============================================================ */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: QUALITY !== 'low',
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
  depth: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PR_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// телефоны часто теряют WebGL-контекст при сворачивании — не даём игре «умереть»
renderer.domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
renderer.domElement.addEventListener('webglcontextrestored', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

/* ============================================================
   2. СЦЕНА И КАМЕРА (изометрия)
   ============================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x0b1220, 0.008);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 400);
const CAM_OFFSET = new THREE.Vector3(12.5, 14.5, 12.5);
const camLook = new THREE.Vector3(0, 1.1, 0);

// Изометрия подстраивается под пропорции экрана:
// в портрете на телефоне камера отъезжает, чтобы комната влезала в кадр.
function fitCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  const k = aspect < 1 ? Math.min(1.85, 0.95 / Math.max(aspect, 0.42)) : 1;
  CAM_OFFSET.set(12.5 * k, 14.5 * (0.82 + 0.18 * k), 12.5 * k);
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 46 : 40;
  camera.updateProjectionMatrix();
}
fitCamera();
camera.position.copy(CAM_OFFSET);
camera.lookAt(camLook);

/* ============================================================
   2.1 ПОСТОБРАБОТКА — БЛУМ (мягкий ореол вокруг эмиссивных элементов)
   Даёт «дорогой» вид без единого лишнего источника света.
   На слабом устройстве выключен, при просадке FPS гасится на ходу.
   ============================================================ */
let composer = null, bloomPass = null;
if (BLOOM_ON) {
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      QUALITY === 'high' ? 0.55 : 0.36,   // сила свечения
      0.75,                                // радиус размытия
      0.78                                 // порог яркости
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  } catch (e) { composer = null; bloomPass = null; BLOOM_ON = false; }
}

/* ============================================================
   3. ТЕКСТУРЫ (генерируются на canvas — без внешних файлов)
   ============================================================ */
function makeFloorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#232c3c'; g.fillRect(0, 0, 512, 512);

  // металлический шум
  for (let i = 0; i < 14000; i++) {
    const v = Math.random() * 46 | 0;
    g.fillStyle = `rgba(${130 + v},${150 + v},${180 + v},0.045)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // потёртости
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(200,220,255,${Math.random() * 0.05})`;
    g.lineWidth = Math.random() * 2;
    g.beginPath();
    const x = Math.random() * 512, y = Math.random() * 512;
    g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120);
    g.stroke();
  }
  // панели
  g.strokeStyle = '#0c1119'; g.lineWidth = 7;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  // внутренняя разметка
  g.strokeStyle = 'rgba(96,150,200,0.30)'; g.lineWidth = 2;
  for (let i = 64; i < 512; i += 128) {
    g.beginPath(); g.moveTo(i, 8); g.lineTo(i, 504); g.stroke();
    g.beginPath(); g.moveTo(8, i); g.lineTo(504, i); g.stroke();
  }
  // заклёпки
  g.fillStyle = 'rgba(190,215,245,0.35)';
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y <= 512; y += 128) {
      for (const o of [[16, 16], [-16, 16], [16, -16], [-16, -16]]) {
        g.beginPath(); g.arc(x + o[0], y + o[1], 2.6, 0, 7); g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeWallTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a2230'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = Math.random() * 40 | 0;
    g.fillStyle = `rgba(${110 + v},${130 + v},${160 + v},0.05)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = '#0d131d'; g.lineWidth = 5;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.strokeStyle = 'rgba(80,130,180,0.22)'; g.lineWidth = 1.5;
  for (let i = 32; i < 256; i += 64) {
    g.beginPath(); g.moveTo(i, 4); g.lineTo(i, 252); g.stroke();
    g.beginPath(); g.moveTo(4, i); g.lineTo(252, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// звёздное небо для носового блистера
function makeStarTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 400);
  grd.addColorStop(0, '#0a1830'); grd.addColorStop(1, '#03060f');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  // туманности
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 60 + Math.random() * 150;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = ['80,120,255', '150,80,220', '60,180,220'][i % 3];
    rg.addColorStop(0, `rgba(${col},0.18)`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // звёзды
  for (let i = 0; i < 950; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = Math.random() * 1.6 + 0.3;
    const a = 0.35 + Math.random() * 0.65;
    g.fillStyle = `rgba(${200 + Math.random() * 55 | 0},${215 + Math.random() * 40 | 0},255,${a})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// экран монитора на столе: бегущие логи терминала (анимированная canvas-текстура)
function makeTerminalScreen() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const MAXL = 13;
  const lines = [];
  const W = ['SCAN','NAV','HULL','PWR','O2','CRYO','SYS','NET','GYRO','SHLD','THR','COMM','AI','MAP','FUEL','DOCK'];
  const pad = (n, l) => String(n).padStart(l, '0');
  const rnd = () => (Math.random() * 9999 | 0);
  function newLine() {
    const w = W[Math.random() * W.length | 0];
    const r = Math.random();
    if (r < 0.30) return '> ' + w + '_' + pad(rnd(), 4) + ' OK ' + (Math.random() * 100).toFixed(1) + '%';
    if (r < 0.48) return '> ' + w + ' ' + (Math.random() * 9).toFixed(3) + ' ' + (Math.random() * 9).toFixed(3);
    if (r < 0.64) return '> 0x' + (Math.random() * 0xffffff | 0).toString(16).toUpperCase().padStart(6, '0') + ' :: ' + w;
    if (r < 0.76) return '> ЧТЕНИЕ ПАМЯТИ ' + pad(rnd(), 4) + ' БАЙТ';
    if (r < 0.86) return '> ' + w + ' · НОРМА · Δ ' + (Math.random() * 2).toFixed(2);
    if (r < 0.94) return '> ПРОВЕРКА СЕКТОРА ' + pad(rnd(), 3) + ' ... OK';
    return '> ' + w + ' ERR ' + pad(rnd(), 3) + ' → СБРОС';
  }
  for (let i = 0; i < MAXL; i++) lines.push(newLine());

  let scan = 0, tmr = 0, acc = 0;
  function draw() {
    g.fillStyle = '#04140c'; g.fillRect(0, 0, 512, 288);
    // сетка
    g.strokeStyle = 'rgba(60,255,150,0.055)'; g.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 288); g.stroke(); }
    for (let y = 0; y < 288; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    // шапка
    g.fillStyle = '#8dffb8';
    g.font = 'bold 15px "Courier New",monospace';
    g.fillText('NEXUS-7 // БОРТОВОЙ ТЕРМИНАЛ', 10, 19);
    g.fillStyle = 'rgba(120,255,180,0.6)';
    g.font = '11px "Courier New",monospace';
    g.fillText('UPTIME ' + (performance.now() / 1000).toFixed(1) + 's   MEM ' +
      (Math.random() * 60 + 30 | 0) + '%   CPU ' + (Math.random() * 40 + 20 | 0) + '%', 10, 34);
    g.strokeStyle = 'rgba(120,255,180,0.35)';
    g.beginPath(); g.moveTo(8, 41); g.lineTo(504, 41); g.stroke();
    // строки лога
    g.font = '13px "Courier New",monospace';
    for (let i = 0; i < lines.length; i++) {
      const a = 0.32 + 0.68 * (i / (lines.length - 1));
      g.fillStyle = 'rgba(110,255,170,' + a.toFixed(2) + ')';
      g.fillText(lines[i], 10, 60 + i * 17);
    }
    // мигающий курсор
    if ((performance.now() / 400 | 0) % 2 === 0) {
      g.fillStyle = '#9dffc8';
      g.fillRect(10, 60 + lines.length * 17 - 11, 8, 12);
    }
    // бегущая полоса развёртки
    g.fillStyle = 'rgba(180,255,210,0.09)';
    g.fillRect(0, scan, 512, 18);
    scan = (scan + 4) % 288;
    tex.needsUpdate = true;
  }
  draw();
  return {
    tex,
    update(dt) {
      acc += dt;
      if (acc < 0.1) return;            // ~10 кадров/с — хватает и почти бесплатно
      acc = 0;
      tmr += 0.1;
      if (tmr > 0.5) { tmr = 0; lines.shift(); lines.push(newLine()); }
      draw();
    }
  };
}
const termScreen = makeTerminalScreen();

/* ============================================================
   4. ОСВЕЩЕНИЕ (тусклое, атмосферное)
   ============================================================ */
/* --- БЮДЖЕТ СВЕТА (v2.0): ТОЛЬКО 2 РЕАЛЬНЫХ ИСТОЧНИКА ---
   Каждый PointLight/SpotLight в Three.js считается для КАЖДОГО пикселя
   и роняет FPS на телефоне. Поэтому реальных источников ровно два:
     1) AmbientLight   — общий фон,
     2) DirectionalLight — главный свет с тенями.
   Всё остальное «свечение» — фейковое (fake lighting):
     • emissive-материалы (панели, лампы, мониторы, разметка),
     • выпеченные в текстуру световые пятна на полу (lightmap),
     • блум (UnrealBloomPass) для мягкого ореола.
   Ни одного нового источника света — GPU почти не нагружается. */

// заглушка: раньше здесь создавались PointLight. Теперь их нет вообще.
function addPointLight() { return null; }

// 1) общий фон (единственный AmbientLight)
scene.add(new THREE.AmbientLight(0x8fb4dd, QUALITY === 'high' ? 1.55 : 1.8));

// 2) главный свет + тени (единственный DirectionalLight)
const keyLight = new THREE.DirectionalLight(0xd6e8ff, 1.8);
keyLight.position.set(14, 26, 10);
keyLight.castShadow = SHADOWS;
keyLight.shadow.mapSize.set(SHADOWS ? 1024 : 512, SHADOWS ? 1024 : 512);
keyLight.shadow.camera.left = -26; keyLight.shadow.camera.right = 26;
keyLight.shadow.camera.top = 26;   keyLight.shadow.camera.bottom = -26;
keyLight.shadow.camera.far = 70;
keyLight.shadow.bias = -0.0009;
scene.add(keyLight);

/* ============================================================
   5. КОРПУС КОРАБЛЯ — интерьер отсека (не квадратная комната)
   Корпус вытянут по оси Z: узкий нос → широкий мидель → корма.
   ============================================================ */
const room = new THREE.Group();
scene.add(room);

const HULL_LEN = 48;
const HULL_Z0  = -HULL_LEN / 2;   // нос (там блистер-окно)
const HULL_Z1  =  HULL_LEN / 2;   // корма
const smooth01 = f => f * f * (3 - 2 * f);

// полуширина корпуса в сечении z
function hullHalf(z) {
  const t = (z - HULL_Z0) / HULL_LEN;
  const bow   = smooth01(Math.min(1, Math.max(0, t / 0.30)));
  const stern = smooth01(Math.min(1, Math.max(0, (1 - t) / 0.26)));
  return 5.0 + 6.2 * Math.min(bow, stern);      // 5.0 .. 11.2
}
// высота потолка в сечении z
function hullHeight(z) {
  const t = (z - HULL_Z0) / HULL_LEN;
  const bow   = smooth01(Math.min(1, Math.max(0, t / 0.30)));
  const stern = smooth01(Math.min(1, Math.max(0, (1 - t) / 0.26)));
  return 4.2 + 3.0 * Math.min(bow, stern);      // 4.2 .. 7.2
}

const floorTex = makeFloorTexture();
const wallTex  = makeWallTexture();
const starTex  = makeStarTexture();

/* --- 5.1 палуба (пол по форме корпуса) --- */
const floorMat = new THREE.MeshStandardMaterial({
  map: floorTex, color: 0xc2d4e8, roughness: 0.58, metalness: 0.42
});
function buildFloorGeometry() {
  const ZS = 56, pos = [], uv = [], idx = [];
  for (let i = 0; i <= ZS; i++) {
    const z = HULL_Z0 + (i / ZS) * HULL_LEN;
    const w = hullHalf(z) - 0.03;
    pos.push(-w, 0, z, w, 0, z);
    uv.push(0, (i / ZS) * 1.31, 0.6, (i / ZS) * 1.31);
  }
  for (let i = 0; i < ZS; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const floor = new THREE.Mesh(buildFloorGeometry(), floorMat);
floor.receiveShadow = true;
room.add(floor);

/* --- 5.1b ВЫПЕЧКА СВЕТА (lightmap) ---
   Светлые пятна нарисованы прямо в текстуру под потолочными панелями.
   Это картинка, а не расчёт физики: выглядит как падающий свет,
   но не стоит GPU ни одного лишнего источника. */
function makeLightPoolTexture() {
  const W = 256, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';

  // мягкая световая дорожка вдоль палубы
  const lane = g.createLinearGradient(0, 0, W, 0);
  lane.addColorStop(0.00, 'rgba(0,0,0,0)');
  lane.addColorStop(0.28, 'rgba(64,112,164,0.26)');
  lane.addColorStop(0.50, 'rgba(118,176,232,0.5)');
  lane.addColorStop(0.72, 'rgba(64,112,164,0.26)');
  lane.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = lane; g.fillRect(0, 0, W, H);

  // пятна строго под светильниками (те же z, что и у ламп на потолке)
  for (let lz = HULL_Z0 + 6; lz <= HULL_Z1 - 6; lz += 5.5) {
    const cy = (lz - HULL_Z0) / HULL_LEN * H;
    g.save();
    g.translate(W / 2, cy);
    g.scale(1, 1.85);
    const r = 76;
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
    rg.addColorStop(0.00, 'rgba(196,228,255,0.85)');
    rg.addColorStop(0.34, 'rgba(122,182,240,0.4)');
    rg.addColorStop(0.70, 'rgba(58,108,168,0.13)');
    rg.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
const poolMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(24, HULL_LEN),
  new THREE.MeshBasicMaterial({
    map: makeLightPoolTexture(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  })
);
poolMesh.rotation.x = -Math.PI / 2;
poolMesh.position.y = 0.045;
poolMesh.renderOrder = 2;
room.add(poolMesh);

/* --- 5.2 обшивка бортов и потолка (видна только изнутри) --- */
const hullMat = new THREE.MeshStandardMaterial({
  map: wallTex, color: 0xa8bed6, roughness: 0.62, metalness: 0.45,
  side: THREE.BackSide
});
// v2.1: обшивка оставлена ТОЛЬКО на дальней стороне (напротив камеры).
// Ближний борт и бок сняты — открытый вид «как в Diablo», обзор свободен.
// a = 0 → дальний борт у пола, a = PI/2 → потолок.
const SHELL_A = Math.PI * 0.58;
function buildShellGeometry() {
  const ZS = 56, AS = 18, pos = [], uv = [], idx = [];
  for (let i = 0; i <= ZS; i++) {
    const z = HULL_Z0 + (i / ZS) * HULL_LEN;
    const w = hullHalf(z), h = hullHeight(z);
    for (let j = 0; j <= AS; j++) {
      const a = (j / AS) * SHELL_A;
      pos.push(-w * Math.cos(a), h * Math.sin(a), z);
      uv.push((j / AS) * 0.8, (i / ZS) * 4.2);
    }
  }
  const row = AS + 1;
  for (let i = 0; i < ZS; i++) {
    for (let j = 0; j < AS; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const shell = new THREE.Mesh(buildShellGeometry(), hullMat);
shell.receiveShadow = true;
room.add(shell);

/* --- 5.3 шпангоуты (рёбра корпуса) --- */
const ribMat = new THREE.MeshStandardMaterial({
  color: 0x93a9c2, roughness: 0.36, metalness: 0.9,
  emissive: 0x1c3a58, emissiveIntensity: 0.5
});
// v2.1: арки — только ДАЛЬНЯЯ дуга. Передняя дуга убрана, чтобы не перекрывать
// вид на космонавта (открытый вид «как в Diablo»).
// Дуга печётся в геометрию (rotateZ), чтобы масштабирование по X/Y не косило её.
const RIB_A = Math.PI * 0.58;   // длина дуги (совпадает с обшивкой)
const RIB_R = Math.PI * 0.42;   // старт дуги: чуть правее потолка → дальний пол
const ribGeo  = new THREE.TorusGeometry(1, 0.075, 8, 24, RIB_A);  // толстые арки
ribGeo.rotateZ(RIB_R);
const ribGeo2 = new THREE.TorusGeometry(1, 0.042, 6, 22, RIB_A * 0.96);  // внутренний поясок
ribGeo2.rotateZ(RIB_R + 0.03);
const gapPanelMat = new THREE.MeshStandardMaterial({
  color: 0x2b3646, roughness: 0.74, metalness: 0.32,
  emissive: 0x0d1c2c, emissiveIntensity: 0.7
});
const ribZs = [];
for (let z = HULL_Z0 + 3.2; z <= HULL_Z1 - 3.2; z += 3.6) ribZs.push(z);

for (const z of ribZs) {
  const w = hullHalf(z), h = hullHeight(z);
  const rib = new THREE.Mesh(ribGeo, ribMat);
  rib.scale.set(w - 0.14, h - 0.14, 1);
  rib.position.set(0, 0, z);
  rib.castShadow = true;
  room.add(rib);
  // второй, тонкий внутренний поясок — обшивка выглядит «богаче»
  const rib2 = new THREE.Mesh(ribGeo2, ribMat);
  rib2.scale.set(w - 0.62, h - 0.62, 1);
  rib2.position.set(0, 0, z);
  room.add(rib2);
}
// тёмные панели в промежутках между арками — чтобы не было пустоты
for (let i = 0; i < ribZs.length - 1; i++) {
  const zc = (ribZs[i] + ribZs[i + 1]) / 2;
  const w = hullHalf(zc), h = hullHeight(zc);
  const ph = Math.max(1.6, h - 1.7);
  for (const s of [-1]) {   // v2.1: панели только на дальнем борту
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, ph, 2.7), gapPanelMat);
    p.position.set(s * (w - 0.42), ph / 2 + 0.28, zc);
    p.rotation.y = s * 0.05;
    p.receiveShadow = true;
    room.add(p);
  }
}

/* --- 5.4 продольные стрингеры по бортам --- */
const stringerMat = new THREE.MeshStandardMaterial({ color: 0x5e7089, roughness: 0.45, metalness: 0.85 });
for (const s of [-1]) {   // v2.1: стрингеры только на дальнем борту
  for (const yy of [1.7, 3.3]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = HULL_Z0 + 2 + (i / 24) * (HULL_LEN - 4);
      pts.push(new THREE.Vector3(s * (hullHalf(z) - 0.3), yy, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    room.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.085, 6, false), stringerMat));
  }
}

/* --- 5.5 центральная палуба: светящаяся разметка --- */
const ringMat = new THREE.MeshStandardMaterial({
  color: 0x2c6f9c, emissive: 0x4fb8ff, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.4
});
for (const s of [-1, 1]) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const z = HULL_Z0 + 3 + (i / 20) * (HULL_LEN - 6);
    pts.push(new THREE.Vector3(s * 2.6, 0.05, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  room.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.07, 5, false), ringMat));
}
for (let z = HULL_Z0 + 6; z <= HULL_Z1 - 6; z += 6) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.05, 0.14), ringMat);
  m.position.set(0, 0.05, z);
  room.add(m);
}

/* --- 5.6 носовой блистер: окно в космос --- */
function archShape(w, h, inset, bottom) {
  const s = new THREE.Shape();
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI;
    const x = -(w - inset) * Math.cos(a);
    const y = bottom + (h - inset - bottom) * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}
const BW = hullHalf(HULL_Z0 + 0.8), BH = hullHeight(HULL_Z0 + 0.8);
const capTex = makeWallTexture();
capTex.repeat.set(0.14, 0.14);
const capMat = new THREE.MeshStandardMaterial({
  map: capTex, color: 0x9db3cc, roughness: 0.55, metalness: 0.6
});
const capShape = archShape(BW, BH, 0, 0.02);
capShape.holes.push(archShape(BW, BH, 1.15, 0.75));
const bowCap = new THREE.Mesh(new THREE.ShapeGeometry(capShape, 20), capMat);
bowCap.position.z = HULL_Z0 + 0.8;
bowCap.receiveShadow = true;
room.add(bowCap);

// стекло — вид на звёзды
const glass = new THREE.Mesh(
  new THREE.ShapeGeometry(archShape(BW, BH, 1.15, 0.75), 20),
  new THREE.MeshBasicMaterial({ map: starTex, side: THREE.DoubleSide })
);
glass.position.z = HULL_Z0 + 0.5;
room.add(glass);

// переплёт окна
const mullMat = new THREE.MeshStandardMaterial({ color: 0x6d8098, roughness: 0.4, metalness: 0.9 });
const winH = BH - 1.9;
const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.2, winH, 0.22), mullMat);
mullV.position.set(0, 0.75 + winH / 2, HULL_Z0 + 0.75);
room.add(mullV);
const mullH = new THREE.Mesh(new THREE.BoxGeometry((BW - 1.15) * 1.8, 0.2, 0.22), mullMat);
mullH.position.set(0, 0.75 + winH * 0.55, HULL_Z0 + 0.75);
room.add(mullH);

// блик на стекле
const sheen = new THREE.Mesh(
  new THREE.PlaneGeometry((BW - 1.15) * 1.6, winH * 0.5),
  new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide })
);
sheen.position.set(0, 0.75 + winH * 0.62, HULL_Z0 + 0.95);
sheen.rotation.z = -0.22;
room.add(sheen);

/* --- 5.7 кормовая переборка с грузовым люком --- */
const SW = hullHalf(HULL_Z1 - 0.8), SH = hullHeight(HULL_Z1 - 0.8);
const sternCap = new THREE.Mesh(new THREE.ShapeGeometry(archShape(SW, SH, 0, 0.02), 20), capMat);
sternCap.position.z = HULL_Z1 - 0.8;
sternCap.rotation.y = Math.PI;
room.add(sternCap);

const hatch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 0.22),
  new THREE.MeshStandardMaterial({ color: 0x3d4b5e, roughness: 0.5, metalness: 0.75 }));
hatch.position.set(0, 1.5, HULL_Z1 - 1.0);
room.add(hatch);
const hatchGlow = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x2a6a9a, emissive: 0x5fd0ff, emissiveIntensity: 2.4 }));
hatchGlow.position.set(0, 2.6, HULL_Z1 - 1.12);
room.add(hatchGlow);

/* --- 5.8 потолочные светильники по оси корпуса --- */
const lampMat = new THREE.MeshStandardMaterial({
  color: 0x9fd8ff, emissive: 0x9fd8ff, emissiveIntensity: 2.8, roughness: 0.2
});
const lampHousMat = new THREE.MeshStandardMaterial({ color: 0x8ea6c0, roughness: 0.45, metalness: 0.75 });
for (let lz = HULL_Z0 + 6; lz <= HULL_Z1 - 6; lz += 5.5) {
  const h = hullHeight(lz);
  const hous = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 2.6), lampHousMat);
  hous.position.set(0, h - 0.28, lz);
  room.add(hous);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 2.3), lampMat);
  lamp.position.set(0, h - 0.42, lz);
  room.add(lamp);
}
// реальные источники — только 2 (экономия FPS на телефоне)
addPointLight(0xbfe2ff, 60, 40, 0, 5.4, -8);
addPointLight(0xbfe2ff, 60, 40, 0, 5.4, 8);

/* --- 5.9 бортовые панели и трубопроводы --- */
const sidePanelMat = new THREE.MeshStandardMaterial({ color: 0x46566b, roughness: 0.5, metalness: 0.7 });
const sideGlowMat  = new THREE.MeshStandardMaterial({
  color: 0x2a5f88, emissive: 0x5fc8ff, emissiveIntensity: 2.4, roughness: 0.3
});
for (const s of [-1, 1]) {
  for (let z = HULL_Z0 + 8; z <= HULL_Z1 - 8; z += 7) {
    const w = hullHalf(z);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 3.0), sidePanelMat);
    p.position.set(s * (w - 0.55), 1.0, z);
    p.rotation.y = s * 0.06;
    p.castShadow = true; p.receiveShadow = true;
    room.add(p);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.4), sideGlowMat);
    gl.position.set(s * (w - 0.82), 1.5, z);
    room.add(gl);
  }
}

const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6a7c92, roughness: 0.45, metalness: 0.8 });
for (const s of [-1, 1]) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const z = HULL_Z0 + 3 + (i / 20) * (HULL_LEN - 6);
    const w = hullHalf(z), h = hullHeight(z);
    pts.push(new THREE.Vector3(s * (w * 0.42), h - 0.55, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  room.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.16, 8, false), pipeMat));
}

/* ============================================================
   6. ОБЪЕКТЫ КОРАБЛЯ
   ============================================================ */
const MAT = {
  metal:   new THREE.MeshStandardMaterial({ color: 0x8fa2b8, roughness: 0.42, metalness: 0.85 }),
  dark:    new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.55, metalness: 0.6 }),
  panel:   new THREE.MeshStandardMaterial({ color: 0x4a5a70, roughness: 0.5, metalness: 0.7 }),
  screen:  new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35d0ff, emissiveIntensity: 1.9, roughness: 0.15, metalness: 0.2 }),
  screen2: new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xffa63a, emissiveIntensity: 1.1, roughness: 0.2 }),
  screen3: new THREE.MeshStandardMaterial({ color: 0x0a2a1a, emissive: 0x3aff9a, emissiveIntensity: 1.0, roughness: 0.2 }),
  crate:   new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.75, metalness: 0.25 }),
  crate2:  new THREE.MeshStandardMaterial({ color: 0x4a6a7a, roughness: 0.7, metalness: 0.35 }),
  glow:    new THREE.MeshStandardMaterial({ color: 0x2a6a9a, emissive: 0x5fd0ff, emissiveIntensity: 2.4, roughness: 0.25 })
};

const obstacles = []; // AABB для коллизий {x,z,hw,hd}

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function addObstacle(x, z, hw, hd) { obstacles.push({ x, z, hw, hd }); }

/* ---------- 6.1 КОМПЬЮТЕР (стол + монитор) ---------- */
function buildComputer(px, pz, ry) {
  const g = new THREE.Group();
  g.position.set(px, 0, pz); g.rotation.y = ry;

  // стол
  g.add(box(4.0, 0.16, 1.7, MAT.panel, 0, 1.02, 0));
  for (const sx of [-1.75, 1.75]) for (const sz of [-0.68, 0.68]) {
    g.add(box(0.16, 1.0, 0.16, MAT.metal, sx, 0.5, sz));
  }
  // тумба
  g.add(box(0.9, 1.0, 1.5, MAT.dark, 1.5, 0.5, 0));

  // стойка монитора
  g.add(cyl(0.1, 0.14, 0.5, MAT.metal, -0.5, 1.35, 0));
  g.add(box(0.9, 0.06, 0.5, MAT.metal, -0.5, 1.12, 0));

  // монитор
  const mon = box(2.3, 1.35, 0.12, MAT.dark, -0.5, 2.25, 0);
  g.add(mon);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.12),
    new THREE.MeshBasicMaterial({ map: termScreen.tex, toneMapped: false }));
  scr.position.set(-0.5, 2.25, 0.075);
  g.add(scr);
  // рамка-подсветка
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.26),
    new THREE.MeshBasicMaterial({ color: 0x35d0ff, transparent: true, opacity: 0.16 }));
  frame.position.set(-0.5, 2.25, 0.085);
  g.add(frame);

  // второй монитор (боком)
  const mon2 = box(1.5, 1.0, 0.1, MAT.dark, 1.45, 1.95, -0.35, -0.5);
  g.add(mon2);
  const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.82), MAT.screen3);
  scr2.position.set(1.45, 1.95, -0.35); scr2.rotation.y = -0.5;
  scr2.translateZ(0.06);
  g.add(scr2);

  // клавиатура + мышь
  g.add(box(1.5, 0.06, 0.5, MAT.dark, -0.5, 1.13, 0.55));
  g.add(box(0.24, 0.08, 0.36, MAT.dark, 0.6, 1.14, 0.55));

  // кресло
  const chair = new THREE.Group();
  chair.position.set(-0.5, 0, 1.5);
  chair.add(cyl(0.09, 0.09, 0.55, MAT.metal, 0, 0.28, 0, 12));
  chair.add(cyl(0.42, 0.42, 0.1, MAT.metal, 0, 0.05, 0, 16));
  chair.add(box(0.85, 0.14, 0.85, MAT.dark, 0, 0.6, 0));
  chair.add(box(0.85, 1.0, 0.14, MAT.dark, 0, 1.15, -0.36));
  g.add(chair);

  // свет от экрана
  addPointLight(0x40c8ff, 12, 9, -0.5, 2.2, 0.7, g);

  room.add(g);
  addObstacle(px, pz, 2.1, 1.0);
  return g;
}

/* ---------- 6.2 ВЕРСТАК (стол + ящики) ---------- */
function buildWorkbench(px, pz, ry) {
  const g = new THREE.Group();
  g.position.set(px, 0, pz); g.rotation.y = ry;

  // верстак
  g.add(box(4.2, 0.2, 1.8, MAT.metal, 0, 1.0, 0));
  for (const sx of [-1.9, 1.9]) for (const sz of [-0.75, 0.75]) {
    g.add(box(0.18, 1.0, 0.18, MAT.dark, sx, 0.5, sz));
  }
  // полка под столом
  g.add(box(3.6, 0.1, 1.4, MAT.dark, 0, 0.55, 0));

  // тиски
  g.add(box(0.5, 0.35, 0.5, MAT.dark, -1.5, 1.28, 0));
  g.add(cyl(0.08, 0.08, 0.6, MAT.metal, -1.5, 1.28, 0.35, 10));

  // ящики на столе
  g.add(box(0.8, 0.5, 0.7, MAT.crate, 0.6, 1.35, -0.2, 0.2));
  g.add(box(0.7, 0.4, 0.6, MAT.crate2, 1.5, 1.3, 0.1, -0.3));

  // стопка ящиков рядом
  const stack = new THREE.Group();
  stack.position.set(2.9, 0, 0.6);
  stack.add(box(1.3, 0.9, 1.3, MAT.crate, 0, 0.45, 0, 0.1));
  stack.add(box(1.1, 0.8, 1.1, MAT.crate2, 0.08, 1.3, -0.05, -0.2));
  stack.add(box(0.9, 0.7, 0.9, MAT.crate, -0.05, 2.05, 0.05, 0.35));
  g.add(stack);

  // инструментальная панель на стене
  const board = box(3.0, 1.6, 0.1, MAT.dark, 0, 3.4, -1.5);
  g.add(board);
  for (let i = 0; i < 7; i++) {
    const t = box(0.1, 0.7 + Math.random() * 0.4, 0.1, MAT.metal, -1.2 + i * 0.4, 3.4, -1.42);
    g.add(t);
  }

  // искры-подсветка
  addPointLight(0xffa63a, 14, 10, 0, 2.4, 0.6, g);

  // лампа над верстаком
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 1.8 }));
  lamp.position.set(0, 4.6, 0);
  g.add(lamp);

  room.add(g);
  addObstacle(px, pz, 2.2, 1.1);
  addObstacle(px + Math.cos(ry) * 2.9, pz - Math.sin(ry) * 2.9, 0.8, 0.8);
  return g;
}

/* ---------- 6.3 ШТУРВАЛ (колонна) ---------- */
function buildHelm(px, pz, ry) {
  const g = new THREE.Group();
  g.position.set(px, 0, pz); g.rotation.y = ry;

  // основание
  g.add(cyl(1.5, 1.75, 0.35, MAT.dark, 0, 0.17, 0, 28));
  g.add(cyl(1.35, 1.45, 0.25, MAT.metal, 0, 0.45, 0, 28));

  // колонна
  g.add(cyl(0.42, 0.55, 1.5, MAT.metal, 0, 1.3, 0, 20));
  g.add(cyl(0.62, 0.62, 0.18, MAT.panel, 0, 2.1, 0, 20));

  // консоль
  const console1 = box(2.6, 0.16, 1.3, MAT.panel, 0, 2.2, 0.55, 0);
  console1.rotation.x = -0.35;
  g.add(console1);

  // кнопки на консоли
  const btnColors = [0xff4a4a, 0x4aff8a, 0xffd24a, 0x4ac8ff];
  for (let i = 0; i < 12; i++) {
    const bm = new THREE.MeshStandardMaterial({
      color: 0x111820, emissive: btnColors[i % 4], emissiveIntensity: 1.6, roughness: 0.3
    });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), bm);
    b.position.set(-1.0 + (i % 6) * 0.4, 2.32 + (i > 5 ? 0.02 : 0), 0.28 + (i > 5 ? 0.42 : 0));
    b.rotation.x = -0.35;
    g.add(b);
  }

  // штурвал (тор)
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 12, 32), MAT.metal);
  wheel.position.set(0, 2.85, 0.15);
  wheel.rotation.x = -0.5;
  wheel.castShadow = true;
  g.add(wheel);
  // спицы
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.35, 0.09), MAT.metal);
    sp.position.set(0, 2.85, 0.15);
    sp.rotation.x = -0.5;
    sp.rotation.z = i * Math.PI / 3;
    g.add(sp);
  }
  // ступица
  g.add(cyl(0.16, 0.16, 0.22, MAT.dark, 0, 2.85, 0.15, 14));

  // голографический дисплей
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  holo.position.set(0, 4.0, 0.3);
  holo.rotation.x = -0.15;
  g.add(holo);
  const holoEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.5, wireframe: true }));
  holoEdge.position.copy(holo.position);
  holoEdge.rotation.x = -0.15;
  g.add(holoEdge);

  // свет
  addPointLight(0x4fd8ff, 16, 11, 0, 3.6, 0.6, g);

  room.add(g);
  addObstacle(px, pz, 1.7, 1.7);
  return g;
}

const ST_COMPUTER = buildComputer(-7.2, 7.0, 0.45);
const ST_BENCH    = buildWorkbench(7.2, 7.0, -0.45);
const ST_HELM     = buildHelm(0, -17.0, Math.PI);

/* ---------- 6.4 Мелкий декор ---------- */
// грузовые ящики вдоль левого борта у кормы
for (let i = 0; i < 5; i++) {
  const z = HULL_Z1 - 5.5 - i * 2.6;
  const w = hullHalf(z);
  const c = box(1.1, 0.9, 1.1, i % 2 ? MAT.crate : MAT.crate2,
    -w + 1.5, 0.45, z, Math.random() * 0.6);
  room.add(c);
  addObstacle(-w + 1.5, z, 0.6, 0.6);
}
// контейнеры у правого борта
for (let i = 0; i < 3; i++) {
  const z = HULL_Z1 - 7 - i * 3.0;
  const w = hullHalf(z);
  const c = box(1.0, 0.8, 1.0, i % 2 ? MAT.crate2 : MAT.crate,
    w - 1.5, 0.4, z, Math.random() * 0.6);
  room.add(c);
  addObstacle(w - 1.5, z, 0.55, 0.55);
}

/* ============================================================
   7. КОСМОНАВТ
   ============================================================ */
function buildAstronaut() {
  const g = new THREE.Group();

  const suit  = new THREE.MeshStandardMaterial({ color: 0xeef3fa, roughness: 0.55, metalness: 0.12 });
  const suit2 = new THREE.MeshStandardMaterial({ color: 0xc3cedd, roughness: 0.6, metalness: 0.2 });
  const grey  = new THREE.MeshStandardMaterial({ color: 0x8b98aa, roughness: 0.5, metalness: 0.55 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 0.45, metalness: 0.65 });
  const visor = new THREE.MeshStandardMaterial({
    color: 0x0a1e30, roughness: 0.06, metalness: 0.95,
    emissive: 0x1a4a6a, emissiveIntensity: 0.8
  });
  const led   = new THREE.MeshStandardMaterial({
    color: 0x0a2030, emissive: 0x4fd8ff, emissiveIntensity: 2.0, roughness: 0.3
  });

  // ноги
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.19, 0.72, 0);
  legR.position.set( 0.19, 0.72, 0);
  for (const [leg, sx] of [[legL, -1], [legR, 1]]) {
    const thigh = cyl(0.13, 0.12, 0.72, suit, 0, -0.36, 0, 12);
    leg.add(thigh);
    const shin = cyl(0.12, 0.11, 0.62, suit2, 0, -0.98, 0, 12);
    leg.add(shin);
    const boot = box(0.28, 0.18, 0.42, grey, 0, -1.34, 0.06);
    leg.add(boot);
    // коленный шарнир
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), grey);
    knee.position.set(0, -0.72, 0);
    leg.add(knee);
  }
  g.add(legL, legR);

  // корпус
  const torso = cyl(0.36, 0.32, 0.95, suit, 0, 1.22, 0, 18);
  g.add(torso);
  // грудная панель
  const chest = box(0.42, 0.34, 0.14, dark, 0, 1.34, 0.3);
  g.add(chest);
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), led);
    l.position.set(-0.12 + i * 0.12, 1.4, 0.38);
    g.add(l);
  }
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.03), led);
  l2.position.set(0, 1.24, 0.38);
  g.add(l2);

  // пояс
  const belt = cyl(0.34, 0.34, 0.14, grey, 0, 0.76, 0, 18);
  g.add(belt);

  // рюкзак (система жизнеобеспечения)
  const pack = box(0.56, 0.72, 0.3, suit2, 0, 1.3, -0.36);
  g.add(pack);
  const packTop = box(0.42, 0.12, 0.24, grey, 0, 1.7, -0.36);
  g.add(packTop);
  for (const sx of [-0.16, 0.16]) {
    const tank = cyl(0.09, 0.09, 0.5, grey, sx, 1.3, -0.55, 10);
    g.add(tank);
  }

  // руки
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.44, 1.6, 0);
  armR.position.set( 0.44, 1.6, 0);
  for (const [arm, sx] of [[armL, -1], [armR, 1]]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), grey);
    arm.add(shoulder);
    const upper = cyl(0.12, 0.11, 0.52, suit, 0, -0.3, 0, 12);
    arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), grey);
    elbow.position.set(0, -0.58, 0);
    arm.add(elbow);
    const fore = cyl(0.11, 0.1, 0.48, suit2, 0, -0.84, 0, 12);
    arm.add(fore);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), grey);
    glove.position.set(0, -1.12, 0);
    arm.add(glove);
  }
  g.add(armL, armR);

  // шея + шлем
  g.add(cyl(0.15, 0.15, 0.14, grey, 0, 1.76, 0, 12));
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), suit);
  helmet.position.set(0, 2.06, 0);
  helmet.castShadow = true;
  g.add(helmet);
  // визор
  const v = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 20, -0.85, 1.7, 0.75, 1.5), visor);
  v.position.set(0, 2.06, 0.02);
  g.add(v);
  // обод визора
  const vring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 28), grey);
  vring.position.set(0, 2.06, 0.16);
  g.add(vring);
  // антенна
  const ant = cyl(0.015, 0.015, 0.3, grey, 0.22, 2.4, -0.1, 6);
  g.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), led);
  antTip.position.set(0.22, 2.56, -0.1);
  g.add(antTip);
  // фонарь на шлеме
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 12), grey);
  lamp.position.set(0, 2.28, 0.26); lamp.rotation.x = Math.PI / 2.4;
  g.add(lamp);
  const lampGlow = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  lampGlow.position.set(0, 2.3, 0.32); lampGlow.rotation.x = -0.5;
  g.add(lampGlow);

  // фонарь на шлеме — ФЕЙКОВЫЙ свет: аддитивный конус вместо SpotLight
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0c8, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  beam.position.set(0, 2.3, 3.3);
  beam.rotation.x = -Math.PI / 2;
  g.add(beam);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // конус фонаря — только свечение, тени он отбрасывать не должен
  beam.castShadow = false; beam.receiveShadow = false;

  return { group: g, legL, legR, armL, armR, torso, helmet };
}

const astro = buildAstronaut();
astro.group.position.set(0, 0, -1);
scene.add(astro.group);

// подсветка космонавта — только эмиссия, без лишнего источника света (FPS)

/* ============================================================
   8. УПРАВЛЕНИЕ
   ============================================================ */
const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');
const MAXR = 52;
let stickId = null;
const stick = { x: 0, y: 0 };

function stickMove(e) {
  if (e.pointerId !== stickId || uiPaused) return;
  const r = stickBase.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > MAXR) { dx = dx / len * MAXR; dy = dy / len * MAXR; }
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  stick.x = dx / MAXR;
  stick.y = dy / MAXR;
}
function placeStick(x, y) {
  const w = stickBase.offsetWidth || 132, h = stickBase.offsetHeight || 132;
  stickBase.style.left   = (x - w / 2) + 'px';
  stickBase.style.top    = (y - h / 2) + 'px';
  stickBase.style.bottom = 'auto';
}
function resetStickPos() {
  stickBase.style.left = '';
  stickBase.style.top = '';
  stickBase.style.bottom = '';
}

stickBase.addEventListener('pointerdown', e => {
  e.preventDefault();
  stickId = e.pointerId;
  try { stickBase.setPointerCapture(e.pointerId); } catch (_) {}
  stickMove(e);
});
stickBase.addEventListener('pointermove', stickMove);
function stickEnd(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  stickKnob.style.transform = 'translate(0,0)';
  stick.x = 0; stick.y = 0;
  resetStickPos();
}
stickBase.addEventListener('pointerup', stickEnd);
stickBase.addEventListener('pointercancel', stickEnd);

// Плавающий джойстик: касание в левой половине экрана переносит базу под палец.
// Так на телефоне не нужно целиться в фиксированный кружок.
if (IS_TOUCH) {
  renderer.domElement.addEventListener('pointerdown', e => {
    if (uiPaused || stickId !== null) return;
    if (e.clientX > window.innerWidth * 0.55) return;
    placeStick(e.clientX, e.clientY);
    stickId = e.pointerId;
    try { stickBase.setPointerCapture(e.pointerId); } catch (_) {}
    stickMove(e);
  });
}

// Полноэкранный режим — на телефоне скрывает адресную строку и ускоряет рендер
const fsBtn = document.getElementById('fsBtn');
if (fsBtn) {
  const canFs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (!canFs) fsBtn.style.display = 'none';
  fsBtn.addEventListener('click', () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  });
}

// клавиатура
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); interact(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });

// кнопка взаимодействия
const actBtn = document.getElementById('actBtn');
actBtn.addEventListener('pointerdown', e => { e.preventDefault(); interact(); });

/* ============================================================
   9. СТАНЦИИ / ВЗАИМОДЕЙСТВИЕ
   ============================================================ */
const stations = [
  { name: 'КОМПЬЮТЕР',  desc: 'Статы · карта 15 уровней · выбор уровня · СТАРТ', pos: new THREE.Vector3(-7.2, 0, 8.6),  r: 4.4 },
  { name: 'ВЕРСТАК',    desc: 'Улучшения: корпус · щиты · оружие · двигатели',   pos: new THREE.Vector3(7.2, 0, 8.6),   r: 4.4 },
  { name: 'ШТУРВАЛ',    desc: 'Переход в полёт',                                 pos: new THREE.Vector3(0, 0, -14.6),   r: 4.4 }
];
let nearStation = null;

const promptEl = document.getElementById('prompt');
const toastEl  = document.getElementById('toast');
let toastTimer = null;

function showToast(html, ms = 2600) {
  toastEl.innerHTML = html;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

function interact() {
  if (uiPaused || !nearStation) return;
  if (nearStation.name === 'КОМПЬЮТЕР')      openUI('computer');
  else if (nearStation.name === 'ВЕРСТАК')   openUI('bench');
  else                                       openUI('helm');
}

/* ============================================================
   9.1 ИНТЕРФЕЙСЫ (ЭТАП 2)
   ============================================================ */
const modalEl    = document.getElementById('modal');
const winTitleEl = document.getElementById('winTitle');
const winBodyEl  = document.getElementById('winBody');
const creditsEl  = document.getElementById('credits');

const GAME = {
  credits: 500,
  totalLevels: 15,
  unlocked: 1,
  selected: 1,
  up: { hull: 1, shield: 1, weapon: 1, engine: 1 }
};
const UPGRADES = [
  { key: 'hull',   ic: '🛡', nm: 'КОРПУС',    ds: 'Прочность корпуса и живучесть' },
  { key: 'shield', ic: '🔵', nm: 'ЩИТЫ',      ds: 'Ёмкость энергетического щита' },
  { key: 'weapon', ic: '🔫', nm: 'ОРУЖИЕ',    ds: 'Урон и скорострельность' },
  { key: 'engine', ic: '🚀', nm: 'ДВИГАТЕЛИ', ds: 'Скорость и манёвренность' }
];
const MAX_LV = 5;
const costOf = (k) => 100 * GAME.up[k];

let uiPaused = false;
let uiKind   = null;
let uiTab    = 'state';

function setCredits() {
  creditsEl.innerHTML = '💰 <b>' + GAME.credits + '</b> КРЕДИТОВ';
}

function openUI(kind) {
  uiKind = kind;
  uiPaused = true;
  if (kind === 'computer') {
    uiTab = 'state';
    winTitleEl.innerHTML = 'БОРТОВОЙ КОМПЬЮТЕР<small>ТЕРМИНАЛ · NEXUS-7</small>';
  } else if (kind === 'bench') {
    winTitleEl.innerHTML = 'ВЕРСТАК<small>МОДУЛЬ УЛУЧШЕНИЙ</small>';
  } else {
    winTitleEl.innerHTML = 'ШТУРВАЛ<small>НАВИГАЦИЯ И ПОЛЁТ</small>';
  }
  renderUI();
  // CRT-корпус только у компьютера; верстак/штурвал — терминальная перекраска
  modalEl.classList.toggle('crt', kind === 'computer');
  modalEl.classList.toggle('term', kind !== 'computer');
  modalEl.classList.add('on');
  // сброс джойстика, чтобы космонавт не «уехал» после закрытия
  stickId = null;
  stick.x = 0; stick.y = 0;
  stickKnob.style.transform = 'translate(0,0)';
}

function closeUI() {
  modalEl.classList.remove('on');
  uiPaused = false;
  uiKind = null;
}

function renderUI() {
  if (uiKind === 'computer')     renderComputer();
  else if (uiKind === 'bench')   renderBench();
  else                           renderHelm();
}

/* ---------- Компьютер ---------- */
function renderComputer() {
  const tabs = [['state', 'СОСТОЯНИЕ'], ['map', 'КАРТА'], ['fly', 'ПОЛЁТ']];
  let h = '<div class="tabs">';
  for (const [k, n] of tabs) h += `<button class="tab${uiTab === k ? ' act' : ''}" data-tab="${k}">${n}</button>`;
  h += '</div>';
  if (uiTab === 'state')      h += paneState();
  else if (uiTab === 'map')   h += paneMap();
  else                        h += paneFly();
  winBodyEl.innerHTML = h;

  winBodyEl.querySelectorAll('.tab').forEach(b => {
    b.onclick = () => { uiTab = b.dataset.tab; renderUI(); };
  });
  if (uiTab === 'map') {
    winBodyEl.querySelectorAll('.node.open').forEach(n => {
      n.onclick = () => { GAME.selected = +n.dataset.lv; renderUI(); };
    });
  }
  if (uiTab === 'fly') {
    winBodyEl.querySelector('#startBtn').onclick = () => {
      alert(`Запуск уровня ${GAME.selected}... Скоро здесь будет космос!`);
    };
  }
}

function paneState() {
  const rows = [
    ['🛡', 'КОРПУС',    GAME.up.hull,   'Прочность'],
    ['🔵', 'ЩИТЫ',      GAME.up.shield, 'Энергощит'],
    ['🔫', 'ОРУЖИЕ',    GAME.up.weapon, 'Урон'],
    ['🚀', 'ДВИГАТЕЛИ', GAME.up.engine, 'Тяга']
  ];
  let h = '';
  for (const [ic, nm, lv, sub] of rows) {
    h += `<div class="stat"><div class="ic">${ic}</div><div style="flex:1">
      <div class="nm">${nm} <span style="color:#5f7f99">· ${sub}</span></div>
      <div class="meter"><i style="width:${lv / MAX_LV * 100}%"></i></div>
    </div><div class="vl">УР. ${lv}</div></div>`;
  }
  h += `<div class="note">Кредиты: <b style="color:#ffd98a">${GAME.credits}</b> · Улучшения — на Верстаке<br>
    Открыто уровней: ${GAME.unlocked} из ${GAME.totalLevels}</div>`;
  return `<div class="pane">${h}</div>`;
}

function paneMap() {
  let h = '<div class="pane"><div class="mapWrap">';
  for (let i = 1; i <= GAME.totalLevels; i++) {
    const open = i <= GAME.unlocked;
    const boss = i % 5 === 0;
    const sel  = i === GAME.selected;
    h += `<div class="node ${open ? 'open' : 'lock'}${sel ? ' sel' : ''}${boss ? ' boss' : ''}" data-lv="${i}">
      <div class="n">${i}</div><div class="lk">${open ? (boss ? 'БОСС' : '◆') : '🔒'}</div></div>`;
  }
  h += '</div>';
  h += `<div class="note">Выбран уровень: <b style="color:#8fe4ff">${GAME.selected}</b> · открыт только 1-й<br>
    Остальные откроются по мере прохождения</div></div>`;
  return h;
}

function paneFly() {
  return `<div class="pane">
    <div class="stat"><div class="ic">🎯</div><div style="flex:1"><div class="nm">ЦЕЛЬ ПОЛЁТА</div></div>
      <div class="vl">УРОВЕНЬ ${GAME.selected}</div></div>
    <div class="stat"><div class="ic">💰</div><div style="flex:1"><div class="nm">КРЕДИТЫ НА БОРТУ</div></div>
      <div class="vl">${GAME.credits}</div></div>
    <div class="stat"><div class="ic">🛠</div><div style="flex:1"><div class="nm">ГОТОВНОСТЬ КОРАБЛЯ</div></div>
      <div class="vl">100%</div></div>
    <button class="btn big" id="startBtn" style="margin-top:14px">НАЧАТЬ ИГРУ</button>
    <div class="note">Уровень можно выбрать на вкладке «КАРТА»</div>
  </div>`;
}

/* ---------- Верстак ---------- */
function renderBench() {
  let h = '<div class="pane">';
  for (const u of UPGRADES) {
    const lv   = GAME.up[u.key];
    const max  = lv >= MAX_LV;
    const cost = costOf(u.key);
    h += `<div class="up">
      <div class="ic">${u.ic}</div>
      <div class="info">
        <div class="nm">${u.nm}</div>
        <div class="ds">${u.ds}</div>
        <div class="lv">УРОВЕНЬ ${lv} → ${max ? 'МАКС' : lv + 1}</div>
      </div>
      <button class="btn gold" data-up="${u.key}" ${max ? 'disabled' : ''}>
        ${max ? 'МАКС' : 'УЛУЧШИТЬ · ' + cost + '💰'}</button>
    </div>`;
  }
  h += `<div class="note">Кредиты: <b style="color:#ffd98a">${GAME.credits}</b> · Максимальный уровень: ${MAX_LV}</div></div>`;
  winBodyEl.innerHTML = h;
  winBodyEl.querySelectorAll('[data-up]').forEach(b => { b.onclick = () => buy(b.dataset.up); });
}

function buy(key) {
  if (GAME.up[key] >= MAX_LV) return;
  const cost = costOf(key);
  if (GAME.credits < cost) {
    showToast(`<b>НЕДОСТАТОЧНО КРЕДИТОВ</b><small>Нужно ${cost} 💰</small>`);
    return;
  }
  GAME.credits -= cost;
  GAME.up[key]++;
  setCredits();
  const nm = (UPGRADES.find(u => u.key === key) || {}).nm || key;
  showToast(`<b>УЛУЧШЕНИЕ УСТАНОВЛЕНО</b><small>${nm} → уровень ${GAME.up[key]}</small>`);
  renderUI();
}

/* ---------- Штурвал ---------- */
function renderHelm() {
  winBodyEl.innerHTML = `<div class="pane">
    <div class="stat"><div class="ic">🧭</div><div style="flex:1"><div class="nm">КУРС</div></div>
      <div class="vl">УРОВЕНЬ ${GAME.selected}</div></div>
    <button class="btn big" id="flyBtn" style="margin-top:14px">НАЧАТЬ ПОЛЁТ</button>
    <div class="note">Штурвал запускает полёт на выбранный уровень</div>
  </div>`;
  winBodyEl.querySelector('#flyBtn').onclick = () => {
    alert(`Запуск уровня ${GAME.selected}... Скоро здесь будет космос!`);
  };
}

/* ---------- Слушатели окна ---------- */
document.getElementById('winClose').onclick = closeUI;
modalEl.addEventListener('pointerdown', e => { if (e.target === modalEl) closeUI(); });
addEventListener('keydown', e => { if (e.code === 'Escape' && uiPaused) closeUI(); });

setCredits();

/* ============================================================
   10. КОЛЛИЗИИ
   ============================================================ */
function resolveCollisions(p) {
  // борта корпуса — ширина зависит от сечения по длине корабля
  const w = hullHalf(p.z) - 1.3;
  p.x = Math.max(-w, Math.min(w, p.x));
  p.z = Math.max(HULL_Z0 + 1.8, Math.min(HULL_Z1 - 1.8, p.z));

  // AABB
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const ox = o.hw + PLAYER_R - Math.abs(dx);
    const oz = o.hd + PLAYER_R - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else         p.z += Math.sign(dz || 1) * oz;
    }
  }
}

/* ============================================================
   11. ЦИКЛ
   ============================================================ */
const clock = new THREE.Clock();
let walkPhase = 0;
let fpsAcc = 0, fpsFrames = 0, lowFps = 0;
const fpsEl = document.getElementById('fps');
const hintEl = document.getElementById('hint');
const locEl = document.getElementById('loc');

setTimeout(() => hintEl.classList.add('gone'), 6500);

// базис движения (изометрия, камера смотрит с +X+Z)
const FWD   = new THREE.Vector3(-0.7071, 0, -0.7071);
const RIGHT = new THREE.Vector3( 0.7071, 0, -0.7071);
const moveDir = new THREE.Vector3();
const desiredCam = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  /* --- ввод --- */
  let ix = stick.x, iy = stick.y;
  if (keys['KeyA'] || keys['ArrowLeft'])  ix -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  if (keys['KeyW'] || keys['ArrowUp'])    iy -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  iy += 1;

  if (uiPaused) { ix = 0; iy = 0; }

  const mag = Math.hypot(ix, iy);
  if (mag > 1) { ix /= mag; iy /= mag; }

  moveDir.set(0, 0, 0);
  if (mag > 0.08) {
    moveDir.addScaledVector(FWD, -iy);
    moveDir.addScaledVector(RIGHT, ix);
    if (moveDir.lengthSq() > 0) moveDir.normalize();
  }

  /* --- движение --- */
  const p = astro.group.position;
  const speed = MOVE_SPEED * Math.min(1, mag);
  if (moveDir.lengthSq() > 0) {
    p.addScaledVector(moveDir, speed * dt);
    resolveCollisions(p);

    // поворот к направлению (модель смотрит в +Z)
    const targetY = Math.atan2(moveDir.x, moveDir.z);
    let diff = targetY - astro.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    astro.group.rotation.y += diff * Math.min(1, dt * 12);

    walkPhase += dt * speed * 2.1;
  } else {
    walkPhase += dt * 1.2;
  }

  /* --- анимация ходьбы --- */
  const moving = moveDir.lengthSq() > 0;
  const sw = moving ? Math.sin(walkPhase) * 0.55 : Math.sin(walkPhase) * 0.05;
  astro.legL.rotation.x =  sw;
  astro.legR.rotation.x = -sw;
  astro.armL.rotation.x = -sw * 0.75;
  astro.armR.rotation.x =  sw * 0.75;
  astro.armL.rotation.z =  0.12;
  astro.armR.rotation.z = -0.12;
  // покачивание корпуса
  astro.group.position.y = moving ? Math.abs(Math.sin(walkPhase)) * 0.045 : 0;
  astro.torso.rotation.z = moving ? Math.sin(walkPhase) * 0.03 : 0;

  /* --- камера (изометрия, плавно) --- */
  desiredCam.copy(p).add(CAM_OFFSET);
  camera.position.lerp(desiredCam, 1 - Math.exp(-5.5 * dt));
  lookTarget.set(p.x, p.y + 1.1, p.z);
  camLook.lerp(lookTarget, 1 - Math.exp(-7 * dt));
  camera.lookAt(camLook);

  /* --- станции --- */
  let found = null;
  for (const s of stations) {
    const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
    if (d < s.r) { found = s; break; }
  }
  if (found !== nearStation) {
    nearStation = found;
    if (nearStation) {
      promptEl.innerHTML = `<b>${nearStation.name}</b> — нажми <b>E</b> / кнопку`;
      promptEl.classList.add('on');
      actBtn.classList.add('on');
      locEl.textContent = 'ОТСЕК: ' + nearStation.name;
    } else {
      promptEl.classList.remove('on');
      actBtn.classList.remove('on');
      locEl.textContent = 'ОТСЕК: ЖИЛОЙ МОДУЛЬ';
    }
  }

  /* --- пульсация --- */
  const t = clock.elapsedTime;
  ringMat.emissiveIntensity = 0.7 + Math.sin(t * 1.6) * 0.3;
  MAT.screen.emissiveIntensity = 1.7 + Math.sin(t * 3.1) * 0.3;
  MAT.screen3.emissiveIntensity = 0.85 + Math.sin(t * 2.3 + 1) * 0.2;
  termScreen.update(dt);

  /* --- FPS + авто-деградация --- */
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 0.5) {
    const fps = Math.round(fpsFrames / fpsAcc);
    fpsEl.textContent = fps + ' FPS';
    fpsAcc = 0; fpsFrames = 0;
    // если блум роняет FPS — гасим его, чтобы игра осталась плавной
    if (composer && fps < 42) {
      if (++lowFps >= 3) {
        composer = null; bloomPass = null; BLOOM_ON = false;
        showToast('<b>РЕЖИМ ЭКОНОМИИ</b><small>Свечение отключено для стабильного FPS</small>', 3000);
      }
    } else lowFps = 0;
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

/* ============================================================
   12. RESIZE + СТАРТ
   ============================================================ */
function onResize() {
  fitCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 260));

// Свернули браузер — сбрасываем ввод и время, чтобы при возврате не было рывка
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stickId = null;
    stick.x = 0; stick.y = 0;
    stickKnob.style.transform = 'translate(0,0)';
    resetStickPos();
    clock.getDelta();
  }
});

document.getElementById('ver').textContent = 'NEXUS SPACE ' + VERSION;

animate();

setTimeout(() => {
  const l = document.getElementById('load');
  l.classList.add('gone');
  setTimeout(() => l.remove(), 700);
  showToast('<b>ДОБРО ПОЖАЛОВАТЬ НА БОРТ</b><small>Подойди к Компьютеру, Верстаку или Штурвалу</small>', 3400);
}, 900);
