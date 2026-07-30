const BASS_SENSITIVITY = 15.0; // raise to make kicks/bass punch harder
const TREBLE_SENSITIVITY = 11.0; // raise to make hihats/snares punch harder
const BASELINE_FOLLOW_SPEED = 0.8; // lower = baseline adapts slower, so hits stand out more against it
const PULSE_DECAY_SPEED = 15.0; // raise = pulse snaps back to rest faster

let BLOOM_BRIGHTNESS_SCALE = 1.8;
let PULSE_EXPANSION_SCALE = 0.45;
const BEAT_PARTICLE_SPAWN_CHANCE = 1;

let OVERRIDE_COLOR = 0x250101;
const baseColor = new THREE.Color(0x250101);
const maxColor = new THREE.Color(0xff0000);

const activeColor = new THREE.Color(); 
let lastAppliedColorHex = -1; 

const toggleUIButton = document.getElementById("toggle-ui-button");
const audioControls = document.getElementById("audio-controls");
const topRightUI = document.getElementById("top-right-ui");

let uiHidden = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

let CAMERA_DISTANCE = 30;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, CAMERA_DISTANCE);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const container = document.getElementById('scene-container') || document.body;
container.appendChild(renderer.domElement);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

let BLOOM_VAL = 1.8;
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM_VAL,
  0.45,
  0.005
);
composer.addPass(bloomPass);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const particleBall = new THREE.Group();
scene.add(particleBall);

function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}
const glowTexture = createGlowTexture();

function randomGaussian() {
  const u = Math.random() || 0.0001;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

let explosionCooldown = 0;
const audioExplosionsGroup = new THREE.Group();
particleBall.add(audioExplosionsGroup);
const audioExplosionsData = [];

function initAudioExplosion() {
  const particleCount = 400 + Math.floor(Math.random() * 400);
  const sphereRadius = 6.2; 
  const centerP = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);

  const rawPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const baseSpeed = 2 + Math.random() * 4;

  for (let i = 0; i < particleCount; i++) {
    rawPositions[i * 3]     = centerP.x;
    rawPositions[i * 3 + 1] = centerP.y;
    rawPositions[i * 3 + 2] = centerP.z;

    let dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    if (dir.dot(centerP) < 0) {
      dir.negate();
    }

    const speed = baseSpeed * (0.3 + Math.random() * 0.7); 
    velocities[i * 3]     = dir.x * speed;
    velocities[i * 3 + 1] = dir.y * speed;
    velocities[i * 3 + 2] = dir.z * speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
  
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR,
    size: 0.22,
    map: glowTexture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);

  return {
    mesh,
    particleCount,
    rawPositions,
    velocities,
    life: 0,
    maxLife: 1.5 + Math.random() * 1.5
  };
}

function updateAudioExplosions(deltaTime) {
  for (let s = audioExplosionsData.length - 1; s >= 0; s--) {
    const exp = audioExplosionsData[s];
    exp.life += deltaTime;
    
    let lifeRatio = exp.life / exp.maxLife;
    if (lifeRatio > 1.0) lifeRatio = 1.0;
    
    let opacity = 1.0;
    if (lifeRatio > 0.3) {
       opacity = 1.0 - ((lifeRatio - 0.3) / 0.7);
    }
    exp.mesh.material.opacity = opacity;
    
    const posAttr = exp.mesh.geometry.getAttribute('position');
    
    for (let i = 0; i < exp.particleCount; i++) {
      const idx = i * 3;
      exp.rawPositions[idx]     += exp.velocities[idx] * deltaTime;
      exp.rawPositions[idx + 1] += exp.velocities[idx + 1] * deltaTime;
      exp.rawPositions[idx + 2] += exp.velocities[idx + 2] * deltaTime;
      
      const dispX = (Math.sin(i * 123.4) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 567.8) * 50.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 901.2) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;

      _tempVector.set(
        exp.rawPositions[idx] + dispX * easeDisperse,
        exp.rawPositions[idx + 1] + dispY * easeDisperse,
        exp.rawPositions[idx + 2] + dispZ * easeDisperse
      );
      
      const fluidScale = calculateWobbleScale(_tempVector);
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
      const totalScale = fluidScale * pulseShift * twinkle;
      
      posAttr.setXYZ(i, _tempVector.x * totalScale, _tempVector.y * totalScale, _tempVector.z * totalScale);
    }
    
    posAttr.needsUpdate = true;
    
    if (exp.life >= exp.maxLife) {
      audioExplosionsGroup.remove(exp.mesh);
      exp.mesh.geometry.dispose();
      exp.mesh.material.dispose();
      audioExplosionsData.splice(s, 1);
    }
  }
}
let beatIntensity = 0;
let beatPulse = 0;

function triggerRandomParticleBeat(spikeIntensity, sensitivity) {
  beatIntensity = Math.min(1.9, beatIntensity + spikeIntensity * sensitivity);
}

function createInnerCore() {
  const count = 5000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    const r = 0.4 + Math.random() * 2.8;
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.15, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData.basePositions = positions.slice();
  points.userData.velocity = new Float32Array(count * 3);
  points.userData.reactivity = 1.3;
  return points;
}

function createThickOuterShell() {
  const count = 10000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    const r = 4.5 + (Math.random() * 1.7); 
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.11, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData.basePositions = positions.slice();
  points.userData.velocity = new Float32Array(count * 3);
  points.userData.reactivity = 1.0;
  return points;
}

function createOuterHaloCloud() {
  const count = 2000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    const r = 5.5 + (Math.random() * 30.0);
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, 
    size: 0.2, 
    map: glowTexture, 
    transparent: true,
    opacity: 0.25, 
    depthWrite: false, 
    blending: THREE.AdditiveBlending, 
    sizeAttenuation: true 
  });
  const points = new THREE.Points(geometry, material);
  points.userData.basePositions = positions.slice();
  points.userData.velocity = new Float32Array(count * 3);
  points.userData.reactivity = 0.15;

  const driftAxis = new Float32Array(count * 3);
  const driftSpeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const axis = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    driftAxis[i * 3] = axis.x;
    driftAxis[i * 3 + 1] = axis.y;
    driftAxis[i * 3 + 2] = axis.z;
    driftSpeed[i] = 0.1 + Math.random() * 0.4;
  }
  points.userData.driftAxis = driftAxis;
  points.userData.driftSpeed = driftSpeed;

  return points;
}

