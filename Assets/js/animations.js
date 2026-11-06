/* ==========================================================================
   SREEDEEP.exe — motion layer (vanilla JS, no dependencies)
   Styles live in Assets/css/animations.css. The <head> bootstrap in
   index.html adds `html.js`; if this file fails, it removes `.js` again on
   DOMContentLoaded so nothing stays hidden.
   ========================================================================== */
(() => {
    'use strict';

    const root = document.documentElement;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const richMotion = !reduceMotion;
    const richPointer = finePointer && !reduceMotion;

    const $ = (sel, scope = document) => scope.querySelector(sel);
    const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /* ---------------------------------------------------------------- */
    /* Split text into per-character spans (keeps nested spans + <br>)   */
    /* ---------------------------------------------------------------- */
    function splitText(el) {
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        let i = 0;
        const walk = (node) => {
            [...node.childNodes].forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const word = document.createElement('span');
                        word.className = 'word';
                        word.setAttribute('aria-hidden', 'true');
                        [...part].forEach((ch) => {
                            const c = document.createElement('span');
                            c.className = 'char';
                            c.textContent = ch;
                            c.style.setProperty('--i', i++);
                            word.appendChild(c);
                        });
                        frag.appendChild(word);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
        el.classList.add('split-ready');
        return i; // character count
    }

    /* Hover wave for [data-wave] headings — runs to completion, never snaps. */
    function bindWave(el, charCount) {
        if (!richMotion) return;
        el.addEventListener('mouseenter', () => {
            if (el.classList.contains('waving') || !el.classList.contains('in')) return;
            el.classList.add('waving');
            setTimeout(() => el.classList.remove('waving'), 700 + charCount * 35);
        });
    }

    /* Text scramble (nav links, tech tiles). */
    const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
    function scramble(el) {
        const final = el.dataset.text || (el.dataset.text = el.textContent.replace(/\s+/g, ' ').trim());
        cancelAnimationFrame(el._scrambleRaf);
        let frame = 0;
        const total = final.length * 2 + 6;
        const tick = () => {
            frame++;
            el.textContent = [...final].map((c, i) =>
                (c === ' ' || frame > i * 2 + 4) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]
            ).join('');
            if (frame < total) el._scrambleRaf = requestAnimationFrame(tick);
            else el.textContent = final;
        };
        tick();
    }

    /* Add `cls` to a batch of elements in DOM order with a stagger. */
    function staggerIn(els, cls, step) {
        els.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        els.forEach((el, k) => {
            const delay = k * step;
            if (delay && richMotion) {
                el.style.transitionDelay = `${delay}ms`;
                // Clear it afterwards so later hover transitions aren't delayed.
                setTimeout(() => { el.style.transitionDelay = ''; }, delay + 1200);
            }
            el.classList.add(cls);
        });
    }

    function onceVisible(el, cb, options = { threshold: 0.3 }) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                cb(e.target);
            });
        }, options);
        io.observe(el);
    }

    /* ---------------------------------------------------------------- */
    /* Boot screen                                                       */
    /* ---------------------------------------------------------------- */
    function runIntro(done) {
        const pre = $('#preloader');
        if (!pre || root.classList.contains('skip-intro')) {
            if (pre) pre.remove();
            done();
            return;
        }
        root.classList.add('is-booting');
        const fill = $('.pl-bar span', pre);
        const count = $('.pl-count', pre);
        const MIN_MS = 1100;
        const t0 = performance.now();
        let ready = false;
        let shown = 0;
        Promise.race([
            document.fonts ? document.fonts.ready : Promise.resolve(),
            new Promise((r) => setTimeout(r, 2200)),
        ]).then(() => { ready = true; });

        const tick = (now) => {
            const t = clamp((now - t0) / MIN_MS, 0, 1);
            const target = ready && t >= 1 ? 1 : Math.min(t, 0.9);
            shown = lerp(shown, target, 0.12);
            if (target === 1 && shown > 0.995) shown = 1;
            fill.style.transform = `scaleX(${shown})`;
            count.textContent = String(Math.round(shown * 100)).padStart(3, '0');
            if (shown === 1) {
                pre.classList.add('is-done');
                root.classList.remove('is-booting');
                try { sessionStorage.setItem('sd-intro', '1'); } catch (e) { /* private mode */ }
                setTimeout(done, 350);
                setTimeout(() => pre.remove(), 1300);
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /* ---------------------------------------------------------------- */
    /* Decorate markup (keeps index.html changes small)                  */
    /* ---------------------------------------------------------------- */
    const splitCounts = new Map();
    $$('[data-split]').forEach((el) => {
        const n = splitText(el);
        splitCounts.set(el, n);
        if (el.hasAttribute('data-wave')) bindWave(el, n);
    });

    // Tech-stack grid tiles (first #skills section).
    const tileGrid = $('#skills .flex-wrap');
    if (tileGrid) {
        tileGrid.classList.add('tiles');
        [...tileGrid.children].forEach((tile, i) => {
            tile.classList.add('tile');
            tile.style.setProperty('--i', i);
            const label = $('.font-display', tile);
            if (label && richPointer) tile.addEventListener('mouseenter', () => scramble(label));
        });
    }

    // Experience timeline: scroll-linked fill + popping markers.
    const timeline = $('#experience .border-l-4');
    let timelineFill = null;
    if (timeline) {
        timelineFill = document.createElement('div');
        timelineFill.className = 'timeline-fill';
        timeline.prepend(timelineFill);
        $$(':scope > .reveal', timeline).forEach((item) => {
            item.dataset.reveal = 'left';
            const dot = $(':scope > .absolute', item);
            if (dot) dot.classList.add('tl-dot');
        });
    }

    // Metrics: reset to zero so the count-up has somewhere to start.
    // (The HTML ships the final values, so no-JS visitors see real numbers.)
    const metrics = $('#system-metrics');
    const counters = metrics ? $$('[data-target]', metrics) : [];
    const typing = $('#typing-text');
    const typingText = typing ? typing.textContent.trim() : '';
    if (richMotion) {
        counters.forEach((c) => { c.textContent = '0'; });
        if (typing) typing.textContent = '';
    }

    /* ---------------------------------------------------------------- */
    /* Scroll-triggered sequences                                        */
    /* ---------------------------------------------------------------- */
    function countUp(el) {
        const target = +el.dataset.target;
        const dur = 1600;
        const t0 = performance.now();
        const step = (now) => {
            const p = clamp((now - t0) / dur, 0, 1);
            const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
            el.textContent = Math.round(target * eased);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function typeInto(el, text, done) {
        let k = 0;
        const tick = () => {
            el.textContent = text.slice(0, ++k);
            if (k < text.length) setTimeout(tick, 40 + Math.random() * 45);
            else if (done) done();
        };
        tick();
    }

    function startScrollSequences() {
        // Generic reveals, batched so things entering together stagger.
        const revealIO = new IntersectionObserver((entries) => {
            const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
            entering.forEach((el) => revealIO.unobserve(el));
            if (entering.length) staggerIn(entering, 'active', 110);
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        $$('.reveal').forEach((el) => revealIO.observe(el));

        // Split headings (the hero one is triggered by the intro instead).
        $$('[data-split]:not([data-split="hero"])').forEach((el) =>
            onceVisible(el, (t) => t.classList.add('in'), { threshold: 0.35 })
        );

        if (tileGrid) {
            onceVisible(tileGrid, (g) => {
                g.classList.add('in');
                setTimeout(() => g.classList.add('settled'), 1600);
            }, { threshold: 0.2 });
        }

        if (metrics) {
            onceVisible(metrics, () => {
                const status = $('.status-lines', metrics);
                if (!richMotion) {
                    counters.forEach((c) => { c.textContent = c.dataset.target; });
                    if (typing) typing.textContent = typingText;
                    if (status) status.classList.add('in');
                    return;
                }
                if (typing) typeInto(typing, typingText);
                setTimeout(() => counters.forEach(countUp), 350);
                if (status) status.classList.add('in');
            }, { threshold: 0.3 });
        }
    }

    /* ---------------------------------------------------------------- */
    /* Nav: entrance, hide-on-scroll, active section, scramble           */
    /* ---------------------------------------------------------------- */
    const nav = $('nav');
    const navLinks = $$('nav a[href^="#"]').filter((a) => a.getAttribute('href').length > 1);
    const linkFor = new Map();
    navLinks.forEach((a) => {
        const target = $(a.getAttribute('href'));
        if (target) linkFor.set(target, a);
        if (richPointer) a.addEventListener('mouseenter', () => scramble(a));
    });
    const sectionIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (!e.isIntersecting) return;
            navLinks.forEach((a) => a.classList.remove('nav-active'));
            const link = linkFor.get(e.target);
            if (link) link.classList.add('nav-active');
        });
    }, { rootMargin: '-50% 0px -50% 0px' });
    linkFor.forEach((_, section) => sectionIO.observe(section));

    /* ---------------------------------------------------------------- */
    /* Hero: rotating tech highlight                                     */
    /* ---------------------------------------------------------------- */
    function startTechCycle() {
        const techs = $$('.tech-cycle .tech');
        if (!techs.length || !richMotion) return;
        let k = 0;
        techs[0].classList.add('on');
        setInterval(() => {
            techs[k].classList.remove('on');
            k = (k + 1) % techs.length;
            techs[k].classList.add('on');
        }, 1500);
    }

    /* ---------------------------------------------------------------- */
    /* Pointer effects: cursor, magnetic, tilt, hero depth               */
    /* ---------------------------------------------------------------- */
    const cursor = $('#cursor');
    const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    const cursorPos = { x: mouse.x, y: mouse.y };
    const HOVER_SEL = '.cursor-hover, a, button, input, textarea';

    if (cursor && finePointer) {
        document.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            cursor.classList.add('is-visible');
        }, { passive: true });
        document.addEventListener('mouseover', (e) => {
            cursor.classList.toggle('is-hover', !!e.target.closest(HOVER_SEL));
        });
        root.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
        document.addEventListener('mousedown', () => cursor.classList.add('is-down'));
        document.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
    }

    if (richPointer) {
        $$('[data-magnetic]').forEach((el) => {
            const strength = parseFloat(el.dataset.magnetic) || 0.3;
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                el.style.translate = `${(dx * strength).toFixed(1)}px ${(dy * strength).toFixed(1)}px`;
            });
            el.addEventListener('mouseleave', () => { el.style.translate = ''; });
        });

        $$('[data-tilt]').forEach((card) => {
            card.addEventListener('mousemove', (e) => {
                if (!card.classList.contains('active')) return;
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                card.classList.add('is-tilting');
                card.style.transform =
                    `perspective(1000px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`;
            });
            card.addEventListener('mouseleave', () => {
                card.classList.remove('is-tilting');
                card.style.transform = '';
            });
        });
    }

    const heroShapes = richPointer
        ? $$('.hero-shape').map((el) => ({ el, depth: +el.dataset.depth || 1, x: 0, y: 0 }))
        : [];

    /* ---------------------------------------------------------------- */
    /* Contact form: sending state → animated confirmation               */
    /* ---------------------------------------------------------------- */
    const form = $('#contact-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = $('button[type="submit"]', form);
            if (!btn || btn.classList.contains('is-sending')) return;
            btn.classList.add('is-sending');
            btn.textContent = 'TRANSMITTING...';
            setTimeout(() => {
                form.innerHTML =
                    '<div class="py-20 text-center">' +
                    '<i class="ri-checkbox-circle-fill text-6xl text-neo-green mb-4 block success-pop"></i>' +
                    '<h3 class="text-2xl font-black uppercase success-rise">Transmission Received</h3>' +
                    '<p class="font-mono text-sm mt-2 success-rise" style="animation-delay:.3s">' +
                    'System response initialized. I will reach out shortly.</p></div>';
            }, reduceMotion ? 0 : 1100);
        });
    }

    /* ---------------------------------------------------------------- */
    /* One rAF loop for everything continuous                            */
    /* ---------------------------------------------------------------- */
    const bar = $('#progressBar');
    const parallax = richMotion
        ? $$('[data-parallax]').map((el) => ({ el, speed: +el.dataset.parallax, host: el.parentElement }))
        : [];
    const footer = $('footer');
    const bang = richMotion ? $('[data-rise]') : null;
    const marqueeAnims = richMotion && Element.prototype.getAnimations
        ? $$('.marquee-content').flatMap((el) => el.getAnimations())
        : [];

    let lastY = -1;
    let marqueeRate = 1;
    let loaded = false;

    function frame() {
        const y = scrollY;
        const vh = innerHeight;
        const dy = lastY < 0 ? 0 : y - lastY;

        if (y !== lastY) {
            const max = document.documentElement.scrollHeight - vh;
            if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;

            if (nav && loaded) {
                if (y > 160 && dy > 4) nav.classList.add('nav-hidden');
                else if (dy < -4 || y <= 160) nav.classList.remove('nav-hidden');
            }

            if (timeline && timelineFill) {
                const r = timeline.getBoundingClientRect();
                const p = clamp((vh * 0.6 - r.top) / r.height, 0, 1);
                timelineFill.style.transform = `scaleY(${p.toFixed(4)})`;
            }

            parallax.forEach(({ el, speed, host }) => {
                const r = host.getBoundingClientRect();
                if (r.bottom < 0 || r.top > vh) return;
                const off = (r.top + r.height / 2 - vh / 2) * speed;
                el.style.translate = `0 ${off.toFixed(1)}px`;
            });

            if (bang && footer) {
                const r = footer.getBoundingClientRect();
                const p = clamp((vh - r.top) / r.height, 0, 1);
                bang.style.translate = `0 ${((1 - p) * 140).toFixed(1)}px`;
            }
            lastY = y;
        }

        // Marquees speed up with scroll velocity, then ease back.
        if (marqueeAnims.length) {
            const target = 1 + Math.min(Math.abs(dy) * 0.12, 4);
            const next = lerp(marqueeRate, target, 0.08);
            if (Math.abs(next - marqueeRate) > 0.004) {
                marqueeRate = next;
                marqueeAnims.forEach((a) => { a.playbackRate = marqueeRate; });
            }
        }

        if (cursor && finePointer) {
            const t = reduceMotion ? 1 : 0.22;
            cursorPos.x = lerp(cursorPos.x, mouse.x, t);
            cursorPos.y = lerp(cursorPos.y, mouse.y, t);
            cursor.style.transform =
                `translate3d(${cursorPos.x.toFixed(1)}px, ${cursorPos.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        }

        if (heroShapes.length && y < vh) {
            const nx = mouse.x / innerWidth - 0.5;
            const ny = mouse.y / vh - 0.5;
            heroShapes.forEach((s) => {
                s.x = lerp(s.x, nx * 40 * s.depth, 0.06);
                s.y = lerp(s.y, ny * 40 * s.depth, 0.06);
                s.el.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`;
            });
        }

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* ---------------------------------------------------------------- */
    /* Go                                                                */
    /* ---------------------------------------------------------------- */
    window.__sdMotion = true;

    const startSite = () => {
        loaded = true;
        document.body.classList.add('loaded');
        const hero = $('[data-split="hero"]');
        if (hero) hero.classList.add('in');
        setTimeout(startScrollSequences, 250);
        startTechCycle();
    };

    runIntro(() => {
        // Assets/js/pc-intro.js removes `is-pc-intro` and fires `sd:pc-entered`
        // when the user enters through the 3D monitor.
        if (root.classList.contains('is-pc-intro')) {
            document.addEventListener('sd:pc-entered', startSite, { once: true });
        } else {
            startSite();
        }
    });
})();
