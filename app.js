// Global default color overridden to #250101 (RGB: 37, 1, 1)
//HARDCODED VALUE ; OVERRIDE_COLOR ; default particle color used until the color slider changes it
let OVERRIDE_COLOR = 0x250101;
// For dispersion/aggregate color transition
//HARDCODED VALUE ; baseColor ; starting THREE.Color used as the low end of the dispersion color blend
const baseColor = new THREE.Color(0x250101); // Your default load-in color
//HARDCODED VALUE ; maxColor ; bright red THREE.Color used as the high end of the dispersion color blend
const maxColor = new THREE.Color(0xff0000);  // Bright red when dispersed

const activeColor = new THREE.Color();
//HARDCODED VALUE ; lastAppliedColorHex ; sentinel of -1 forces the very first frame to apply a color since no real hex value equals -1
let lastAppliedColorHex = -1;

//UI
const toggleUIButton = document.getElementById("toggle-ui-button");
const audioControls = document.getElementById("audio-controls");
const topRightUI = document.getElementById("top-right-ui");
let uiHidden = false;

const scene = new THREE.Scene();
//HARDCODED VALUE ; scene.background ; pure black background behind the particle ball
scene.background = new THREE.Color(0x000000);

//HARDCODED VALUE ; CAMERA_DISTANCE ; distance the camera orbits from the center of the scene
let CAMERA_DISTANCE = 30;

//HARDCODED VALUE ; camera ; 60 degree field of view with a near clip of 0.1 and a far clip of 1000, these control how wide and how deep the camera can see
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, CAMERA_DISTANCE);

//HARDCODED VALUE ; antialias ; turned off for performance, enable for smoother edges at a higher GPU cost
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
//HARDCODED VALUE ; pixel ratio cap ; limits rendering to 1.5x device pixel ratio to save performance on high density screens
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
//HARDCODED VALUE ; toneMappingExposure ; overall brightness multiplier applied after tone mapping
renderer.toneMappingExposure = 1.1;

const container = document.getElementById('scene-container') || document.body;
container.appendChild(renderer.domElement);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

//HARDCODED VALUE ; bloomPass ; strength 1.8 controls glow intensity, radius 0.45 controls how far the glow spreads, and threshold 0.05 controls how bright a pixel must be before it blooms
let BLOOM_VAL = 1.8; //1.8 default
//HARDCODED VALUE ; PULSE_EXPANSION_SCALE ; multiplies every beat driven expansion effect below (the main sphere and all filament, stream, and flare layers), change this one value to scale the whole audio expansion effect up or down everywhere at once
let BLOOM_BRIGHTNESS_SCALE = 1.8;
let PULSE_EXPANSION_SCALE = 0.45;
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM_VAL,  //Bloom strength
  0.45, //Radius
  0.005  //Threshold
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

