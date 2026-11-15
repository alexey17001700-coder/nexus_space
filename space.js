/* ============================================================
   NEXUS SPACE — ЭТАП 3: МОДУЛЬ КОСМОСА (отдельный файл)
   Полёт, стрельба, враги, астероиды, HUD.
   Всё на InstancedMesh + пулах объектов — чтобы держать FPS
   на телефоне. Реальных источников света — 3 (ambient + 2 dir),
   блума здесь нет вообще.
   ============================================================ */
import * as THREE from 'three';

export function createSpace(opts) {
  const renderer = opts.renderer;
  const LOW  = opts.quality === 'low';
  const MID  = opts.quality === 'mid';
  const onHud = opts.onHud || function () {};
  const onEnd = opts.onEnd || function () {};
  /* ЭТАП 4: звук (Web Audio) и голос компьютера (Web Speech) */
  const audio  = opts.audio  || null;
  const speech = opts.speech || null;

  /* ---------- сцена и камера ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060e);
  scene.fog = new THREE.FogExp2(0x03060e, 0.0028);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, 3.8, 13);

  /* ---------- свет: ровно 3 источника ---------- */
  scene.add(new THREE.AmbientLight(0x9fc4ff, 1.5));
  const keyL = new THREE.DirectionalLight(0xdcecff, 2.1);
  keyL.position.set(7, 12, 9);   scene.add(keyL);
  const rimL = new THREE.DirectionalLight(0x4f8cff, 1.25);
  rimL.position.set(-9, -5, -11); scene.add(rimL);

  /* ---------- вспомогательные текстуры (canvas, без файлов) ---------- */
  function dotTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function nebTex(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0.00, 'rgba(' + rgb + ',0.55)');
    rg.addColorStop(0.35, 'rgba(' + rgb + ',0.22)');
    rg.addColorStop(0.70, 'rgba(' + rgb + ',0.06)');
    rg.addColorStop(1.00, 'rgba(' + rgb + ',0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const DOT = dotTex();

  /* ============================================================
     1. ЗВЁЗДЫ (particle system, рециклится вокруг корабля)
     ============================================================ */
  const STAR_N = LOW ? 900 : (MID ? 1400 : 1900);
  const SB = { x: 460, y: 300, z: 1000 };
  const sPos = new Float32Array(STAR_N * 3);
  const sCol = new Float32Array(STAR_N * 3);
  const sSpd = new Float32Array(STAR_N);
  const tmpC = new THREE.Color();
  for (let i = 0; i < STAR_N; i++) {
    sPos[i * 3]     = (Math.random() - 0.5) * SB.x;
    sPos[i * 3 + 1] = (Math.random() - 0.5) * SB.y;
    sPos[i * 3 + 2] = (Math.random() - 0.5) * SB.z - 250;
    tmpC.setHSL(0.54 + Math.random() * 0.14, 0.55, 0.62 + Math.random() * 0.35);
    sCol[i * 3] = tmpC.r; sCol[i * 3 + 1] = tmpC.g; sCol[i * 3 + 2] = tmpC.b;
    sSpd[i] = 26 + Math.random() * 80;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: LOW ? 1.6 : 2.0, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  stars.frustumCulled = false;
  scene.add(stars);

  /* ============================================================
     2. ТУМАННОСТИ (спрайты, рециклятся)
     ============================================================ */
  const NEB_COL = ['70,120,255', '150,80,220', '60,180,220', '220,90,160', '80,220,180'];
  const NEB_N = LOW ? 6 : 12;
  const nebs = [];
  for (let i = 0; i < NEB_N; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nebTex(NEB_COL[i % NEB_COL.length]),
      transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const sc = 120 + Math.random() * 260;
    sp.scale.set(sc, sc, 1);
    sp.position.set((Math.random() - 0.5) * 700, (Math.random() - 0.5) * 420, -Math.random() * 1100);
    scene.add(sp);
    nebs.push(sp);
  }

  /* ============================================================
     3. КОРАБЛЬ ИГРОКА
     ============================================================ */
  const flames = [];
  function buildShip() {
    const g = new THREE.Group();
    const body  = new THREE.MeshStandardMaterial({ color: 0xdfe9f5, roughness: 0.34, metalness: 0.32 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x2b3646, roughness: 0.5, metalness: 0.5 });
    const acc   = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, emissive: 0x4fd8ff, emissiveIntensity: 2.3, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x2a7fb8, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 });

    // фюзеляж (вдоль -Z)
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 3.4, 14), body);
    fus.rotation.x = Math.PI / 2; g.add(fus);
    // нос
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.7, 14), body);
    nose.rotation.x = -Math.PI / 2; nose.position.z = -2.5; g.add(nose);
    // кабина
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glass);
    cab.scale.set(0.85, 0.62, 1.55); cab.position.set(0, 0.44, -0.5); g.add(cab);
    // киль
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 1.25), body);
    fin.position.set(0, 0.62, 1.5); g.add(fin);
    // неоновая полоса по борту
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.6), acc);
      strip.position.set(s * 0.66, 0.05, -0.2); g.add(strip);

      // крыло
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 1.5), body);
      w.position.set(s * 1.65, -0.05, 0.55);
      w.rotation.z = s * 0.13; w.rotation.y = -s * 0.22;
      g.add(w);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 1.05), acc);
      tip.position.set(s * 2.9, 0.16, 0.66); g.add(tip);

      // двигатель
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.6, 12), dark);
      eng.rotation.x = Math.PI / 2; eng.position.set(s * 0.86, -0.1, 1.9); g.add(eng);
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.3, 12), acc);
      noz.rotation.x = Math.PI / 2; noz.position.set(s * 0.86, -0.1, 2.72); g.add(noz);

      // пламя сопла (аддитивное, без источника света)
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1.7, 10),
        new THREE.MeshBasicMaterial({
          color: 0x8fe4ff, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        })
      );
      fl.rotation.x = Math.PI / 2;
      fl.position.set(s * 0.86, -0.1, 3.6);
      g.add(fl);
      flames.push(fl);
    }
    return g;
  }
  const ship = buildShip();
  scene.add(ship);

  /* ============================================================
     4. ЛАЗЕРЫ (InstancedMesh, пул)
     ============================================================ */
  const LAS_MAX = LOW ? 30 : 48;
  const lasGeo = new THREE.BoxGeometry(0.16, 0.16, 2.8);
  const lasMat = new THREE.MeshBasicMaterial({ color: 0x7ff2ff, toneMapped: false });
  const lasMesh = new THREE.InstancedMesh(lasGeo, lasMat, LAS_MAX);
  lasMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lasMesh.frustumCulled = false;
  scene.add(lasMesh);
  const lasers = [];
  for (let i = 0; i < LAS_MAX; i++) lasers.push({ alive: false, x: 0, y: 0, z: 0 });

  /* ============================================================
     5. ВРАГИ (2 InstancedMesh: корпус + крылья, общие матрицы)
     ============================================================ */
  const EN_MAX = LOW ? 12 : 20;
  const enGeo  = new THREE.ConeGeometry(0.95, 2.8, 6);
  enGeo.rotateX(-Math.PI / 2);
  const enWGeo = new THREE.BoxGeometry(3.6, 0.18, 1.2);
  enWGeo.translate(0, 0, 0.5);
  const enMat  = new THREE.MeshStandardMaterial({ color: 0xff6a86, emissive: 0xff2a4a, emissiveIntensity: 1.7, roughness: 0.45, metalness: 0.2 });
  const enWMat = new THREE.MeshStandardMaterial({ color: 0xff9ab0, emissive: 0xff3a5a, emissiveIntensity: 1.3, roughness: 0.5, metalness: 0.2 });
  const enMesh  = new THREE.InstancedMesh(enGeo, enMat, EN_MAX);
  const enWMesh = new THREE.InstancedMesh(enWGeo, enWMat, EN_MAX);
  enMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  enWMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  enMesh.frustumCulled = false; enWMesh.frustumCulled = false;
  scene.add(enMesh, enWMesh);
  const enemies = [];
  for (let i = 0; i < EN_MAX; i++) enemies.push({ alive: false, x: 0, y: 0, z: 0, hp: 2, r: 1.9, spd: 22, roll: 0 });

  /* ============================================================
     6. АСТЕРОИДЫ (InstancedMesh)
     ============================================================ */
  const AS_MAX = LOW ? 16 : 26;
  const asGeo = new THREE.IcosahedronGeometry(1, 0);
  const asMat = new THREE.MeshStandardMaterial({ color: 0x8f8478, roughness: 0.92, metalness: 0.06, flatShading: true });
  const asMesh = new THREE.InstancedMesh(asGeo, asMat, AS_MAX);
  asMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  asMesh.frustumCulled = false;
  scene.add(asMesh);
  const rocks = [];
  for (let i = 0; i < AS_MAX; i++) rocks.push({ alive: false, x: 0, y: 0, z: 0, r: 2, spd: 16, sc: 1, rx: 0, ry: 0, hp: 1 });

  /* ============================================================
     7. ВЗРЫВЫ (пул частиц Points, аддитивные)
     ============================================================ */
  const PN = LOW ? 200 : 360;
  const pPos  = new Float32Array(PN * 3);
  const pCol  = new Float32Array(PN * 3);
  const pVel  = new Float32Array(PN * 3);
  const pBase = new Float32Array(PN * 3);
  const pLife = new Float32Array(PN);
  const pMax  = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { pPos[i * 3 + 1] = -9999; }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 1.5, map: DOT, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  parts.frustumCulled = false;
  scene.add(parts);
  let pHead = 0;

  function boom(x, y, z, count, rgb, power) {
    for (let k = 0; k < count; k++) {
      const i = pHead; pHead = (pHead + 1) % PN;
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = power * (0.35 + Math.random() * 0.9);
      pVel[i * 3]     = Math.sin(ph) * Math.cos(th) * sp;
      pVel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * sp;
      pVel[i * 3 + 2] = Math.cos(ph) * sp;
      const b = 0.6 + Math.random() * 0.4;
      pBase[i * 3] = rgb[0] * b; pBase[i * 3 + 1] = rgb[1] * b; pBase[i * 3 + 2] = rgb[2] * b;
      pCol[i * 3] = pBase[i * 3]; pCol[i * 3 + 1] = pBase[i * 3 + 1]; pCol[i * 3 + 2] = pBase[i * 3 + 2];
      pMax[i] = 0.5 + Math.random() * 0.55;
      pLife[i] = pMax[i];
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  /* ============================================================
     8. СОСТОЯНИЕ
     ============================================================ */
  const dummy = new THREE.Object3D();
  const state = {
    level: 1, score: 0, hp: 100, maxHp: 100,
    shield: 60, maxShield: 60, time: 60, over: false, shake: 0
  };
  let inputX = 0, inputY = 0, firing = false;
  let shipX = 0, shipY = 0, shipVX = 0, shipVY = 0;
  let worldSpd = 26, laserDmg = 1, fireCd = 0, enCd = 0, asCd = 0, hudCd = 0;
  let t = 0;
  /* ЭТАП 4: улучшения из комнаты влияют на полёт */
  let weaponLv = 1, engineLv = 1, dualGun = false, fireRate = 0.14;
  let kills = 0, critSaid = false;

  function resetInstances() {
    for (let i = 0; i < EN_MAX; i++) {
      dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      enMesh.setMatrixAt(i, dummy.matrix); enWMesh.setMatrixAt(i, dummy.matrix);
    }
    enMesh.instanceMatrix.needsUpdate = true; enWMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < AS_MAX; i++) {
      dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      asMesh.setMatrixAt(i, dummy.matrix);
    }
    asMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < LAS_MAX; i++) {
      dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      lasMesh.setMatrixAt(i, dummy.matrix);
    }
    lasMesh.instanceMatrix.needsUpdate = true;
  }

  function enter(level, up) {
    up = up || { hull: 1, shield: 1, weapon: 1, engine: 1 };
    state.level = level;
    state.score = 0;
    state.maxHp = 100 + (up.hull - 1) * 40;
    state.hp = state.maxHp;
    state.maxShield = 60 + (up.shield - 1) * 40;
    state.shield = state.maxShield;
    state.time = 60;
    state.over = false;
    state.shake = 0;
    /* --- ЭТАП 4: улучшения из комнаты влияют на геймплей ---
       ОРУЖИЕ 2+ → стрельба ДВУМЯ лазерами одновременно,
       каждый уровень оружия ещё и ускоряет перезарядку.
       ДВИГАТЕЛИ → выше скорость мира и резче манёвр. */
    weaponLv = Math.max(1, up.weapon || 1);
    engineLv = Math.max(1, up.engine || 1);
    dualGun  = weaponLv >= 2;
    fireRate = Math.max(0.07, 0.14 - (weaponLv - 1) * 0.015);
    worldSpd = 24 + (engineLv - 1) * 4;
    laserDmg = 1 + (weaponLv - 1) * 0.5;
    kills = 0; critSaid = false;
    shipX = 0; shipY = 0; shipVX = 0; shipVY = 0;
    inputX = 0; inputY = 0; firing = false;
    fireCd = 0; enCd = 1.2; asCd = 0.6; hudCd = 0; t = 0;
    for (const l of lasers) l.alive = false;
    for (const e of enemies) e.alive = false;
    for (const r of rocks) r.alive = false;
    for (let i = 0; i < PN; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -9999; }
    pGeo.attributes.position.needsUpdate = true;
    resetInstances();
    ship.position.set(0, 0, 0);
    ship.rotation.set(0, 0, 0);
    camera.position.set(0, 3.8, 13);
    pushHud();
    /* ЭТАП 4: бортовой компьютер объявляет уровень */
    if (speech) speech.say('Уровень ' + level + '. Поехали!');
  }

  function exit() {
    for (const l of lasers) l.alive = false;
    for (const e of enemies) e.alive = false;
    for (const r of rocks) r.alive = false;
    resetInstances();
  }

  function pushHud() {
    onHud({
      hp: Math.max(0, state.hp), maxHp: state.maxHp,
      shield: Math.max(0, state.shield), maxShield: state.maxShield,
      score: state.score, level: state.level, time: state.time
    });
  }

  /* ---------- спавн ---------- */
  function spawnEnemy() {
    for (let i = 0; i < EN_MAX; i++) {
      const e = enemies[i];
      if (e.alive) continue;
      e.alive = true;
      e.x = (Math.random() - 0.5) * 26;
      e.y = (Math.random() - 0.5) * 14;
      e.z = -170 - Math.random() * 60;
      e.hp = 2 + Math.floor(state.level / 2);
      e.r = 1.9;
      e.spd = 20 + state.level * 3.2;
      e.roll = Math.random() * 6.28;
      return;
    }
  }
  function spawnRock() {
    for (let i = 0; i < AS_MAX; i++) {
      const r = rocks[i];
      if (r.alive) continue;
      r.alive = true;
      r.sc = 1.1 + Math.random() * 2.6;
      r.x = (Math.random() - 0.5) * 30;
      r.y = (Math.random() - 0.5) * 16;
      r.z = -180 - Math.random() * 70;
      r.r = r.sc * 1.05;
      r.spd = 13 + state.level * 2.4;
      r.rx = Math.random() * 6.28; r.ry = Math.random() * 6.28;
      r.hp = r.sc > 2.4 ? 2 : 1;
      return;
    }
  }
  function fireLaser(ox) {
    for (let i = 0; i < LAS_MAX; i++) {
      const l = lasers[i];
      if (l.alive) continue;
      l.alive = true;
      l.x = shipX + (ox || 0); l.y = shipY; l.z = -2.6;
      return;
    }
  }

  function damage(amount) {
    if (state.over) return;
    if (state.shield > 0) {
      state.shield -= amount;
      if (state.shield < 0) { state.hp += state.shield; state.shield = 0; }
    } else {
      state.hp -= amount;
    }
    state.shake = Math.min(1.1, state.shake + 0.55);
    if (state.hp <= 0) {
      state.hp = 0;
      state.over = true;
      boom(shipX, shipY, 0, LOW ? 60 : 110, [1.0, 0.65, 0.3], 22);
      setTimeout(() => { if (state.over) onEnd({ win: false, score: state.score, level: state.level, credits: 0 }); }, 900);
    }
  }

  /* ============================================================
     9. ОБНОВЛЕНИЕ
     ============================================================ */
  function update(dt) {
    if (state.over) {
      // только частицы и камера
      updateParticles(dt);
      camera.position.lerp(new THREE.Vector3(shipX * 0.4, 4.2, 15), 1 - Math.exp(-3 * dt));
      camera.lookAt(shipX * 0.4, 0, -6);
      return;
    }
    t += dt;
    state.time -= dt;
    if (state.time <= 0) {
      state.time = 0;
      state.over = true;
      onEnd({ win: true, score: state.score, level: state.level, credits: 150 + state.level * 50 });
      return;
    }

    /* --- корабль --- */
    // ДВИГАТЕЛИ: каждый уровень — резче манёвр
    const ax = inputX * (46 + (engineLv - 1) * 6), ay = -inputY * (40 + (engineLv - 1) * 5);
    shipVX += (ax - shipVX * 3.2) * dt;
    shipVY += (ay - shipVY * 3.2) * dt;
    shipX = Math.max(-13, Math.min(13, shipX + shipVX * dt));
    shipY = Math.max(-8.5, Math.min(8.5, shipY + shipVY * dt));

    ship.position.set(shipX, shipY, 0);
    ship.rotation.z = -inputX * 0.55;
    ship.rotation.x = inputY * 0.32;
    ship.rotation.y = -inputX * 0.22;

    // пульсация пламени
    const fp = 0.42 + Math.sin(t * 26) * 0.12;
    for (const f of flames) {
      f.material.opacity = fp;
      f.scale.set(1, 0.85 + Math.sin(t * 31) * 0.18, 1);
    }

    /* --- стрельба --- */
    fireCd -= dt;
    if (firing && fireCd <= 0) {
      if (dualGun) { fireLaser(-0.95); fireLaser(0.95); }   // ОРУЖИЕ 2+ → два лазера
      else fireLaser(0);
      fireCd = fireRate;
      if (audio) audio.laser();
    }

    /* --- спавн --- */
    enCd -= dt;
    if (enCd <= 0) { spawnEnemy(); enCd = Math.max(0.55, 1.7 - state.level * 0.16) * (0.7 + Math.random() * 0.6); }
    asCd -= dt;
    if (asCd <= 0) { spawnRock(); asCd = Math.max(0.35, 1.1 - state.level * 0.11) * (0.7 + Math.random() * 0.6); }

    /* --- лазеры --- */
    for (let i = 0; i < LAS_MAX; i++) {
      const l = lasers[i];
      if (!l.alive) { dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix(); lasMesh.setMatrixAt(i, dummy.matrix); continue; }
      l.z -= 130 * dt;
      if (l.z < -200) { l.alive = false; }
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(l.alive ? 1 : 0);
      dummy.updateMatrix();
      lasMesh.setMatrixAt(i, dummy.matrix);
    }
    lasMesh.instanceMatrix.needsUpdate = true;

    /* --- враги --- */
    for (let i = 0; i < EN_MAX; i++) {
      const e = enemies[i];
      if (e.alive) {
        e.z += (e.spd + worldSpd * 0.35) * dt;
        e.x += Math.sign(shipX - e.x) * Math.min(3.2, Math.abs(shipX - e.x)) * dt * 0.55;
        e.y += Math.sign(shipY - e.y) * Math.min(2.4, Math.abs(shipY - e.y)) * dt * 0.45;
        e.roll += dt * 1.4;
        if (e.z > 26) e.alive = false;

        // столкновение с игроком
        const dx = e.x - shipX, dy = e.y - shipY, dz = e.z;
        if (e.alive && dx * dx + dy * dy + dz * dz < 8.4) {
          e.alive = false;
          boom(e.x, e.y, e.z, LOW ? 26 : 46, [1.0, 0.35, 0.35], 16);
          damage(14);
        }
      }
      dummy.position.set(e.x, e.y, e.z);
      dummy.rotation.set(0, 0, e.roll);
      dummy.scale.setScalar(e.alive ? 1 : 0);
      dummy.updateMatrix();
      enMesh.setMatrixAt(i, dummy.matrix);
      enWMesh.setMatrixAt(i, dummy.matrix);
    }
    enMesh.instanceMatrix.needsUpdate = true;
    enWMesh.instanceMatrix.needsUpdate = true;

    /* --- астероиды --- */
    for (let i = 0; i < AS_MAX; i++) {
      const r = rocks[i];
      if (r.alive) {
        r.z += (r.spd + worldSpd * 0.3) * dt;
        r.rx += dt * 0.7; r.ry += dt * 0.5;
        if (r.z > 26) r.alive = false;

        const dx = r.x - shipX, dy = r.y - shipY, dz = r.z;
        const rr = r.r + 1.7;
        if (r.alive && dx * dx + dy * dy + dz * dz < rr * rr) {
          r.alive = false;
          boom(r.x, r.y, r.z, LOW ? 22 : 40, [0.85, 0.7, 0.5], 14);
          damage(9);
        }
      }
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(r.rx, r.ry, 0);
      dummy.scale.setScalar(r.alive ? r.sc : 0);
      dummy.updateMatrix();
      asMesh.setMatrixAt(i, dummy.matrix);
    }
    asMesh.instanceMatrix.needsUpdate = true;

    /* --- попадания лазеров --- */
    for (let i = 0; i < LAS_MAX; i++) {
      const l = lasers[i];
      if (!l.alive) continue;
      // враги
      for (let j = 0; j < EN_MAX; j++) {
        const e = enemies[j];
        if (!e.alive) continue;
        const dx = e.x - l.x, dy = e.y - l.y, dz = e.z - l.z;
        if (dx * dx + dy * dy + dz * dz < 6.5) {
          l.alive = false;
          e.hp -= laserDmg;
          if (e.hp <= 0) {
            e.alive = false;
            state.score += 25;
            boom(e.x, e.y, e.z, LOW ? 28 : 50, [1.0, 0.42, 0.42], 18);
          } else {
            boom(l.x, l.y, l.z, 5, [1.0, 0.8, 0.5], 7);
          }
          break;
        }
      }
      if (!l.alive) continue;
      // астероиды
      for (let j = 0; j < AS_MAX; j++) {
        const r = rocks[j];
        if (!r.alive) continue;
        const dx = r.x - l.x, dy = r.y - l.y, dz = r.z - l.z;
        const rr = r.r + 0.5;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          l.alive = false;
          r.hp -= laserDmg;
          if (r.hp <= 0) {
            r.alive = false;
            state.score += 10;
            boom(r.x, r.y, r.z, LOW ? 20 : 36, [0.9, 0.75, 0.55], 14);
          } else {
            boom(l.x, l.y, l.z, 5, [0.9, 0.8, 0.6], 7);
          }
          break;
        }
      }
    }

    updateParticles(dt);

    /* --- камера (следует за кораблём, с тряской) --- */
    const sh = state.shake;
    state.shake = Math.max(0, sh - dt * 2.2);
    const tx = shipX * 0.55, ty = 3.8 + shipY * 0.35, tz = 13;
    camera.position.x += (tx - camera.position.x) * (1 - Math.exp(-6 * dt));
    camera.position.y += (ty - camera.position.y) * (1 - Math.exp(-6 * dt));
    camera.position.z += (tz - camera.position.z) * (1 - Math.exp(-6 * dt));
    camera.position.x += (Math.random() - 0.5) * sh * 0.9;
    camera.position.y += (Math.random() - 0.5) * sh * 0.9;
    camera.lookAt(shipX * 0.7, shipY * 0.55, -10);

    /* --- фон --- */
    const sp = worldSpd * dt;
    for (let i = 0; i < STAR_N; i++) {
      sPos[i * 3 + 2] += sp * (sSpd[i] / 60);
      if (sPos[i * 3 + 2] > 320) {
        sPos[i * 3 + 2] -= SB.z;
        sPos[i * 3] = (Math.random() - 0.5) * SB.x;
        sPos[i * 3 + 1] = (Math.random() - 0.5) * SB.y;
      }
    }
    starGeo.attributes.position.needsUpdate = true;
    for (const n of nebs) {
      n.position.z += sp * 0.55;
      if (n.position.z > 200) {
        n.position.z = -1100 - Math.random() * 300;
        n.position.x = (Math.random() - 0.5) * 700;
        n.position.y = (Math.random() - 0.5) * 420;
      }
    }

    /* --- HUD --- */
    hudCd -= dt;
    if (hudCd <= 0) { hudCd = 0.12; pushHud(); }
  }

  function updateParticles(dt) {
    let any = false;
    for (let i = 0; i < PN; i++) {
      if (pLife[i] <= 0) continue;
      any = true;
      pLife[i] -= dt;
      const k = Math.max(0, pLife[i] / pMax[i]);
      pVel[i * 3] *= 0.955; pVel[i * 3 + 1] *= 0.955; pVel[i * 3 + 2] *= 0.955;
      pPos[i * 3]     += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pCol[i * 3]     = pBase[i * 3] * k;
      pCol[i * 3 + 1] = pBase[i * 3 + 1] * k;
      pCol[i * 3 + 2] = pBase[i * 3 + 2] * k;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -9999;
    }
    if (any) {
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    }
  }

  function render() { renderer.render(scene, camera); }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return {
    scene, camera, state,
    enter, exit, update, render, resize,
    setInput(x, y) { inputX = x; inputY = y; },
    setFire(v) { firing = !!v; },
    isOver() { return state.over; }
  };
}