const innerCore = createInnerCore();
const outerShell = createThickOuterShell();
const outerHalo = createOuterHaloCloud();

particleBall.add(innerCore);
particleBall.add(outerShell);
scene.add(outerHalo); 

let NUM_INTERNAL_STREAMS = 60;
const internalStreamGroup = new THREE.Group();
particleBall.add(internalStreamGroup);
const internalStreamData = [];

function initInternalStream() {
  const particleCount = 400 + Math.floor(Math.random() * 300);
  const p1 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(6.0);
  const p2 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(6.0);
  const mid = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(1.5 + Math.random() * 2.5);
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

  const positions = new Float32Array(particleCount * 3);
  const progressOffsets = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const localOffsets = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    progressOffsets[i] = t;
    speeds[i] = 0.12 + Math.random() * 0.22;

    const tangent = curve.getTangent(t);
    const up = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();

    const width = 0.45;
    const sideOffset = (Math.random() - 0.5) * width;
    const normOffset = (Math.random() - 0.5) * width;

    localOffsets[i * 3]     = side.x * sideOffset + normal.x * normOffset;
    localOffsets[i * 3 + 1] = side.y * sideOffset + normal.y * normOffset;
    localOffsets[i * 3 + 2] = side.z * sideOffset + normal.z * normOffset;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.12, map: glowTexture, transparent: true,
    opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);
  return { mesh, curve, particleCount, progressOffsets, speeds, localOffsets, life: 0, maxLife: 3 + Math.random() * 4,
           driftAxis: new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize(),
           driftSpeed: (Math.random() - 0.5) * 0.8 };
}

for (let s = 0; s < NUM_INTERNAL_STREAMS; s++) {
  const st = initInternalStream();
  st.life = Math.random() * st.maxLife;
  internalStreamData.push(st);
  internalStreamGroup.add(st.mesh);
}

function setInternalStreamCount(target) {
  while (internalStreamData.length < target) {
    const st = initInternalStream();
    st.life = Math.random() * st.maxLife;
    internalStreamData.push(st);
    internalStreamGroup.add(st.mesh);
  }
  while (internalStreamData.length > target) {
    const removed = internalStreamData.pop();
    internalStreamGroup.remove(removed.mesh);
    removed.mesh.geometry.dispose();
    removed.mesh.material.dispose();
  }
}

let NUM_SURFACE_FILAMENTS = 100;
const surfaceFilamentGroup = new THREE.Group();
particleBall.add(surfaceFilamentGroup);
const surfaceFilamentData = [];

function initSurfaceFilament() {
  const particleCount = 600 + Math.floor(Math.random() * 400);
  const sphereRadius = 6.2;
  
  const p1 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);
  const p2 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(sphereRadius + 1.2 + Math.random() * 1.0);
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

  const positions = new Float32Array(particleCount * 3);
  const progressOffsets = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const localOffsets = new Float32Array(particleCount * 3);
  const maxThickness = 0.8 + Math.random() * 0.4;

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    progressOffsets[i] = t;
    speeds[i] = 0.08 + Math.random() * 0.18;

    const tangent = curve.getTangent(t);
    const up = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();

    const width = Math.sin(t * Math.PI) * maxThickness;
    const sideOffset = (Math.random() - 0.5) * width;
    const normOffset = (Math.random() - 0.5) * (width * 0.7);

    localOffsets[i * 3]     = side.x * sideOffset + normal.x * normOffset;
    localOffsets[i * 3 + 1] = side.y * sideOffset + normal.y * normOffset;
    localOffsets[i * 3 + 2] = side.z * sideOffset + normal.z * normOffset;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.10, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);
  return { mesh, curve, particleCount, progressOffsets, speeds, localOffsets, life: 0, maxLife: 3 + Math.random() * 4 };
}

for (let f = 0; f < NUM_SURFACE_FILAMENTS; f++) {
  const fil = initSurfaceFilament();
  fil.life = Math.random() * fil.maxLife;
  surfaceFilamentData.push(fil);
  surfaceFilamentGroup.add(fil.mesh);
}

function setSurfaceFilamentCount(target) {
  while (surfaceFilamentData.length < target) {
    const fil = initSurfaceFilament();
    fil.life = Math.random() * fil.maxLife;
    surfaceFilamentData.push(fil);
    surfaceFilamentGroup.add(fil.mesh);
  }
  while (surfaceFilamentData.length > target) {
    const removed = surfaceFilamentData.pop();
    surfaceFilamentGroup.remove(removed.mesh);
    removed.mesh.geometry.dispose();
    removed.mesh.material.dispose();
  }
}

let NUM_MINI_EXPLOSIONS = 40;
const explosionsGroup = new THREE.Group();
particleBall.add(explosionsGroup);
const explosionsData = [];

function initMiniExplosion() {
  const particleCount = 200 + Math.floor(Math.random() * 100);
  const sphereRadius = 6.2; 
  const centerP = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);

  const rawPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const baseSpeed = Math.random() * (4 - 0.1) + 0.1;

  for (let i = 0; i < particleCount; i++) {
    rawPositions[i * 3]     = centerP.x;
    rawPositions[i * 3 + 1] = centerP.y;
    rawPositions[i * 3 + 2] = centerP.z;

    let dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    if (dir.dot(centerP) < 0) {
      dir.negate();
    }

    const speed = baseSpeed * (0.2 + Math.random() * 0.8);
    velocities[i * 3]     = dir.x * speed;
    velocities[i * 3 + 1] = dir.y * speed;
    velocities[i * 3 + 2] = dir.z * speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
  
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR,
    size: 0.10,
    map: glowTexture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);

  return {
    mesh,
    particleCount,
    rawPositions,
    velocities,
    life: 0,
    maxLife: 0.5 + Math.random() * 1.5
  };
}

for (let e = 0; e < NUM_MINI_EXPLOSIONS; e++) {
  const exp = initMiniExplosion();
  exp.life = Math.random() * exp.maxLife;
  explosionsData.push(exp);
  explosionsGroup.add(exp.mesh);
}