//Glow texture
function createGlowTexture() {
  //HARDCODED VALUE ; size ; pixel resolution of the generated glow sprite texture used by every particle material
  const size = 128;
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


let beatIntensity = 0;
let beatPulse = 0;

//HARDCODED VALUE ; BASS_SENSITIVITY ; raise to make kicks/bass punch the visuals harder
const BASS_SENSITIVITY = 15.0;
//HARDCODED VALUE ; TREBLE_SENSITIVITY ; raise to make hihats/cymbals punch the visuals harder
const TREBLE_SENSITIVITY = 11.0;
//HARDCODED VALUE ; BASELINE_FOLLOW_SPEED ; how fast the adaptive "quiet floor" tracks the song's current loudness, lower makes hits stand out more against it
const BASELINE_FOLLOW_SPEED = 1.5;
//HARDCODED VALUE ; PULSE_DECAY_SPEED ; how quickly the pulse falls back to rest each frame, raise for a snappier decay
const PULSE_DECAY_SPEED = 15.0;

function triggerRandomParticleBeat(spikeIntensity, sensitivity) {
  //HARDCODED VALUE ; beat cap ; 1.8 is the max beat intensity allowed no matter how hard the hits stack up
  beatIntensity = Math.min(1.8, beatIntensity + spikeIntensity * sensitivity);
}

//Main Sphere
function createInnerCore() {
  //HARDCODED VALUE ; count ; number of particles that make up the dense inner core layer
  const count = 5000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    //HARDCODED VALUE ; r ; inner core radius range, particles land between 0.4 and 0.4+2.8 units from center
    const r = 0.4 + Math.random() * 2.8;
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  //HARDCODED VALUE ; material ; point size 0.15 and opacity 0.75 control how big and how visible each inner core particle looks
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.15, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData.basePositions = positions.slice();
  points.userData.velocity = new Float32Array(count * 3);
  //HARDCODED VALUE ; reactivity ; how strongly this layer reacts to the audio beat pulse, higher means more movement
  points.userData.reactivity = 1.3;
  return points;
}

function createThickOuterShell() {
  //HARDCODED VALUE ; count ; number of particles that make up the mid shell layer
  const count = 10000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    //HARDCODED VALUE ; r ; shell radius range, particles land between 4.5 and 4.5+1.7 units from center
    const r = 4.5 + (Math.random() * 1.7);
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  //HARDCODED VALUE ; material ; point size 0.11 and opacity 0.75 control how big and how visible each shell particle looks
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.11, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData.basePositions = positions.slice();
  points.userData.velocity = new Float32Array(count * 3);
  //HARDCODED VALUE ; reactivity ; how strongly this layer reacts to the audio beat pulse
  points.userData.reactivity = 1.3;
  return points;
}

function createOuterHaloCloud() {
  //HARDCODED VALUE ; count ; number of particles that make up the faint outer halo cloud
  const count = 2000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    //HARDCODED VALUE ; r ; halo radius range, particles land between 5.5 and 5.5+30 units from center, this is what makes the halo spread out so far
    const r = 5.5 + (Math.random() * 30.0);
    const pt = dir.multiplyScalar(r);
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  //HARDCODED VALUE ; material ; point size 0.2 and opacity 0.25 make halo particles bigger but much more transparent than the core
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
  //HARDCODED VALUE ; reactivity ; how strongly this layer reacts to the audio beat pulse, kept low so the halo stays calm
  points.userData.reactivity = 0.15;

  // Per particle random wander: each halo particle gets its own random 3D
  // direction and its own random speed, so they drift independently
  // instead of all moving together as one rigid rotating cloud.
  const driftAxis = new Float32Array(count * 3);
  const driftSpeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const axis = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    driftAxis[i * 3] = axis.x;
    driftAxis[i * 3 + 1] = axis.y;
    driftAxis[i * 3 + 2] = axis.z;
    //HARDCODED VALUE ; driftSpeed range ; each particle wanders at its own random speed between 0.1 and 0.5
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
// ADDED BACK TO SCENE for independent rotation
scene.add(outerHalo);

//STREAM SYSTEM
//HARDCODED VALUE ; NUM_INTERNAL_STREAMS ; how many internal stream ribbons exist at once inside the ball
let NUM_INTERNAL_STREAMS = 60; //default 30
const internalStreamGroup = new THREE.Group();
particleBall.add(internalStreamGroup);
const internalStreamData = [];

function initInternalStream() {
  //HARDCODED VALUE ; particleCount ; each stream gets between 400 and 700 particles
  const particleCount = 400 + Math.floor(Math.random() * 300);
  //HARDCODED VALUE ; p1/p2 anchor distance ; stream endpoints are placed 6 units from center
  const p1 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(6.0);
  const p2 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(6.0);
  //HARDCODED VALUE ; mid anchor distance ; the curve control point sits between 1.5 and 1.5+2.5 units from center, pulling the stream toward the middle
  const mid = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(1.5 + Math.random() * 2.5);
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

  const positions = new Float32Array(particleCount * 3);
  const progressOffsets = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const localOffsets = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    progressOffsets[i] = t;
    //HARDCODED VALUE ; speeds[i] ; how fast each particle travels along the stream curve, between 0.12 and 0.34
    speeds[i] = 0.12 + Math.random() * 0.22;

    const tangent = curve.getTangent(t);
    const up = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();

    //HARDCODED VALUE ; width ; how thick the stream ribbon is around its center curve
    const width = 0.45;
    const sideOffset = (Math.random() - 0.5) * width;
    const normOffset = (Math.random() - 0.5) * width;

    localOffsets[i * 3]     = side.x * sideOffset + normal.x * normOffset;
    localOffsets[i * 3 + 1] = side.y * sideOffset + normal.y * normOffset;
    localOffsets[i * 3 + 2] = side.z * sideOffset + normal.z * normOffset;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  //HARDCODED VALUE ; material ; point size 0.12 and opacity 0.65 for the internal stream particles
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.12, map: glowTexture, transparent: true,
    opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);
  //HARDCODED VALUE ; maxLife ; each stream lives between 3 and 7 seconds before being recycled
  //HARDCODED VALUE ; driftSpeed ; random slow rotation speed applied to the whole stream mesh, between -0.4 and 0.4
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

// Lets the streams slider add or remove streams while the app is running,
// instead of only being read once at startup.
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

//Surface Filaments
//HARDCODED VALUE ; NUM_SURFACE_FILAMENTS ; how many filament ribbons exist on the surface at once
let NUM_SURFACE_FILAMENTS = 100;
const surfaceFilamentGroup = new THREE.Group();
particleBall.add(surfaceFilamentGroup);
const surfaceFilamentData = [];

function initSurfaceFilament() {
  //HARDCODED VALUE ; particleCount ; each filament gets between 600 and 1000 particles
  const particleCount = 600 + Math.floor(Math.random() * 400);
  //HARDCODED VALUE ; sphereRadius ; radius of the sphere surface the filament arcs across
  const sphereRadius = 6.2;

  const p1 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);
  const p2 = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);
  //HARDCODED VALUE ; mid arc height ; how far the filament's midpoint bulges outward past the sphere surface, between 1.2 and 2.2 extra units
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(sphereRadius + 1.2 + Math.random() * 1.0);
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

  const positions = new Float32Array(particleCount * 3);
  const progressOffsets = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const localOffsets = new Float32Array(particleCount * 3);
  //HARDCODED VALUE ; maxThickness ; how thick the filament can get at its widest point, between 0.8 and 1.2
  const maxThickness = 0.8 + Math.random() * 0.4;

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    progressOffsets[i] = t;
    //HARDCODED VALUE ; speeds[i] ; how fast each particle travels along the filament curve, between 0.08 and 0.26
    speeds[i] = 0.08 + Math.random() * 0.18;

    const tangent = curve.getTangent(t);
    const up = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();

    const width = Math.sin(t * Math.PI) * maxThickness;
    const sideOffset = (Math.random() - 0.5) * width;
    //HARDCODED VALUE ; normal offset scale ; the normal direction is squeezed to 70 percent of the side width so filaments look flatter than they are wide
    const normOffset = (Math.random() - 0.5) * (width * 0.7);

    localOffsets[i * 3]     = side.x * sideOffset + normal.x * normOffset;
    localOffsets[i * 3 + 1] = side.y * sideOffset + normal.y * normOffset;
    localOffsets[i * 3 + 2] = side.z * sideOffset + normal.z * normOffset;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  //HARDCODED VALUE ; material ; point size 0.10 and opacity 0.75 for surface filament particles
  const material = new THREE.PointsMaterial({
    color: OVERRIDE_COLOR, size: 0.10, map: glowTexture, transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });

  const mesh = new THREE.Points(geometry, material);
  //HARDCODED VALUE ; maxLife ; each filament lives between 3 and 7 seconds before being recycled
  return { mesh, curve, particleCount, progressOffsets, speeds, localOffsets, life: 0, maxLife: 3 + Math.random() * 4 };
}

