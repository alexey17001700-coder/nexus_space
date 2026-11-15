/* ============================================================
   NEXUS SPACE — ЭТАП 1: КОРАБЛЬ И КОСМОНАВТ
   Изометрический 3D-экшен на Three.js
   ============================================================ */
import * as THREE from 'three';

const VERSION   = 'v1.2 · build 3';
const ROOM_HALF = 19;      // половина стороны комнаты
const PLAYER_R  = 0.62;    // радиус космонавта
const MOVE_SPEED = 6.4;

/* ============================================================
   1. РЕНДЕР
   ============================================================ */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

/* ============================================================
   2. СЦЕНА И КАМЕРА (изометрия)
   ============================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x0b1220, 0.008);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 400);
const CAM_OFFSET = new THREE.Vector3(12.5, 14.5, 12.5);
const camLook = new THREE.Vector3(0, 1.1, 0);
camera.position.copy(CAM_OFFSET);
camera.lookAt(camLook);

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

/* ============================================================
   4. ОСВЕЩЕНИЕ (тусклое, атмосферное)
   ============================================================ */
scene.add(new THREE.AmbientLight(0x6a8cb8, 0.85));
scene.add(new THREE.HemisphereLight(0x9fd0ff, 0x18202e, 1.15));

const keyLight = new THREE.DirectionalLight(0xcfe4ff, 1.35);
keyLight.position.set(14, 26, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -26; keyLight.shadow.camera.right = 26;
keyLight.shadow.camera.top = 26;   keyLight.shadow.camera.bottom = -26;
keyLight.shadow.camera.far = 70;
keyLight.shadow.bias = -0.0009;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x3f7fd0, 0.5);
rimLight.position.set(-14, 12, -12);
scene.add(rimLight);

/* ============================================================
   5. КОМНАТА КОРАБЛЯ
   ============================================================ */
const room = new THREE.Group();
scene.add(room);

const floorTex = makeFloorTexture();
const wallTex  = makeWallTexture();

const floorMat = new THREE.MeshStandardMaterial({
  map: floorTex, color: 0x9fb4cc, roughness: 0.62, metalness: 0.55
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
room.add(floor);

// центральная разметка
const ringMat = new THREE.MeshStandardMaterial({
  color: 0x2c6f9c, emissive: 0x1d5f8c, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.3
});
const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.62, 64), ringMat);
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
room.add(ring);

const ring2 = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.72, 64), ringMat.clone());
ring2.material.emissiveIntensity = 0.5;
ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.012;
room.add(ring2);

// стены
const wallMat = new THREE.MeshStandardMaterial({
  map: wallTex, color: 0x8ea6c0, roughness: 0.72, metalness: 0.42, side: THREE.DoubleSide
});
const WALL_H = 7.2;
function addWall(w, x, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat);
  m.position.set(x, WALL_H / 2, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  room.add(m);
  return m;
}
addWall(ROOM_HALF * 2, 0, -ROOM_HALF, 0);
addWall(ROOM_HALF * 2, 0,  ROOM_HALF, Math.PI);
addWall(ROOM_HALF * 2, -ROOM_HALF, 0, Math.PI / 2);
addWall(ROOM_HALF * 2,  ROOM_HALF, 0, -Math.PI / 2);

// светящиеся полосы по стенам (атмосфера)
const stripMat = new THREE.MeshStandardMaterial({
  color: 0x2a5f88, emissive: 0x4fb8ff, emissiveIntensity: 1.5, roughness: 0.3
});
function addStrip(x, z, ry, len) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.14), stripMat);
  s.position.set(x, 5.6, z); s.rotation.y = ry;
  room.add(s);
}
addStrip(0, -ROOM_HALF + 0.12, 0, ROOM_HALF * 1.9);
addStrip(0,  ROOM_HALF - 0.12, 0, ROOM_HALF * 1.9);
addStrip(-ROOM_HALF + 0.12, 0, Math.PI / 2, ROOM_HALF * 1.9);
addStrip( ROOM_HALF - 0.12, 0, Math.PI / 2, ROOM_HALF * 1.9);