function setMiniExplosionCount(target) {
  while (explosionsData.length < target) {
    const exp = initMiniExplosion();
    exp.life = Math.random() * exp.maxLife;
    explosionsData.push(exp);
    explosionsGroup.add(exp.mesh);
  }
  while (explosionsData.length > target) {
    const removed = explosionsData.pop();
    explosionsGroup.remove(removed.mesh);
    removed.mesh.geometry.dispose();
    removed.mesh.material.dispose();
  }
}

const MIN_MASSIVE_FLARE_HEIGHT = 8.0;
const MAX_MASSIVE_FLARE_HEIGHT = 12.0;
const massiveFlareGroup = new THREE.Group();
particleBall.add(massiveFlareGroup);

const massiveSolarFlareData = [];
let massiveFlareTimer = 0;

function initMassiveSolarFlare() {
  const sphereRadius = 6.2;
  const numSubStreams = 10 + Math.floor(Math.random() * 4);
  const particlesPerStream = 300 + Math.floor(Math.random() * 250);
  const totalParticles = numSubStreams * particlesPerStream;

  const coreDir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
  const originP = coreDir.clone().multiplyScalar(1.2 + Math.random() * 1.5);

  let endDir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
  if (coreDir.dot(endDir) > 0.4) endDir.negate();
  const landP = endDir.clone().multiplyScalar(sphereRadius);

  const flareHeight = MIN_MASSIVE_FLARE_HEIGHT + Math.random() * (MAX_MASSIVE_FLARE_HEIGHT - MIN_MASSIVE_FLARE_HEIGHT);
  const apexDir = new THREE.Vector3().addVectors(coreDir, endDir).normalize();
  if (apexDir.lengthSq() < 0.1) apexDir.copy(new THREE.Vector3(0, 1, 0));
  const apexMid = apexDir.multiplyScalar(sphereRadius + flareHeight);

  const subCurves = [];
  for (let c = 0; c < numSubStreams; c++) {
    const offsetAngle = (c / numSubStreams) * Math.PI * 2;
    const strandRadius = 0.6 + Math.random() * 0.5;
    const midOffset = new THREE.Vector3(
      Math.cos(offsetAngle) * strandRadius,
      Math.sin(offsetAngle) * strandRadius,
      (Math.random() - 0.5) * strandRadius
    );

    const cp1 = originP.clone().add(apexMid.clone().sub(originP).multiplyScalar(0.4)).add(midOffset);
    const cp2 = apexMid.clone().add(midOffset);
    subCurves.push(new THREE.CubicBezierCurve3(originP.clone(), cp1, cp2, landP.clone()));
  }

  const positions = new Float32Array(totalParticles * 3);
  const progress = new Float32Array(totalParticles);
  const streamIndices = new Int32Array(totalParticles);
  const particleSpeeds = new Float32Array(totalParticles);
  const particleStates = new Uint8Array(totalParticles); 
  const sweepLife = new Float32Array(totalParticles);
  const maxSweepLife = new Float32Array(totalParticles);
  const sweepDirs = new Float32Array(totalParticles * 3);
  const localOffsets = new Float32Array(totalParticles * 3);

  let pIdx = 0;
  for (let s = 0; s < numSubStreams; s++) {
    for (let p = 0; p < particlesPerStream; p++) {
      progress[pIdx] = - (p / particlesPerStream) * 0.5 + (Math.random() * 0.02);
      streamIndices[pIdx] = s;
      particleSpeeds[pIdx] = 0.10 + Math.random() * 0.18;
      particleStates[pIdx] = 1;

      localOffsets[pIdx * 3]     = (Math.random() - 0.5) * 0.35;
      localOffsets[pIdx * 3 + 1] = (Math.random() - 0.5) * 0.35;
      localOffsets[pIdx * 3 + 2] = (Math.random() - 0.5) * 0.35;

      positions[pIdx * 3]     = 9999;
      positions[pIdx * 3 + 1] = 9999;
      positions[pIdx * 3 + 2] = 9999;
      pIdx++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.12, map: glowTexture, transparent: true,
    opacity: 0.60, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);
  return { mesh, subCurves, originP, landP, particleCount: totalParticles, progress,
           streamIndices, particleSpeeds, particleStates, sweepLife, maxSweepLife, sweepDirs, localOffsets };
}

function spawnMassiveSolarFlare() {
  const flare = initMassiveSolarFlare();
  massiveSolarFlareData.push(flare);
  massiveFlareGroup.add(flare.mesh);
}

for (let i = 0; i < 4; i++) {
  spawnMassiveSolarFlare();
}

function updateMassiveSolarFlareSpawning(deltaTime) {
  massiveFlareTimer += deltaTime;
  if (massiveFlareTimer >= 1) {
    massiveFlareTimer -= 1;
    if (Math.random() < 0.8) {
      spawnMassiveSolarFlare();
    }
  }
}

let isDispersed = false;
let targetDisperseFactor = 0;
let currentDisperseFactor = 0;
let easeDisperse = 0;

const DISPERSE_SPEED = 0.5;   
const AGGREGATE_SPEED = 0.2; 

const disperseBtn = document.getElementById('disperse-btn');
if (disperseBtn) {
  disperseBtn.addEventListener('click', () => {
    isDispersed = !isDispersed;
    if (isDispersed) {
      targetDisperseFactor = 1.0;
      disperseBtn.textContent = 'Aggregate';
    } else {
      targetDisperseFactor = 0.0;
      disperseBtn.textContent = 'Disperse';
    }
  });
}

const INITIAL_SPIN_Y = 5.0;
const IDLE_SPIN_Y    = 0.3;
const IDLE_SPIN_X    = 0;

let interactionMode = 'spin';
const modeToggleBtn = document.getElementById('mode-toggle-btn');
if (modeToggleBtn) {
  modeToggleBtn.addEventListener('click', () => {
    if (interactionMode === 'spin') {
      interactionMode = 'move';
      modeToggleBtn.textContent = 'Mode: Move';
      if (disperseBtn) disperseBtn.style.display = 'none';
      
      if (isDispersed) {
        isDispersed = false;
        targetDisperseFactor = 0.0;
        disperseBtn.textContent = 'Disperse';
      }
    } else {
      interactionMode = 'spin';
      modeToggleBtn.textContent = 'Mode: Spin';
      if (disperseBtn) disperseBtn.style.display = 'block';
    }
  });
}

let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let currentSpinX = 0;
let currentSpinY = INITIAL_SPIN_Y;

let jellyImpactPoint = new THREE.Vector3(0, 0, 1);
let jellyWobbleEnergy = 0;
let maxDragSpeed = 0;
const DRAG_SPEED_THRESHOLD = 100.0; 

let ballPos = new THREE.Vector3(0, 0, 0);
let ballVel = new THREE.Vector3(0, 0, 0);
let lastBallVel = new THREE.Vector3(0, 0, 0);
let ballDragOffset = new THREE.Vector3(0, 0, 0);
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let movementWobble = 0;
let movementWobbleVel = 0;
let wobbleAxis = new THREE.Vector3(0, 1, 0);

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.8; 
const mouseNDC = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);

  if (interactionMode === 'spin') {
    const hits = raycaster.intersectObjects([outerShell, innerCore]);
    if (hits.length > 0) {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      maxDragSpeed = 0;
      jellyImpactPoint = particleBall.worldToLocal(hits[0].point.clone()).normalize();
      renderer.domElement.style.cursor = 'grabbing';
    }
  } else {
    let planeNormal = new THREE.Vector3().subVectors(camera.position, ballPos).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, ballPos);

    let hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      if (hitPoint.distanceTo(ballPos) < 10.0) { 
        isDragging = true;
        ballDragOffset.subVectors(ballPos, hitPoint);
        renderer.domElement.style.cursor = 'grabbing';
      }
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  if (interactionMode === 'spin') {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    currentSpinY = Math.max(-2, Math.min(2, dx * 0.05));
    currentSpinX = Math.max(-2, Math.min(2, dy * 0.05));

    const speed = Math.hypot(dx, dy);
    if (speed > maxDragSpeed) maxDragSpeed = speed;
  } else {
    let planeNormal = new THREE.Vector3().subVectors(camera.position, ballPos).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, ballPos);

    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    
    let hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      let targetPos = hitPoint.clone().add(ballDragOffset);
      
      let dist = targetPos.length();
      let maxDist = 10.0; 
      if (dist > maxDist) {
        let excess = dist - maxDist;
        let stretched = maxDist + Math.log(1 + excess * 0.4) * 2.5;
        targetPos.normalize().multiplyScalar(stretched);
      }
      
      ballVel.copy(targetPos).sub(ballPos).multiplyScalar(30.0);
      ballPos.copy(targetPos);
    }
  }
});

