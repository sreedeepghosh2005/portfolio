/* ==========================================================================
   SREEDEEP.exe — 3D gaming room intro (ES module, Three.js from the import map)

   Flow:
   1. The head bootstrap in index.html adds `html.is-pc-intro` on the first
      visit of a session. Otherwise it adds `html.skip-pc` and this file exits.
   2. The scene is a gaming room: desk, monitor, RGB tower, chair,
      window with a city view, shelves, posters, plant, lamp.
      The sky in the window follows the time of day in IST (UTC+5:30).
      Add ?ist=<hour> to the URL to preview another hour, e.g. ?ist=13.
      The room turns a little to follow the pointer.
   3a. Clicking the speaker on top of the bookcase plays
      Assets/audio/Nutshell.mp3 and sends music notes out of it.
   3b. Clicking the figurine on the desk opens the CV chatbot
      (Assets/js/cv-bot.js). If that file fails to load, the figurine
      is still drawn but does nothing.
   3c. Hovering the plant shows a watering can. Clicking pours water,
      and the plant then grows flowers.
   3. Clicking the monitor (or ENTER SITE / the Enter key) moves the camera
      into the screen. Esc skips straight to the site.
   4. finish() removes `is-pc-intro`, sets sessionStorage `sd-pc`, and fires
      `sd:pc-entered`. Assets/js/animations.js waits for that event before it
      plays the hero intro.
   Any failure (no WebGL, CDN down) calls finish() at once, so the site loads.

   All textures are drawn on 2D canvases at load time. No image or model files.
   ========================================================================== */

const root = document.documentElement;
const overlay = document.getElementById('pc-intro');
const STORE_KEY = 'sd-pc';

let finished = false;
let cleanup = () => { if (overlay) overlay.remove(); };

function finish({ fade = true } = {}) {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem(STORE_KEY, '1'); } catch (e) { /* private mode */ }
    if (overlay && fade) overlay.classList.add('is-done');
    root.classList.remove('is-pc-intro');
    document.dispatchEvent(new Event('sd:pc-entered'));
    if (fade) setTimeout(() => cleanup(), 750);
    else cleanup();
}

function hasWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
        return false;
    }
}

if (!overlay || !root.classList.contains('is-pc-intro')) {
    if (overlay) overlay.remove();
} else if (!hasWebGL()) {
    finish({ fade: false });
} else {
    boot().catch((err) => {
        console.warn('[pc-intro] falling back to the normal site:', err);
        finish({ fade: false });
    });
}