// угловые колонны-стойки
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5c6f85, roughness: 0.5, metalness: 0.75 });
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, WALL_H, 1.1), pillarMat);
    p.position.set(sx * (ROOM_HALF - 0.6), WALL_H / 2, sz * (ROOM_HALF - 0.6));
    p.castShadow = true; p.receiveShadow = true;
    room.add(p);
  }
}

// потолочные лампы (источники света)
const lampMat = new THREE.MeshStandardMaterial({
  color: 0x9fd8ff, emissive: 0x9fd8ff, emissiveIntensity: 2.2, roughness: 0.2
});
const lampPos = [];
for (let ix = -1; ix <= 1; ix++) {
  for (let iz = -1; iz <= 1; iz++) lampPos.push([ix * 11, iz * 11]);
}
for (const [lx, lz] of lampPos) {
  // корпус светильника
  const hous = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x8ea6c0, roughness: 0.45, metalness: 0.75 }));
  hous.position.set(lx, 6.62, lz);
  room.add(hous);
  // светящаяся панель
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 0.72), lampMat);
  lamp.position.set(lx, 6.48, lz);
  room.add(lamp);
  // сам источник
  const pl = new THREE.PointLight(0xbfe2ff, 42, 30, 2);
  pl.position.set(lx, 6.1, lz);
  room.add(pl);
}

// настенные бра (по 2 на стену)
const sconceMat = new THREE.MeshStandardMaterial({
  color: 0x9fd8ff, emissive: 0xbfe8ff, emissiveIntensity: 2.0, roughness: 0.25
});
const sconcePos = [];
for (const d of [-6.5, 6.5]) {
  sconcePos.push([d, -ROOM_HALF + 0.25, 0]);
  sconcePos.push([d,  ROOM_HALF - 0.25, Math.PI]);
  sconcePos.push([-ROOM_HALF + 0.25, d, Math.PI / 2]);
  sconcePos.push([ ROOM_HALF - 0.25, d, -Math.PI / 2]);
}
for (const [sx, sz, ry] of sconcePos) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.22), sconceMat);
  s.position.set(sx, 4.3, sz); s.rotation.y = ry;
  room.add(s);
  const sl = new THREE.PointLight(0xbfe8ff, 16, 15, 2);
  sl.position.set(sx * 0.94, 4.1, sz * 0.94);
  room.add(sl);
}

// светящиеся полосы по полу (по периметру)
const floorStripMat = new THREE.MeshStandardMaterial({
  color: 0x2a5f88, emissive: 0x5fc8ff, emissiveIntensity: 1.6, roughness: 0.3
});
for (const s of [-1, 1]) {
  const a = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 1.8, 0.06, 0.3), floorStripMat);
  a.position.set(0, 0.03, s * (ROOM_HALF - 1.2));
  room.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, ROOM_HALF * 1.8), floorStripMat);
  b.position.set(s * (ROOM_HALF - 1.2), 0.03, 0);
  room.add(b);
}

/* ============================================================
   6. ОБЪЕКТЫ КОРАБЛЯ
   ============================================================ */
const MAT = {
  metal:   new THREE.MeshStandardMaterial({ color: 0x8fa2b8, roughness: 0.42, metalness: 0.85 }),
  dark:    new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.55, metalness: 0.6 }),
  panel:   new THREE.MeshStandardMaterial({ color: 0x4a5a70, roughness: 0.5, metalness: 0.7 }),
  screen:  new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35d0ff, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.2 }),
  screen2: new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xffa63a, emissiveIntensity: 1.1, roughness: 0.2 }),
  screen3: new THREE.MeshStandardMaterial({ color: 0x0a2a1a, emissive: 0x3aff9a, emissiveIntensity: 1.0, roughness: 0.2 }),
  crate:   new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.75, metalness: 0.25 }),
  crate2:  new THREE.MeshStandardMaterial({ color: 0x4a6a7a, roughness: 0.7, metalness: 0.35 }),
  glow:    new THREE.MeshStandardMaterial({ color: 0x2a6a9a, emissive: 0x5fd0ff, emissiveIntensity: 1.6, roughness: 0.25 })
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
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.12), MAT.screen);
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
  const gl = new THREE.PointLight(0x40c8ff, 12, 9, 2);
  gl.position.set(-0.5, 2.2, 0.7);
  g.add(gl);

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
  const wl = new THREE.PointLight(0xffa63a, 14, 10, 2);
  wl.position.set(0, 2.4, 0.6);
  g.add(wl);

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
  const hl = new THREE.PointLight(0x4fd8ff, 16, 11, 2);
  hl.position.set(0, 3.6, 0.6);
  g.add(hl);

  room.add(g);
  addObstacle(px, pz, 1.7, 1.7);
  return g;
}