for (let f = 0; f < NUM_SURFACE_FILAMENTS; f++) {
  const fil = initSurfaceFilament();
  fil.life = Math.random() * fil.maxLife;
  surfaceFilamentData.push(fil);
  surfaceFilamentGroup.add(fil.mesh);
}

// Lets the filaments slider add or remove filaments while the app is
// running, instead of only being read once at startup.
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

//CME's
//HARDCODED VALUE ; NUM_MINI_EXPLOSIONS ; how many mini explosion bursts exist at once
let NUM_MINI_EXPLOSIONS = 40; //20 default
const explosionsGroup = new THREE.Group();
particleBall.add(explosionsGroup);
const explosionsData = [];

function initMiniExplosion() {
  //HARDCODED VALUE ; particleCount ; each explosion gets between 200 and 300 particles
  const particleCount = 200 + Math.floor(Math.random() * 100);
  //HARDCODED VALUE ; sphereRadius ; radius of the sphere surface where explosions originate
  const sphereRadius = 6.2;
  const centerP = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);

  const rawPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  //HARDCODED VALUE ; baseSpeed ; base outward speed of an explosion's particles, drawn between 0.1 and 4.0
  const baseSpeed = Math.random() * (4 - 0.1) + 0.1;

  for (let i = 0; i < particleCount; i++) {
    rawPositions[i * 3]     = centerP.x;
    rawPositions[i * 3 + 1] = centerP.y;
    rawPositions[i * 3 + 2] = centerP.z;

    let dir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
    if (dir.dot(centerP) < 0) {
      dir.negate();
    }

    //HARDCODED VALUE ; speed scaling ; each particle gets between 20 percent and 100 percent of the base speed so the burst looks uneven
    const speed = baseSpeed * (0.2 + Math.random() * 0.8);
    velocities[i * 3]     = dir.x * speed;
    velocities[i * 3 + 1] = dir.y * speed;
    velocities[i * 3 + 2] = dir.z * speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));

  //HARDCODED VALUE ; material ; point size 0.10 and full opacity 1.0 so explosions read as bright flashes
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
    //HARDCODED VALUE ; maxLife ; each explosion lives between 0.5 and 2.0 seconds before being recycled
    maxLife: 0.5 + Math.random() * 1.5
  };
}

for (let e = 0; e < NUM_MINI_EXPLOSIONS; e++) {
  const exp = initMiniExplosion();
  exp.life = Math.random() * exp.maxLife;
  explosionsData.push(exp);
  explosionsGroup.add(exp.mesh);
}

// Lets the explosions slider add or remove explosions while the app is
// running, instead of only being read once at startup.
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

//AUDIO EXPLOSIONS - separate from the mini explosions above, these only spawn on big beat hits
let explosionCooldown = 0;
const audioExplosionsGroup = new THREE.Group();
particleBall.add(audioExplosionsGroup);
const audioExplosionsData = [];