async function boot() {
    const [
        THREE,
        { RoundedBoxGeometry },
        { mergeGeometries },
        { RoomEnvironment },
        { RectAreaLightUniformsLib },
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass },
        { OutputPass },
        cvBotModule,
    ] = await Promise.all([
        import('three'),
        import('three/addons/geometries/RoundedBoxGeometry.js'),
        import('three/addons/utils/BufferGeometryUtils.js'),
        import('three/addons/environments/RoomEnvironment.js'),
        import('three/addons/lights/RectAreaLightUniformsLib.js'),
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        // The chatbot is optional. A load failure must not stop the room.
        import('./cv-bot.js?v=1').catch((err) => { console.warn('[pc-intro] chatbot not loaded:', err); return null; }),
    ]);
    if (finished || !root.classList.contains('is-pc-intro')) return finish({ fade: false });

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const lowPower = innerWidth < 768 || !finePointer;

    // Seeded random, so the room looks the same on every load.
    let seed = 20051;
    const rand = () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    const canvas = overlay.querySelector('#pc-canvas');
    const hint = overlay.querySelector('.pc-hint-text');
    const hintBox = overlay.querySelector('.pc-hint');
    const skipBtn = overlay.querySelector('.pc-skip');
    const cursorEl = document.getElementById('cursor');
    const flash = document.createElement('div');
    flash.className = 'pc-flash';
    overlay.appendChild(flash);
    const verb = finePointer ? 'CLICK' : 'TAP';
    if (hint) hint.textContent = `> ${verb} THE MONITOR`;

    /* ================================================================ */
    /* Renderer, scene, camera, post                                     */
    /* ================================================================ */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    RectAreaLightUniformsLib.init();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080c);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.16;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
    const lookBase = new THREE.Vector3(0.2, 1.2, -0.5);
    const camBase = new THREE.Vector3(0, 3.1, 13);

    let composer = null;
    let bloom = null;
    if (!lowPower) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 1.0);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
    }

    const world = new THREE.Group();
    scene.add(world);

    /* ================================================================ */
    /* Helpers                                                           */
    /* ================================================================ */
    const std = (color, roughness = 0.6, metalness = 0, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    // Unlit, bright colour for LEDs. Values above 1 feed the bloom pass.
    const glow = (color, boost = 3) => {
        const m = new THREE.MeshBasicMaterial({ color });
        m.color.multiplyScalar(boost);
        m.userData.boost = boost;
        return m;
    };
    const setGlow = (m, h, s = 1, l = 0.55) => m.color.setHSL(h % 1, s, l).multiplyScalar(m.userData.boost || 1);

    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    function rbox(w, h, d, mat, r = 0.03, seg = 2) {
        const radius = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
        return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, radius), mat));
    }
    const cyl = (rt, rb, h, mat, seg = 32, open = false) =>
        shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat));
    function put(parent, obj, x = 0, y = 0, z = 0, ry = 0) {
        obj.position.set(x, y, z);
        if (ry) obj.rotation.y = ry;
        parent.add(obj);
        return obj;
    }

    const textures = [];
    function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = maxAniso;
        if (repeat) {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(repeat[0], repeat[1]);
        }
        textures.push(t);
        return t;
    }
    function withRepeat(tex, rx, ry) {
        const t = tex.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.needsUpdate = true;
        textures.push(t);
        return t;
    }
    function noise(ctx, w, h, n, alpha, light = false) {
        for (let i = 0; i < n; i++) {
            const v = light ? 255 : 0;
            ctx.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`;
            ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
        }
    }

    /* ================================================================ */
    /* Canvas textures                                                   */
    /* ================================================================ */
    const floorTex = canvasTex(1024, 1024, (ctx, w, h) => {
        const rows = 8;
        const rh = h / rows;
        for (let r = 0; r < rows; r++) {
            let x = -rand() * w * 0.5;
            while (x < w) {
                const len = w * (0.3 + rand() * 0.45);
                const l = 26 + rand() * 12;
                ctx.fillStyle = `hsl(${24 + rand() * 8}, ${32 + rand() * 14}%, ${l}%)`;
                ctx.fillRect(x, r * rh, len, rh);
                for (let k = 0; k < 26; k++) {
                    const y0 = r * rh + rand() * rh;
                    ctx.strokeStyle = rand() < 0.5 ? `rgba(0,0,0,${0.05 + rand() * 0.1})` : `rgba(255,220,180,${rand() * 0.06})`;
                    ctx.lineWidth = 0.5 + rand() * 1.5;
                    ctx.beginPath();
                    const amp = rand() * 3;
                    const f = 0.004 + rand() * 0.01;
                    for (let px = x; px <= x + len; px += 8) ctx.lineTo(px, y0 + Math.sin(px * f) * amp);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(x, r * rh, 2, rh);
                x += len;
            }
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, r * rh, w, 2);
        }
    }, { repeat: [3, 5.5] });

    const wallTex = canvasTex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#3a3f4b';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, 9000, 0.06);
        noise(ctx, w, h, 5000, 0.04, true);
    });

    const walnutTex = canvasTex(1024, 512, (ctx, w, h) => {
        ctx.fillStyle = '#4b2e1c';
        ctx.fillRect(0, 0, w, h);
        for (let k = 0; k < 220; k++) {
            const y0 = rand() * h;
            ctx.strokeStyle = rand() < 0.6 ? `rgba(20,10,4,${0.08 + rand() * 0.18})` : `rgba(160,100,60,${rand() * 0.12})`;
            ctx.lineWidth = 0.6 + rand() * 2.2;
            ctx.beginPath();
            const amp = 2 + rand() * 8;
            const f = 0.002 + rand() * 0.006;
            const ph = rand() * 6;
            for (let px = 0; px <= w; px += 6) ctx.lineTo(px, y0 + Math.sin(px * f + ph) * amp);
            ctx.stroke();
        }
    });

    const rugTex = canvasTex(1024, 768, (ctx, w, h) => {
        ctx.fillStyle = '#2c3038';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, 30000, 0.12);
        noise(ctx, w, h, 15000, 0.06, true);
        ctx.strokeStyle = 'rgba(200,205,215,0.35)';
        ctx.lineWidth = 10;
        ctx.strokeRect(40, 40, w - 80, h - 80);
        ctx.lineWidth = 3;
        ctx.strokeRect(70, 70, w - 140, h - 140);
        ctx.strokeStyle = 'rgba(168,85,247,0.35)';
        ctx.lineWidth = 4;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(140 + i * 130, 110);
            ctx.lineTo(205 + i * 130, h / 2);
            ctx.lineTo(140 + i * 130, h - 110);
            ctx.stroke();
        }
    });

    /* ---- Time of day in IST, for the view through the window ---------- */
    // IST is UTC+5:30 with no daylight saving. ?ist=<hour> overrides it for testing.
    const istOverride = parseFloat(new URLSearchParams(location.search).get('ist'));
    const now = new Date();
    const istHour = Number.isFinite(istOverride)
        ? ((istOverride % 24) + 24) % 24
        : (now.getUTCHours() + now.getUTCMinutes() / 60 + 5.5) % 24;
    // Sky colours (top, middle, low, horizon) and how much daylight there is, by IST hour.
    const NIGHT = { sky: ['#03050c', '#0e1430', '#2b2350', '#3d2a4f'], day: 0 };
    const DAWN = { sky: ['#1b2550', '#5a4a7a', '#e58a6b', '#ffb27a'], day: 0.45 };
    const DAY = { sky: ['#2f6fd0', '#6fa8e8', '#b9dcf5', '#dcefff'], day: 1 };
    const DUSK = { sky: ['#24305f', '#6b4a85', '#f08a5d', '#ffb36b'], day: 0.45 };
    const SKY_KEYS = [[0, NIGHT], [5, NIGHT], [6, DAWN], [7.5, DAY], [16.5, DAY], [18, DUSK], [19.5, NIGHT], [24, NIGHT]];
    const sky = (() => {
        let i = 0;
        while (istHour >= SKY_KEYS[i + 1][0]) i++;
        const [h0, a] = SKY_KEYS[i];
        const [h1, b] = SKY_KEYS[i + 1];
        const f = (istHour - h0) / (h1 - h0);
        const ca = new THREE.Color();
        const cb = new THREE.Color();
        return {
            colors: a.sky.map((c, k) => `#${ca.set(c).lerp(cb.set(b.sky[k]), f).getHexString()}`),
            day: lerp(a.day, b.day, f),
        };
    })();
    const mixHex = (night, day) => `#${new THREE.Color(night).lerp(new THREE.Color(day), sky.day).getHexString()}`;

    const cityTex = canvasTex(2048, 1024, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, sky.colors[0]);
        g.addColorStop(0.5, sky.colors[1]);
        g.addColorStop(0.85, sky.colors[2]);
        g.addColorStop(1, sky.colors[3]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Stars fade out as the sky gets light. The rand() calls stay the same
        // at every hour, so the rest of the room keeps the same seeded layout.
        const starAlpha = 1 - sky.day;
        for (let i = 0; i < 350; i++) {
            ctx.fillStyle = `rgba(255,255,255,${rand() * 0.8 * starAlpha})`;
            ctx.fillRect(rand() * w, rand() * h * 0.55, 1.5, 1.5);
        }
        // Moon at night, sun once there is more than half daylight.
        const mx = w * 0.3;
        const my = h * 0.2;
        const isSun = sky.day > 0.5;
        const haloRgb = isSun ? '255,236,190' : '230,235,255';
        const haloR = isSun ? 240 : 160;
        const mg = ctx.createRadialGradient(mx, my, 10, mx, my, haloR);
        mg.addColorStop(0, `rgba(${haloRgb},${isSun ? 0.75 : 0.5})`);
        mg.addColorStop(1, `rgba(${haloRgb},0)`);
        ctx.fillStyle = mg;
        ctx.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);
        ctx.fillStyle = isSun ? '#fff6dc' : '#eef0f8';
        ctx.beginPath();
        ctx.arc(mx, my, isSun ? 52 : 44, 0, Math.PI * 2);
        ctx.fill();
        const layers = [
            { base: mixHex('#0b0d1c', '#7d8aa3'), minH: 0.12, maxH: 0.3, lit: 0.12 },
            { base: mixHex('#080912', '#5f6b84'), minH: 0.2, maxH: 0.45, lit: 0.22 },
            { base: mixHex('#040408', '#434c60'), minH: 0.25, maxH: 0.6, lit: 0.32 },
        ];
        // In daylight, lit windows are faint.
        const winAlpha = 1 - sky.day * 0.85;
        layers.forEach((L) => {
            let x = -20;
            while (x < w) {
                const bw = 70 + rand() * 170;
                const bh = h * (L.minH + rand() * (L.maxH - L.minH));
                const top = h - bh;
                ctx.fillStyle = L.base;
                ctx.fillRect(x, top, bw - 6, bh);
                for (let wy = top + 14; wy < h - 10; wy += 16) {
                    for (let wx = x + 8; wx < x + bw - 16; wx += 13) {
                        if (rand() < L.lit) {
                            ctx.fillStyle = rand() < 0.8
                                ? `rgba(255,${190 + rand() * 40},${120 + rand() * 50},${(0.5 + rand() * 0.5) * winAlpha})`
                                : `rgba(150,200,255,${(0.4 + rand() * 0.5) * winAlpha})`;
                            ctx.fillRect(wx, wy, 6, 8);
                        }
                    }
                }
                if (rand() < 0.25) {
                    ctx.fillStyle = '#ff3355';
                    ctx.fillRect(x + bw / 2 - 3, top - 8, 5, 5);
                }
                x += bw;
            }
        });
    });

    const posterSiteTex = canvasTex(600, 840, (ctx, w, h) => {
        ctx.fillStyle = '#FFFDF5';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        const block = (x, y, bw, bh, c) => {
            ctx.fillStyle = '#000'; ctx.fillRect(x + 10, y + 10, bw, bh);
            ctx.fillStyle = c; ctx.fillRect(x, y, bw, bh);
            ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeRect(x, y, bw, bh);
        };
        block(60, 80, 160, 160, '#3B82F6');
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(440, 210, 110, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF70A6';
        ctx.beginPath(); ctx.arc(430, 200, 100, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = '#121212';
        ctx.font = '800 110px "Space Grotesk", sans-serif';
        ctx.fillText('CODE.', 40, 450);
        ctx.fillText('CREATE.', 40, 560);
        block(40, 610, 520, 110, '#FBFF48');
        ctx.fillStyle = '#121212';
        ctx.font = '800 64px "Space Grotesk", sans-serif';
        ctx.fillText('DISRUPT.', 70, 690);
        ctx.font = '700 22px "JetBrains Mono", monospace';
        ctx.fillText('SREEDEEP.exe // 2026', 40, 790);
    });

    const posterNetTex = canvasTex(600, 800, (ctx, w, h) => {
        ctx.fillStyle = '#0c0f14';
        ctx.fillRect(0, 0, w, h);
        const layers = [4, 6, 6, 3];
        const pts = layers.map((n, li) => Array.from({ length: n }, (_, i) => [90 + li * 140, 140 + (i + 0.5) * (440 / n)]));
        ctx.lineWidth = 1.2;
        for (let li = 0; li < pts.length - 1; li++) {
            pts[li].forEach((a) => pts[li + 1].forEach((b) => {
                ctx.strokeStyle = `rgba(51,255,87,${0.12 + rand() * 0.35})`;
                ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            }));
        }
        pts.flat().forEach(([x, y]) => {
            ctx.fillStyle = '#0c0f14'; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#33FF57'; ctx.lineWidth = 3; ctx.stroke();
        });
        ctx.fillStyle = '#e8ffe9';
        ctx.font = '800 54px "Space Grotesk", sans-serif';
        ctx.fillText('DEEP', 50, 660);
        ctx.fillText('LEARNING', 50, 718);
        ctx.fillStyle = '#33FF57';
        ctx.font = '700 18px "JetBrains Mono", monospace';
        ctx.fillText('> forward(x) -> y_hat', 52, 760);
    });

    /* ================================================================ */
    /* Room shell                                                        */
    /* ================================================================ */
    const FLOOR = -2.58;
    const CEIL = 6.4;
    const BACK = -2.1;
    const SIDE = 7.5;
    const FRONT = 28;
    const ROOM_H = CEIL - FLOOR;

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(SIDE * 2, FRONT - BACK),
        std(0xffffff, 0.55, 0, { map: floorTex, envMapIntensity: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    put(world, floor, 0, FLOOR, (BACK + FRONT) / 2);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, FRONT - BACK), std(0x2a2d35, 0.95));
    ceiling.rotation.x = Math.PI / 2;
    put(world, ceiling, 0, CEIL, (BACK + FRONT) / 2);

    const wallMat = (w, h) => std(0xffffff, 0.92, 0, { map: withRepeat(wallTex, w / 4, h / 4) });
    function wallBox(w, h, d, x, y, z) {
        const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat(Math.max(w, d), h)));
        return put(world, m, x, y, z);
    }
    const T = 0.2;
    wallBox(T, ROOM_H, FRONT - BACK, SIDE + T / 2, FLOOR + ROOM_H / 2, (BACK + FRONT) / 2);
    wallBox(T, ROOM_H, FRONT - BACK, -SIDE - T / 2, FLOOR + ROOM_H / 2, (BACK + FRONT) / 2);

    // Back wall, built around a window opening left of the desk.
    const WIN = { x0: -7.0, x1: -4.3, y0: 0.6, y1: 4.8 };
    const BZ = BACK - T / 2;
    const fullW = SIDE * 2 + T * 2;
    const leftEdge = -SIDE - T;
    wallBox(WIN.x0 - leftEdge, ROOM_H, T, (leftEdge + WIN.x0) / 2, FLOOR + ROOM_H / 2, BZ);
    wallBox(fullW / 2 - WIN.x1, ROOM_H, T, (WIN.x1 + fullW / 2) / 2, FLOOR + ROOM_H / 2, BZ);
    wallBox(WIN.x1 - WIN.x0, WIN.y0 - FLOOR, T, (WIN.x0 + WIN.x1) / 2, (FLOOR + WIN.y0) / 2, BZ);
    wallBox(WIN.x1 - WIN.x0, CEIL - WIN.y1, T, (WIN.x0 + WIN.x1) / 2, (WIN.y1 + CEIL) / 2, BZ);

    // Skirting boards.
    const skirt = std(0x1c1e24, 0.6);
    put(world, rbox(SIDE * 2, 0.32, 0.06, skirt, 0.01), 0, FLOOR + 0.16, BACK + 0.03);
    put(world, rbox(0.06, 0.32, FRONT - BACK, skirt, 0.01), SIDE - 0.03, FLOOR + 0.16, (BACK + FRONT) / 2);
    put(world, rbox(0.06, 0.32, FRONT - BACK, skirt, 0.01), -SIDE + 0.03, FLOOR + 0.16, (BACK + FRONT) / 2);

    // Window: frame, mullions, glass, sill, curtains, city outside.
    const frameMat = std(0x1a1b20, 0.45, 0.3);
    const wcx = (WIN.x0 + WIN.x1) / 2;
    const wcy = (WIN.y0 + WIN.y1) / 2;
    const ww = WIN.x1 - WIN.x0;
    const wh = WIN.y1 - WIN.y0;
    put(world, rbox(ww + 0.12, 0.12, 0.24, frameMat, 0.02), wcx, WIN.y1, BACK);
    put(world, rbox(ww + 0.12, 0.12, 0.24, frameMat, 0.02), wcx, WIN.y0, BACK);
    put(world, rbox(0.12, wh, 0.24, frameMat, 0.02), WIN.x0, wcy, BACK);
    put(world, rbox(0.12, wh, 0.24, frameMat, 0.02), WIN.x1, wcy, BACK);
    put(world, rbox(0.07, wh, 0.14, frameMat, 0.02), wcx, wcy, BACK - 0.03);
    put(world, rbox(ww, 0.07, 0.14, frameMat, 0.02), wcx, WIN.y0 + wh * 0.64, BACK - 0.03);
    put(world, rbox(ww + 0.5, 0.08, 0.45, std(0x2a2c33, 0.5), 0.02), wcx, WIN.y0 - 0.02, BACK + 0.12);
    const winGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(ww, wh),
        std(0x9fb6d8, 0.05, 0, { transparent: true, opacity: 0.08, depthWrite: false }),
    );
    put(world, winGlass, wcx, wcy, BACK - 0.04);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshBasicMaterial({ map: cityTex }));
    city.material.color.setScalar(0.9);
    put(world, city, wcx + 4, 2.5, -20);

    const curtainMat = std(0x2b3346, 1, 0, { side: THREE.DoubleSide });
    function curtain(x0, x1) {
        const g = new THREE.PlaneGeometry(x1 - x0, CEIL - 0.5 - (FLOOR + 0.15), 40, 1);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 11) * 0.07);
        g.computeVertexNormals();
        const m = shadowed(new THREE.Mesh(g, curtainMat));
        put(world, m, (x0 + x1) / 2, (CEIL - 0.5 + FLOOR + 0.15) / 2, BACK + 0.25);
    }
    curtain(WIN.x0 - 0.45, WIN.x0 + 0.45);
    curtain(WIN.x1 - 0.45, WIN.x1 + 0.4);
    const rod = cyl(0.035, 0.035, ww + 2.0, std(0x111111, 0.3, 0.8), 12);
    rod.rotation.z = Math.PI / 2;
    put(world, rod, wcx, CEIL - 0.42, BACK + 0.28);

    /* ================================================================ */
    /* Lights                                                            */
    /* ================================================================ */
    world.add(new THREE.HemisphereLight(0x8090b8, 0x221a14, lerp(0.35, 0.7, sky.day)));

    // Moonlight (or sunlight, by IST hour) through the window: makes a window-shaped patch on the floor.
    // A narrow spot with no falloff acts like moonlight, but only through the window.
    const moon = new THREE.SpotLight(mixHex('#a9bcff', '#fff0d8'), lerp(2.6, 7, sky.day), 0, 0.17, 0.5, 0);
    moon.position.set(wcx - 1, 18, -14);
    moon.target.position.set(wcx, FLOOR, 2);
    moon.castShadow = true;
    moon.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
    moon.shadow.camera.near = 5;
    moon.shadow.camera.far = 40;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.04;
    world.add(moon, moon.target);
    const windowGlow = new THREE.RectAreaLight(mixHex('#6f86c8', '#cfe2ff'), lerp(2.5, 6, sky.day), ww, wh);
    windowGlow.rotation.y = Math.PI;
    put(world, windowGlow, wcx, wcy, BACK + 0.02);

    // Warm ceiling spot over the desk.
    const spot = new THREE.SpotLight(0xffc48a, 90, 0, 0.62, 0.85, 2);
    spot.position.set(0.6, CEIL - 0.1, 2.4);
    spot.target.position.set(0, 0, -0.6);
    spot.castShadow = !lowPower;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    spot.shadow.normalBias = 0.03;
    world.add(spot, spot.target);

    /* ================================================================ */
    /* Desk                                                              */
    /* ================================================================ */
    const blackMetal = std(0x16171b, 0.38, 0.75);
    put(world, rbox(6.4, 0.16, 2.8, std(0xffffff, 0.42, 0, { map: walnutTex }), 0.04), 0, -0.08, 0);
    [[-2.95, -1.15], [2.95, -1.15], [-2.95, 1.15], [2.95, 1.15]].forEach(([x, z]) => {
        put(world, rbox(0.14, 2.4, 0.14, blackMetal, 0.03), x, -1.38, z);
    });
    put(world, rbox(5.9, 0.14, 0.1, blackMetal, 0.02), 0, -0.24, -1.15);
    put(world, rbox(0.1, 0.14, 2.3, blackMetal, 0.02), -2.95, -0.24, 0);
    put(world, rbox(0.1, 0.14, 2.3, blackMetal, 0.02), 2.95, -0.24, 0);
    const deskStrip = glow(0xff00aa, 2.5);
    put(world, new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.025, 0.025), deskStrip), 0, -0.17, -1.36);
    const deskLight = new THREE.RectAreaLight(0xff00aa, 6, 6, 0.4);
    put(world, deskLight, 0, -0.1, -1.6);

    // Desk mat with RGB edge.
    put(world, rbox(4.0, 0.02, 1.3, std(0x101115, 0.95), 0.008), -0.25, 0.02, 0.75);
    const matEdge = glow(0x00ffff, 1.6);
    put(world, new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.012, 1.35), matEdge), -0.25, 0.012, 0.75);

    /* ================================================================ */
    /* Monitor                                                           */
    /* ================================================================ */
    const monitor = new THREE.Group();
    put(world, monitor, -0.6, 0, -0.55);
    const silver = std(0x8d9097, 0.32, 0.85);
    put(monitor, rbox(1.2, 0.05, 0.62, silver, 0.025), 0, 0.025, -0.08);
    put(monitor, rbox(0.2, 1.0, 0.08, silver, 0.03), 0, 0.52, -0.16);

    const head = new THREE.Group();
    head.position.set(0, 1.85, 0);
    head.rotation.x = -0.04;
    monitor.add(head);
    const bezel = rbox(3.42, 1.98, 0.1, std(0x0b0b0d, 0.45, 0.2), 0.03);
    head.add(bezel);
    put(head, rbox(3.2, 1.6, 0.16, std(0x121215, 0.55, 0.2), 0.08), 0, 0, -0.08);
    put(head, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), glow(0xffffff, 1.5)), 1.55, -0.95, 0.052);

    const sc = document.createElement('canvas');
    sc.width = 1024;
    sc.height = 576;
    const ctx = sc.getContext('2d');
    const screenTex = new THREE.CanvasTexture(sc);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = maxAniso;
    textures.push(screenTex);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    screenMat.color.setScalar(0.95);
    const SCREEN_W = 3.3;
    const SCREEN_H = 1.86;
    const screen = put(head, new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat), 0, 0, 0.051);
    screen.name = 'Screen';

    // Light from the screen onto the desk, and bias light on the wall behind.
    const screenLight = new THREE.RectAreaLight(0xbfe8d0, 3.5, SCREEN_W, SCREEN_H);
    screenLight.rotation.y = Math.PI;
    put(head, screenLight, 0, 0, 0.06);
    const biasLight = new THREE.RectAreaLight(0x7c3aed, 7, 3.0, 1.6);
    put(head, biasLight, 0, 0, -0.2);

    /* ================================================================ */
    /* Tower PC (glass side shows the parts)                             */
    /* ================================================================ */
    const tower = new THREE.Group();
    put(world, tower, 2.3, 0, -0.3, 0.55);
    const caseMat = std(0x0e0f12, 0.4, 0.6);
    const TW = 1.1;
    const TH = 2.5;
    const TD = 2.0;
    put(tower, rbox(0.05, TH, TD, caseMat, 0.02), TW / 2 - 0.025, TH / 2, 0);
    put(tower, rbox(TW, TH, 0.05, caseMat, 0.02), 0, TH / 2, -TD / 2 + 0.025);
    put(tower, rbox(TW, 0.06, TD, caseMat, 0.02), 0, TH - 0.03, 0);
    put(tower, rbox(TW, 0.08, TD, caseMat, 0.02), 0, 0.04, 0);
    [-TW / 2 + 0.03, TW / 2 - 0.03].forEach((x) => {
        put(tower, rbox(0.06, TH, 0.06, caseMat, 0.02), x, TH / 2, TD / 2 - 0.03);
        put(tower, rbox(0.06, TH, 0.06, caseMat, 0.02), x, TH / 2, -TD / 2 + 0.03);
    });
    put(tower, rbox(0.06, 0.06, TD, caseMat, 0.02), -TW / 2 + 0.03, TH - 0.03, 0);
    [[-0.4, -0.75], [0.4, -0.75], [-0.4, 0.75], [0.4, 0.75]].forEach(([x, z]) => {
        put(tower, rbox(0.18, 0.06, 0.18, std(0x050505, 0.8), 0.02), x, -0.03, z);
    });

    const glassMat = std(0x8aa0b4, 0.04, 0.1, { transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 3 });
    const frontGlass = put(tower, new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.06, TH - 0.1), glassMat), 0, TH / 2, TD / 2 + 0.005);
    frontGlass.renderOrder = 2;
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(TD - 0.06, TH - 0.1), glassMat);
    sideGlass.rotation.y = -Math.PI / 2;
    sideGlass.renderOrder = 2;
    put(tower, sideGlass, -TW / 2 - 0.005, TH / 2, 0);

    // Inside the case.
    put(tower, rbox(0.03, 2.1, 1.7, std(0x1a1f1c, 0.6, 0.2), 0.01), TW / 2 - 0.08, 1.4, -0.08);
    put(tower, rbox(TW - 0.1, 0.55, TD - 0.1, caseMat, 0.03), 0, 0.33, 0);
    const shroudGlow = glow(0xffffff, 1.4);
    put(tower, new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.03, TD - 0.3), shroudGlow), -TW / 2 + 0.045, 0.45, 0);
    const gpu = put(tower, rbox(0.62, 0.22, 1.55, std(0x1b1c20, 0.35, 0.7), 0.03), TW / 2 - 0.42, 1.0, -0.05);
    const gpuGlow = glow(0xa855f7, 3);
    put(gpu, new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.035, 1.2), gpuGlow), -0.312, 0.04, 0);
    const pump = cyl(0.2, 0.2, 0.16, std(0x15161a, 0.3, 0.8), 32);
    pump.rotation.z = Math.PI / 2;
    put(tower, pump, TW / 2 - 0.17, 1.75, -0.25);
    const pumpRingMat = glow(0x33ff57, 3);
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 40), pumpRingMat);
    pumpRing.rotation.y = Math.PI / 2;
    put(tower, pumpRing, TW / 2 - 0.26, 1.75, -0.25);
    const ramMats = [];
    for (let i = 0; i < 4; i++) {
        put(tower, rbox(0.12, 0.42, 0.025, std(0x111216, 0.4, 0.6), 0.008), TW / 2 - 0.15, 1.72, 0.22 + i * 0.07);
        const m = glow(0xffffff, 3);
        ramMats.push(m);
        put(tower, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.026), m), TW / 2 - 0.15, 1.95, 0.22 + i * 0.07);
    }
    const tubeMat = std(0x0d0d0f, 0.5, 0.1);
    const tubeA = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 24, Math.PI / 2), tubeMat);
    tubeA.rotation.set(0, Math.PI / 2, 0);
    put(tower, tubeA, TW / 2 - 0.26, 1.9, 0.1);

    // Fans: three in the front, one at the back.
    const bladeParts = [];
    for (let i = 0; i < 9; i++) {
        const b = new THREE.BoxGeometry(0.09, 0.2, 0.01);
        b.translate(0, 0.15, 0);
        b.rotateY(0.45);
        b.rotateZ((i / 9) * Math.PI * 2);
        bladeParts.push(b);
    }
    bladeParts.push(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20).rotateX(Math.PI / 2));
    const bladeGeo = mergeGeometries(bladeParts);
    bladeParts.forEach((g) => g.dispose());
    const bladeMat = std(0x1d1e22, 0.5, 0.1, { transparent: true, opacity: 0.85 });
    const ringGeo = new THREE.TorusGeometry(0.29, 0.025, 8, 48);
    const fanFrameGeo = new RoundedBoxGeometry(0.7, 0.7, 0.1, 2, 0.05);
    const fanFrameMat = std(0x0c0c0e, 0.5, 0.3);
    const fans = [];
    function addFan(x, y, z, ry, offset) {
        const g = new THREE.Group();
        put(tower, g, x, y, z, ry);
        const frame = new THREE.Mesh(fanFrameGeo, fanFrameMat);
        frame.scale.z = 0.6;
        frame.position.z = -0.04;
        g.add(frame);
        const ringMat = glow(0xffffff, 3.2);
        g.add(new THREE.Mesh(ringGeo, ringMat));
        const blades = new THREE.Mesh(bladeGeo, bladeMat);
        blades.position.z = 0.01;
        g.add(blades);
        fans.push({ blades, ringMat, offset, speed: 9 + rand() * 4 });
    }
    [0.62, 1.32, 2.02].forEach((y, i) => addFan(0, y, TD / 2 - 0.09, 0, i * 0.08));
    addFan(0.05, 1.9, -TD / 2 + 0.1, Math.PI, 0.3);

    const caseLight = new THREE.PointLight(0xff3399, 4, 3.5, 2);
    put(tower, caseLight, -0.1, 1.4, 0.3);
    const powerLed = glow(0xffffff, 2);
    put(tower, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 12), powerLed), 0.3, TH + 0.005, TD / 2 - 0.15);

    /* ================================================================ */
    /* Keyboard, mouse, speaker, mug                                     */
    /* ================================================================ */
    const kb = new THREE.Group();
    put(world, kb, -0.6, 0.03, 0.8);
    put(kb, rbox(2.3, 0.09, 0.74, std(0x202227, 0.35, 0.75), 0.03), 0, 0.045, 0);
    const kbPlate = glow(0xffffff, 2.2);
    put(kb, new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.01, 0.64), kbPlate), 0, 0.095, 0);
    const keyGeo = new RoundedBoxGeometry(0.12, 0.07, 0.11, 2, 0.022);
    const keyMat = std(0x1c1d22, 0.6, 0.05);
    const spots = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 15; col++) {
            if (row === 4 && col >= 4 && col <= 10) continue;
            spots.push([-0.98 + col * 0.14, -0.26 + row * 0.13, 0.12]);
        }
    }
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, spots.length + 1);
    const dummy = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
        dummy.position.set(x, 0.13, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        keys.setMatrixAt(i, dummy.matrix);
    });
    dummy.position.set(0, 0.13, 0.26);
    dummy.scale.set(7.9, 1, 1);
    dummy.updateMatrix();
    keys.setMatrixAt(spots.length, dummy.matrix);
    keys.castShadow = true;
    keys.receiveShadow = true;
    kb.add(keys);

    const mouse = new THREE.Group();
    put(world, mouse, 1.05, 0.03, 0.85, -0.1);
    const mouseBody = rbox(0.34, 0.14, 0.56, std(0x17181c, 0.4, 0.3), 0.12, 4);
    mouseBody.scale.set(1, 1, 1);
    put(mouse, mouseBody, 0, 0.07, 0);
    const mouseGlow = glow(0xffffff, 2.5);
    put(mouse, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.02), mouseGlow), 0, 0.03, 0.27);
    put(mouse, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12).rotateZ(Math.PI / 2), std(0x333333, 0.5)), 0, 0.145, -0.12);

    const speaker = new THREE.Group();
    put(world, speaker, -2.7, 0, -0.75, 0.25);
    put(speaker, rbox(0.62, 1.05, 0.7, std(0x141416, 0.55, 0.1), 0.04), 0, 0.525, 0);
    const cone = cyl(0.2, 0.2, 0.04, std(0x0a0a0b, 0.8), 32);
    cone.rotation.x = Math.PI / 2;
    put(speaker, cone, 0, 0.36, 0.35);
    const tweet = cyl(0.08, 0.08, 0.04, std(0x2a2a2e, 0.3, 0.6), 24);
    tweet.rotation.x = Math.PI / 2;
    put(speaker, tweet, 0, 0.78, 0.35);

    const mug = new THREE.Group();
    put(world, mug, -2.55, 0, 0.75, 0.6);
    const ceramic = std(0xece6dc, 0.28);
    put(mug, cyl(0.17, 0.155, 0.38, ceramic, 32), 0, 0.19, 0);
    put(mug, cyl(0.15, 0.15, 0.01, std(0x2a1607, 0.2), 32), 0, 0.33, 0);
    const handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 10, 24, Math.PI), ceramic));
    handle.rotation.z = -Math.PI / 2;
    put(mug, handle, 0.17, 0.19, 0);

    /* ================================================================ */
    /* Figurine of Sreedeep on the desk: click it to open the CV chatbot */
    /* ================================================================ */
    // Stands between the desk speaker and the mug, turned a little toward the camera.
    const figurine = new THREE.Group();
    put(world, figurine, -2.62, 0, 0.0, 0.35);
    figurine.scale.setScalar(1.35);
    const figBody = new THREE.Group();
    figurine.add(figBody);
    const skin = std(0xc68a5a, 0.55);
    const hoodie = std(0x18181c, 0.7);
    const jeans = std(0x1e3a8a, 0.75);
    const hairMat = std(0x16110d, 0.6);
    const ink = std(0x050505, 0.3);

    // Display base with a glowing ring.
    put(figBody, cyl(0.24, 0.26, 0.06, std(0x121212, 0.35, 0.4), 40), 0, 0.03, 0);
    const figRingMat = glow(0x33ff57, 2.2);
    const figRing = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.012, 8, 48), figRingMat);
    figRing.rotation.x = Math.PI / 2;
    put(figBody, figRing, 0, 0.06, 0);

    // Everything above the base bobs together.
    const figBob = new THREE.Group();
    put(figBody, figBob, 0, 0.06, 0);
    [-0.065, 0.065].forEach((x) => {
        put(figBob, rbox(0.1, 0.05, 0.15, std(0xf5f5f5, 0.5), 0.02), x, 0.025, 0.02);
        put(figBob, cyl(0.042, 0.046, 0.19, jeans, 16), x, 0.14, 0);
    });
    put(figBob, rbox(0.32, 0.3, 0.19, hoodie, 0.07, 3), 0, 0.38, 0);
    // Chest print: the site's </> tag.
    const chestTex = canvasTex(128, 64, (c, w, h) => {
        c.fillStyle = '#33FF57';
        c.font = '800 44px "JetBrains Mono", monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('</>', w / 2, h / 2 + 2);
    });
    const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: chestTex, transparent: true }));
    chest.material.color.setScalar(1.6);
    put(figBob, chest, 0, 0.4, 0.097);
    // Headphones around the neck.
    const phones = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 32), std(0x33ff57, 0.4));
    phones.rotation.x = Math.PI / 2 - 0.2;
    put(figBob, phones, 0, 0.53, 0.01);
    // Left arm hangs. Right arm hangs from a shoulder pivot so it can wave.
    const armGeo = new THREE.CapsuleGeometry(0.038, 0.17, 4, 12);
    const armL = shadowed(new THREE.Mesh(armGeo, hoodie));
    armL.rotation.z = -0.18;
    put(figBob, armL, -0.2, 0.37, 0);
    put(figBob, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), skin)), -0.218, 0.24, 0);
    const shoulderR = new THREE.Group();
    put(figBob, shoulderR, 0.175, 0.5, 0);
    const armR = shadowed(new THREE.Mesh(armGeo, hoodie));
    put(shoulderR, armR, 0.02, -0.12, 0);
    put(shoulderR, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), skin)), 0.04, -0.25, 0);
    shoulderR.rotation.z = 0.18;
    // Big chibi head with hair, eyes and a smile.
    const figHead = new THREE.Group();
    put(figBob, figHead, 0, 0.72, 0);
    put(figHead, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), skin)), 0, 0, 0);
    const hair = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.182, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat));
    hair.rotation.x = -0.35;
    put(figHead, hair, 0, 0.012, -0.01);
    const fringe = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), hairMat));
    fringe.scale.set(1.5, 0.45, 0.8);
    put(figHead, fringe, 0.03, 0.11, 0.1);
    [-0.06, 0.06].forEach((x) => {
        put(figHead, new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), ink), x, 0.01, 0.155);
        put(figHead, new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), glow(0xffffff, 1.2)), x + 0.008, 0.02, 0.175);
    });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI), ink);
    smile.rotation.z = Math.PI;
    put(figHead, smile, 0, -0.055, 0.158);
    put(figHead, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin)), -0.17, -0.01, 0);
    put(figHead, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin)), 0.17, -0.01, 0);

    // "ASK ME!" speech bubble that floats above the head while the chat is closed.
    const bubbleTex = canvasTex(256, 128, (c) => {
        c.fillStyle = '#000';
        c.beginPath();
        c.roundRect(14, 14, 230, 82, 16);
        c.fill();
        c.fillStyle = '#FBFF48';
        c.beginPath();
        c.roundRect(6, 6, 230, 82, 16);
        c.fill();
        c.lineWidth = 6;
        c.strokeStyle = '#000';
        c.stroke();
        c.fillStyle = '#FBFF48';
        c.beginPath();
        c.moveTo(60, 84);
        c.lineTo(52, 120);
        c.lineTo(92, 84);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#FBFF48';
        c.fillRect(58, 78, 32, 9);
        c.fillStyle = '#121212';
        c.font = '800 40px "JetBrains Mono", monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('ASK ME!', 121, 48);
    });
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false, toneMapped: false }));
    bubble.scale.set(0.62, 0.31, 1);
    bubble.center.set(0.25, 0);
    put(figurine, bubble, 0.08, 1.02, 0);
    bubble.renderOrder = 3;

    const fig = { hot: false, open: false, talking: false, scale: 1, bubble: 1 };
    function updateFigurine(dt, t) {
        const k = 1 - Math.pow(0.0001, dt);
        // Idle bob, faster while the bot is replying.
        figBob.position.y = 0.06 + Math.abs(Math.sin(t * (fig.talking ? 9 : 2.2))) * (fig.talking ? 0.025 : 0.012);
        // Wave when hovered or while the chat is open; arm down otherwise.
        const waving = fig.hot || fig.open;
        const armTarget = waving ? 2.5 + Math.sin(t * 9) * 0.45 : 0.18;
        shoulderR.rotation.z = lerp(shoulderR.rotation.z, armTarget, k * 0.6);
        // Nod while talking, and look a little toward the pointer.
        figHead.rotation.x = fig.talking ? Math.sin(t * 14) * 0.09 : lerp(figHead.rotation.x, 0, k);
        figHead.rotation.y = lerp(figHead.rotation.y, pointer.has ? clamp(pointer.nx * 1.2 + 0.35, -0.5, 0.8) : 0, k * 0.4);
        fig.scale = lerp(fig.scale, fig.hot ? 1.1 : 1, k);
        figBody.scale.setScalar(fig.scale);
        // Ring: green idle, pink while chatting.
        setGlow(figRingMat, fig.open ? 0.93 : 0.36, 1, 0.45 + Math.sin(t * 3) * 0.1);
        fig.bubble = lerp(fig.bubble, fig.open ? 0 : 1, k);
        bubble.material.opacity = fig.bubble;
        bubble.visible = fig.bubble > 0.02;
        bubble.position.y = 1.02 + Math.sin(t * 2.4) * 0.03;
    }

    /* ================================================================ */
    /* Gaming chair                                                      */
    /* ================================================================ */
    const chair = new THREE.Group();
    put(world, chair, -4.1, FLOOR, 2.0, 1.25);
    const leather = std(0x141418, 0.42, 0.05);
    const accent = std(0x6d28d9, 0.48, 0.05);
    const chrome = std(0xcfd2d8, 0.15, 1);
    for (let i = 0; i < 5; i++) {
        const arm = new THREE.Group();
        arm.rotation.y = (i / 5) * Math.PI * 2;
        chair.add(arm);
        const leg = rbox(0.13, 0.1, 1.0, blackMetal, 0.04);
        leg.rotation.x = 0.08;
        put(arm, leg, 0, 0.3, 0.5);
        put(arm, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), std(0x0a0a0a, 0.5))), 0, 0.1, 0.98);
    }
    put(chair, cyl(0.08, 0.08, 0.95, chrome, 20), 0, 0.82, 0);
    put(chair, rbox(1.9, 0.36, 1.8, leather, 0.16, 4), 0, 1.5, 0);
    put(chair, rbox(0.24, 0.42, 1.75, accent, 0.1, 3), -0.86, 1.56, 0);
    put(chair, rbox(0.24, 0.42, 1.75, accent, 0.1, 3), 0.86, 1.56, 0);
    const backrest = new THREE.Group();
    backrest.position.set(0, 1.6, -0.82);
    backrest.rotation.x = -0.14;
    chair.add(backrest);
    put(backrest, rbox(1.7, 3.2, 0.34, leather, 0.15, 4), 0, 1.6, 0);
    put(backrest, rbox(0.26, 2.9, 0.44, accent, 0.12, 3), -0.78, 1.5, 0.04);
    put(backrest, rbox(0.26, 2.9, 0.44, accent, 0.12, 3), 0.78, 1.5, 0.04);
    put(backrest, rbox(0.9, 0.42, 0.22, leather, 0.1, 3), 0, 2.85, 0.24);
    put(backrest, rbox(1.0, 0.5, 0.22, leather, 0.1, 3), 0, 0.75, 0.24);
    put(backrest, rbox(0.5, 0.14, 0.02, glow(0xa855f7, 1.2), 0.01), 0, 2.4, 0.18);
    [-1.05, 1.05].forEach((x) => {
        put(chair, rbox(0.12, 0.7, 0.12, blackMetal, 0.03), x, 1.85, -0.1);
        put(chair, rbox(0.26, 0.08, 0.8, leather, 0.04), x, 2.22, -0.05);
    });

    /* ================================================================ */
    /* Wall decor: posters, shelf, hex lights                            */
    /* ================================================================ */
    function poster(tex, w, h, x, y, z, ry = 0) {
        const g = new THREE.Group();
        put(world, g, x, y, z, ry);
        put(g, rbox(w + 0.12, h + 0.12, 0.06, std(0x101012, 0.4, 0.4), 0.015), 0, 0, 0.03);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, 0.75, 0, { map: tex }));
        p.receiveShadow = true;
        put(g, p, 0, 0, 0.062);
        return g;
    }
    poster(posterSiteTex, 1.5, 2.1, 5.0, 2.1, BACK);
    poster(posterNetTex, 1.2, 1.6, -3.15, 2.35, BACK);

    const BOOK_COLORS = [0x7f1d1d, 0x1e3a8a, 0x14532d, 0x78350f, 0x312e81, 0x9a3412, 0xd6d3d1, 0x111827, 0x854d0e, 0x4c1d95, 0x0f766e, 0xbe123c, 0x334155];
    function bookRow(parent, x0, x1, y, z, depth, maxH) {
        const items = [];
        let x = x0;
        while (x < x1) {
            const w = 0.09 + rand() * 0.12;
            if (x + w > x1) break;
            if (rand() < 0.08) { x += 0.25; continue; }
            const h = maxH * (0.62 + rand() * 0.38);
            items.push({ x: x + w / 2, w, h, d: depth * (0.75 + rand() * 0.25), c: pick(BOOK_COLORS), tilt: 0 });
            x += w + 0.008;
        }
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, 0.75), items.length);
        const col = new THREE.Color();
        items.forEach((b, i) => {
            dummy.position.set(b.x, y + b.h / 2, z);
            dummy.rotation.set(0, 0, b.tilt);
            dummy.scale.set(b.w, b.h, b.d);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            mesh.setColorAt(i, col.setHex(b.c));
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
    }

    // Floating shelf above the monitor.
    const shelf = new THREE.Group();
    put(world, shelf, -0.6, 3.75, BACK + 0.3);
    put(shelf, rbox(3.2, 0.1, 0.55, std(0xffffff, 0.45, 0, { map: walnutTex }), 0.02), 0, 0, 0);
    bookRow(shelf, -1.5, 0.2, 0.05, 0, 0.42, 0.75);
    put(shelf, rbox(0.34, 0.34, 0.34, std(0x33ff57, 0.35), 0.05), 0.55, 0.22, 0.02, 0.4);
    const potS = cyl(0.17, 0.13, 0.3, std(0x1f1f22, 0.4), 24);
    put(shelf, potS, 1.15, 0.2, 0);
    for (let i = 0; i < 7; i++) {
        const leaf = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), std(0x2f6b3a, 0.6)));
        leaf.scale.set(0.6, 1.5, 0.35);
        leaf.rotation.set((rand() - 0.5) * 1.2, rand() * 6, (rand() - 0.5) * 1.4);
        put(shelf, leaf, 1.15 + (rand() - 0.5) * 0.2, 0.48 + rand() * 0.12, (rand() - 0.5) * 0.15);
    }

    // Hexagon light panels on the back wall.
    const hexGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 6).rotateX(Math.PI / 2);
    const hexBackGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.04, 6).rotateX(Math.PI / 2);
    const hexes = [];
    const hexCells = [[0, 0], [1, 0], [0, 1], [1, -1], [2, -1], [-1, 1], [2, 0]];
    const hexGroup = new THREE.Group();
    put(world, hexGroup, 2.4, 4.75, BACK + 0.03);
    hexCells.forEach(([q, r], i) => {
        const x = 0.79 * (q + r / 2);
        const y = 0.685 * r;
        put(hexGroup, new THREE.Mesh(hexBackGeo, std(0xdddddd, 0.6)), x, y, 0.02);
        const m = glow(0xffffff, 1.1);
        put(hexGroup, new THREE.Mesh(hexGeo, m), x, y, 0.05);
        hexes.push({ m, offset: i * 0.06 });
    });
    const hexLight = new THREE.PointLight(0x55aaff, 5, 5, 2);
    put(world, hexLight, 3.0, 4.75, BACK + 0.8);

    /* ================================================================ */
    /* Bookshelf, floor lamp, plant, rug                                 */
    /* ================================================================ */
    const bookcase = new THREE.Group();
    put(world, bookcase, SIDE - 0.55, FLOOR, 1.6, -Math.PI / 2);
    const caseWood = std(0x1d1e22, 0.55, 0.1);
    const BW = 3.0;
    const BH = 6.2;
    const BD = 1.0;
    put(bookcase, rbox(0.08, BH, BD, caseWood, 0.02), -BW / 2, BH / 2, 0);
    put(bookcase, rbox(0.08, BH, BD, caseWood, 0.02), BW / 2, BH / 2, 0);
    put(bookcase, rbox(BW, BH, 0.04, caseWood, 0.01), 0, BH / 2, -BD / 2 + 0.02);
    [0.08, 1.3, 2.55, 3.8, 5.05, BH - 0.04].forEach((y, i) => {
        put(bookcase, rbox(BW, 0.08, BD, caseWood, 0.01), 0, y, 0);
        if (i < 5) bookRow(bookcase, -BW / 2 + 0.1, BW / 2 - 0.1 - (i % 2 ? 0.8 : 0.1), y + 0.04, 0.05, 0.75, 1.05);
    });
    put(bookcase, rbox(0.5, 0.5, 0.5, std(0xFBFF48, 0.4), 0.06), 1.05, 1.59, 0.05, 0.3);
    put(bookcase, shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), std(0xffffff, 0.15, 0.9))), 1.05, 4.1, 0.05);

    // Speaker on top of the bookcase. Clicking it plays the song (see Music below).
    // Turned 45° so its front faces between the room and the camera.
    const shelfSpeaker = new THREE.Group();
    put(bookcase, shelfSpeaker, 0.55, BH, 0.05, Math.PI / 4);
    const spkBody = new THREE.Group();
    shelfSpeaker.add(spkBody);
    const SPK_W = 0.8;
    const SPK_H = 1.15;
    const SPK_D = 0.65;
    const SPK_FRONT = SPK_D / 2;
    put(spkBody, rbox(SPK_W, SPK_H, SPK_D, std(0x141416, 0.55, 0.1), 0.05), 0, SPK_H / 2, 0);
    put(spkBody, rbox(SPK_W - 0.08, SPK_H - 0.08, 0.02, std(0x0b0b0d, 0.85), 0.01), 0, SPK_H / 2, SPK_FRONT);
    const woofer = new THREE.Group();
    put(spkBody, woofer, 0, 0.42, SPK_FRONT + 0.01);
    put(woofer, shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 10, 40), std(0x1a1a1c, 0.7))), 0, 0, 0);
    const wooferCone = cyl(0.06, 0.24, 0.08, std(0x0a0a0b, 0.8, 0, { side: THREE.DoubleSide }), 32, true);
    wooferCone.rotation.x = -Math.PI / 2;
    put(woofer, wooferCone, 0, 0, -0.04);
    const dustCap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 10), std(0x202024, 0.4, 0.3)));
    dustCap.scale.z = 0.45;
    put(woofer, dustCap, 0, 0, -0.07);
    const spkRingMat = glow(0xffffff, 2.5);
    put(spkBody, new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 48), spkRingMat), 0, 0.42, SPK_FRONT + 0.015);
    const tweeter = cyl(0.08, 0.08, 0.03, std(0x2a2a2e, 0.3, 0.6), 24);
    tweeter.rotation.x = Math.PI / 2;
    put(spkBody, tweeter, 0, 0.9, SPK_FRONT + 0.01);
    const tweeterDome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 8), std(0x8d9097, 0.25, 0.85)));
    tweeterDome.scale.z = 0.5;
    put(spkBody, tweeterDome, 0, 0.9, SPK_FRONT + 0.025);
    const spkLed = glow(0xff3355, 2);
    put(spkBody, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12).rotateX(Math.PI / 2), spkLed), 0.28, 0.1, SPK_FRONT + 0.012);

    // Music notes: sprites that float up and out of the speaker front.
    function noteTex(beamed) {
        return canvasTex(128, 128, (c) => {
            c.fillStyle = '#fff';
            const head = (x, y) => {
                c.beginPath();
                c.ellipse(x, y, 19, 13, -0.4, 0, Math.PI * 2);
                c.fill();
            };
            if (!beamed) {
                head(46, 98);
                c.fillRect(58, 22, 9, 74);
                c.beginPath();
                c.moveTo(67, 22);
                c.bezierCurveTo(78, 40, 104, 46, 92, 80);
                c.bezierCurveTo(96, 56, 80, 50, 67, 46);
                c.closePath();
                c.fill();
            } else {
                head(30, 102);
                head(92, 90);
                c.fillRect(42, 26, 9, 74);
                c.fillRect(104, 14, 9, 74);
                c.beginPath();
                c.moveTo(42, 26);
                c.lineTo(113, 12);
                c.lineTo(113, 28);
                c.lineTo(42, 42);
                c.closePath();
                c.fill();
            }
        });
    }
    const noteTexs = [noteTex(false), noteTex(true)];
    const NOTE_COLORS = [0x33ff57, 0xff70a6, 0xfbff48, 0x3b82f6, 0xa855f7];
    const noteGroup = new THREE.Group();
    shelfSpeaker.add(noteGroup);
    const notes = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    function spawnNote() {
        let n = notes.find((o) => !o.alive);
        if (!n) {
            if (notes.length >= 32) return;
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexs[0], transparent: true, depthWrite: false }));
            noteGroup.add(s);
            n = { s };
            notes.push(n);
        }
        const m = n.s.material;
        m.map = noteTexs[Math.random() < 0.5 ? 0 : 1];
        m.color.setHex(NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]).multiplyScalar(1.6);
        m.opacity = 0;
        n.alive = true;
        n.age = 0;
        n.life = rnd(2.2, 3.0);
        n.size = rnd(0.22, 0.32);
        n.x0 = rnd(-0.2, 0.2);
        n.y0 = rnd(0.35, 0.95);
        n.vx = rnd(-0.18, 0.18);
        // The speaker sits near the top of the view, so notes drift out more than up.
        n.vy = rnd(0.28, 0.48);
        n.vz = rnd(0.6, 0.95);
        n.phase = rnd(0, Math.PI * 2);
        n.spin = rnd(-0.6, 0.6);
        n.s.visible = true;
        n.s.scale.setScalar(n.size * 0.5);
        n.s.position.set(n.x0, n.y0, SPK_FRONT + 0.05);
    }
    function updateNotes(dt) {
        notes.forEach((n) => {
            if (!n.alive) return;
            n.age += dt;
            const p = n.age / n.life;
            if (p >= 1) { n.alive = false; n.s.visible = false; return; }
            const a = n.age;
            n.s.position.set(
                n.x0 + n.vx * a + Math.sin(a * 3 + n.phase) * 0.12,
                n.y0 + n.vy * a,
                SPK_FRONT + 0.05 + n.vz * a,
            );
            n.s.scale.setScalar(n.size * Math.min(1, 0.5 + p * 4));
            n.s.material.rotation = Math.sin(a * 2.5 + n.phase) * 0.35 + n.spin * a;
            n.s.material.opacity = Math.min(1, p / 0.08) * (p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
        });
    }

    const lamp = new THREE.Group();
    put(world, lamp, SIDE - 0.95, FLOOR, -1.25);
    put(lamp, cyl(0.45, 0.5, 0.08, blackMetal, 32), 0, 0.04, 0);
    put(lamp, cyl(0.035, 0.035, 5.0, blackMetal, 12), 0, 2.5, 0);
    const shade = cyl(0.55, 0.75, 0.95, std(0xf1e4cc, 0.9, 0, { side: THREE.DoubleSide, emissive: 0xffb877, emissiveIntensity: 0.9 }), 40, true);
    put(lamp, shade, 0, 5.1, 0);
    put(lamp, new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), glow(0xffd2a0, 4)), 0, 5.0, 0);
    const lampLight = new THREE.PointLight(0xffb06a, 22, 0, 2);
    put(lamp, lampLight, 0, 4.9, 0.1);

    const plant = new THREE.Group();
    put(world, plant, 4.75, FLOOR, -1.35);
    put(plant, cyl(0.5, 0.38, 1.1, std(0xe7e2d8, 0.35), 36), 0, 0.55, 0);
    const soilMat = std(0x2a1d14, 1);
    put(plant, cyl(0.46, 0.46, 0.02, soilMat, 24), 0, 1.05, 0);
    const plantLeaves = [];
    const leafGeo = new THREE.BoxGeometry(0.22, 1, 0.025, 1, 8, 1);
    {
        const p = leafGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const yN = p.getY(i) + 0.5;
            p.setX(i, p.getX(i) * (1 - yN * 0.85));
            p.setZ(i, p.getZ(i) + Math.sin(yN * Math.PI) * 0.06);
        }
        leafGeo.translate(0, 0.5, 0);
        leafGeo.computeVertexNormals();
    }
    const leafMats = [std(0x2d5a32, 0.55), std(0x3f7a3c, 0.55), std(0x24452a, 0.6)];
    for (let i = 0; i < 16; i++) {
        const leaf = shadowed(new THREE.Mesh(leafGeo, pick(leafMats)));
        const a = rand() * Math.PI * 2;
        const r = rand() * 0.3;
        leaf.position.set(Math.cos(a) * r, 1.02, Math.sin(a) * r);
        leaf.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
        leaf.scale.set(1, 1.3 + rand() * 1.1, 1);
        plant.add(leaf);
        plantLeaves.push(leaf);
    }

    /* ---- Watering: hover the plant to show a can, click to pour, then it flowers ---- */
    // No seeded rand() below this point in the plant code, so the rest of the room keeps its layout.
    // The can floats on the right of the plant (open wall), turned to pour leftward into the pot.
    const canGroup = new THREE.Group();
    put(plant, canGroup, 0.95, 1.95, 0.3, Math.PI);
    canGroup.scale.setScalar(0.001);
    canGroup.visible = false;
    const canMat = std(0x3b82f6, 0.35, 0.35);
    put(canGroup, cyl(0.22, 0.24, 0.4, canMat, 32), 0, 0, 0);
    const canRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 32), canMat);
    canRim.rotation.x = Math.PI / 2;
    put(canGroup, canRim, 0, 0.2, 0);
    put(canGroup, shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24, Math.PI), canMat)), -0.06, 0.2, 0);
    // Spout: leaves the body low on the right side, angled up and out.
    const SPOUT_ANGLE = 1.0;
    const spoutDir = new THREE.Vector3(Math.sin(SPOUT_ANGLE), Math.cos(SPOUT_ANGLE), 0);
    const spoutBase = new THREE.Vector3(0.2, -0.08, 0);
    const spout = cyl(0.025, 0.04, 0.55, canMat, 16);
    spout.rotation.z = -SPOUT_ANGLE;
    spout.position.copy(spoutBase).addScaledVector(spoutDir, 0.275);
    canGroup.add(spout);
    const rose = cyl(0.075, 0.03, 0.08, std(0x2563eb, 0.3, 0.5), 16);
    rose.rotation.z = -SPOUT_ANGLE;
    rose.position.copy(spoutBase).addScaledVector(spoutDir, 0.57);
    canGroup.add(rose);
    const spoutTip = new THREE.Object3D();
    spoutTip.position.copy(spoutBase).addScaledVector(spoutDir, 0.62);
    canGroup.add(spoutTip);
    const spoutRoot = new THREE.Object3D();
    spoutRoot.position.copy(spoutBase);
    canGroup.add(spoutRoot);

    // Water drops: a small pool of stretched spheres.
    const dropGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 });
    const drops = Array.from({ length: 48 }, () => {
        const m = new THREE.Mesh(dropGeo, dropMat);
        m.visible = false;
        plant.add(m);
        return { m, v: new THREE.Vector3(), alive: false };
    });
    const tmpV = new THREE.Vector3();
    const SOIL_DRY = new THREE.Color(0x2a1d14);
    const SOIL_WET = new THREE.Color(0x120b06);

    // Flowers at the tips of every other leaf. They start at scale 0.
    const PETAL_COLORS = [0xff70a6, 0xffffff, 0xc084fc, 0xff70a6, 0xffb4d2];
    const petalGeo = new THREE.SphereGeometry(0.075, 12, 8);
    const centerMat = std(0xfbff48, 0.5, 0, { emissive: 0xfbd000, emissiveIntensity: 0.5 });
    const flowers = plantLeaves.filter((_, i) => i % 2 === 0).map((leaf, i) => {
        leaf.updateMatrix();
        const tip = new THREE.Vector3(0, 0.97, 0).applyMatrix4(leaf.matrix);
        const g = new THREE.Group();
        g.position.copy(tip);
        g.rotation.set(0.25 * Math.sin(i * 2.1), i * 1.3, 0.25 * Math.cos(i * 1.7));
        g.scale.setScalar(0);
        const c = PETAL_COLORS[i % PETAL_COLORS.length];
        const petalMat = std(c, 0.6, 0, { emissive: c, emissiveIntensity: 0.22 });
        for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.scale.set(1, 0.32, 0.6);
            petal.position.set(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
            petal.rotation.y = -a;
            g.add(petal);
        }
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), centerMat));
        plant.add(g);
        return { g, delay: i * 0.14, size: 1.45 + (i % 3) * 0.25 };
    });

    const POUR_TIME = 2.4;
    const water = { hot: false, pour: -1, show: 0, bloom: -1, bounce: -1, wet: 0, spawnAcc: 0 };
    const easeOutBack = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
    function waterPlant() {
        if (water.pour >= 0) return;
        water.pour = 0;
    }
    function spawnDrop() {
        const d = drops.find((o) => !o.alive);
        if (!d) return;
        plant.worldToLocal(spoutTip.getWorldPosition(d.m.position));
        // Out along the tilted spout (tip minus root, in plant space), with a little spread.
        plant.worldToLocal(spoutRoot.getWorldPosition(tmpV));
        tmpV.subVectors(d.m.position, tmpV).normalize();
        d.v.set(tmpV.x * 0.9 + (Math.random() - 0.5) * 0.25, tmpV.y * 0.9, (Math.random() - 0.5) * 0.25);
        d.alive = true;
        d.m.visible = true;
    }
    function updatePlant(dt) {
        const k = 1 - Math.pow(0.0005, dt);
        const pouring = water.pour >= 0;
        // The can shows on hover and always while pouring (touch screens have no hover).
        water.show = lerp(water.show, water.hot || pouring ? 1 : 0, k);
        canGroup.visible = water.show > 0.02;
        canGroup.scale.setScalar(Math.max(0.001, water.show));

        let tilt = 0;
        if (pouring) {
            water.pour += dt;
            const p = water.pour;
            tilt = p < 0.4 ? easeInOut(p / 0.4) : p > POUR_TIME - 0.4 ? easeInOut((POUR_TIME - p) / 0.4) : 1;
            water.wet = Math.min(1, water.wet + dt * 0.6);
            if (tilt > 0.6) {
                water.spawnAcc += dt;
                while (water.spawnAcc > 0.022) { water.spawnAcc -= 0.022; spawnDrop(); }
            }
            if (p >= POUR_TIME) {
                water.pour = -1;
                water.spawnAcc = 0;
                if (water.bloom < 0) water.bloom = 0;
                else water.bounce = 0;
            }
        }
        canGroup.rotation.z = -0.8 * tilt;
        canGroup.position.y = 1.95 + Math.sin(performance.now() / 400) * 0.03 * (1 - tilt);

        drops.forEach((d) => {
            if (!d.alive) return;
            d.v.y -= 7 * dt;
            d.m.position.addScaledVector(d.v, dt);
            d.m.scale.set(1, clamp(1 + -d.v.y * 0.6, 1, 2.6), 1);
            if (d.m.position.y < 1.07) { d.alive = false; d.m.visible = false; }
        });

        // Wet soil looks darker.
        soilMat.color.copy(SOIL_DRY).lerp(SOIL_WET, water.wet);
        soilMat.roughness = 1 - water.wet * 0.5;

        if (water.bloom >= 0) water.bloom += dt;
        if (water.bounce >= 0) { water.bounce += dt; if (water.bounce > 1) water.bounce = -1; }
        flowers.forEach((f) => {
            const x = water.bloom < 0 ? 0 : clamp((water.bloom - f.delay) / 0.7, 0, 1);
            const pop = water.bounce >= 0 ? Math.sin(clamp((water.bounce - f.delay * 0.4) / 0.5, 0, 1) * Math.PI) * 0.25 : 0;
            f.g.scale.setScalar(Math.max(0, easeOutBack(x)) * f.size * (1 + pop));
            if (x > 0) f.g.rotation.y += dt * 0.15;
        });
    }

    const rug = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 6.5), std(0xffffff, 1, 0, { map: rugTex }));
    rug.rotation.x = -Math.PI / 2;
    rug.receiveShadow = true;
    put(world, rug, -0.8, FLOOR + 0.01, 3.0);

    /* ================================================================ */
    /* Screen content (2D canvas texture)                                */
    /* ================================================================ */
    const screenState = { hot: false, blink: true, boot: -1 };
    function drawScreen() {
        const W = sc.width;
        const H = sc.height;
        const mono = '"JetBrains Mono", monospace';
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#33FF57';
        ctx.fillRect(0, 0, W, 46);
        ctx.fillStyle = '#121212';
        ctx.font = `800 24px ${mono}`;
        ctx.textAlign = 'left';
        ctx.fillText('SREEDEEP.exe', 22, 24);
        ctx.textAlign = 'right';
        ctx.fillText('_  □  ×', W - 22, 24);
        ctx.textAlign = 'left';

        ctx.fillStyle = '#FFFDF5';
        ctx.font = `700 28px ${mono}`;
        ['> init portfolio ........ OK', '> load modules: AI / ML / WEB', '> status: READY']
            .forEach((line, i) => ctx.fillText(line, 44, 104 + i * 44));

        ctx.font = '800 76px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#FBFF48';
        ctx.fillText('HELLO, WORLD.', 44, 292);

        if (screenState.boot < 0) {
            const label = `[ ${verb} TO BOOT ]`;
            ctx.font = `800 40px ${mono}`;
            const tw = ctx.measureText(label).width;
            const bw = tw + 64;
            const bx = 44;
            const by = 380;
            const bh = 92;
            ctx.fillStyle = screenState.hot ? '#FF70A6' : '#33FF57';
            ctx.fillRect(bx + 10, by + 10, bw, bh);
            ctx.fillStyle = screenState.hot ? '#33FF57' : '#121212';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = '#33FF57';
            ctx.lineWidth = 4;
            ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
            ctx.fillStyle = screenState.hot ? '#121212' : '#33FF57';
            ctx.fillText(label, bx + 32, by + bh / 2 + 2);
            if (screenState.blink) {
                ctx.fillStyle = '#33FF57';
                ctx.fillRect(bx + bw + 30, by + 22, 26, 50);
            }
        } else {
            const p = screenState.boot;
            ctx.font = `800 40px ${mono}`;
            ctx.fillStyle = '#33FF57';
            ctx.fillText(`> booting ${String(Math.round(p * 100)).padStart(3, '0')}%`, 44, 410);
            ctx.strokeStyle = '#FFFDF5';
            ctx.lineWidth = 4;
            ctx.strokeRect(44, 460, W - 88, 44);
            ctx.fillStyle = '#33FF57';
            ctx.fillRect(52, 468, (W - 104) * clamp(p / 0.7, 0, 1), 28);
        }
        screenTex.needsUpdate = true;
    }
    drawScreen();
    if (document.fonts) {
        Promise.all([
            document.fonts.load('800 40px "JetBrains Mono"'),
            document.fonts.load('800 76px "Space Grotesk"'),
        ]).then(() => {
            drawScreen();
            [posterSiteTex, posterNetTex].forEach((t) => { t.needsUpdate = true; });
        }, () => {});
    }

    /* ================================================================ */
    /* Sizing                                                            */
    /* ================================================================ */
    // World x of the left and right edges of the things worth reaching.
    const PAN_LEFT = -3.5;
    const PAN_RIGHT = 7.9;
    const pan = { x: 0, target: 0, min: 0, max: 0, halfW: 1, drag: null, dragged: false, used: false };
    const canPan = () => pan.max - pan.min > 0.3;
    function fit() {
        const w = innerWidth;
        const h = innerHeight;
        const aspect = w / h;
        const pr = Math.min(devicePixelRatio, lowPower ? 1.5 : 2);
        renderer.setPixelRatio(pr);
        renderer.setSize(w, h, false);
        if (composer) {
            composer.setPixelRatio(pr);
            composer.setSize(w, h);
        }
        camera.aspect = aspect;
        // Keep the monitor and tower (about 6 units wide) in view on narrow screens.
        const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camBase.z = Math.max(13, 3.0 / (halfV * aspect) + 1.2);
        camera.updateProjectionMatrix();
        // On narrow screens the room is wider than the view. Allow a sideways pan
        // from the figurine (left) to the bookcase speaker and plant (right).
        pan.halfW = camBase.z * halfV * aspect;
        pan.min = Math.min(0, PAN_LEFT + pan.halfW);
        pan.max = Math.max(0, PAN_RIGHT - pan.halfW);
        pan.target = clamp(pan.target, pan.min, pan.max);
    }
    fit();

    /* ================================================================ */
    /* Input                                                             */
    /* ================================================================ */
    const ac = new AbortController();
    const on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: ac.signal });
    const pointer = { nx: 0, ny: 0, has: false, overCanvas: false, ndc: new THREE.Vector2(9, 9) };
    const setPointer = (e) => {
        pointer.nx = e.clientX / innerWidth - 0.5;
        pointer.ny = e.clientY / innerHeight - 0.5;
        pointer.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        pointer.overCanvas = e.target === canvas;
    };
    const raycaster = new THREE.Raycaster();
    const hitTargets = [screen, bezel, spkBody, figurine, plant];
    const isIn = (obj, rootObj) => {
        for (let o = obj; o; o = o.parent) if (o === rootObj) return true;
        return false;
    };
    // Returns 'monitor', 'speaker', 'bot', 'plant' or null for the nearest thing under the pointer.
    const pickTarget = () => {
        raycaster.setFromCamera(pointer.ndc, camera);
        const hit = raycaster.intersectObjects(hitTargets, true)[0];
        if (!hit) return null;
        if (isIn(hit.object, spkBody)) return 'speaker';
        if (isIn(hit.object, figurine)) return 'bot';
        if (isIn(hit.object, plant)) return 'plant';
        return 'monitor';
    };

    /* ================================================================ */
    /* CV chatbot (Assets/js/cv-bot.js), opened from the figurine        */
    /* ================================================================ */
    const cvBot = cvBotModule
        ? cvBotModule.createCvBot({
            mount: overlay,
            onOpenChange: (open) => {
                fig.open = open;
                overlay.classList.toggle('is-chatting', open);
            },
            onTalk: (talking) => { fig.talking = talking; },
        })
        : null;

    /* ================================================================ */
    /* Music: the bookcase speaker plays Nutshell (Alice in Chains)      */
    /* ================================================================ */
    // The song file is not in the repo. Put your own copy at this path.
    const SONG_URL = 'Assets/audio/Nutshell.mp3';
    const music = { el: null, ctx: null, analyser: null, gain: null, data: null, playing: false, level: 0, msg: '', msgUntil: 0, spawnAcc: 0 };
    function musicMessage(text) {
        music.msg = text;
        music.msgUntil = performance.now() + 4000;
    }
    function setupMusic() {
        const el = new Audio(SONG_URL);
        el.preload = 'auto';
        music.el = el;
        on(el, 'playing', () => { music.playing = true; });
        on(el, 'pause', () => { music.playing = false; });
        on(el, 'ended', () => { music.playing = false; el.currentTime = 0; });
        on(el, 'error', () => {
            music.playing = false;
            musicMessage('> SONG FILE MISSING: ' + SONG_URL);
            console.warn('[pc-intro] could not load', SONG_URL);
        });
        // Web Audio analyser, so the woofer and the notes follow the music.
        // If it is not available, the speaker still plays and uses a fake beat.
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            const actx = new AC();
            const src = actx.createMediaElementSource(el);
            const analyser = actx.createAnalyser();
            analyser.fftSize = 256;
            const gain = actx.createGain();
            src.connect(analyser);
            analyser.connect(gain);
            gain.connect(actx.destination);
            Object.assign(music, { ctx: actx, analyser, gain, data: new Uint8Array(analyser.frequencyBinCount) });
        } catch (e) { /* plain <audio> playback */ }
    }
    function toggleMusic() {
        if (!music.el) setupMusic();
        if (music.ctx && music.ctx.state === 'suspended') music.ctx.resume();
        if (!music.el.paused) { music.el.pause(); return; }
        music.el.play().catch((err) => {
            if (err && err.name === 'NotAllowedError') musicMessage(`> ${verb} THE SPEAKER AGAIN`);
        });
    }
    function updateMusic(dt, t) {
        let target = 0;
        if (music.playing) {
            if (music.analyser) {
                music.analyser.getByteFrequencyData(music.data);
                let sum = 0;
                for (let i = 1; i < 9; i++) sum += music.data[i];
                target = clamp((sum / 8 / 255 - 0.35) / 0.55, 0, 1);
            } else {
                target = 0.5 + 0.5 * Math.sin(t * 7);
            }
        }
        music.level = lerp(music.level, target, 1 - Math.pow(0.001, dt));
        const lv = music.level;
        woofer.scale.set(1 + lv * 0.05, 1 + lv * 0.05, 1 + lv * 0.9);
        setGlow(spkRingMat, t * 0.15 + 0.8, 1, music.playing ? 0.35 + lv * 0.25 : 0.12);
        spkLed.color.setHex(music.playing ? 0x33ff57 : 0xff3355).multiplyScalar(2);

        if (music.playing) {
            music.spawnAcc += dt;
            const every = 0.42 - lv * 0.26;
            while (music.spawnAcc > every) {
                music.spawnAcc -= every;
                spawnNote();
            }
        } else {
            music.spawnAcc = 0;
        }
        updateNotes(dt);
    }
    function stopMusic() {
        const { el, ctx: actx, gain } = music;
        if (!el) return;
        // Fade out over about a second instead of cutting off.
        if (actx && gain) {
            gain.gain.setTargetAtTime(0, actx.currentTime, 0.25);
            setTimeout(() => { el.pause(); actx.close().catch(() => {}); }, 1200);
        } else {
            el.pause();
        }
    }

    on(window, 'pointermove', (e) => { pointer.has = true; setPointer(e); }, { passive: true });
    on(canvas, 'pointerdown', (e) => {
        setPointer(e);
        pan.dragged = false;
        if (canPan() && !entering) pan.drag = { id: e.pointerId, x0: e.clientX, from: pan.target };
    });
    // Swipe sideways to pan the camera on narrow screens.
    on(window, 'pointermove', (e) => {
        const d = pan.drag;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x0;
        if (Math.abs(dx) > 8) pan.dragged = true;
        if (!pan.dragged) return;
        pan.used = true;
        pan.target = clamp(d.from - (dx / innerWidth) * pan.halfW * 2.2, pan.min, pan.max);
    }, { passive: true });
    const endDrag = (e) => { if (pan.drag && e.pointerId === pan.drag.id) pan.drag = null; };
    on(window, 'pointerup', endDrag);
    on(window, 'pointercancel', endDrag);
    on(canvas, 'click', (e) => {
        // A swipe ends with a click event; it should not press anything.
        if (pan.dragged) { pan.dragged = false; return; }
        setPointer(e);
        const target = pickTarget();
        if (target === 'speaker') toggleMusic();
        else if (target === 'bot') { if (cvBot) cvBot.toggle(); }
        else if (target === 'plant') waterPlant();
        else if (target === 'monitor') enter();
    });
    on(document, 'mouseleave', () => { pointer.overCanvas = false; });
    on(skipBtn, 'click', () => enter());
    on(window, 'keydown', (e) => {
        // Esc closes the chat first; a second Esc skips the intro.
        if (e.key === 'Escape' && cvBot && cvBot.isOpen) cvBot.close();
        else if (e.key === 'Escape') finish({ fade: true });
        else if ((e.key === 'Enter' || e.key === ' ') && e.target === document.body) {
            e.preventDefault();
            enter();
        }
    });
    on(window, 'resize', fit);

    /* ================================================================ */
    /* Enter transition                                                  */
    /* ================================================================ */
    let entering = null;
    const look = lookBase.clone();
    const camOff = new THREE.Vector2();

    function enter() {
        if (entering || finished) return;
        if (cvBot) cvBot.close();
        overlay.classList.add('is-entering');
        if (cursorEl) cursorEl.classList.remove('is-hover');
        canvas.style.cursor = '';

        // Where the screen ends up once the room turns back to face the camera.
        const rx = world.rotation.x;
        const ry = world.rotation.y;
        const hs = head.scale.x;
        world.rotation.set(0, 0, 0);
        head.scale.setScalar(1);
        world.updateMatrixWorld(true);
        const center = screen.getWorldPosition(new THREE.Vector3());
        const normal = screen.getWorldDirection(new THREE.Vector3());
        world.rotation.set(rx, ry, 0);
        head.scale.setScalar(hs);
        world.updateMatrixWorld(true);

        // Close enough that the screen covers the whole viewport.
        const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const dH = SCREEN_H / 2 / halfV;
        const dW = SCREEN_W / 2 / (halfV * camera.aspect);
        const d = Math.min(dH, dW) * 0.95;

        entering = {
            t0: performance.now(),
            rx, ry, hs,
            fromPos: camera.position.clone(),
            fromLook: look.clone(),
            toPos: center.clone().addScaledVector(normal, d),
            toLook: center,
        };
        screenState.hot = false;
        screenState.boot = 0;
    }

    /* ================================================================ */
    /* Frame loop                                                        */
    /* ================================================================ */
    const clock = new THREE.Clock();
    let lastUi = 0;
    let firstFrame = true;
    const SPEED = 0.07;

    function tick() {
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        if (!finished && !root.classList.contains('is-pc-intro')) { finish({ fade: false }); return; }

        // RGB effects all run off one hue clock.
        const hue = t * SPEED;
        // Wall-wash lights stay in the purple / blue / pink range so the room never turns green.
        const wash = 0.78 + Math.sin(t * 0.35) * 0.14;
        fans.forEach((f) => {
            f.blades.rotation.z -= dt * f.speed;
            setGlow(f.ringMat, hue + f.offset);
        });
        setGlow(kbPlate, hue + 0.3);
        setGlow(mouseGlow, hue + 0.3);
        setGlow(matEdge, hue + 0.5, 1, 0.5);
        setGlow(deskStrip, wash + 0.08);
        deskLight.color.setHSL((wash + 0.08) % 1, 1, 0.55);
        setGlow(pumpRingMat, hue + 0.2);
        ramMats.forEach((m, i) => setGlow(m, hue + i * 0.05));
        setGlow(shroudGlow, hue + 0.1, 0.6, 0.7);
        caseLight.color.setHSL(hue % 1, 1, 0.55);
        biasLight.color.setHSL(wash % 1, 0.9, 0.5);
        hexes.forEach((h) => setGlow(h.m, hue * 0.6 + h.offset + 0.55, 1, 0.5));
        hexLight.color.setHSL((wash - 0.1) % 1, 0.9, 0.55);
        powerLed.color.setScalar(Math.sin(t * 2.4) > -0.5 ? 2 : 0.3);
        updateMusic(dt, t);
        updateFigurine(dt, t);
        updatePlant(dt);

        if (entering) {
            const p = clamp((performance.now() - entering.t0) / 1600, 0, 1);
            const e = easeInOut(p);
            world.rotation.x = lerp(entering.rx, 0, e);
            world.rotation.y = lerp(entering.ry, 0, e);
            head.scale.setScalar(lerp(entering.hs, 1, e));
            camera.position.lerpVectors(entering.fromPos, entering.toPos, e);
            look.lerpVectors(entering.fromLook, entering.toLook, e);
            camera.lookAt(look);
            screenState.boot = p;
            drawScreen();
            // Fade to the site background so the hand-off is seamless.
            flash.style.opacity = clamp((p - 0.62) / 0.33, 0, 1).toFixed(3);
            if (p >= 1) finish({ fade: true });
        } else {
            const k = 1 - Math.pow(1 - 0.05, dt * 60);
            // Touch screens have no hover, so the room keeps its slow idle sway there.
            const follow = pointer.has && finePointer;
            const sway = canPan() ? 0.4 : 1;
            const nx = follow ? pointer.nx : Math.sin(t * 0.4) * 0.35 * sway;
            const ny = follow ? pointer.ny : Math.sin(t * 0.29) * 0.2 * sway;
            world.rotation.y = lerp(world.rotation.y, nx * 0.32, k);
            world.rotation.x = lerp(world.rotation.x, ny * 0.06, k);
            camOff.x = lerp(camOff.x, -nx * 0.9, k);
            camOff.y = lerp(camOff.y, ny * 0.5, k);
            pan.x = lerp(pan.x, pan.target, Math.min(1, k * 3));
            camera.position.set(camBase.x + camOff.x + pan.x, camBase.y + camOff.y, camBase.z);
            look.copy(lookBase);
            look.x += pan.x;
            camera.lookAt(look);

            const target = pointer.has && pointer.overCanvas ? pickTarget() : null;
            const hot = target === 'monitor';
            const spkHot = target === 'speaker';
            const botHot = target === 'bot' && !!cvBot;
            fig.hot = botHot;
            const plantHot = target === 'plant';
            water.hot = plantHot;
            const anyHot = hot || spkHot || botHot || plantHot;
            const blink = Math.floor(t / 0.53) % 2 === 0;
            if (hot !== screenState.hot || blink !== screenState.blink) {
                screenState.hot = hot;
                screenState.blink = blink;
                drawScreen();
            }
            if (t - lastUi > 0.1) {
                lastUi = t;
                if (pointer.overCanvas && cursorEl) cursorEl.classList.toggle('is-hover', anyHot);
                canvas.style.cursor = anyHot ? 'pointer' : '';
                if (hint) {
                    if (performance.now() < music.msgUntil) hint.textContent = music.msg;
                    else if (spkHot) hint.textContent = `> ${verb} TO ${music.playing ? 'PAUSE' : 'PLAY'} MUSIC`;
                    else if (plantHot) {
                        if (water.pour >= 0) hint.textContent = '> WATERING...';
                        else if (water.bloom >= 0) hint.textContent = `> IT FLOWERED! ${verb} TO WATER AGAIN`;
                        else hint.textContent = `> ${verb} TO WATER THE PLANT`;
                    }
                    else if (botHot) hint.textContent = `> ${verb} TO ${fig.open ? 'CLOSE THE' : 'OPEN THE'} CHAT`;
                    else if (hot) hint.textContent = `> ${verb} TO BOOT`;
                    // Until the first swipe, alternate with a pan hint on narrow screens.
                    else if (canPan() && !pan.used && Math.floor(t / 3) % 2 === 1) hint.textContent = '< SWIPE TO LOOK AROUND >';
                    else hint.textContent = `> ${verb} THE MONITOR`;
                }
                if (hintBox) hintBox.classList.toggle('is-hot', anyHot);
            }
            head.scale.setScalar(lerp(head.scale.x, hot ? 1.03 : 1, k * 2));
            screenMat.color.setScalar(lerp(screenMat.color.r, hot ? 1.1 : 0.95, k * 2));
        }

        if (composer) composer.render(dt);
        else renderer.render(scene, camera);
        if (firstFrame) {
            firstFrame = false;
            overlay.classList.add('is-ready');
        }
    }

    on(document, 'visibilitychange', () => {
        if (document.hidden) renderer.setAnimationLoop(null);
        else { clock.getDelta(); renderer.setAnimationLoop(tick); }
    });
    // Compile shaders before the first visible frame to avoid a stutter.
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera).catch(() => {});
    if (finished) return;
    renderer.setAnimationLoop(tick);

    cleanup = () => {
        ac.abort();
        stopMusic();
        renderer.setAnimationLoop(null);
        const geos = new Set();
        const mats = new Set();
        scene.traverse((o) => {
            if (o.geometry) geos.add(o.geometry);
            if (o.material) mats.add(o.material);
            if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
        });
        geos.forEach((g) => g.dispose());
        mats.forEach((m) => m.dispose());
        textures.forEach((tx) => tx.dispose());
        envTex.dispose();
        if (composer) composer.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (cursorEl) cursorEl.classList.remove('is-hover');
        overlay.remove();
    };
}