function releaseDrag() {
  if (!isDragging) return;
  isDragging = false;
  renderer.domElement.style.cursor = 'default';

  if (interactionMode === 'spin') {
    if (maxDragSpeed > DRAG_SPEED_THRESHOLD) {
      jellyWobbleEnergy = Math.min(1.0, (maxDragSpeed - DRAG_SPEED_THRESHOLD) * 0.02 + 0.3);
    }
  }
}

window.addEventListener('mouseup', releaseDrag);
window.addEventListener('mouseleave', releaseDrag);

const _tempVector = new THREE.Vector3();
const _normPos = new THREE.Vector3();

function calculateWobbleScale(posVector) {
  if (!posVector || posVector.lengthSq() < 0.0001) return 1.0;
  _normPos.copy(posVector).normalize();
  
  let scale = 1.0;

  if (jellyWobbleEnergy > 0.001) {
    const dragDot = Math.max(0, _normPos.dot(jellyImpactPoint));
    const fluidWobble = Math.sin(totalElapsedTime * 5.0 + dragDot * 10.8) * 
                        (jellyWobbleEnergy * 1.35) * Math.pow(dragDot, 1.4) * 0.26;
    if (!isNaN(fluidWobble)) scale += fluidWobble;
  }
  
  if (Math.abs(movementWobble) > 0.001) {
    const moveDot = _normPos.dot(wobbleAxis);
    const moveFluid = movementWobble * (moveDot * moveDot - 0.333) * 0.5;
    if (!isNaN(moveFluid)) scale += moveFluid;
  }

  return Math.max(0.15, scale);
}

function updateParticleLayer(layer, deltaTime) {
  const posAttr = layer.geometry.getAttribute('position');
  const base = layer.userData.basePositions;
  const vel = layer.userData.velocity;
  const count = posAttr.count;
  const layerReactivity = layer.userData.reactivity || 1.0;

  const stiffness = 4.5;
  const damping = 1.5;

  const driftAxis = layer.userData.driftAxis;
  const driftSpeed = layer.userData.driftSpeed;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    
    const dispX = (Math.sin(i * 1352.34) * 25.0) + Math.sin(totalElapsedTime * 0.5 + i) * 10.0;
    const dispY = (Math.cos(i * 4132.21) * 25.0) + Math.cos(totalElapsedTime * 0.6 + i) * 10.0;
    const dispZ = (Math.sin(i * 7265.54) * 25.0) + Math.sin(totalElapsedTime * 0.7 + i) * 10.0;

    let effectiveBaseX = base[idx] + dispX * easeDisperse;
    let effectiveBaseY = base[idx + 1] + dispY * easeDisperse;
    let effectiveBaseZ = base[idx + 2] + dispZ * easeDisperse;

    if (driftAxis) {
      const driftAmount = Math.sin(totalElapsedTime * driftSpeed[i] + i) * 4.0;
      effectiveBaseX += driftAxis[idx] * driftAmount;
      effectiveBaseY += driftAxis[idx + 1] * driftAmount;
      effectiveBaseZ += driftAxis[idx + 2] * driftAmount;
    }
    
    _tempVector.set(effectiveBaseX, effectiveBaseY, effectiveBaseZ);
    
    const fluidScale = calculateWobbleScale(_tempVector);
    const smoothPulse = beatPulse * 0.02 * PULSE_EXPANSION_SCALE * layerReactivity;
    
    const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 8.0 + i)) * easeDisperse * 1.5);
    const totalScale = (fluidScale + smoothPulse) * twinkle;

    const targetX = effectiveBaseX * (1.0 + totalScale * 0.22);
    const targetY = effectiveBaseY * (1.0 + totalScale * 0.22);
    const targetZ = effectiveBaseZ * (1.0 + totalScale * 0.22);

    vel[idx]     += ((targetX - _tempVector.x) * stiffness - vel[idx] * damping) * deltaTime;
    vel[idx + 1] += ((targetY - _tempVector.y) * stiffness - vel[idx + 1] * damping) * deltaTime;
    vel[idx + 2] += ((targetZ - _tempVector.z) * stiffness - vel[idx + 2] * damping) * deltaTime;

    posAttr.setXYZ(i, _tempVector.x + vel[idx] * deltaTime, _tempVector.y + vel[idx + 1] * deltaTime, _tempVector.z + vel[idx + 2] * deltaTime);
  }
  posAttr.needsUpdate = true;
}

