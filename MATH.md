# <span style="color: red">The Mathematical & Physics Implementation of `app.js`</span>

I attempted a comprehensive breakdown of the utilized mathematical models, physics systems, and algorithms to construct my sphere. Project had me losing my mind but it was a great sandbox of trial error for testing my mathematical skills. I think it made a good first project considering my dual major in CS and Math. Had to go over linear algebra and relearn a little bit of trig, calculus and statistics (surprising amount of normalizing) to make this work.

<br>

# **Table of Contents**
- [The Mathematical & Physics Implementation of `app.js`](#the-mathematical--physics-implementation-of-appjs)
  - [Initial Mapping](#initial-mapping)
  - [Camera Kinematics and Orbital Trigonometry](#camera-kinematics-and-orbital-trigonometry)
  - [Sphere generation through the Box-Muller Transform](#sphere-generation-through-the-box-muller-transform)
  - [The Chaos system | Pseudo-Random Noise through trig](#the-chaos-system--pseudo-random-noise-through-trig)
  - [Hooke's Law and Particle Kinematics](#hookes-law-and-particle-kinematics)
  - [Procedural Curves, Internal Streams, Surface Filaments](#procedural-curves-internal-streams-surface-filaments)
    - [Creating Volume (The Frenet-Serret Frame)](#creating-volume-the-frenet-serret-frame)
    - [Filament Tapering](#filament-tapering)
  - [Mini explosions from vector dot product](#mini-explosions-from-vector-dot-product)
  - [Massive Solar Flares and its State Machines](#massive-solar-flares-and-its-state-machines)
  - [Interactive Physics (Logarithmic Elasticity) and Raycasting](#interactive-physics-logarithmic-elasticity-and-raycasting)
  - [Fluid Dynamics](#fluid-dynamics)
  - [Interpolation and Easing Functions (Disperse & Aggregate)](#interpolation-and-easing-functions-disperse--aggregate)
  - [Real-Time Audio Fast Fourier Transform (FFT)](#real-time-audio-fast-fourier-transform-fft)

<br>

## <span style="color: yellow">Initial Mapping</span>

Before anything, I needed a visual storing system for the nearly quarter million individual particles. If each particle was an object with its own unique set of properties (`x`, `y`, `z`, `speed`, `color`, `glow`, etc) the CPU overhead would crash the browser and probably brick my laptop if I wasn't on a mac.

So instead, the code uses contiguous memory via `Float32Array`, mapping a 3D coordinate into a 1D array.

Essentially, for some particle $i$:
- its X coordinate is at index $i \times 3$
- its Y coordinate is at $(i \times 3) + 1$
- its Z coordinate is at $(i \times 3) + 2$

So basically when the code iterates through thousands of particles in a for loop, it calculates the offset index to instantly access the exact block of memory for that specific particle's spatial data (coords):

`const idx = i * 3;`

## <span style="color: yellow">Camera Kinematics and Orbital Trigonometry</span>

The visualizer does not just sit still when idle. the camera orbits the origin. (As well as the sphere more on that later)

$$X_{cam} = \cos(\omega \cdot t) \cdot R$$
$$Z_{cam} = \sin(\omega \cdot t) \cdot R$$

- Radius ($R$): Defined by `CAMERA_DISTANCE = 30`
- Angular Velocity ($\omega$): Set to $0.04$
- Time ($t$): Represented by `totalElapsedTime`

After feeding a continuously increasing time value into sine and cosine, the resulting output oscillates perfectly between -1 and 1. Multiplied by 30, the camera goes in a perfect 360-degree circle around the space. Then I lock the view using `camera.lookAt(0, 0, 0)`

## <span style="color: yellow">Sphere generation through the Box-Muller Transform</span>

To create the inner core, outer shell, and outer halo cloud, the particles must be spawned within a sphere. Doing this was somehow several times harder than I thought.

Using a standard random number generator (picking a random val [-1, 1] for a particle's X, Y, and Z coordinates) will end up generating a cube. Fixing this used a Box-Muller Transform:

$$Z = \cos(2\pi v)\sqrt{-2 \ln(u)} $$

- Let u and v be uniform random variables between 0 and 1
- The natural logarithm $\ln(u)$ forces an inward heavy distribution (towards the center) and creates a long, trailing tail.
- The cosine function $\cos(2\pi v)$ wraps the entire distribution in a circle.

This famous technique generates a normally distributed (Gaussian) vector: `THREE.Vector3(randomGaussian(), randomGaussian(), randomGaussian())`. Once this vector is normalized (setting total length exactly to 1), it is multiplied by a randomized radius:

- Inner Core: Multiplied by $0.4 + \text{random} \times 2.8$
- Outer Shell: Multiplied by $4.5 + \text{random} \times 1.7$
- Outer Halo: Multiplied by $5.5 + \text{random} \times 30.0$

## <span style="color: yellow">The Chaos system | Pseudo-Random Noise through trig</span>

When you look closely at the visualizer, every single individual particle constantly yet randomly drifts up, down, left, and right. Simply having a uniform Left Right Up Down for some random distance x for each particle was too calculation heavy and wouldn't cause a smooth drifting appearance.

Importing a 3D Simplex or Perlin noise library was too heavy and I was advised against it. Instead, I made my own rudimentary pseudo-random movement using pure trigonometry inside the `updateParticleLayer` function.

So for every individual particle index $i$:

$$X_{disp} = \sin(i \cdot 1352.34) \cdot 25.0 + \sin(t \cdot 0.5 + i) \cdot 10.0$$
$$Y_{disp} = \cos(i \cdot 4132.21) \cdot 25.0 + \cos(t \cdot 0.6 + i) \cdot 10.0$$
$$Z_{disp} = \sin(i \cdot 7265.54) \cdot 25.0 + \sin(t \cdot 0.7 + i) \cdot 10.0$$

Simply,

**Deterministic random movement for each particle** — `Math.sin(i * 1352.34) * 25.0`. By multiplying the particle's index by a massive, arbitrary decimal, the sine wave output is randomized. Particle 1 might output $0.9$, while Particle 2, $-0.4$. This creates a unique yet permanent mathematical "fingerprint" offset for every single particle without needing to store that data in memory.

**Smoothed and controlled randomness** — `Math.sin(totalElapsedTime * 0.5 + i) * 10.0`. This takes the current time, offsets it by the particle's index, and runs it through a sine function. This creates a slow, rhythmic motion, ensuring the chaos feels like it is "breathing" rather than just being chaotic and broken.

## <span style="color: yellow">Hooke's Law and Particle Kinematics</span>

Didn't think i'd need to pull formulas straight out of physics for this project but here we are.
Even though particles have a "base" position, there are multiple forces acting on them like the bass pulse or different wobble effects from various user interactions. The visualizer calculates a `targetX`, `targetY`, and `targetZ` for where the particle **wants** to be in that specific frame.

To move the particle to that target, I use a harmonic oscillator model (Hooke's Law combined with friction) and heavily damp it with some constant.

$k$ is stiffness, $c$ is damping, $x$ is the distance to the target, and $v$ is the current velocity:

$$F = (-k \cdot x) - (c \cdot v)$$

So basically, the particle calculates the exact distance between its current position `_tempVector.x` and its target position `targetX`. It multiplies that gap by the stiffness to generate a spring force. It then subtracts its current velocity multiplied by the damping constant so it doesn't overshoot and oscillate forever. This acceleration is added to the velocity, which is then added to the position. This is calculated and applied thousands of times per frame.



## <span style="color: yellow">Procedural Curves, Internal Streams, Surface Filaments</span>

The glowing lines inside and outside the sphere are not predefined 3D models. They are procedurally generated using Parametric Bezier Mathematics. This sounds fancy and complex but it really isn't.

Both the Internal Streams and Surface Filaments utilize Quadratic Bezier curves, which rely on three points: a start point $P_0$, a control point $P_1$, and an end point $P_2$:

$$B(t) = (1-t)^2 P_0 + 2(1-t)t P_1 + t^2 P_2$$

As $t$ moves from $0.0$ to $1.0$, the mathematical function traces a beautiful arc.

---

### Creating Volume (The Frenet-Serret Frame)

A mathematical curve is a 1D line; it has no thickness. To make the streams look like they actually have depth, the code must calculate individual 3D volume along the curve. But I didn't want static thickness. I wanted a thickness that changed along the arc. See [Filament Tapering](#filament-tapering).

1. Tangent: It calculates the instantaneous forward direction of the curve at any point $t$ using basic calculus `curve.getTangent(t)`.
2. Up Vector: It determines a global "up" direction (usually $Y = 1$).
3. Cross Products: By taking the cross product of the tangent and the up vector, it generates a `side` vector. By taking the cross product of the `side` vector and the `tangent`, it generates a perfect perpendicular vector `normal`:
   - `const side = new THREE.Vector3().crossVectors(tangent, up).normalize();`
   - `const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();`

Now that it has a "left/right" and "up/down" relative to the curve's direction, it spawns particles and offsets them randomly among these axes.

---

### Filament Tapering

For the surface filaments, you'll notice they're kind of pinched at the ends and thick in the middle. This is done using a sine wave I've mapped to the curve's progress which worked better than I expected.

`const width = Math.sin(t * Math.PI) * maxThickness;`

Because $\sin(0) = 0$ (start of the curve), $\sin(\frac{\pi}{2}) = 1$ (middle of the curve), and $\sin(\pi) = 0$ (end of the curve), multiplying the offset width by this sine output forces the filament to dwindle at both ends.

## <span style="color: yellow">Mini explosions from vector dot product</span>

The mini explosions that pop off the surface rely on pure linear kinematics and vector dot products.

1. The Origin Point: An explosion is spawned at a random point exactly on the surface of the sphere.
2. Velocity Vector Validation: A random 3D direction vector `dir` is generated for a particle. However, if that particle shoots inward toward the center of the sphere, it looks wrong. I used dot product to check the angle between the particle's direction and the center of the sphere:

   `if (dir.dot(centerP) < 0) { dir.negate(); }`

   If the dot product is less than 0, THEN the angle between the vectors is greater than 90 degrees AKA the particle is facing the wrong way. Calling `.negate()` simply multiplies the vector by $-1$, instantly flipping it outward so all particles explode away from the surface (the correct way).

## <span style="color: yellow">Massive Solar Flares and its State Machines</span>

The massive flares are the most mathematically complex entities. They took me an entire day to implement and had me going over a bunch of fancy sounding concepts.

**1. The Probability Gate**

Flares are very very expensive to render, so I restricted them by a time-based probability gate.

Every time the accumulated frame time (`deltaTime`) crosses 1 second, the loop resets and rolls a random decimal. If that decimal is under $0.8$, a flare spawns. So basically every second there is an 80% chance for a flare to spawn. Both said values are constants and can be changed easily in the code.

**2. Spatial Formatting and Curve Generation**

A flare needs to shoot from one side of the sphere to the other. The flare cannot have a static thickness. The flare can't be too small. It must look beautiful, with sun like solar flares with varying thickness like the rings of a planet.

1. Distance Check: 2 vectors are generated, a start vector `coreDir` and an end vector `endDir`. It calculates the dot product. If the start and end are too close, the end point is flipped and the flare wraps around the sphere the long way:

   `if (coreDir.dot(endDir) > 0.4) endDir.negate();`

2. The Arc: a midpoint is calculated between the start and end, gets normalized, and scales outward by a random height (`flareHeight` between 8.0 and 12.0) to create the apex (peak) of the arc.
3. Cubic Beziers: Because the arc I wanted was so specific, a quadratic curve wasn't cutting it. I used a Cubic Bezier Curve:

$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3$$

Basically, 2 control points to pull the arc high into space before quickly hooking it back down to the surface. This worked ten times better than I imagined and I was very satisfied with the end product.

**3. Gram-Schmidt Orthogonalization (Surface Sweeping)**

My Flares have 3 states, and I created a machine for them to go through.

- State 1: Flying through the air (particles progressing the curve)
- State 2: Crashing into the surface (particles sweeping rapidly across the curve)
- State 3: Dead (removed from calculation once all particles spill throughout the sphere)

When a particle hits $t = 1.0$, I have it switch into state 2. It takes the heavy downward momentum of the curve (`curveTangent`) and flattens it against the curved surface of the sphere (`landNormal`) where it moves across.

This is a direct application of something called the Gram-Schmidt Orthogonalization. It subtracts the bit of the curve's velocity that is pointing directly into the sphere, leaving the velocity that is perfectly parallel (tangent) to the sphere's surface. Then it applies a cross product to generate a lateral spread (`sideTangent`), allowing the flare to crash and visually wash across the circumference of the visualizer like a wave of fire.

## <span style="color: yellow">Interactive Physics (Logarithmic Elasticity) and Raycasting</span>

When the user clicks "Mode: Move" and drags the ball, it relies on 3D raycasting and elastic stretching.

1. **Raycasting to a Mathematical Plane** When the mouse clicks, it translates the 2D screen coordinates into normalized device coordinates (NDC) ranging from -1 to 1. A mathematical line (Ray) is shot out of the camera. Then it constructs an invisible `THREE.Plane` an infinite flat surface that perfectly faces the camera, positioned directly where the ball is. <br>

2. **Intersection** This allows us to calculate the exact 3D point where the ray intersects the plane (`hitPoint`).<br>

3. **Logarithmic Stretching (Rubber Band effect)** Intially when the user draged the mouse too fast or too far, the ball kept flying off screen. Either that or it'd break. To fix this I created a log function that forces the stretch to be bounded by a maximum distance. Essentially it simulates increasing tension per more stretch. But it also acted as a security feature so that the ball wouldn't break. In fact it indirectly also causes the sphere to feel tight and heavy the more its stretched past the threshold: `maxDist` = (10.0)

## <span style="color: yellow">Fluid Dynamics</span>

When releasing the ball after flicking it really hard, I calculate a real-time fluid-like wave deformation across the surface. Instead of animating a static or set of static wobble(s), every frame runs a spatial wave function in `calculateWobbleScale(posVector)`:

$$W = \sin(\omega \cdot t + k (\hat{p} \cdot \hat{i})) \cdot E \cdot (\hat{p} \cdot \hat{i})^{1.4}$$

1. Relevent Axis: It calculates the dot product between a particle's normalized position $\hat{p}$ and the exact coordinate where the mouse hit the sphere $\hat{i}$ (`jellyImpactPoint`).
2. The Wave: It plugs this dot product into a sine wave:

   `Math.sin(totalElapsedTime * 7.0 + dragDot * 3.8)`

   The $7.0$ is a frequency (how fast the sphere shakes), and the $3.8$ is the tightness between the ripples.
3. Energy Decay: It multiplies the wave by `jellyWobbleEnergy`, which is exponentially slowed every frame using $E \cdot 0.18^{\Delta t}$
4. Impact Concentration Control: By multiplying the entire equation by $\text{dragDot}^{1.4}$, the wave amplitude is forced to be "violent" at the point of impact. Despite this, the far side of the sphere is completely still/unaffected.

## <span style="color: yellow">Interpolation and Easing Functions (Disperse & Aggregate)</span>

Clicking the "Disperse" button transitions my visualizer from a tight sphere into a chaotic cloud of static noise.

However if I used linear interpolation (moving from A to B at a constant speed), the animation would feel rigid and sudden. So I switched to a smooth-step cubic easing function to create a natural acceleration and deceleration effect.

$$f(t) = \begin{cases} 4t^3 & \text{if } t < 0.5 \\ 1 - \frac{(-2t + 2)^3}{2} & \text{if } t \ge 0.5 \end{cases}$$

- Acceleration Phase ($t < 0.5$): This means as time starts, the movement is incredibly slow, but rapidly accelerates as it approaches the halfway point.
- Deceleration Phase ($t \ge 0.5$): The code then inverts the function. This acts as a brake, ensuring the scattered particles glide smoothly into their final floating positions without appearing chaotic.

This easing scalar (`easeDisperse`) is then multiplied against all trigonometric pseudo-random noise (`dispX`, `dispY`, `dispZ`) calculated earlier in [The Chaos System](#the-chaos-system--pseudo-random-noise-through-trig).
This expands the noise field from a multiplier of 0 to a multiplier of 1. It is also simultaneously used to linearly interpolate colors between the base red and the pure maximum red.

## <span style="color: yellow">Real-Time Audio Fast Fourier Transform (FFT)</span>

The visualizer reacts live to system audio, scaling the bloom lighting and generating a pulselike heartbeat within the core.

Audio from a computer is a waveform (Time Domain). To make it react only to the bass (and not random irrelevent high-pitched noises), the math must convert this waveform into the Frequency Domain using something called a Fast Fourier Transform (FFT).

1. FFT Sizing: The `AnalyserNode` uses an `fftSize` of 2048. This chops the audio spectrum into frequency bins.
2. Bin Width Calculation: By dividing the audio sample rate by the FFT size (`binWidth = audioCtx.sampleRate / analyser.fftSize`), the code determines exactly how many Hz each bin represents.
3. Targeting the Bass: The code calculates the starting bin mapping to $20$Hz and the ending bin mapping to $140$Hz.
4. Amplitude Averaging: Every frame, a for-loop iterates strictly through this targeted bass array, sums up the raw amplitude data, and calculates the average `bassEnergy` which is then normalized between 0 and 1.
5. Triggering: If the resulting `bassEnergy` exceeds a hard limit of $0.55$, the math logs the timestamp, triggers a visual beat pulse, and aggressively scales up the Three.js `bloomPass.strength = 1.8 + (beatPulse * 5)`.

This entire thing is run 60 times a second.

---

<details><summary>message</summary>

# <span style="color: blue">Message</span>

It's hard to make exactly what I saw when it was quite literally a fever dream.

## <span style="color: blue">The Dream</span>

<span style="color: red">**1.**</span>

Having been deprived of all social interaction for nearly a week, minimal food and pretty much no entertainment, my mind was genuinely tweaking out. The people I enjoyed talking to were on the other side of the planet, and I was being monitored, making it impossible to talk to the people I most wanted to. To top it off, I became sick, incredibly sick and it was pretty much impossible to fall asleep. My mind was reaching ; reflecting across random thoughts and memories. I was seeing things that didn't exist. I heard my name being called when it wasn't. I reacted to conversations I had only in my head. I wanted some form of entertainment to pass the time. My mind craved something special. I was tired, barely functioning, for around 51 hours with no sleep, until I finally drifted.

<span style="color: red">**2.**</span>

Pitch black. That's the first thing I saw. It wasn't as simple as standing in front of a black canvas. It was a void. A cold empty space with no color. The only thing being reflected by such darkness was the vast space it was occupied in. Incomprehensible. I was frozen. Standing in a nothing so vast, it mocked the very idea of standing itself. No ground, no sky just an empty space. A space devoid of anything and everything yet it mimicked an unimginable scale that drove straight fear into my heart. It was a primal feeling. A feeling of miserable helplessness seeped into me. Then I was unnerved. Terrified. I didn't see anything yet I knew something was off.

I can most definitely differeniate illusion to reality but still. Absence of everything had never felt so real. It felt so real in fact, that a sense of clear rational came to mind. A rational that made me dread the empty hell I seemed to be stuck in.

Such impossible scale could only exist with the presence of 2 things. Some being, capable of perceiving said scale. Me. And something else. Something huge. Something so primordial and boundless, so forsaken, that it forced me into a sense of being infinitely smaller than I thought possible.

No sound. There should have been no sound. And yet there was. Coming from far, a low, rhythmic pressure against the silence ; a beat, pulsating somewhere I couldn't find.

I felt something. It could only be described as malevolent. A sound of slight flickering, a glowing haze on my skin, lighting up each individual hair on my arm. With heat pressing on my back, I turned.

<span style="color: red">**3.**</span>

I saw only flashes of it before I woke up in sweat. but it was terrifying. Something so large and unfathomable in scale, so incomprehensible, yet I was able to take it all in. It was beauitful and I was in awe. A sphere, blood red, pulsing. Its colors, deep and rich, contrasted harshly against the complete void surrounding it. I could feel the blazing heat and my fingertip seered in pain as I imagined moving just an inch to touch it. I saw wisps of flares, explosions coming from it's surface, and streams of deadly plasma dragging themselves across the body of the sphere as if they were veins. It was silent, yet I could hear it pulse ever so slightly. A heartbeat. I couldn't move. I saw a massive flare bursting upwards. It climbed higher and higher, so large, it grew its own monstrous tendrils which shot off violently. It's flames wide, like the rings of a planet. Everything felt real. The colors brighter than before, the darkness more constricting then ever. I felt conscious for a brief moment. Conscious enough to know that sound can't travel in space. Yet I still heard it. The cosmic flare arched wildly and drove itself back into the sphere, causing a roar so loud it deafened my ears. A sound so loud, it could only be described through the feeling of a crack splitting reality itself open. I could see it in its whole and despite that, it felt endless. It was endless. Its surface stretched forever, scarred in rivers of molten light and fire. The surface seemed to glide, flickering and pressing on me harder than the darkness around me could.
The ominous dark red glow continuously bled into the void.

**Conclusion**

Then I woke up with a plan to recreate this to the best of my ability. And connect it to my computer's audio system.

## Inspiration

- The Dream
- [UL131WEB (YouTube)](https://www.youtube.com/@ul131web)
- Liu Cixin
- That one scene from Umbrella Academy
- Interstellar

</details>

<span style="color: red">**END**</span>
