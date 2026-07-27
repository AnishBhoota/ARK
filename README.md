# <span style="color: red;">ARK | Audio-Reactive Kugelblitz</span>

Interactive web-based 3d particle visualizer built with Three.js  The application renders a complex particle sphere with multiple organic layers including: core particles, surface filaments, internal streams, bursts, and solar flares that react dynamically to live system audio input.

## <span style="color: yellow">Features</span>
* **Audio Reactivity:** Captures system's live audio and splits it into a bass frequency and beat intensity stream. Crossing either streams' threshold value triggers a real-time reaction in the sphere's inner & outter core and their respective colors/streams/flare systems.

* **Layered Particle Mechanics:** Features multiple particle systems, including a dense core, outer halo, flowing internal streams, surface filaments, solar flares of various sizes, and miniture CME's.

* **Post-Processing Glow:** Utilizes Three.js `EffectComposer` and `UnrealBloomPass` to achieve a dynamic bloom lighting that intensifies with the audio.
* **Interactive Physics:** Supports two interaction modes
  * **Spin Mode:** Drag to rotate the particle ball with realistic inertia and (if flicked fast enough) fluid-like impact physics
  * **Move Mode:** Click and drag the sphere across the screen with an elastic resistance to the center screen.
* **Particle Dispersion & Aggregation:** Toggle between a dispersed sphere state and an aggregated state with smooth color blending. (Only avaliable through spin mode)
* **Customization Controls:** Includes 5 real time sliders, a full-screen toggle, and FPS counter.
1. Red tone Brightness
2. Camera Zoom
3. Bloom Strength
4. Bloom Radius
5. Bloom Threshold 

## <span style="color: yellow">Additional Notes</span>
* Because the visualizer renders nearly 200,000 individual particles, each with their own unique `Xpos`/`Ypos`/`Zpos`/`spawnrate`/`movement`/`speed`/`purpose` and MORE along with real-time post-processing glow and physics calculations, it is very graphics-intensive. **A capable GPU is required** to run smoothly. Lag or performance drops on low-end devices.

* Most immersive with oled screens in a dim/dark room.


## <span style="color: yellow">Built with</span>

* HTML5
* CSS3
* JavaScript (ES6+)
* Three.js (WebGL rendering engine)

## <span style="color: yellow">How to run</span>
1. Clone/Download this repository to your local machine.
2. Open (simply double click) the `index.html` file directly in a modern web
3. Or simply click [anishbhoota.github.io/ARK/](anishbhoota.github.io/ARK/)