function updateInternalStreams(deltaTime) {
  for (let s = 0; s < internalStreamData.length; s++) {
    const stream = internalStreamData[s];
    stream.life += deltaTime;

    let opacityAlpha = 1.0;
    if (stream.life > stream.maxLife - 1.0) {
      opacityAlpha = Math.max(0, (stream.maxLife - stream.life));
    } else if (stream.life < 0.8) {
      opacityAlpha = stream.life / 0.8;
    }
    stream.mesh.material.opacity = 0.65 * opacityAlpha;

    stream.mesh.rotation.x += stream.driftAxis.x * stream.driftSpeed * deltaTime;
    stream.mesh.rotation.y += stream.driftAxis.y * stream.driftSpeed * deltaTime;
    stream.mesh.rotation.z += stream.driftAxis.z * stream.driftSpeed * deltaTime;

    const posAttr = stream.mesh.geometry.getAttribute('position');

    for (let i = 0; i < stream.particleCount; i++) {
      stream.progressOffsets[i] = (stream.progressOffsets[i] + stream.speeds[i] * deltaTime * 0.25) % 1.0;
      const t = stream.progressOffsets[i];
      const pt = stream.curve.getPoint(t);
      const idx = i * 3;
      
      const dispX = (Math.sin(i * 135.2) * 20.0) + Math.sin(totalElapsedTime + i) * 10.0;
      const dispY = (Math.cos(i * 413.2) * 20.0) + Math.cos(totalElapsedTime + i) * 10.0;
      const dispZ = (Math.sin(i * 726.5) * 20.0) + Math.sin(totalElapsedTime + i) * 10.0;

      _tempVector.set(
        pt.x + stream.localOffsets[idx] + dispX * easeDisperse,
        pt.y + stream.localOffsets[idx + 1] + dispY * easeDisperse,
        pt.z + stream.localOffsets[idx + 2] + dispZ * easeDisperse
      );

      const fluidScale = calculateWobbleScale(_tempVector);
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
      const totalScale = fluidScale * pulseShift * twinkle;

      posAttr.setXYZ(i, _tempVector.x * totalScale, _tempVector.y * totalScale, _tempVector.z * totalScale);
    }
    posAttr.needsUpdate = true;

    if (stream.life >= stream.maxLife) {
      internalStreamGroup.remove(stream.mesh);
      stream.mesh.geometry.dispose();
      stream.mesh.material.dispose();

      const newStream = initInternalStream();
      internalStreamData[s] = newStream;
      internalStreamGroup.add(newStream.mesh);
    }
  }
}


function updateSurfaceFilaments(deltaTime) {
  const sphereRadius = 6.2;
  for (let f = 0; f < surfaceFilamentData.length; f++) {
    const fil = surfaceFilamentData[f];
    fil.life += deltaTime;
    const posAttr = fil.mesh.geometry.getAttribute('position');
    const isDying = fil.life > (fil.maxLife - 1.2);
    const dieProgress = isDying ? (fil.life - (fil.maxLife - 1.2)) / 1.2 : 0;

    for (let i = 0; i < fil.particleCount; i++) {
      fil.progressOffsets[i] = (fil.progressOffsets[i] + fil.speeds[i] * deltaTime * 0.25) % 1.0;
      const t = fil.progressOffsets[i];
      const pt = fil.curve.getPoint(t);
      const idx = i * 3;

      const dispX = (Math.sin(i * 246.1) * 60.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 572.3) * 60.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 819.4) * 60.0) + Math.sin(totalElapsedTime + i) * 15.0;

      _tempVector.set(
        pt.x + fil.localOffsets[idx] + dispX * easeDisperse,
        pt.y + fil.localOffsets[idx + 1] + dispY * easeDisperse,
        pt.z + fil.localOffsets[idx + 2] + dispZ * easeDisperse
      );

      if (isDying && easeDisperse < 0.1) {
        const shellTarget = _tempVector.clone().normalize().multiplyScalar(sphereRadius);
        _tempVector.lerp(shellTarget, Math.min(1.0, dieProgress * 1.5));
      }

      const fluidScale = calculateWobbleScale(_tempVector);
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
      const totalScale = fluidScale * pulseShift * twinkle;

      posAttr.setXYZ(i, _tempVector.x * totalScale, _tempVector.y * totalScale, _tempVector.z * totalScale);
    }
    posAttr.needsUpdate = true;

    if (fil.life >= fil.maxLife) {
      surfaceFilamentGroup.remove(fil.mesh);
      fil.mesh.geometry.dispose();
      fil.mesh.material.dispose();

      const newFilament = initSurfaceFilament();
      surfaceFilamentData[f] = newFilament;
      surfaceFilamentGroup.add(newFilament.mesh);
    }
  }
}