const ST_COMPUTER = buildComputer(-9.5, -9.5, 0.35);
const ST_BENCH    = buildWorkbench(9.5, -9.5, -0.35);
const ST_HELM     = buildHelm(0, 11.5, Math.PI);

/* ---------- 6.4 Мелкий декор ---------- */
// трубы по потолку
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6a7c92, roughness: 0.45, metalness: 0.8 });
for (let i = -1; i <= 1; i++) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, ROOM_HALF * 2 - 2, 12), pipeMat);
  p.rotation.z = Math.PI / 2;
  p.position.set(0, 6.9, i * 6);
  room.add(p);
}
// ящики у стены
for (let i = 0; i < 5; i++) {
  const c = box(1.1, 0.9, 1.1, i % 2 ? MAT.crate : MAT.crate2,
    -ROOM_HALF + 1.6, 0.45, -2 + i * 2.4, Math.random() * 0.6);
  room.add(c);
  addObstacle(-ROOM_HALF + 1.6, -2 + i * 2.4, 0.6, 0.6);
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

  const spot = new THREE.SpotLight(0xfff0c8, 6, 12, 0.5, 0.6, 1.5);
  spot.position.set(0, 2.3, 0.3);
  spot.target.position.set(0, 0, 6);
  g.add(spot, spot.target);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { group: g, legL, legR, armL, armR, torso, helmet };
}

const astro = buildAstronaut();
astro.group.position.set(0, 0, -1);
scene.add(astro.group);

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
stickBase.addEventListener('pointerdown', e => {
  stickId = e.pointerId;
  stickBase.setPointerCapture(e.pointerId);
  stickMove(e);
});
stickBase.addEventListener('pointermove', stickMove);
function stickEnd(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  stickKnob.style.transform = 'translate(0,0)';
  stick.x = 0; stick.y = 0;
}
stickBase.addEventListener('pointerup', stickEnd);
stickBase.addEventListener('pointercancel', stickEnd);

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
  { name: 'КОМПЬЮТЕР',  desc: 'Статы · карта 15 уровней · выбор уровня · СТАРТ', pos: new THREE.Vector3(-9.5, 0, -8.2), r: 4.2 },
  { name: 'ВЕРСТАК',    desc: 'Улучшения: корпус · щиты · оружие · двигатели',   pos: new THREE.Vector3(9.5, 0, -8.2),  r: 4.2 },
  { name: 'ШТУРВАЛ',    desc: 'Переход в полёт',                                 pos: new THREE.Vector3(0, 0, 9.6),     r: 4.0 }
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
  // границы комнаты
  const lim = ROOM_HALF - 0.9;
  p.x = Math.max(-lim, Math.min(lim, p.x));
  p.z = Math.max(-lim, Math.min(lim, p.z));

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
let fpsAcc = 0, fpsFrames = 0;
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
  MAT.screen.emissiveIntensity = 1.2 + Math.sin(t * 3.1) * 0.25;
  MAT.screen3.emissiveIntensity = 0.85 + Math.sin(t * 2.3 + 1) * 0.2;

  /* --- FPS --- */
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 0.5) {
    fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + ' FPS';
    fpsAcc = 0; fpsFrames = 0;
  }

  renderer.render(scene, camera);
}

/* ============================================================
   12. RESIZE + СТАРТ
   ============================================================ */
addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('ver').textContent = 'NEXUS SPACE ' + VERSION;

animate();

setTimeout(() => {
  const l = document.getElementById('load');
  l.classList.add('gone');
  setTimeout(() => l.remove(), 700);
  showToast('<b>ДОБРО ПОЖАЛОВАТЬ НА БОРТ</b><small>Подойди к Компьютеру, Верстаку или Штурвалу</small>', 3400);
}, 900);