function initAudioExplosion() {
  //HARDCODED VALUE ; particleCount ; each beat burst gets between 400 and 800 particles
  const particleCount = 400 + Math.floor(Math.random() * 400);
  //HARDCODED VALUE ; sphereRadius ; radius of the sphere surface where the burst originates
  const sphereRadius = 6.2;
  const centerP = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize().multiplyScalar(sphereRadius);

  const rawPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  //HARDCODED VALUE ; baseSpeed ; base outward speed of a beat burst's particles, drawn between 2 and 6
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
    //HARDCODED VALUE ; maxLife ; each beat burst lives between 1.5 and 3.0 seconds before fading out
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

//Massive Flares
//HARDCODED VALUE ; MIN_MASSIVE_FLARE_HEIGHT ; shortest a solar flare arc can reach above the surface
const MIN_MASSIVE_FLARE_HEIGHT = 8.0;
//HARDCODED VALUE ; MAX_MASSIVE_FLARE_HEIGHT ; tallest a solar flare arc can reach above the surface
const MAX_MASSIVE_FLARE_HEIGHT = 12.0;
const massiveFlareGroup = new THREE.Group();
particleBall.add(massiveFlareGroup);

const massiveSolarFlareData = [];
let massiveFlareTimer = 0;

function initMassiveSolarFlare() {
  //HARDCODED VALUE ; sphereRadius ; radius of the sphere surface the flare launches from and lands on
  const sphereRadius = 6.2;
  //HARDCODED VALUE ; numSubStreams ; how many braided sub-strands make up one flare, between 10 and 13
  const numSubStreams = 10 + Math.floor(Math.random() * 4);
  //HARDCODED VALUE ; particlesPerStream ; how many particles ride along each sub-strand, between 300 and 550
  const particlesPerStream = 300 + Math.floor(Math.random() * 250);
  const totalParticles = numSubStreams * particlesPerStream;

  const coreDir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
  //HARDCODED VALUE ; originP distance ; how far above the surface the flare's launch point sits, between 1.2 and 2.7 units
  const originP = coreDir.clone().multiplyScalar(1.2 + Math.random() * 1.5);

  let endDir = new THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian()).normalize();
  //HARDCODED VALUE ; landing angle threshold ; if the landing point is on nearly the same side as the launch point, flip it to the opposite side so the arc actually travels somewhere
  if (coreDir.dot(endDir) > 0.4) endDir.negate();
  const landP = endDir.clone().multiplyScalar(sphereRadius);

  const flareHeight = MIN_MASSIVE_FLARE_HEIGHT + Math.random() * (MAX_MASSIVE_FLARE_HEIGHT - MIN_MASSIVE_FLARE_HEIGHT);
  const apexDir = new THREE.Vector3().addVectors(coreDir, endDir).normalize();
  if (apexDir.lengthSq() < 0.1) apexDir.copy(new THREE.Vector3(0, 1, 0));
  const apexMid = apexDir.multiplyScalar(sphereRadius + flareHeight);

  const subCurves = [];
  for (let c = 0; c < numSubStreams; c++) {
    const offsetAngle = (c / numSubStreams) * Math.PI * 2;
    //HARDCODED VALUE ; strandRadius ; how far each braided sub-strand drifts from the main flare curve, between 0.6 and 1.1
    const strandRadius = 0.6 + Math.random() * 0.5;
    const midOffset = new THREE.Vector3(
      Math.cos(offsetAngle) * strandRadius,
      Math.sin(offsetAngle) * strandRadius,
      (Math.random() - 0.5) * strandRadius
    );

    //HARDCODED VALUE ; control point blend ; places the first bezier control point 40 percent of the way toward the apex, shaping the curve
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
      //HARDCODED VALUE ; particleSpeeds ; how fast each particle travels along the flare arc, between 0.10 and 0.28
      particleSpeeds[pIdx] = 0.10 + Math.random() * 0.18;
      particleStates[pIdx] = 1;

      //HARDCODED VALUE ; localOffsets jitter ; small random jitter added to each particle position for a less uniform look, between -0.175 and 0.175
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

  //HARDCODED VALUE ; material ; point size 0.12 and opacity 0.60 for solar flare particles
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

//HARDCODED VALUE ; initial flare count ; number of solar flares spawned immediately when the scene loads
for (let i = 0; i < 4; i++) {
  spawnMassiveSolarFlare();
}

function updateMassiveSolarFlareSpawning(deltaTime) {
  massiveFlareTimer += deltaTime;
  //HARDCODED VALUE ; spawn interval ; checks whether to spawn a new flare every 1.5 seconds
  if (massiveFlareTimer >= 1) {
    massiveFlareTimer -= 1;
    //HARDCODED VALUE ; spawn chance ; 50 percent chance a new flare actually spawns on each interval tick
    if (Math.random() < 0.8) {
      spawnMassiveSolarFlare();
    }
  }
}

//Disperse/Aggregate
let isDispersed = false;
let targetDisperseFactor = 0;
let currentDisperseFactor = 0;
let easeDisperse = 0;

//HARDCODED VALUE ; DISPERSE_SPEED ; how quickly particles fly outward when dispersion is triggered
const DISPERSE_SPEED = 0.5;
//HARDCODED VALUE ; AGGREGATE_SPEED ; how quickly particles pull back together when aggregation is triggered, slower than dispersing
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

//Drag and Move
//HARDCODED VALUE ; INITIAL_SPIN_Y ; the fast spin speed the ball has right when the page loads
const INITIAL_SPIN_Y = 5.0;
//HARDCODED VALUE ; IDLE_SPIN_Y ; the slow resting spin speed the ball settles into around the Y axis when nothing is dragging it
const IDLE_SPIN_Y    = 0.3;
//HARDCODED VALUE ; IDLE_SPIN_X ; the resting spin speed around the X axis, zero means it never tips forward or back on its own
const IDLE_SPIN_X    = 0;

let interactionMode = 'spin'; // 'spin' or 'move'
const modeToggleBtn = document.getElementById('mode-toggle-btn');
if (modeToggleBtn) {
  modeToggleBtn.addEventListener('click', () => {
    if (interactionMode === 'spin') {
      interactionMode = 'move';
      modeToggleBtn.textContent = 'Mode: Move';
      if (disperseBtn) disperseBtn.style.display = 'none';

      //Force aggregate if user toggles to move mode while dispersed
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
//HARDCODED VALUE ; DRAG_SPEED_THRESHOLD ; how fast a drag flick must be before it triggers the jelly wobble effect on release
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
//HARDCODED VALUE ; raycaster point threshold ; how close the mouse ray needs to be to a particle point to count as a hit, bigger makes points easier to grab
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
      //HARDCODED VALUE ; grab radius ; in move mode, a click must land within 10 units of the ball's center to start dragging it
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

    //HARDCODED VALUE ; spin clamp and sensitivity ; mouse drag distance is scaled by 0.05 into spin speed, then clamped between -2 and 2 so spinning can't run away
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
      //HARDCODED VALUE ; maxDist ; how far the ball can be dragged from center before the elastic stretch resistance kicks in
      let maxDist = 10.0;
      if (dist > maxDist) {
        let excess = dist - maxDist;
        //HARDCODED VALUE ; stretch formula ; controls how the ball resists being dragged past maxDist, 0.4 softens the log curve and 2.5 scales how much extra stretch is visible
        let stretched = maxDist + Math.log(1 + excess * 0.4) * 2.5;
        targetPos.normalize().multiplyScalar(stretched);
      }

      //HARDCODED VALUE ; velocity multiplier ; converts the drag distance moved this frame into ball velocity, higher feels snappier
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
      //HARDCODED VALUE ; wobble energy formula ; converts how far past the drag threshold the flick was into wobble energy, 0.02 is the scale and 0.3 is a minimum kick even for a small flick, capped at 1.0
      jellyWobbleEnergy = Math.min(1.0, (maxDragSpeed - DRAG_SPEED_THRESHOLD) * 0.02 + 0.3);
    }
  }
}

window.addEventListener('mouseup', releaseDrag);
window.addEventListener('mouseleave', releaseDrag);

//Reusable Animation and logic
const _tempVector = new THREE.Vector3();
const _normPos = new THREE.Vector3();

function calculateWobbleScale(posVector) {
  if (!posVector || posVector.lengthSq() < 0.0001) return 1.0;
  _normPos.copy(posVector).normalize();

  let scale = 1.0;

  if (jellyWobbleEnergy > 0.001) {
    const dragDot = Math.max(0, _normPos.dot(jellyImpactPoint));
    //HARDCODED VALUE ; fluidWobble formula ; 5.0 sets the wobble oscillation speed, 10.8 spreads the wave across the ball based on distance from the impact point, 1.35 scales overall energy, 1.4 shapes the falloff curve and 0.26 caps how big the visual wobble gets
    const fluidWobble = Math.sin(totalElapsedTime * 5.0 + dragDot * 10.8) *
                        (jellyWobbleEnergy * 1.35) * Math.pow(dragDot, 1.4) * 0.26;
    if (!isNaN(fluidWobble)) scale += fluidWobble;
  }

  if (Math.abs(movementWobble) > 0.001) {
    const moveDot = _normPos.dot(wobbleAxis);
    //HARDCODED VALUE ; moveFluid formula ; 0.333 recenters the squared dot product so the wobble is symmetric front to back, 0.5 scales how visible the movement wobble is
    const moveFluid = movementWobble * (moveDot * moveDot - 0.333) * 0.5;
    if (!isNaN(moveFluid)) scale += moveFluid;
  }

  //HARDCODED VALUE ; minimum scale ; particles are never allowed to shrink below 15 percent of their base size
  return Math.max(0.15, scale);
}

function updateParticleLayer(layer, deltaTime) {
  const posAttr = layer.geometry.getAttribute('position');
  const base = layer.userData.basePositions;
  const vel = layer.userData.velocity;
  const count = posAttr.count;
  const layerReactivity = layer.userData.reactivity || 1.0;

  //HARDCODED VALUE ; stiffness ; spring strength pulling particles back toward their target position each frame
  const stiffness = 4.5;
  //HARDCODED VALUE ; damping ; how much particle velocity is absorbed each frame, prevents the spring from oscillating forever
  const damping = 1.5;

  const driftAxis = layer.userData.driftAxis;
  const driftSpeed = layer.userData.driftSpeed;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;

    //HARDCODED VALUE ; scatter magic numbers ; the large numbers like 1352.34 are just unique seeds per particle index so each one scatters differently, while 25.0 sets how far particles fly when dispersed and 10.0 adds a slower secondary drift
    const dispX = (Math.sin(i * 1352.34) * 25.0) + Math.sin(totalElapsedTime * 0.5 + i) * 10.0;
    const dispY = (Math.cos(i * 4132.21) * 25.0) + Math.cos(totalElapsedTime * 0.6 + i) * 10.0;
    const dispZ = (Math.sin(i * 7265.54) * 25.0) + Math.sin(totalElapsedTime * 0.7 + i) * 10.0;

    let effectiveBaseX = base[idx] + dispX * easeDisperse;
    let effectiveBaseY = base[idx + 1] + dispY * easeDisperse;
    let effectiveBaseZ = base[idx + 2] + dispZ * easeDisperse;

    // Independent per particle wander, only present on layers that have
    // driftAxis/driftSpeed set (currently just the halo). Each particle
    // oscillates back and forth along its own random axis at its own
    // random speed, so they don't all move together.
    if (driftAxis) {
      //HARDCODED VALUE ; drift amount ; how far a halo particle wanders from its base position, 4.0 sets the maximum wander distance
      const driftAmount = Math.sin(totalElapsedTime * driftSpeed[i] + i) * 4.0;
      effectiveBaseX += driftAxis[idx] * driftAmount;
      effectiveBaseY += driftAxis[idx + 1] * driftAmount;
      effectiveBaseZ += driftAxis[idx + 2] * driftAmount;
    }

    _tempVector.set(effectiveBaseX, effectiveBaseY, effectiveBaseZ);

    const fluidScale = calculateWobbleScale(_tempVector);
    //HARDCODED VALUE ; smoothPulse scale ; how much the audio beat pulse expands this layer, 0.02 times PULSE_EXPANSION_SCALE sets the overall pulse strength
    const smoothPulse = beatPulse * 0.02 * PULSE_EXPANSION_SCALE * layerReactivity;

    //HARDCODED VALUE ; twinkle formula ; 8.0 sets how fast particles twinkle and 1.5 sets how strong the twinkle gets at full dispersion
    const twinkle = 1.0 + (Math.abs(Math.sin(totalElapsedTime * 8.0 + i)) * easeDisperse * 1.5);
    const totalScale = (fluidScale + smoothPulse) * twinkle;

    //HARDCODED VALUE ; scale multiplier ; 0.22 controls how much the combined wobble and pulse actually pushes particles outward from their base position
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
    //HARDCODED VALUE ; fade timing ; the last 1.0 second of life fades out, and the first 0.8 seconds fades in
    if (stream.life > stream.maxLife - 1.0) {
      opacityAlpha = Math.max(0, (stream.maxLife - stream.life));
    } else if (stream.life < 0.8) {
      opacityAlpha = stream.life / 0.8;
    }
    //HARDCODED VALUE ; base opacity ; internal streams max out at 0.65 opacity even when fully faded in
    stream.mesh.material.opacity = 0.65 * opacityAlpha;

    stream.mesh.rotation.x += stream.driftAxis.x * stream.driftSpeed * deltaTime;
    stream.mesh.rotation.y += stream.driftAxis.y * stream.driftSpeed * deltaTime;
    stream.mesh.rotation.z += stream.driftAxis.z * stream.driftSpeed * deltaTime;

    const posAttr = stream.mesh.geometry.getAttribute('position');

    for (let i = 0; i < stream.particleCount; i++) {
      //HARDCODED VALUE ; progress speed scale ; slows the per-particle travel speed down to 25 percent so streams flow gently along the curve
      stream.progressOffsets[i] = (stream.progressOffsets[i] + stream.speeds[i] * deltaTime * 0.25) % 1.0;
      const t = stream.progressOffsets[i];
      const pt = stream.curve.getPoint(t);
      const idx = i * 3;

      //HARDCODED VALUE ; scatter magic numbers ; unique per-particle seeds like 135.2 combined with a 20.0 spread and 10.0 secondary drift, controls how far internal stream particles scatter when dispersed
      const dispX = (Math.sin(i * 135.2) * 20.0) + Math.sin(totalElapsedTime + i) * 10.0;
      const dispY = (Math.cos(i * 413.2) * 20.0) + Math.cos(totalElapsedTime + i) * 10.0;
      const dispZ = (Math.sin(i * 726.5) * 20.0) + Math.sin(totalElapsedTime + i) * 10.0;

      _tempVector.set(
        pt.x + stream.localOffsets[idx] + dispX * easeDisperse,
        pt.y + stream.localOffsets[idx + 1] + dispY * easeDisperse,
        pt.z + stream.localOffsets[idx + 2] + dispZ * easeDisperse
      );

      const fluidScale = calculateWobbleScale(_tempVector);
      //HARDCODED VALUE ; pulseShift ; how much the audio beat pulse swells this stream, 0.27 times PULSE_EXPANSION_SCALE sets the strength
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      //HARDCODED VALUE ; twinkle formula ; 10.0 sets twinkle speed and 1.5 sets how strong it gets at full dispersion
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
  //HARDCODED VALUE ; sphereRadius ; radius filaments collapse back onto when they die out while the ball is aggregated
  const sphereRadius = 6.2;
  for (let f = 0; f < surfaceFilamentData.length; f++) {
    const fil = surfaceFilamentData[f];
    fil.life += deltaTime;
    const posAttr = fil.mesh.geometry.getAttribute('position');
    //HARDCODED VALUE ; dying window ; the last 1.2 seconds of a filament's life are treated as its dying fade
    const isDying = fil.life > (fil.maxLife - 1.2);
    const dieProgress = isDying ? (fil.life - (fil.maxLife - 1.2)) / 1.2 : 0;

    for (let i = 0; i < fil.particleCount; i++) {
      //HARDCODED VALUE ; progress speed scale ; slows travel speed to 25 percent for a gentle flow along the filament
      fil.progressOffsets[i] = (fil.progressOffsets[i] + fil.speeds[i] * deltaTime * 0.25) % 1.0;
      const t = fil.progressOffsets[i];
      const pt = fil.curve.getPoint(t);
      const idx = i * 3;

      //HARDCODED VALUE ; scatter magic numbers ; unique per-particle seeds combined with a 60.0 spread and 15.0 secondary drift, controls how far surface filament particles scatter when dispersed
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
        //HARDCODED VALUE ; collapse speed ; how quickly a dying filament snaps back onto the sphere surface, 1.5 makes it finish before the fade is fully done
        _tempVector.lerp(shellTarget, Math.min(1.0, dieProgress * 1.5));
      }

      const fluidScale = calculateWobbleScale(_tempVector);
      //HARDCODED VALUE ; pulseShift ; how much the audio beat pulse swells this filament, 0.27 times PULSE_EXPANSION_SCALE sets the strength
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      //HARDCODED VALUE ; twinkle formula ; 10.0 sets twinkle speed and 1.5 sets how strong it gets at full dispersion
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
    //HARDCODED VALUE ; fade start ; explosions stay fully opaque for the first 20 percent of their life, then fade out over the remaining 80 percent
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

      //HARDCODED VALUE ; scatter magic numbers ; unique per-particle seeds combined with a 50.0 spread and 15.0 secondary drift, controls how far explosion particles scatter when dispersed
      const dispX = (Math.sin(i * 123.4) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 567.8) * 50.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 901.2) * 50.0) + Math.sin(totalElapsedTime + i) * 15.0;

      _tempVector.set(
        exp.rawPositions[idx] + dispX * easeDisperse,
        exp.rawPositions[idx + 1] + dispY * easeDisperse,
        exp.rawPositions[idx + 2] + dispZ * easeDisperse
      );

      const fluidScale = calculateWobbleScale(_tempVector);
      //HARDCODED VALUE ; pulseShift ; how much the audio beat pulse swells the explosion, 0.27 times PULSE_EXPANSION_SCALE sets the strength
      const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
      //HARDCODED VALUE ; twinkle formula ; 10.0 sets twinkle speed and 1.5 sets how strong it gets at full dispersion
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
  //HARDCODED VALUE ; sphereRadius ; radius flares sweep across once they land on the surface
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

      //HARDCODED VALUE ; scatter magic numbers ; unique per-particle seeds combined with a 70.0 spread and 15.0 secondary drift, controls how far flare particles scatter when dispersed
      const dispX = (Math.sin(i * 345.6) * 70.0) + Math.sin(totalElapsedTime + i) * 15.0;
      const dispY = (Math.cos(i * 789.0) * 70.0) + Math.cos(totalElapsedTime + i) * 15.0;
      const dispZ = (Math.sin(i * 234.5) * 70.0) + Math.sin(totalElapsedTime + i) * 15.0;

      if (flare.particleStates[i] === 1) {
        //HARDCODED VALUE ; travel speed multiplier ; particles move 1.5 times faster than their base particleSpeeds value while flying along the arc
        flare.progress[i] += flare.particleSpeeds[i] * deltaTime * 1.5;

        if (flare.progress[i] < 0) {
          posAttr.setXYZ(i, 9999, 9999, 9999);
          continue;
        }

        if (flare.progress[i] >= 1.0) {
          flare.particleStates[i] = 2;
          flare.sweepLife[i] = 0;
          //HARDCODED VALUE ; maxSweepLife ; how long a particle sweeps across the surface after landing, between 1.0 and 2.4 seconds
          flare.maxSweepLife[i] = 1.0 + Math.random() * 1.4;

          const landNormal = flare.landP.clone().normalize();
          const curveTangent = curve.getTangent(1.0).normalize();
          let surfTangent = curveTangent.clone().sub(landNormal.clone().multiplyScalar(curveTangent.dot(landNormal))).normalize();
          if (surfTangent.lengthSq() < 0.01) surfTangent = new THREE.Vector3(0, 1, 0);

          const sideTangent = new THREE.Vector3().crossVectors(landNormal, surfTangent).normalize();
          //HARDCODED VALUE ; spread direction blend ; mixes in up to half a unit of sideways drift so the sweep direction is not perfectly straight
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
        //HARDCODED VALUE ; pulseShift ; how much the audio beat pulse swells the flare, 0.27 times PULSE_EXPANSION_SCALE sets the strength
        const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
        //HARDCODED VALUE ; twinkle formula ; 10.0 sets twinkle speed and 1.5 sets how strong it gets at full dispersion
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
        //HARDCODED VALUE ; sweep speed ; how fast a landed particle slides across the surface, between 3.5 and 5.5
        currentP.addScaledVector(moveDir, (3.5 + Math.random() * 2.0) * deltaTime);
        //HARDCODED VALUE ; surface jitter ; keeps swept particles glued to the sphere surface with a tiny random wobble of plus or minus 0.075
        currentP.normalize().multiplyScalar(sphereRadius + (Math.random() - 0.5) * 0.15);

        //Addback scatter
        currentP.x += dispX * easeDisperse;
        currentP.y += dispY * easeDisperse;
        currentP.z += dispZ * easeDisperse;

        const fluidScale = calculateWobbleScale(currentP);
        //HARDCODED VALUE ; pulseShift ; how much the audio beat pulse swells the flare, 0.27 times PULSE_EXPANSION_SCALE sets the strength
        const pulseShift = 1.0 + (beatPulse * 0.27 * PULSE_EXPANSION_SCALE);
        //HARDCODED VALUE ; twinkle formula ; 10.0 sets twinkle speed and 1.5 sets how strong it gets at full dispersion
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

//UI AND SLIDER SYSTEM
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

  // Force the animate() loop to recognize the new slider color
  // Apply it across all particle materials on the next frame.
  lastAppliedColorHex = -1;
}

// UI logic for the settings sliders and the reset icon
const settingsIcon = document.getElementById('settings-icon');
const slidersContainer = document.getElementById('sliders-container');

if (settingsIcon && slidersContainer) {
  settingsIcon.addEventListener('click', () => {
    // Check the actual computed display style instead of relying only on inline styles
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
  // Run it once immediately so the color you actually see on load is
  // derived from the slider's own default position, instead of the
  // separate OVERRIDE_COLOR constant above. This keeps load-in and
  // reset always producing the same color.
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

// Restart icon resets every slider back to the default value stated in its
// HTML "value" attribute, then fires a real input event on each one so all
// the listeners above re-apply that default the same way a manual drag would.
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

//CONSTANT ANIMATION LOOP SYSTEM
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

  //HARDCODED VALUE ; delta clamp ; caps each frame's delta time at 0.1 seconds so a lag spike cannot cause a huge physics jump
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  totalElapsedTime += deltaTime;

  beatIntensity *= Math.exp(-PULSE_DECAY_SPEED * deltaTime);
  //HARDCODED VALUE ; beat smoothing ; how quickly the visible beat pulse catches up to the raw beat intensity, 14.0 controls the smoothing speed
  beatPulse += (beatIntensity - beatPulse) * Math.min(1.0, deltaTime * 14.0);

  // Make the ball glow brighter dynamically per beat
  bloomPass.strength = BLOOM_VAL + (beatPulse * BLOOM_BRIGHTNESS_SCALE);

  //HARDCODED VALUE ; jelly wobble decay ; 0.18 is the fraction of wobble energy left after one full second, this decays the jelly wobble effect over time
  jellyWobbleEnergy *= Math.pow(0.18, deltaTime);

  // Calculate Dispersion Easing
  if (currentDisperseFactor < targetDisperseFactor) {
    currentDisperseFactor = Math.min(1.0, currentDisperseFactor + deltaTime * DISPERSE_SPEED);
  } else if (currentDisperseFactor > targetDisperseFactor) {
    currentDisperseFactor = Math.max(0.0, currentDisperseFactor - deltaTime * AGGREGATE_SPEED);
  }

  easeDisperse = currentDisperseFactor < 0.5
    ? 4 * currentDisperseFactor * currentDisperseFactor * currentDisperseFactor
    : 1 - Math.pow(-2 * currentDisperseFactor + 2, 3) / 2;

  //COLOR TRANSITION LOGIC
  // Smoothly blend between the slider color and target based on dispersion
  activeColor.lerpColors(baseColor, maxColor, easeDisperse);
  const currentHex = activeColor.getHex();

  // Performance check: Only push to materials if the color actually changed
  if (currentHex !== lastAppliedColorHex) {
    lastAppliedColorHex = currentHex;

    innerCore.material.color.copy(activeColor);
    outerShell.material.color.copy(activeColor);


    const mainRed = activeColor.r;
    //HARDCODED VALUE ; haloBoostFactor ; pushes the halo's red channel 80 percent of the way to full red, making the halo look hotter than the core
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
    //HARDCODED VALUE ; orbit speed ; how fast the camera slowly circles around the ball when idle, 0.04 controls the rotation speed
    camera.position.x = Math.cos(totalElapsedTime * 0.04) * CAMERA_DISTANCE;
    camera.position.z = Math.sin(totalElapsedTime * 0.04) * CAMERA_DISTANCE;
    camera.lookAt(0, 0, 0);
  }

  if (!isDragging || interactionMode !== 'move') {
    //HARDCODED VALUE ; springK ; how strongly the ball is pulled back to the center when released, its spring stiffness
    const springK = 8.0;
    //HARDCODED VALUE ; dampC ; how much the return-to-center motion is slowed down so it doesn't overshoot forever
    const dampC = 2.5;

    let springForce = ballPos.clone().multiplyScalar(-springK);
    let dampingForce = ballVel.clone().multiplyScalar(-dampC);
    let leashAcceleration = springForce.add(dampingForce);

    ballVel.add(leashAcceleration.multiplyScalar(deltaTime));
    ballPos.add(ballVel.clone().multiplyScalar(deltaTime));
  }

  particleBall.position.copy(ballPos);

  //HARDCODED VALUE ; halo spin speed ; the outer halo spins independently , 0.08 around Y and 0.03 around X
  outerHalo.rotation.y += 0.08 * deltaTime;
  outerHalo.rotation.x += 0.03 * deltaTime;

  let currentAcc = ballVel.clone().sub(lastBallVel).divideScalar(deltaTime > 0 ? deltaTime : 0.016);
  lastBallVel.copy(ballVel);

  let accMag = currentAcc.length();
  if (accMag > 0.1) {
    wobbleAxis.lerp(currentAcc.clone().normalize(), deltaTime * 8.0).normalize();
    movementWobbleVel -= accMag * 0.0015;
  }

  //HARDCODED VALUE ; wobbleK ; spring stiffness pulling the movement wobble back to zero
  const wobbleK = 100.0;
  //HARDCODED VALUE ; wobbleDamp ; how much the movement wobble spring is damped so it settles instead of oscillating forever
  const wobbleDamp = 8.0;
  let wobbleAcc = (-wobbleK * movementWobble) - (wobbleDamp * movementWobbleVel);
  movementWobbleVel += wobbleAcc * deltaTime;
  movementWobble += movementWobbleVel * deltaTime;

  if (!isDragging || interactionMode !== 'spin') {
    //HARDCODED VALUE ; spin return speed ; how fast the ball's spin eases back to idle spin speed once dragging stops
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

//AUDIO SYSTEM
const startButton = document.getElementById('start-visualizer-button');
const bassDebugLabel = document.getElementById('bass-debug-label');

if (startButton) {
  startButton.addEventListener('click', startAudioCapture);
}

async function startAudioCapture() {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    displayStream.getVideoTracks().forEach(track => track.stop());

    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert('No audio track detected. Make sure to check "Share system audio"!');
      return;
    }

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(displayStream);
    const analyser = audioCtx.createAnalyser();

    //HARDCODED VALUE ; fftSize ; resolution of the audio frequency analysis, higher gives finer frequency detail but costs more performance
    analyser.fftSize = 2048;
    //HARDCODED VALUE ; smoothingTimeConstant ; how much the analyser smooths frequency data between frames, closer to 1 is smoother but less responsive
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const binWidth = audioCtx.sampleRate / analyser.fftSize;
    //HARDCODED VALUE ; bass frequency range ; the bass band is measured between 20 Hz and 140 Hz
    const bassStart = Math.floor(20 / binWidth);
    const bassEnd = Math.ceil(140 / binWidth);
    //HARDCODED VALUE ; treble frequency range ; the hihat/cymbal band is measured between 5000 Hz and 10000 Hz
    const trebleStart = Math.floor(5000 / binWidth);
    const trebleEnd = Math.ceil(10000 / binWidth);

    startButton.textContent = 'Visualizer Running';
    startButton.disabled = true;

    //HARDCODED VALUE ; starting baselines ; small nonzero start so the first few frames don't read as a giant fake spike
    let bassBaseline = 0.02;
    let trebleBaseline = 0.02;
    let lastProcessTime = performance.now();

    function processAudio() {
      requestAnimationFrame(processAudio);
      analyser.getByteFrequencyData(freqData);

      const now = performance.now();
      const dt = Math.min((now - lastProcessTime) / 1000, 0.1);
      lastProcessTime = now;

      let bassSum = 0;
      for (let i = bassStart; i <= bassEnd; i++) {
        bassSum += freqData[i];
      }
      bassEnergy = bassSum / ((bassEnd - bassStart + 1) * 255);

      let trebleSum = 0;
      for (let i = trebleStart; i <= trebleEnd; i++) {
        trebleSum += freqData[i];
      }
      const trebleEnergy = trebleSum / ((trebleEnd - trebleStart + 1) * 255);

      //HARDCODED VALUE ; silence gate ; below this raw energy on both bands, treat it as silence and skip all triggering for the frame
      if (bassEnergy < 0.045 && trebleEnergy < 0.045) {
        if (bassDebugLabel) {
          bassDebugLabel.textContent = `Bass: ${bassEnergy.toFixed(2)} | Treble: ${trebleEnergy.toFixed(2)} | Beat Intensity: ${beatIntensity.toFixed(2)}`;
        }
        return;
      }

      bassBaseline += (bassEnergy - bassBaseline) * Math.min(1.0, dt * BASELINE_FOLLOW_SPEED);
      trebleBaseline += (trebleEnergy - trebleBaseline) * Math.min(1.0, dt * BASELINE_FOLLOW_SPEED);

      if (explosionCooldown > 0) explosionCooldown -= dt;

      const bassSpike = bassEnergy - bassBaseline;
      const trebleSpike = trebleEnergy - trebleBaseline;

      //HARDCODED VALUE ; pulse trigger threshold ; how far above its own baseline the bass has to spike before it counts as a beat
      if (bassSpike > 0.25) {
        triggerRandomParticleBeat(bassSpike, BASS_SENSITIVITY);
      }

      //HARDCODED VALUE ; treble pulse trigger threshold ; how far above its own baseline the treble has to spike before it counts as a hihat hit
      if (trebleSpike > 0.15) {
        triggerRandomParticleBeat(trebleSpike, TREBLE_SENSITIVITY);
      }

      //HARDCODED VALUE ; EXPLOSION_ENERGY_THRESHOLD ; raw bass loudness (0 to 1, not a spike) needed to fire a big burst, watch the debug label's Bass value during real playback to tune this
      const EXPLOSION_ENERGY_THRESHOLD = 0.35;
      //HARDCODED VALUE ; explosion cooldown ; minimum seconds between bursts so back-to-back hits don't overlap
      if (bassEnergy > EXPLOSION_ENERGY_THRESHOLD && explosionCooldown <= 0) {
        const bigExp = initAudioExplosion();
        audioExplosionsData.push(bigExp);
        audioExplosionsGroup.add(bigExp.mesh);
        explosionCooldown = 0.35;
      }

      if (bassDebugLabel) {
        bassDebugLabel.textContent = `Bass: ${bassEnergy.toFixed(2)} | Baseline: ${bassBaseline.toFixed(2)}\nTreble: ${trebleEnergy.toFixed(2)} | Baseline: ${trebleBaseline.toFixed(2)}\nBeat Intensity: ${beatIntensity.toFixed(2)}`;
      }
    }
    processAudio();
  } catch (err) {
    console.error('Audio capture failed:', err);
  }
}