function updateMiniExplosions(deltaTime) {
  for (let s = 0; s < explosionsData.length; s++) {
    const exp = explosionsData[s];
    exp.life += deltaTime;
    
    let lifeRatio = exp.life / exp.maxLife;
    if (lifeRatio > 1.0) lifeRatio = 1.0;
    
    let opacity = 1.0;
    if (lifeRatio > 0.2) {
       opacity = 1.0 - ((lifeRatio - 0.2) / 0.8);
    }
    exp.mesh.material.opacity = opacity;
    
    const posAttr = exp.mesh.geometry.getAttribute('position');
    
    for (let i = 0; i < exp.particleCount; i++) {
      const idx = i * 3;
      exp.rawPositions[idx]     += exp.velocities[idx] * deltaTime;
      exp.rawPositions[idx + 1] += exp.velocities[idx + 1] * deltaTime;
      exp.rawPositions[idx + 2] += exp.velocities[idx + 2] * deltaTime;
      
      const dispX = (Math.sin(i * 123.4) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 567.8) * 50.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 901.2) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;

      _tempVector.set(
        exp.rawPositions[idx] + dispX * easeDisperse,
        exp.rawPositions[idx + 1] + dispY * easeDisperse,
        exp.rawPositions[idx + 2] + dispZ * easeDisperse
      );
      
      const fluidScale = calculateWobbleScale(_tempVector);
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
      const totalScale = fluidScale * pulseShift * twinkle;
      
      posAttr.setXYZ(i, _tempVector.x * totalScale, _tempVector.y * totalScale, _tempVector.z * totalScale);
    }
    
    posAttr.needsUpdate = true;
    
    if (exp.life >= exp.maxLife) {
      explosionsGroup.remove(exp.mesh);
      exp.mesh.geometry.dispose();
      exp.mesh.material.dispose();
      
      const newExp = initMiniExplosion();
      explosionsData[s] = newExp;
      explosionsGroup.add(newExp.mesh);
    }
  }
}

function updateMassiveSolarFlares(deltaTime) {
  const sphereRadius = 6.2;

  for (let m = massiveSolarFlareData.length - 1; m >= 0; m--) {
    const flare = massiveSolarFlareData[m];
    const posAttr = flare.mesh.geometry.getAttribute('position');
    let activeParticles = 0;

    for (let i = 0; i < flare.particleCount; i++) {
      const idx = i * 3;
      const sIdx = flare.streamIndices[i];
      const curve = flare.subCurves[sIdx];

      if (flare.particleStates[i] === 3) {
        posAttr.setXYZ(i, 9999, 9999, 9999);
        continue;
      }

      activeParticles++;
      
      const dispX = (Math.sin(i * 345.6) * 70.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 789.0) * 70.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 234.5) * 70.0) + Math.sin(totalElapsedTime + i) * 15.0;

      if (flare.particleStates[i] === 1) {
        flare.progress[i] += flare.particleSpeeds[i] * deltaTime * 1.5; 

        if (flare.progress[i] < 0) {
          posAttr.setXYZ(i, 9999, 9999, 9999);
          continue;
        }

        if (flare.progress[i] >= 1.0) {
          flare.particleStates[i] = 2;
          flare.sweepLife[i] = 0;
          flare.maxSweepLife[i] = 1.0 + Math.random() * 1.4;

          const landNormal = flare.landP.clone().normalize();
          const curveTangent = curve.getTangent(1.0).normalize();
          let surfTangent = curveTangent.clone().sub(landNormal.clone().multiplyScalar(curveTangent.dot(landNormal))).normalize();
          if (surfTangent.lengthSq() < 0.01) surfTangent = new THREE.Vector3(0, 1, 0);

          const sideTangent = new THREE.Vector3().crossVectors(landNormal, surfTangent).normalize();
          const spreadDir = surfTangent.clone().add(sideTangent.clone().multiplyScalar((Math.random() - 0.5) * 1.2)).normalize();

          flare.sweepDirs[idx]     = spreadDir.x;
          flare.sweepDirs[idx + 1] = spreadDir.y;
          flare.sweepDirs[idx + 2] = spreadDir.z;

          posAttr.setXYZ(i, flare.landP.x, flare.landP.y, flare.landP.z);
          continue;
        }

        const t = Math.min(1.0, Math.max(0, flare.progress[i]));
        const curvePt = curve.getPoint(t);

        _tempVector.set(
          curvePt.x + flare.localOffsets[idx] * Math.sin(t * Math.PI) + dispX * easeDisperse,
          curvePt.y + flare.localOffsets[idx + 1] * Math.sin(t * Math.PI) + dispY * easeDisperse,
          curvePt.z + flare.localOffsets[idx + 2] * Math.sin(t * Math.PI) + dispZ * easeDisperse
        );

        const fluidScale = calculateWobbleScale(_tempVector);
        const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
        const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
        const totalScale = fluidScale * pulseShift * twinkle;

        posAttr.setXYZ(i, _tempVector.x * totalScale, _tempVector.y * totalScale, _tempVector.z * totalScale);

      } else if (flare.particleStates[i] === 2) {
        flare.sweepLife[i] += deltaTime;

        if (flare.sweepLife[i] >= flare.maxSweepLife[i]) {
          flare.particleStates[i] = 3;
          posAttr.setXYZ(i, 9999, 9999, 9999);
          continue;
        }

        let currentP = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        
        currentP.x -= dispX * easeDisperse;
        currentP.y -= dispY * easeDisperse;
        currentP.z -= dispZ * easeDisperse;

        const moveDir = new THREE.Vector3(flare.sweepDirs[idx], flare.sweepDirs[idx + 1], flare.sweepDirs[idx + 2]);
        currentP.addScaledVector(moveDir, (3.5 + Math.random() * 2.0) * deltaTime);
        currentP.normalize().multiplyScalar(sphereRadius + (Math.random() - 0.5) * 0.15);
        
        currentP.x += dispX * easeDisperse;
        currentP.y += dispY * easeDisperse;
        currentP.z += dispZ * easeDisperse;

        const fluidScale = calculateWobbleScale(currentP);
        const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
        const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 10.0 + i)) * easeDisperse * 1.5);
        const totalScale = fluidScale * pulseShift * twinkle;

        posAttr.setXYZ(i, currentP.x * totalScale, currentP.y * totalScale, currentP.z * totalScale);
      }
    }

    posAttr.needsUpdate = true;

    if (activeParticles === 0) {
      massiveFlareGroup.remove(flare.mesh);
      flare.mesh.geometry.dispose();
      flare.mesh.material.dispose();
      massiveSolarFlareData.splice(m, 1);
    }
  }
}

const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

function updateParticleColors(hexValue) {
  baseColor.set(hexValue);
  OVERRIDE_COLOR = baseColor.getHex();
  
  lastAppliedColorHex = -1;
}

const settingsIcon = document.getElementById('settings-icon');
const slidersContainer = document.getElementById('sliders-container');

if (settingsIcon && slidersContainer) {
  settingsIcon.addEventListener('click', () => {
    const currentDisplay = window.getComputedStyle(slidersContainer).display;

    if (currentDisplay === 'none') {
      slidersContainer.style.display = 'flex';
    } else {
      slidersContainer.style.display = 'none';
    }
  });
}

const colorSlider = document.getElementById('gradient-slider');
const colorValLabel = document.getElementById('color-val');

if (colorSlider) {
  colorSlider.addEventListener('input', (event) => {
    const val = parseInt(event.target.value, 10);
    const hexStr = '#' + val.toString(16).padStart(2, '0') + '0000';
    if (colorValLabel) {
      colorValLabel.textContent = hexStr.toUpperCase();
    }
    updateParticleColors(hexStr);
  });
  colorSlider.dispatchEvent(new Event('input'));
}

const camSlider = document.getElementById('cam-slider');
if (camSlider) {
  camSlider.addEventListener('input', (e) => {
    CAMERA_DISTANCE = parseFloat(e.target.value);
  });
}

const bloomSlider = document.getElementById('bloom-slider');
if (bloomSlider) {
  bloomSlider.addEventListener('input', (e) => {
    BLOOM_VAL = parseFloat(e.target.value);
  });
}

const radiusSlider = document.getElementById('radius-slider');
if (radiusSlider) {
  radiusSlider.addEventListener('input', (e) => {
    bloomPass.radius = parseFloat(e.target.value);
  });
}

const thresholdSlider = document.getElementById('threshold-slider');
if (thresholdSlider) {
  thresholdSlider.addEventListener('input', (e) => {
    bloomPass.threshold = parseFloat(e.target.value);
  });
}

const streamsSlider = document.getElementById('streams-slider');
if (streamsSlider) {
  streamsSlider.addEventListener('input', (e) => {
    NUM_INTERNAL_STREAMS = parseInt(e.target.value, 10);
    setInternalStreamCount(NUM_INTERNAL_STREAMS);
  });
}

const filamentsSlider = document.getElementById('filaments-slider');
if (filamentsSlider) {
  filamentsSlider.addEventListener('input', (e) => {
    NUM_SURFACE_FILAMENTS = parseInt(e.target.value, 10);
    setSurfaceFilamentCount(NUM_SURFACE_FILAMENTS);
  });
}

const explosionsSlider = document.getElementById('explosions-slider');
if (explosionsSlider) {
  explosionsSlider.addEventListener('input', (e) => {
    NUM_MINI_EXPLOSIONS = parseInt(e.target.value, 10);
    setMiniExplosionCount(NUM_MINI_EXPLOSIONS);
  });
}

const resetIcon = document.getElementById('reset-icon');
const allSliders = [
  colorSlider, camSlider, bloomSlider, radiusSlider, thresholdSlider,
  streamsSlider, filamentsSlider, explosionsSlider
];

if (resetIcon) {
  resetIcon.addEventListener('click', () => {
    allSliders.forEach((slider) => {
      if (!slider) return;
      slider.value = slider.defaultValue;
      slider.dispatchEvent(new Event('input'));
    });
  });
}
toggleUIButton.addEventListener("click", () => {
    uiHidden = !uiHidden;

    audioControls.style.display = uiHidden ? "none" : "";
    topRightUI.style.display = uiHidden ? "none" : "";
});

const clock = new THREE.Clock();
let totalElapsedTime = 0;
let bassEnergy = 0;

let frames = 0;
let lastFpsTime = performance.now();
const fpsElement = document.getElementById('fps-counter');

function animate() {
  requestAnimationFrame(animate);

  frames++;
  const timeNow = performance.now();
  if (timeNow - lastFpsTime >= 1000) {
    if (fpsElement) {
      fpsElement.textContent = Math.round((frames * 1000) / (timeNow - lastFpsTime)) + ' FPS';
    }
    frames = 0;
    lastFpsTime = timeNow;
  }

  const deltaTime = Math.min(clock.getDelta(), 0.1);
  totalElapsedTime += deltaTime;

  beatIntensity *= Math.exp(-PULSE_DECAY_SPEED * deltaTime);
  beatPulse += (beatIntensity - beatPulse) * Math.min(1.0, deltaTime * 14.0);
  
  bloomPass.strength = BLOOM_VAL + (beatPulse * BLOOM_BRIGHTNESS_SCALE);

  jellyWobbleEnergy *= Math.pow(0.18, deltaTime);
  
  if (currentDisperseFactor < targetDisperseFactor) {
    currentDisperseFactor = Math.min(1.0, currentDisperseFactor + deltaTime * DISPERSE_SPEED);
  } else if (currentDisperseFactor > targetDisperseFactor) {
    currentDisperseFactor = Math.max(0.0, currentDisperseFactor - deltaTime * AGGREGATE_SPEED);
  }
  
  easeDisperse = currentDisperseFactor < 0.5 
    ? 4 * currentDisperseFactor * currentDisperseFactor * currentDisperseFactor 
    : 1 - Math.pow(-2 * currentDisperseFactor + 2, 3) / 2;

  activeColor.lerpColors(baseColor, maxColor, easeDisperse);
  const currentHex = activeColor.getHex();

  if (currentHex !== lastAppliedColorHex) {
    lastAppliedColorHex = currentHex;

    innerCore.material.color.copy(activeColor);
    outerShell.material.color.copy(activeColor);


    const mainRed = activeColor.r;
    const haloBoostFactor = 0.8;
    const haloRed = mainRed + (1.0 - mainRed) * haloBoostFactor;
    outerHalo.material.color.setRGB(haloRed, activeColor.g, activeColor.b);

    internalStreamGroup.children.forEach(mesh => mesh.material.color.copy(activeColor));
    surfaceFilamentGroup.children.forEach(mesh => mesh.material.color.copy(activeColor));
    explosionsGroup.children.forEach(mesh => mesh.material.color.copy(activeColor));
    audioExplosionsGroup.children.forEach(mesh => mesh.material.color.copy(activeColor));
    massiveFlareGroup.children.forEach(mesh => mesh.material.color.copy(activeColor));
  }

  if (!(isDragging && interactionMode === 'move')) {
    camera.position.x = Math.cos(totalElapsedTime * 0.04) * CAMERA_DISTANCE;
    camera.position.z = Math.sin(totalElapsedTime * 0.04) * CAMERA_DISTANCE;
    camera.lookAt(0, 0, 0);
  }

  if (!isDragging || interactionMode !== 'move') {
    const springK = 8.0; 
    const dampC = 2.5; 
    
    let springForce = ballPos.clone().multiplyScalar(-springK);
    let dampingForce = ballVel.clone().multiplyScalar(-dampC);
    let leashAcceleration = springForce.add(dampingForce);
    
    ballVel.add(leashAcceleration.multiplyScalar(deltaTime));
    ballPos.add(ballVel.clone().multiplyScalar(deltaTime));
  }
  
  particleBall.position.copy(ballPos);

  outerHalo.rotation.y += 0.08 * deltaTime;
  outerHalo.rotation.x += 0.03 * deltaTime;

  let currentAcc = ballVel.clone().sub(lastBallVel).divideScalar(deltaTime > 0 ? deltaTime : 0.016);
  lastBallVel.copy(ballVel);

  let accMag = currentAcc.length();
  if (accMag > 0.1) {
    wobbleAxis.lerp(currentAcc.clone().normalize(), deltaTime * 8.0).normalize();
    movementWobbleVel -= accMag * 0.0015; 
  }

  const wobbleK = 100.0;
  const wobbleDamp = 8.0;
  let wobbleAcc = (-wobbleK * movementWobble) - (wobbleDamp * movementWobbleVel);
  movementWobbleVel += wobbleAcc * deltaTime;
  movementWobble += movementWobbleVel * deltaTime;

  if (!isDragging || interactionMode !== 'spin') {
    currentSpinY += (IDLE_SPIN_Y - currentSpinY) * (1.5 * deltaTime);
    currentSpinX += (IDLE_SPIN_X - currentSpinX) * (1.5 * deltaTime);
  }

  particleBall.rotation.y += currentSpinY * deltaTime;
  particleBall.rotation.x += currentSpinX * deltaTime;

  updateParticleLayer(innerCore, deltaTime);
  updateParticleLayer(outerShell, deltaTime);
  updateParticleLayer(outerHalo, deltaTime);
  
  updateInternalStreams(deltaTime);
  updateSurfaceFilaments(deltaTime);
  updateMiniExplosions(deltaTime);
  updateAudioExplosions(deltaTime);
  
  if (easeDisperse < 0.5) {
    updateMassiveSolarFlareSpawning(deltaTime);
  }
  updateMassiveSolarFlares(deltaTime);

  composer.render();
}

animate();

const bassDebugLabel = document.getElementById('bass-debug-label');

let bassBaseline = 0.02;
let trebleBaseline = 0.02;

window.addEventListener('load', startAudioCapture);

async function startAudioCapture() {
  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionStream.getTracks().forEach(track => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const blackholeDevice = devices.find(
      d => d.kind === 'audioinput' && /blackhole/i.test(d.label)
    );

    if (!blackholeDevice) {
      if (bassDebugLabel) {
        bassDebugLabel.textContent = 'BlackHole input not found. Check that it is installed and set as your output.';
      }
      return;
    }

    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: blackholeDevice.deviceId } }
    });

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(audioStream);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);

    let lastProcessTime = performance.now();

    function processAudio() {
      requestAnimationFrame(processAudio);
      analyser.getByteFrequencyData(freqData);

      const now = performance.now();
      const dt = Math.min((now - lastProcessTime) / 1000, 0.1);
      lastProcessTime = now;

      let bassSum = 0;
      for (let i = 0; i < 10; i++) {
        bassSum += freqData[i];
      }
      bassEnergy = bassSum / (10 * 255);

      let trebleSum = 0;
      const trebleStart = 30; // bin index where the hihat/cymbal range starts
      const trebleEnd = 90; // bin index where it ends
      for (let i = trebleStart; i < trebleEnd; i++) {
        trebleSum += freqData[i];
      }
      const trebleEnergy = trebleSum / ((trebleEnd - trebleStart) * 255);

      bassBaseline += (bassEnergy - bassBaseline) * Math.min(1.0, dt * BASELINE_FOLLOW_SPEED);
      trebleBaseline += (trebleEnergy - trebleBaseline) * Math.min(1.0, dt * BASELINE_FOLLOW_SPEED);

      if (explosionCooldown > 0) explosionCooldown -= dt;

      const bassSpike = bassEnergy - bassBaseline;
      const trebleSpike = trebleEnergy - trebleBaseline;
      if (bassSpike > 0.065) {
        triggerRandomParticleBeat(bassSpike, BASS_SENSITIVITY);
      }
      const EXPLOSION_ENERGY_THRESHOLD = 0.6; // raw bass loudness (0-1) needed to trigger an explosion, check the debug label's "Bass:" value to tune this
      if (bassEnergy > EXPLOSION_ENERGY_THRESHOLD && explosionCooldown <= 0) {
        const bigExp = initAudioExplosion();
        audioExplosionsData.push(bigExp);
        audioExplosionsGroup.add(bigExp.mesh);

        explosionCooldown = 0.25;
      }

      if (trebleSpike > 0.1) {
        triggerRandomParticleBeat(trebleSpike, TREBLE_SENSITIVITY);
      }

      if (bassDebugLabel) {
        bassDebugLabel.textContent = `Bass: ${bassEnergy.toFixed(2)} | Baseline: ${bassBaseline.toFixed(2)}\nTreble: ${trebleEnergy.toFixed(2)} | Baseline: ${trebleBaseline.toFixed(2)}\nBeat Intensity: ${beatIntensity.toFixed(2)}`;
      }
    }
    processAudio();
  } catch (err) {
    console.error('Audio capture failed:', err);
    if (bassDebugLabel) {
      bassDebugLabel.textContent = 'Audio capture failed, check console for details';
    }
  }
}