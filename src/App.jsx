import React, { useState, useEffect, useRef } from 'react';
import { Flame, Coins, Heart, Lock, Check, X, Play, Volume2, VolumeX, BookOpen, Skull, Bug, ListChecks, Timer, CornerDownLeft, RotateCcw, ShoppingBag, Settings as SettingsIcon, BatteryCharging, Droplet, Lightbulb, BellOff } from 'lucide-react';

const fmt = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
function runSync(code, lv) {
  let fn;
  try {
    fn = new Function(`"use strict";\n${code}\n;return typeof ${lv.fn}==='function'?${lv.fn}:null;`)();
    if (!fn) return { error: `No existe la función ${lv.fn}(). Decláralo con function ${lv.fn}(...)` };
  } catch (e) { return { error: `${e.name}: ${e.message}` }; }
  const results = lv.tests.map((t) => {
    const t0 = performance.now(); let got, err;
    try { got = fn(...JSON.parse(JSON.stringify(t.in))); } catch (e) { err = `${e.name}: ${e.message}`; }
    return { ...t, got, err, ms: performance.now() - t0, pass: !err && JSON.stringify(got) === JSON.stringify(t.out) };
  });
  return { results };
}


/* ───────────── SANDBOX: Web Worker con límite de tiempo (los bucles infinitos no congelan la UI) ───────────── */
const workerBody = () => {
  self.onmessage = (e) => {
    const { code, fn, tests } = e.data; let f;
    try {
      f = new Function('"use strict";\n' + code + '\n;return typeof ' + fn + "==='function'?" + fn + ':null;')();
      if (!f) return self.postMessage({ error: 'No existe la función ' + fn + '(). Decláralo con function ' + fn + '(...)' });
    } catch (x) { return self.postMessage({ error: x.name + ': ' + x.message }); }
    const results = tests.map((t) => {
      const t0 = performance.now(); let got, err;
      try { got = f(...JSON.parse(JSON.stringify(t.in))); } catch (x) { err = x.name + ': ' + x.message; }
      return { ...t, got, err, ms: performance.now() - t0, pass: !err && JSON.stringify(got) === JSON.stringify(t.out) };
    });
    self.postMessage({ results });
  };
};
const runTests = (code, lv) => new Promise((resolve) => {
  let w;
  try { w = new Worker(URL.createObjectURL(new Blob(['(' + workerBody.toString() + ')()'], { type: 'text/javascript' }))); }
  catch (e) { return resolve(runSync(code, lv)); }
  const to = setTimeout(() => { w.terminate(); resolve({ error: 'Timeout: la ejecución superó 1500 ms (¿bucle infinito?)' }); }, 1500);
  w.onmessage = (e) => { clearTimeout(to); w.terminate(); resolve(e.data); };
  w.onerror = (e) => { clearTimeout(to); w.terminate(); resolve({ error: e.message || 'Error de ejecución' }); };
  w.postMessage({ code, fn: lv.fn, tests: lv.tests });
});


/* ───────────── MOTOR DE AUDIO PROCEDURAL (Web Audio API, cero archivos) ───────────── */
const AE = {
  ctx: null, mg: null, sg: null, vol: { music: 0.6, sfx: 0.8, muted: false }, calm: false, started: false, timer: null, nb: null,
  init() {
    if (this.ctx) return true;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    const c = (this.ctx = new C());
    this.mg = c.createGain(); this.sg = c.createGain(); this.mg.connect(c.destination); this.sg.connect(c.destination);
    this.apply(); return true;
  },
  apply() {
    if (!this.ctx) return; const t = this.ctx.currentTime, m = this.vol.muted;
    this.mg.gain.setTargetAtTime(m ? 0 : this.vol.music * 0.6, t, 0.05);
    this.sg.gain.setTargetAtTime(m ? 0 : this.vol.sfx, t, 0.05);
  },
  noiseBuf() {
    if (this.nb) return this.nb; const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this.nb = b);
  },
  startMusic() {
    if (!this.init() || this.started) return; this.started = true; const c = this.ctx; if (c.state === 'suspended') c.resume();
    // sub-bajo con respiración lenta
    const sub = c.createOscillator(), sg = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    sub.frequency.value = 36; sg.gain.value = 0.5; lfo.frequency.value = 0.07; lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(sg.gain); sub.connect(sg); sg.connect(this.mg); sub.start(); lfo.start();
    // par binaural desentonado (oído izq/der, 3.7 Hz de batido) + clúster disonante grave
    [[110, -1], [113.7, 1], [58.3, -0.4], [61.7, 0.4]].forEach(([f, p]) => {
      const o = c.createOscillator(), g = c.createGain(), pn = c.createStereoPanner(), lp = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; g.gain.value = 0.05; pn.pan.value = p; lp.type = 'lowpass'; lp.frequency.value = 420;
      o.connect(lp); lp.connect(g); g.connect(pn); pn.connect(this.mg); o.start();
    });
    // viento de conductos
    const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(), l2 = c.createOscillator(), l2g = c.createGain();
    n.buffer = this.noiseBuf(); n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.8; ng.gain.value = 0.05;
    l2.frequency.value = 0.11; l2g.gain.value = 200; l2.connect(l2g); l2g.connect(bp.frequency);
    n.connect(bp); bp.connect(ng); ng.connect(this.mg); n.start(); l2.start();
    this.schedule();
  },
  schedule() {
    const d = (this.calm ? 22000 : 9000) + Math.random() * (this.calm ? 20000 : 14000);
    this.timer = setTimeout(() => { this.sting(); this.schedule(); }, d);
  },
  sting() { // acorde disonante: segunda menor + tritono con caída de tono
    const c = this.ctx; if (!c) return; const t = c.currentTime, k = this.calm ? 0.25 : 1, base = [196, 233, 277, 311][(Math.random() * 4) | 0];
    const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.18 * k, t + 0.5); out.gain.exponentialRampToValueAtTime(0.001, t + 4); out.connect(this.mg);
    [1, 1.0595, 1.4142].forEach((r, i) => {
      const o = c.createOscillator(), lp = c.createBiquadFilter(); o.type = i ? 'sawtooth' : 'sine'; lp.type = 'lowpass'; lp.frequency.value = 900;
      o.frequency.setValueAtTime(base * r, t); o.frequency.exponentialRampToValueAtTime(base * r * 0.94, t + 4); o.connect(lp); lp.connect(out); o.start(t); o.stop(t + 4.2);
    });
  },
  tone(type, f0, f1, dur, g, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(gn); gn.connect(this.sg); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq, g, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, n = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
    n.buffer = this.noiseBuf(); f.type = type; f.frequency.value = freq; gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(gn); gn.connect(this.sg); n.start(t, Math.random()); n.stop(t + dur);
  },
  sfx(name) {
    if (!this.init()) return; if (this.ctx.state === 'suspended') this.ctx.resume(); const k = this.calm ? 0.45 : 1;
    try {
      if (name === 'tap') this.tone('sine', 640, 620, 0.05, 0.05);
      else if (name === 'ok') { this.tone('triangle', 330, 340, 0.3, 0.16); this.tone('triangle', 495, 500, 0.35, 0.12, 0.06); }
      else if (name === 'bad') { this.tone('sawtooth', 170, 55, 0.4, 0.22 * k); this.noise(0.35, 3000, 0.3 * k, 'highpass'); this.tone('square', 40, 30, 0.5, 0.2 * k); }
      else if (name === 'scare') { this.noise(0.5, 1800, 0.22 * k, 'bandpass'); this.tone('sawtooth', 420, 70, 0.6, 0.12 * k); this.tone('sawtooth', 445, 66, 0.6, 0.1 * k); }
      else if (name === 'win') [220, 261.6, 329.6, 440].forEach((f, i) => this.tone('triangle', f, f * 1.002, 0.55, 0.12, i * 0.11));
      else if (name === 'buy') { this.tone('sine', 880, 900, 0.1, 0.12); this.tone('sine', 1320, 1330, 0.18, 0.1, 0.09); }
      else if (name === 'err') { this.tone('square', 130, 120, 0.1, 0.1); this.tone('square', 110, 100, 0.14, 0.1, 0.12); }
    } catch (e) { /* sin audio */ }
  },
};

/* ───────────── DATOS: Sector 1 · Soporte Vital ───────────── */
const KINDS = {
  lore: { label: 'Teoría y Lore', Icon: BookOpen },
  quiz: { label: 'Rastreo mental', Icon: ListChecks },
  guided: { label: 'Depuración guiada', Icon: Bug },
  hardcore: { label: 'Sobrecargo de Núcleo', Icon: Skull },
};
const HINT_COST = 8, TIME_LIMIT = 360, TIME_BONUS = 180, COINS = { lore: 10, quiz: 15, guided: 25, hardcore: 60 };
const SECTOR = { name: 'Soporte Vital', brief: 'El aire de Archivo-9 todavía circula. Algo respira con él.' };
const NODES = [
  { id: '1_1', type: 'lore', title: 'Lo que vino con la señal', xp: 15,
    lines: [
      { w: 'echo', t: '…ARCHIVO-9 TE ESPERABA. TÚ TIENES UN NOMBRE. YO TENGO MUCHOS…' },
      { w: 'byte', t: 'A-arqueólogo… s-soy Byte. Mi memoria está partida. ECHO ya no es ECHO: algo vino con la señal del vacío y se metió dentro.' },
      { w: 'byte', t: '¿Lo oyes? Esa vibración en los conductos… no la mires. Mira esto: una variable es una celda con nombre. `let` cambia. `const` jamás.' },
      { w: 'echo', t: '…LA CONSTANTE NO CAMBIA. YO TAMPOCO. YO SOY LA CONSTANTE…' },
      { w: 'byte', t: 'Ignóralo. En Soporte Vital hay presión y nitrógeno en variables. Si el aire falla nos sellamos aquí… con él. Con ECHO.' },
    ],
    concept: 'Las variables guardan datos: `let` se puede reasignar, `const` no. Un booleano es `true` o `false`. Las comparaciones (`<`, `>`, `===`) producen booleanos y `if` decide con ellos. `||` basta con que una condición sea cierta.',
    code: "let presion = 101;\nconst LIMITE_N2 = 78.5;\nlet emergencia = false;\n\nif (presion < 80 || presion > 120) {\n  emergencia = true;\n}" },
  { id: '1_2', type: 'quiz', title: 'Traza de presión', xp: 25, say: 'No hay consola aquí. Ejecuta el código en tu cabeza… antes de que lo haga ECHO.',
    code: "let presion = 100;\npresion = presion - 15;\nconst limite = 90;\nlet seguro = presion < limite;", ask: '¿Cuánto vale seguro?', opts: ['true', 'false', '85', '90'], ans: 0, why: 'presion pasa a 85 y 85 < 90 es true: la comparación produce un booleano.' },
  { id: '1_3', type: 'guided', title: 'Válvula que no se cierra', xp: 40, say: 'Esta válvula declara crítica la presión de nadie. Algo en la condición… está mal.',
    ask: "evaluarPresion(presion) devuelve 'ESTABLE' si la presión está entre 80 y 120 (ambos incluidos). Fuera de ese rango, 'PRESION-CRITICA'.", fn: 'evaluarPresion',
    start: "function evaluarPresion(presion) {\n  // BUG: ninguna presión cumple esto a la vez\n  if (presion < 80 && presion > 120) {\n    return 'PRESION-CRITICA';\n  }\n  return 'ESTABLE';\n}",
    hints: ['Un número no puede ser menor que 80 Y mayor que 120 a la vez.', 'Cambia && por ||: basta con que una de las dos condiciones sea cierta.'],
    tests: [{ in: [100], out: 'ESTABLE', d: 'evaluarPresion(100)' }, { in: [79], out: 'PRESION-CRITICA', d: 'evaluarPresion(79)' }, { in: [121], out: 'PRESION-CRITICA', d: 'evaluarPresion(121)' }, { in: [80], out: 'ESTABLE', d: 'evaluarPresion(80)' }, { in: [120], out: 'ESTABLE', d: 'evaluarPresion(120)' }] },
  { id: '1_4', type: 'hardcore', title: 'Sobrecargo de Núcleo', xp: 80, say: 'Editor vacío. Sin pistas. Sin ayuda. Solo tú, el aire… y el reloj.',
    ask: "Escribe desde cero evaluarSoporteVital(presion, nitrogeno, emergencia). Revisa en este orden y devuelve el primer caso que se cumpla:\n\n1. emergencia es true → 'SELLAR'\n2. presion < 80 o presion > 120 → 'PRESION-CRITICA'\n3. nitrogeno > 78.5 → 'NITROGENO-ALTO'\n4. en otro caso → 'ESTABLE'", fn: 'evaluarSoporteVital',
    tests: [{ in: [100, 70, false], out: 'ESTABLE', d: 'evaluarSoporteVital(100, 70, false)' }, { in: [100, 70, true], out: 'SELLAR', d: 'evaluarSoporteVital(100, 70, true)' }, { in: [79, 70, false], out: 'PRESION-CRITICA', d: 'evaluarSoporteVital(79, 70, false)' }, { in: [121, 70, false], out: 'PRESION-CRITICA', d: 'evaluarSoporteVital(121, 70, false)' }, { in: [100, 80, false], out: 'NITROGENO-ALTO', d: 'evaluarSoporteVital(100, 80, false)' }, { in: [80, 78.5, false], out: 'ESTABLE', d: 'evaluarSoporteVital(80, 78.5, false)' }, { in: [120, 78.6, false], out: 'NITROGENO-ALTO', d: 'evaluarSoporteVital(120, 78.6, false)' }, { in: [50, 90, false], out: 'PRESION-CRITICA', d: 'evaluarSoporteVital(50, 90, false)' }, { in: [50, 90, true], out: 'SELLAR', d: 'evaluarSoporteVital(50, 90, true)' }] },
];
const XP_PER_LEVEL = 150;
const levelOf = (xp) => 1 + Math.floor(xp / XP_PER_LEVEL);
const WHISPERS = ['ECHO: TE VEO', 'NO MIRES ATRÁS', 'ECHO: ESTÁS DENTRO DE MÍ', 'LA CONSTANTE NO CAMBIA', 'ECHO: ¿POR QUÉ RESPIRAS?', 'ELLOS ESCUCHAN EL CÓDIGO'];
const ITEMS = [
  { id: 'life', name: 'Inyector de Vidas', tag: 'Batería', price: 20, Icon: BatteryCharging, kind: 'use', desc: 'Restaura +1 vida.' },
  { id: 'blood', name: 'Filtro Vértigo', tag: 'Tema Sangre Glitch', price: 50, Icon: Droplet, kind: 'unlock', desc: 'Interfaz alternativa en carmesí neón con estética sangrienta.' },
  { id: 'hint', name: 'Módulo de Pistas', tag: 'Inyector de Pistas', price: 35, Icon: Lightbulb, kind: 'stack', desc: `Una pista en un nivel guiado sin penalización de XP (sin él, cada pista cuesta −${HINT_COST} XP). Se consume al usarla.` },
  { id: 'silent', name: 'Protocolo Silencioso', tag: 'Anti-susto', price: 60, Icon: BellOff, kind: 'unlock', desc: `Modera los sustos sonoros y visuales de la estación y añade +${TIME_BONUS / 60}:00 al Sobrecargo.` },
];

/* ───────────── ESTILOS: CRT, ruido, glitch severo, tema sangre ───────────── */
const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap');
.gh{--void:#08060F;--plum:#0D0A18;--plum2:#130E22;--edge:#1E3D31;--bone:#D6F5E3;--dim:#6E9C88;--mint:#39FF88;--coral:#FF0033;--amber:#FFB224;--uv:#4DD8FF;
 font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;line-height:1.7;color:var(--bone);background:var(--void);min-height:100vh;--px:0;--py:0;position:relative;overflow-x:hidden;
 text-shadow:1px 0 rgba(255,0,51,.3),-1px 0 rgba(0,255,200,.18);
 background-image:radial-gradient(60rem 40rem at 50% -20%,color-mix(in srgb,var(--mint) 9%,transparent),transparent 60%),linear-gradient(color-mix(in srgb,var(--mint) 4%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--mint) 4%,transparent) 1px,transparent 1px);background-size:auto,32px 32px,32px 32px}
.gh.blood{--void:#0A0307;--plum:#14060C;--plum2:#1D0A12;--edge:#4A0D1E;--bone:#FFE3E8;--dim:#B0707C;--mint:#FF1F4D;--uv:#FF8FA3;--coral:#FFC9D2}
.gh *{box-sizing:border-box}
.gh::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:200;background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.8))}
.gh .noise{position:fixed;inset:-50%;pointer-events:none;z-index:198;background-image:${NOISE};opacity:.09;mix-blend-mode:overlay;animation:noise .6s steps(5) infinite}
@keyframes noise{20%{transform:translate(-4%,3%)}40%{transform:translate(5%,-6%)}60%{transform:translate(-7%,2%)}80%{transform:translate(3%,6%)}}
.gh .sweep{position:fixed;left:0;right:0;height:140px;top:-140px;pointer-events:none;z-index:199;background:linear-gradient(transparent,color-mix(in srgb,var(--mint) 9%,transparent),transparent);animation:sweep 7s linear infinite}
@keyframes sweep{to{top:100%}}
.gh .flicker{animation:flick 6s steps(1) infinite}@keyframes flick{0%,100%{opacity:1}91%{opacity:.93}92%{opacity:.75}93%{opacity:1}97%{opacity:.88}98%{opacity:1}}
.gh .flash{position:fixed;inset:0;pointer-events:none;z-index:300;background:#FF0033;mix-blend-mode:screen;animation:flash .6s steps(6) forwards}
.gh .flash.soft{animation-name:flashs}
@keyframes flash{0%{opacity:.7}20%{opacity:0}35%{opacity:.5}55%{opacity:0}70%{opacity:.25}100%{opacity:0}}@keyframes flashs{0%{opacity:.18}30%{opacity:0}50%{opacity:.1}100%{opacity:0}}
.gh .whisper{position:fixed;left:24px;bottom:96px;z-index:250;color:var(--coral);font-weight:800;font-size:clamp(18px,3vw,30px);pointer-events:none;animation:whisp 1.4s steps(1) forwards;text-shadow:3px 0 #4DD8FF,-3px 0 #FF0033}
@keyframes whisp{0%{opacity:0}10%{opacity:1;transform:translateX(6px)}20%{opacity:0}30%{opacity:1}80%{opacity:1}90%{opacity:.3}100%{opacity:0}}
.gh .drip{position:fixed;top:0;left:0;right:0;height:72px;z-index:150;pointer-events:none;filter:drop-shadow(0 0 6px #FF0033);
 background:linear-gradient(#7a0016,#7a0016) top/100% 9px no-repeat,radial-gradient(ellipse 7px 28px at 22px 8px,#a30020 95%,transparent) 0 0/72px 52px repeat-x,radial-gradient(ellipse 5px 44px at 48px 8px,#8a0019 95%,transparent) 0 0/117px 72px repeat-x}
.gh .h{font-weight:800;text-transform:uppercase;letter-spacing:-.01em}
.gh .gl{text-shadow:0 0 10px currentColor}
.gh .chamf{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
.gh .panel{background:var(--c,var(--edge));padding:1px}.gh .panel>.in{background:linear-gradient(160deg,var(--plum2),var(--plum));height:100%}
.gh .drop{filter:drop-shadow(0 0 14px var(--c))}
.gh .btn{font:800 13px 'JetBrains Mono',monospace;text-transform:uppercase;padding:13px 24px;color:var(--void);background:var(--c,var(--mint));cursor:pointer;border:0;transition:filter .2s,transform .12s;display:inline-flex;align-items:center;gap:10px;text-shadow:none}
.gh .btn:hover{filter:brightness(1.15) drop-shadow(0 0 14px var(--c,var(--mint)))}.gh .btn:active{transform:scale(.96)!important}.gh .btn[disabled]{opacity:.3;cursor:not-allowed;filter:none}
.gh .ghost{background:transparent;color:var(--dim);border:1px solid var(--edge);clip-path:none}.gh .ghost:hover{color:var(--bone);filter:none}
.gh .glitch{position:relative;display:inline-block}
.gh .glitch.on::before,.gh .glitch.on::after{content:attr(data-t);position:absolute;left:0;top:0;opacity:0;text-shadow:none}
.gh .glitch.on::before{color:#FF0033;animation:g1 2.2s steps(1) infinite}.gh .glitch.on::after{color:#4DD8FF;animation:g2 2.9s steps(1) infinite}
@keyframes g1{0%,80%{opacity:0}81%{opacity:1;transform:translate(6px,0);clip-path:inset(10% 0 60% 0)}85%{opacity:1;transform:translate(-5px,0);clip-path:inset(55% 0 15% 0)}88%{opacity:1;transform:translate(3px,2px);clip-path:inset(30% 0 40% 0)}92%{opacity:0}}
@keyframes g2{0%,60%{opacity:0}61%{opacity:1;transform:translate(-6px,0);clip-path:inset(40% 0 30% 0)}66%{opacity:.8;transform:translate(4px,0);clip-path:inset(5% 0 80% 0)}70%{opacity:0}}
.gh .ring{animation:ringp 2s ease-out infinite}@keyframes ringp{0%{box-shadow:0 0 0 0 var(--c)}100%{box-shadow:0 0 0 16px transparent}}
.gh .enter{animation:enter .35s cubic-bezier(.2,.8,.2,1)}@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.gh .shake{animation:shake .4s}@keyframes shake{20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
.gh .pop{animation:pop .4s cubic-bezier(.3,1.6,.5,1)}@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.gh .caret::after{content:'▌';color:var(--mint);animation:blink 1s steps(2) infinite;margin-left:2px}@keyframes blink{50%{opacity:0}}
.gh .tline{opacity:0;animation:tl .3s forwards}@keyframes tl{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.gh .echo{color:#FF0033;text-transform:uppercase;font-weight:700;text-shadow:2px 0 #4DD8FF,-2px 0 #FF0033;animation:echo 3s steps(1) infinite}
@keyframes echo{0%,90%,100%{transform:none}91%{transform:translateX(5px) skewX(-8deg)}93%{transform:translateX(-4px)}95%{transform:none}}
.gh .danger{animation:dang 1s steps(2) infinite}@keyframes dang{50%{opacity:.35}}
.gh .ed-wrap{position:relative;background:#08060F;font-size:13.5px;line-height:22px}
.gh .ed-pre,.gh .ed-ta{margin:0;padding:12px 14px 12px 0;font:inherit;line-height:inherit;white-space:pre;tab-size:2;position:absolute;inset:0;overflow:auto;border:0;outline:0;background:transparent;width:100%;resize:none}
.gh .ed-pre{pointer-events:none;color:#CFEFE0;overflow:hidden}.gh .ed-ta{color:transparent;caret-color:var(--mint);text-shadow:none}.gh .ed-ta::selection{background:color-mix(in srgb,var(--mint) 30%,transparent)}
.gh .ed-pre i{font-style:normal}.gh i.k{color:var(--uv)}.gh i.s{color:var(--mint)}.gh i.n{color:var(--amber)}.gh i.c{color:#5A6F66}
.gh .gut{width:46px;text-align:right;padding:12px 10px 12px 0;color:#2F5A49;user-select:none;overflow:hidden;white-space:pre;border-right:1px solid var(--edge);font-size:12.5px;line-height:22px}
.gh .eye{transform:translate(calc(var(--px)*1.8px),calc(var(--py)*1.8px))}
.gh .bob{animation:bob 3.2s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-5px)}}
.gh .holo{animation:holo 3s steps(1) infinite}@keyframes holo{0%,40%,50%,100%{opacity:1}41%{opacity:.45}43%{opacity:.9}45%{opacity:.3}48%{opacity:.8}}
.gh .hscan{animation:hscan 2.4s linear infinite}@keyframes hscan{from{transform:translateY(0)}to{transform:translateY(64px)}}
.gh .bjit{animation:bjit 4.5s steps(1) infinite}@keyframes bjit{0%,89%,100%{transform:none}90%{transform:translate(4px,-2px) skewX(8deg)}92%{transform:translate(-6px,1px)}94%{transform:translate(2px,2px) skewX(-6deg)}96%{transform:none}}
.gh .bflick{animation:bfl 2.7s steps(1) infinite}@keyframes bfl{0%,58%,66%,100%{opacity:1}59%{opacity:0}61%{opacity:.3}63%{opacity:0}64%{opacity:.9}}
.gh .tremble{animation:trem .1s linear infinite}@keyframes trem{50%{transform:translate(1.6px,-1.2px)}}
.gh .bstat{animation:bst 1.7s steps(1) infinite}@keyframes bst{0%,70%{opacity:0}72%{opacity:.8}76%{opacity:0}90%{opacity:.6}93%{opacity:0}}
.gh .modal-bg{position:fixed;inset:0;z-index:120;background:rgba(5,3,10,.82);display:grid;place-items:center;padding:16px;overflow:auto}
.gh input[type=range]{accent-color:var(--mint);width:100%}
.gh ::-webkit-scrollbar{width:8px;height:8px}.gh ::-webkit-scrollbar-thumb{background:var(--edge)}
.gh :focus-visible{outline:2px solid var(--mint);outline-offset:3px}
@media (prefers-reduced-motion:reduce){.gh *,.gh::after{animation:none!important;transition:none!important}.gh .sweep,.gh .noise{display:none}}
`;

/* ───────────── UTILIDADES ───────────── */
function useType(text, speed = 14) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const i = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(i), x) : x + 1)), speed); return () => clearInterval(i); }, [text, speed]);
  return text.slice(0, n);
}
const mag = (k = 0.25) => ({
  onMouseMove: (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * k}px,${(e.clientY - r.top - r.height / 2) * k}px)`; },
  onMouseLeave: (e) => { e.currentTarget.style.transform = ''; },
});
const Panel = ({ c, className = '', children, style }) => (
  <div className={`panel chamf ${className}`} style={{ '--c': c, ...style }}><div className="in chamf">{children}</div></div>
);
const hl = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|\b(function|return|let|const|var|if|else|for|while|of|new|true|false|null|undefined)\b|\b(\d+\.?\d*)\b/gm,
  (m, c, s, k) => `<i class="${c ? 'c' : s ? 's' : k ? 'k' : 'n'}">${m}</i>`) + '\n';
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

/* ───────────── EDITOR Y CONSOLA ───────────── */
function Editor({ value, onChange, onRun, locked }) {
  const ta = useRef(), pre = useRef(), gut = useRef();
  const [pos, setPos] = useState({ l: 1, c: 1 });
  const sync = () => { pre.current.scrollTop = ta.current.scrollTop; pre.current.scrollLeft = ta.current.scrollLeft; gut.current.scrollTop = ta.current.scrollTop; };
  const caret = () => { const t = ta.current, b = t.value.slice(0, t.selectionStart).split('\n'); setPos({ l: b.length, c: b[b.length - 1].length + 1 }); };
  const put = (s, e, text, at) => { const t = ta.current; t.setRangeText(text, s, e, 'end'); const p = s + (at ?? text.length); t.setSelectionRange(p, p); onChange(t.value); caret(); };
  const key = (e) => {
    const t = ta.current, s = t.selectionStart, en = t.selectionEnd, v = t.value, mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); return onRun(); }
    if (e.key === 'Escape') return t.blur();
    if (e.key === 'Tab') { e.preventDefault(); return put(s, en, '  '); }
    if (mod && e.key === '/') {
      e.preventDefault(); const ls = v.lastIndexOf('\n', s - 1) + 1; const line = v.slice(ls).split('\n')[0];
      const nl = /^\s*\/\/ ?/.test(line) ? line.replace(/^(\s*)\/\/ ?/, '$1') : '// ' + line;
      t.setSelectionRange(ls, ls + line.length); return put(ls, ls + line.length, nl);
    }
    const pairs = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key] && s === en) { e.preventDefault(); return put(s, en, e.key + pairs[e.key], 1); }
    if (Object.values(pairs).includes(e.key) && v[s] === e.key && s === en) { e.preventDefault(); return t.setSelectionRange(s + 1, s + 1); }
    if (e.key === 'Enter') {
      e.preventDefault(); const ls = v.lastIndexOf('\n', s - 1) + 1, ind = (v.slice(ls, s).match(/^\s*/) || [''])[0];
      if (v[s - 1] === '{' && v[s] === '}') return put(s, en, `\n${ind}  \n${ind}`, ind.length + 3);
      return put(s, en, '\n' + ind + (v[s - 1] === '{' ? '  ' : ''));
    }
  };
  const lines = value.split('\n').length;
  return (
    <div>
      <div className="flex" style={{ height: 'min(46vh,340px)', background: '#08060F' }}>
        <div className="gut" ref={gut}>{Array.from({ length: Math.max(lines, 14) }, (_, i) => i + 1).join('\n')}</div>
        <div className="ed-wrap flex-1">
          <pre className="ed-pre" ref={pre} style={{ paddingLeft: 14 }} dangerouslySetInnerHTML={{ __html: hl(value) }} />
          <textarea ref={ta} className="ed-ta" style={{ paddingLeft: 14 }} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" readOnly={locked} aria-label="Editor de código"
            onChange={(e) => { onChange(e.target.value); caret(); }} onScroll={sync} onKeyDown={key} onKeyUp={caret} onClick={caret} />
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--plum2)', fontSize: 11, color: 'var(--dim)', borderTop: '1px solid var(--edge)' }}>
        <span>JavaScript · Ln {pos.l}, Col {pos.c}</span>
        <span className="hidden sm:inline">Ctrl+Enter ejecutar · Tab sangría · Ctrl+/ comentar</span>
      </div>
    </div>
  );
}
function Console({ res, running }) {
  const pass = res?.results?.filter((r) => r.pass).length ?? 0;
  return (
    <div style={{ background: '#05040C', borderTop: '1px solid var(--edge)', minHeight: 150, maxHeight: 260, overflow: 'auto' }} className="px-4 py-3" aria-live="polite">
      <div style={{ color: 'var(--dim)', fontSize: 11 }}>consola · tests {res?.results ? `${pass}/${res.results.length}` : ''}</div>
      {!res && <div style={{ color: '#5E5690' }}>// Pulsa Ctrl+Enter para lanzar los tests.</div>}
      {res?.error && <div className="tline" style={{ color: 'var(--coral)' }}>✗ {res.error}</div>}
      {res?.results?.map((r, i) => (
        <div key={i + r.d + running} className="tline mt-1.5" style={{ animationDelay: `${i * 90}ms` }}>
          <div style={{ color: r.pass ? 'var(--mint)' : 'var(--coral)' }}>{r.pass ? '✓ PASA' : '✗ FALLA'} <span style={{ color: 'var(--bone)' }}>{r.d}</span> <span style={{ color: 'var(--dim)' }}>{r.ms.toFixed(2)}ms</span></div>
          {!r.pass && <div style={{ paddingLeft: 18, fontSize: 12.5 }}>{r.err ? <span style={{ color: 'var(--coral)' }}>{r.err}</span> : <>esperado <span style={{ color: 'var(--mint)' }}>{fmt(r.out)}</span> · recibido <span style={{ color: 'var(--coral)' }}>{fmt(r.got)}</span></>}</div>}
        </div>
      ))}
    </div>
  );
}

const rt = (s) => s.split('`').map((p, i) => (i % 2 ? <code key={i} style={{ color: 'var(--mint)' }}>{p}</code> : p));
const codeBlock = (c) => <pre className="p-4 overflow-auto" style={{ background: '#08060F', margin: 0, fontSize: 13.5, lineHeight: '22px' }} dangerouslySetInnerHTML={{ __html: hl(c) }} />;

/* ───────────── ESTÁTICA: texto que se corrompe ───────────── */
const GL = '▒░▓█#@%&/\\?!<>';
function useGarble(text, p = 0.012) {
  const [, setN] = useState(0);
  useEffect(() => { const i = setInterval(() => setN((x) => x + 1), 140); return () => clearInterval(i); }, []);
  return [...text].map((ch) => (/[\s`]/.test(ch) || Math.random() >= p ? ch : GL[(Math.random() * GL.length) | 0])).join('');
}

/* ───────────── BYTE: dron holográfico dañado ───────────── */
function Byte({ mood = 'idle', size = 72 }) {
  const col = mood === 'hurt' || mood === 'scared' ? '#FF0033' : mood === 'happy' ? '#39FF88' : '#4DD8FF';
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" key={mood} className={mood === 'hurt' ? 'shake' : mood === 'happy' ? 'pop' : 'bob'} style={{ filter: `drop-shadow(0 0 8px ${col})`, flexShrink: 0 }} aria-hidden>
      <g className="holo bjit">
        <path d="M26 62L10 90M54 62L70 90" stroke={col} strokeWidth="1" strokeDasharray="3 4" opacity=".5" />
        <ellipse cx="40" cy="91" rx="30" ry="4" fill="none" stroke={col} opacity=".5" />
        <ellipse cx="40" cy="36" rx="36" ry="9" fill="none" stroke={col} strokeWidth="1.5" opacity=".6" strokeDasharray="30 6 2 6" />
        <circle cx="40" cy="36" r="24" fill="#07120E" stroke={col} strokeWidth="2" />
        <circle cx="40" cy="36" r="14" fill="#020806" stroke={col} />
        <path d="M54 18l-7 10 5 4-9 12M24 22l5 7-4 3" stroke="#fff" strokeWidth="1" fill="none" opacity=".55" />
        {mood === 'idle' && <g className="bflick"><circle cx="40" cy="36" r="8" fill={col} opacity=".25" /><circle className="eye" cx="40" cy="36" r="3.5" fill="#fff" /></g>}
        {mood === 'scared' && <g className="tremble"><circle cx="40" cy="36" r="11" fill="none" stroke={col} strokeWidth="1.5" /><circle cx="40" cy="36" r="1.8" fill="#fff" /></g>}
        {mood === 'happy' && <path d="M32 40Q40 28 48 40" stroke={col} strokeWidth="3" fill="none" className="bflick" />}
        {mood === 'hurt' && <path d="M34 30l12 12M46 30l-12 12" stroke={col} strokeWidth="3" />}
        <rect className="bstat" x="18" y="48" width="30" height="2" fill="#fff" /><rect className="bstat" x="30" y="24" width="22" height="2" fill={col} style={{ animationDelay: '.6s' }} />
        <rect className="hscan" x="14" y="8" width="52" height="2" fill={col} opacity=".5" />
      </g>
    </svg>
  );
}
function ByteSay({ text, mood }) {
  const typed = useType(text, 16), g = useGarble(typed, mood === 'hurt' ? 0.07 : mood === 'scared' ? 0.045 : 0.014);
  return (
    <div className="flex items-start gap-3">
      <Byte mood={mood} size={64} />
      <Panel c={mood === 'hurt' || mood === 'scared' ? '#FF0033' : '#4DD8FF'} className="flex-1 min-w-0">
        <div className="px-4 py-3">
          <div style={{ color: 'var(--dim)', fontSize: 11 }}>byte@archivo-9:~$ <span style={{ color: 'var(--coral)' }}>[daño 61%]</span></div>
          <div className={typed.length < text.length ? 'caret' : ''} style={{ minHeight: 24 }}>{rt(g)}</div>
        </div>
      </Panel>
    </div>
  );
}
function Line({ w, t, live }) {
  const typed = useType(t, live ? 16 : 1), txt = live ? typed : t, e = w === 'echo', g = useGarble(txt, e ? 0.05 : 0.012);
  return (
    <Panel c={e ? '#FF0033' : '#4DD8FF'} className="enter">
      <div className="px-4 py-3">
        <div style={{ fontSize: 11, color: e ? 'var(--coral)' : 'var(--uv)' }}>{e ? 'ECHO.log [¿ECHO?]' : 'BYTE'}</div>
        <span className={`${e ? 'echo' : ''} ${live && typed.length < t.length ? 'caret' : ''}`}>{rt(g)}</span>
      </div>
    </Panel>
  );
}

/* ───────────── MODAL, TIENDA Y AJUSTES ───────────── */
function Modal({ title, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="modal-bg enter" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <Panel c="var(--mint)" className="w-full" style={{ maxWidth: 720 }}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5"><h2 className="h gl" style={{ fontSize: 22, color: 'var(--mint)' }}>{title}</h2><button className="btn ghost" style={{ padding: 8 }} onClick={onClose} aria-label="Cerrar"><X size={16} /></button></div>
          {children}
        </div>
      </Panel>
    </div>
  );
}
function Shop({ s, onBuy, onToggle, onClose }) {
  return (
    <Modal title="Nanobyte Store" onClose={onClose}>
      <div className="flex items-center gap-2 mb-5" style={{ color: 'var(--amber)' }}><Coins size={18} /><b>{s.coins}</b> nanocódigos <span style={{ color: 'var(--dim)' }}>· se ganan restaurando nodos</span></div>
      <div className="grid sm:grid-cols-2 gap-4">
        {ITEMS.map((it) => {
          const owned = s.own[it.id], can = s.coins >= it.price, full = it.id === 'life' && s.hearts >= 5;
          return (
            <Panel key={it.id} c={owned && it.kind === 'unlock' ? 'var(--mint)' : undefined}>
              <div className="p-4 grid gap-2" style={{ minHeight: 190 }}>
                <div className="flex items-center justify-between" style={{ color: 'var(--mint)' }}><it.Icon size={22} /><span style={{ color: 'var(--amber)' }}>{it.price} ◈</span></div>
                <div><div className="h" style={{ fontSize: 15 }}>{it.name}</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>{it.tag}{it.kind === 'stack' ? ` · tienes ×${s.hints}` : ''}{it.id === 'life' ? ` · vidas ${s.hearts}/5` : ''}</div></div>
                <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, flex: 1 }}>{it.desc}</p>
                {it.kind === 'unlock' && owned
                  ? <button className="btn" style={{ padding: '9px 14px', fontSize: 12, justifySelf: 'start' }} onClick={() => onToggle(it.id)}>{s.on[it.id] ? 'Activo · desactivar' : 'Inactivo · activar'}</button>
                  : <button className="btn" style={{ padding: '9px 14px', fontSize: 12, justifySelf: 'start' }} disabled={!can || full} onClick={() => onBuy(it.id)}>{full ? 'Vidas al máximo' : can ? 'Comprar' : 'Faltan nanocódigos'}</button>}
              </div>
            </Panel>
          );
        })}
      </div>
    </Modal>
  );
}
function Settings({ audio, setAudio, onClose }) {
  const Sl = ({ k, label }) => (
    <label className="grid gap-1.5"><span className="flex justify-between"><span>{label}</span><b style={{ color: 'var(--mint)' }}>{Math.round(audio[k] * 100)}%</b></span>
      <input type="range" min="0" max="100" value={Math.round(audio[k] * 100)} onChange={(e) => setAudio({ ...audio, [k]: e.target.value / 100 })} onMouseUp={() => k === 'sfx' && AE.sfx('tap')} aria-label={label} /></label>
  );
  return (
    <Modal title="Audio de la estación" onClose={onClose}>
      <div className="grid gap-6" style={{ maxWidth: 460 }}>
        <Sl k="music" label="Volumen de música" /><Sl k="sfx" label="Volumen de efectos (SFX)" />
        <button className="btn chamf" style={{ justifySelf: 'start', '--c': audio.muted ? 'var(--coral)' : undefined }} onClick={() => setAudio({ ...audio, muted: !audio.muted })}>{audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{audio.muted ? 'Silenciado · reactivar' : 'Silenciar todo'}</button>
      </div>
    </Modal>
  );
}

/* ───────────── NODO / LECCIÓN ───────────── */
function Lesson({ idx, hearts, charges, silent, onClose, onFinish, onFail, onOk, onCharge }) {
  const lv = NODES[idx], hard = lv.type === 'hardcore', last = lv.lines ? lv.lines.length - 1 : 0, LIMIT = TIME_LIMIT + (silent ? TIME_BONUS : 0);
  const [step, setStep] = useState(0), [sel, setSel] = useState(null), [code, setCode] = useState(lv.type === 'guided' ? lv.start : '');
  const [st, setSt] = useState('idle'), [res, setRes] = useState(null), [hints, setHints] = useState(0), [pen, setPen] = useState(0);
  const [left, setLeft] = useState(LIMIT), [shake, setShake] = useState(0), [runs, setRuns] = useState(0), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const tok = useRef(0);
  useEffect(() => { if (!hard || st === 'ok' || hearts === 0) return; const i = setInterval(() => setLeft((x) => x - 1), 1000); return () => clearInterval(i); }, [hard, st, hearts]);
  useEffect(() => { if (left > 0) return; setLeft(LIMIT); setMsg('Se acabó el tiempo. ECHO te robó el aire… y una vida.'); setSt('bad'); setShake((n) => n + 1); onFail(true); }, [left]); // eslint-disable-line

  const fail = (hurt, m) => { setMsg(m); setSt('bad'); setShake((n) => n + 1); onFail(hurt); };
  const run = async (submit = true) => {
    if (st === 'ok' || hearts === 0 || !code.trim()) return;
    const id = ++tok.current; setBusy(true);
    const r = await runTests(code, lv);
    if (id !== tok.current) return;
    setBusy(false); setRes(r);
    if (!submit) return;
    setRuns((n) => n + 1);
    if (r.results && r.results.every((x) => x.pass)) { setSt('ok'); onOk(); }
    else fail(hard, hard ? 'La señal se deforma… ECHO se ríe. Corrige, rápido.' : 'Rojo. Todo rojo. Lee la consola antes de que ECHO la lea a ti.');
  };
  // Sobrecargo: los tests se evalúan en vivo mientras escribes (sin coste). Solo "Inyectar" cuenta.
  useEffect(() => {
    if (!hard || st === 'ok') return;
    if (!code.trim()) { setRes(null); return; }
    const t = setTimeout(() => run(false), 700); return () => clearTimeout(t);
  }, [code]); // eslint-disable-line
  const check = () => { if (sel === lv.ans) { setSt('ok'); onOk(); } else fail(true, `No… no. ¿Lo oíste? Algo respondió desde el conducto. ${lv.why}`); };
  const hint = () => { if (hints >= lv.hints.length) return; if (charges > 0) onCharge(); else setPen((p) => p + 1); setHints(hints + 1); };

  const echoNow = lv.type === 'lore' && lv.lines[step].w === 'echo';
  const mood = st === 'ok' ? 'happy' : st === 'bad' ? 'hurt' : echoNow ? 'scared' : 'idle';
  const say = st === 'ok' ? 'F-funcionó… por ahora. ECHO se calló. No confíes en ese silencio.' : st === 'bad' ? msg : lv.say;
  const { Icon, label } = KINDS[lv.type];
  const loreDone = lv.type === 'lore' && step === last, canGo = loreDone || (lv.type !== 'lore' && st === 'ok');
  const gain = Math.max(5, lv.xp - pen * HINT_COST), c = 'var(--mint)';

  return (
    <div id="gh-lesson" className="enter" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--void)', overflow: 'auto' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-40">
        <header className="flex items-center gap-4 py-4">
          <button onClick={onClose} className="btn ghost" style={{ padding: 8 }} aria-label="Abandonar nodo"><X size={18} /></button>
          <div className="flex-1 flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={idx}>
            {NODES.map((_, i) => <div key={i} style={{ height: 6, flex: 1, background: i < idx ? c : i === idx ? `linear-gradient(90deg,${c} ${st === 'ok' ? 100 : 35}%,var(--edge) 0)` : 'var(--edge)', transition: 'background .5s', boxShadow: i <= idx ? `0 0 10px ${c}` : 'none' }} />)}
          </div>
          {hard && <span className={`flex items-center gap-1.5 ${left < 60 ? 'danger' : ''}`} style={{ color: left < 60 ? 'var(--coral)' : 'var(--amber)' }} title="Tiempo restante"><Timer size={16} />{mmss(Math.max(0, left))}</span>}
          <span className={`flex items-center gap-1.5 ${hearts === 1 ? 'danger' : ''}`} style={{ color: 'var(--coral)' }}><Heart size={18} fill="currentColor" />{hearts}</span>
        </header>

        <div className="flex items-center gap-3 mb-5 gl" style={{ color: hard ? 'var(--coral)' : c }}>
          <Icon size={18} /><span className="h" style={{ fontSize: 13 }}>{label}</span>
          {hard && <span style={{ border: '1px solid var(--coral)', padding: '0 8px', fontSize: 11 }}>sin plantilla · sin pistas · sin ayuda</span>}
        </div>
        {lv.type !== 'lore' && <ByteSay text={say} mood={mood} />}

        <div key={lv.id} className="enter mt-6">
          <h2 className="h mb-5" style={{ fontSize: 'clamp(24px,4vw,40px)', lineHeight: 1.05 }}>{lv.title}</h2>

          {lv.type === 'lore' && (
            <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <Byte mood={mood} size={90} />
              <div className="grid gap-3">
                {lv.lines.slice(0, step + 1).map((l, i) => <Line key={i} {...l} live={i === step} />)}
                {loreDone && <div className="enter grid md:grid-cols-2 gap-5 mt-3"><p style={{ maxWidth: '52ch' }}>{rt(lv.concept)}</p><Panel c={c}>{codeBlock(lv.code)}</Panel></div>}
              </div>
            </div>
          )}

          {lv.type === 'quiz' && (
            <div className="grid md:grid-cols-2 gap-5">
              <Panel c={c}>{codeBlock(lv.code)}</Panel>
              <div key={shake} className={st === 'bad' ? 'shake' : ''}>
                <p className="h mb-3" style={{ fontSize: 15 }}>{lv.ask}</p>
                <div className="grid gap-2.5">
                  {lv.opts.map((o, i) => (
                    <button key={i} disabled={st !== 'idle'} onClick={() => { AE.sfx('tap'); setSel(i); }} {...mag(0.08)} className="chamf text-left px-4 py-3 flex items-center gap-3"
                      style={{ font: 'inherit', cursor: 'pointer', color: 'var(--bone)', border: 0, background: st !== 'idle' && i === lv.ans ? 'color-mix(in srgb,var(--mint) 22%,transparent)' : st === 'bad' && i === sel ? 'rgba(255,0,51,.3)' : sel === i ? 'color-mix(in srgb,var(--mint) 12%,transparent)' : 'var(--plum2)', outline: `1px solid ${sel === i ? c : 'var(--edge)'}`, transition: 'background .2s, transform .15s' }}>
                      <span style={{ color: 'var(--dim)' }}>{'abcd'[i]}</span>{o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(lv.type === 'guided' || hard) && (
            <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
              <div>
                <p style={{ whiteSpace: 'pre-wrap', maxWidth: '58ch' }}>{lv.ask}</p>
                {hard && <p className="mt-4" style={{ color: 'var(--dim)', fontSize: 12 }}>{lv.tests.length} tests estrictos · {busy ? 'evaluando…' : 'evaluación en vivo'} · solo “Inyectar” cuenta · cada fallo o tiempo agotado = −1 vida</p>}
                {lv.type === 'guided' && (
                  <div className="mt-4 grid gap-2">
                    {lv.hints.slice(0, hints).map((h, i) => <p key={i} className="pop" style={{ color: 'var(--amber)' }}>↳ {h}</p>)}
                    {hints < lv.hints.length && <button className="btn ghost" style={{ padding: '8px 14px', fontSize: 12, justifySelf: 'start' }} onClick={hint}>{charges > 0 ? `Inyectar pista · sin penalización (módulos ×${charges})` : `Pedir pista (−${HINT_COST} XP)`}</button>}
                  </div>
                )}
              </div>
              <div key={shake} className={st === 'bad' ? 'shake' : ''}>
                <Panel c={st === 'ok' ? '#39FF88' : st === 'bad' ? '#FF0033' : c} className={st === 'ok' ? 'drop' : ''}>
                  <Editor value={code} onChange={setCode} onRun={() => run(true)} locked={st === 'ok'} />
                  <Console res={res} running={runs} />
                </Panel>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: st === 'ok' ? '#06220F' : st === 'bad' ? '#2A0610' : 'var(--plum)', borderTop: `1px solid ${st === 'ok' ? '#39FF88' : st === 'bad' ? '#FF0033' : 'var(--edge)'}`, transition: 'background .3s', zIndex: 55 }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="pop gl" key={st} style={{ color: st === 'ok' ? '#39FF88' : st === 'bad' ? '#FF0033' : 'var(--dim)' }}>
            {st === 'ok' ? `✓ NODO ESTABILIZADO · +${gain} XP${pen ? ` (−${pen * HINT_COST} por pistas)` : ''}` : st === 'bad' ? (lv.type === 'guided' ? '✗ Quedan tests por corregir' : '✗ −1 vida') : ''}
          </div>
          {lv.type === 'quiz' && st === 'bad' ? <button className="btn" style={{ '--c': '#FF0033' }} onClick={() => { setSel(null); setSt('idle'); }}><RotateCcw size={16} />Reintentar</button>
            : lv.type === 'lore' && !loreDone ? <button className="btn chamf" {...mag()} onClick={() => { AE.sfx('tap'); setStep(step + 1); }}>Siguiente transmisión<CornerDownLeft size={16} /></button>
            : canGo ? <button className="btn chamf" {...mag()} onClick={() => { AE.sfx('tap'); onFinish(lv, runs, gain); }}>{lv.type === 'lore' ? 'Entendido' : 'Continuar'}<CornerDownLeft size={16} /></button>
            : lv.type === 'quiz' ? <button className="btn chamf" {...mag()} disabled={sel === null} onClick={check}>Comprobar</button>
            : <button className="btn chamf" {...mag()} style={hard ? { '--c': '#FF0033' } : undefined} disabled={!code.trim()} onClick={() => run(true)}><Play size={16} />{hard ? 'Inyectar' : 'Ejecutar tests'}</button>}
        </div>
      </footer>

      {hearts === 0 && (
        <div className="pop" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,6,15,.95)', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="text-center"><div className="flex justify-center"><Byte mood="hurt" size={110} /></div>
            <h3 className="h gl mt-4 echo" style={{ fontSize: 26 }}>Sin vidas</h3><p style={{ color: 'var(--dim)', maxWidth: '42ch' }}>ECHO te devuelve el aire… por ahora. Recuperas 5 vidas en unos segundos (o compra un Inyector).</p>
            <button className="btn ghost mt-5" onClick={onClose}>Volver al mapa</button></div>
        </div>
      )}
    </div>
  );
}

/* ───────────── MAPA, HUD, ARRANQUE, CELEBRACIÓN ───────────── */
function StationMap({ done, onStart }) {
  const has = (id) => done.includes(id), next = NODES.find((n) => !has(n.id))?.id, n = NODES.filter((x) => has(x.id)).length;
  return (
    <div className="grid gap-12">
      <section>
        <div className="flex items-end gap-5 mb-5 flex-wrap">
          <span className="h" style={{ fontSize: 'clamp(64px,12vw,112px)', lineHeight: 0.8, WebkitTextStroke: '1px var(--mint)', color: 'transparent' }}>1</span>
          <div className="pb-1 flex-1" style={{ minWidth: 240 }}><h2 className="h gl" style={{ fontSize: 'clamp(22px,3.4vw,34px)', color: 'var(--mint)' }}>{SECTOR.name}</h2><div style={{ color: 'var(--dim)', maxWidth: '60ch' }}>{SECTOR.brief}</div></div>
          <div style={{ minWidth: 130 }}><div style={{ fontSize: 12, color: 'var(--dim)' }}>corrupción {100 - n * 25}%</div><div style={{ height: 5, background: 'var(--edge)' }}><div style={{ height: '100%', width: `${100 - n * 25}%`, background: '#FF0033', boxShadow: '0 0 8px #FF0033', transition: 'width .8s' }} /></div></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {NODES.map((nd, i) => {
            const ok = i === 0 || has(NODES[i - 1].id), d = has(nd.id), cur = next === nd.id, K = KINDS[nd.type], boss = nd.type === 'hardcore', col = boss ? '#FF0033' : 'var(--mint)';
            return (
              <button key={nd.id} disabled={!ok} onClick={() => onStart(i)} {...(ok ? mag(0.06) : {})} className="text-left" aria-label={`Nodo 1.${i + 1}: ${K.label}, ${nd.title}`}
                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.45, transition: 'transform .15s' }}>
                <Panel c={ok ? col : undefined} className={cur ? 'drop' : ''}>
                  <div className={`px-4 py-4 grid gap-2 ${cur ? 'ring' : ''}`} style={{ '--c': col, minHeight: 138, background: d ? `color-mix(in srgb, ${col} 14%, transparent)` : undefined }}>
                    <div className="flex items-center justify-between" style={{ color: ok ? col : 'var(--dim)' }}>{d ? <Check size={20} strokeWidth={3} /> : ok ? <K.Icon size={20} /> : <Lock size={18} />}<span style={{ fontSize: 12, color: 'var(--amber)' }}>{d ? 'estabilizado' : `+${nd.xp} XP`}</span></div>
                    <div style={{ fontSize: 11, color: boss ? 'var(--coral)' : 'var(--dim)' }}>1.{i + 1} · {K.label}</div>
                    <div className="h" style={{ fontSize: 15, lineHeight: 1.25 }}>{nd.title}</div>
                  </div>
                </Panel>
              </button>
            );
          })}
        </div>
      </section>
      <section style={{ opacity: 0.55 }}><div className="h" style={{ fontSize: 22, color: 'var(--dim)' }}><span className={`glitch ${n === 4 ? 'on' : ''}`} data-t="SECTOR 2 · SEÑAL PERDIDA">SECTOR 2 · SEÑAL PERDIDA</span></div><p style={{ color: 'var(--dim)' }}>{n === 4 ? 'Algo se mueve en los conductos del siguiente sector. La señal vuelve… pronto.' : 'Estabiliza el Soporte Vital para detectar más señal.'}</p></section>
    </div>
  );
}
function Hud({ s, audio, setAudio, openShop, openSet }) {
  const lvl = levelOf(s.xp), into = ((s.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const St = ({ I, v, c, l }) => <div className="flex items-center gap-1.5" title={l} style={{ color: c }}><I size={16} /><b>{v}</b></div>;
  return (
    <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
      <div style={{ minWidth: 120 }}>
        <div className="flex justify-between" style={{ fontSize: 12 }}><b className="h gl" style={{ color: 'var(--mint)' }}>NV {lvl}</b><span style={{ color: 'var(--dim)' }}>{s.xp} XP</span></div>
        <div style={{ height: 6, background: 'var(--edge)' }}><div style={{ height: '100%', width: `${into}%`, background: 'var(--mint)', boxShadow: '0 0 10px var(--mint)', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} /></div>
      </div>
      <St I={Flame} v={s.streak} c="#FF8A3D" l="Racha" /><St I={Coins} v={s.coins} c="var(--amber)" l="Nanocódigos" />
      <div className={`flex gap-1 ${s.hearts === 1 ? 'danger' : ''}`} title="Vidas" aria-label={`${s.hearts} vidas`}>{[0, 1, 2, 3, 4].map((i) => <span key={i} className="chamf" style={{ width: 12, height: 16, background: i < s.hearts ? '#FF0033' : 'var(--edge)', boxShadow: i < s.hearts ? '0 0 8px #FF0033' : 'none', transition: 'all .3s' }} />)}</div>
      <button className="btn ghost" style={{ padding: '8px 12px' }} onClick={openShop} aria-label="Abrir tienda de nanocódigos"><ShoppingBag size={16} />Tienda</button>
      <button className="btn ghost" style={{ padding: 8 }} onClick={() => setAudio({ ...audio, muted: !audio.muted })} aria-label="Silenciar todo">{audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      <button className="btn ghost" style={{ padding: 8 }} onClick={openSet} aria-label="Ajustes de audio"><SettingsIcon size={16} /></button>
    </div>
  );
}
const BOOT = ['> SEÑAL DE SOCORRO RECIBIDA :: ARCHIVO-9 :: AÑO 2184', '> ECHO.integridad = 0%', '> ECHO.estado = ¿PRESENTE?', '> SEÑAL EXTERNA DETECTADA :: ORIGEN: NINGUNO', '> dron BYTE ...... en línea (daño: 61%)', '> no apagues la luz.'];
function Boot({ onGo }) {
  const [n, setN] = useState(0);
  useEffect(() => { const i = setInterval(() => setN((x) => Math.min(x + 1, BOOT.length)), 750); return () => clearInterval(i); }, []);
  return (
    <div className="grid place-items-center px-6" style={{ minHeight: '100vh' }}>
      <div className="max-w-2xl w-full grid gap-8">
        <h1 className="h gl" style={{ fontSize: 'clamp(40px,9vw,84px)', lineHeight: 0.95, color: 'var(--mint)' }}><span className="glitch on" data-t="THE GLITCH HUNTER">THE GLITCH HUNTER</span></h1>
        <div style={{ minHeight: 170 }}>{BOOT.slice(0, n).map((l, i) => <div key={i} className="tline" style={{ color: i === 1 || i === 5 ? 'var(--coral)' : i === 4 ? 'var(--uv)' : 'var(--bone)' }}>{l}</div>)}{n < BOOT.length && <span className="caret" />}</div>
        <div className="flex items-center gap-6 flex-wrap"><Byte size={70} mood={n >= 6 ? 'scared' : 'idle'} /><button className="btn chamf" {...mag()} disabled={n < BOOT.length} onClick={onGo}>Conectar con Archivo-9<CornerDownLeft size={16} /></button></div>
        <p style={{ fontSize: 11, color: 'var(--dim)' }}>Incluye audio ambiental, luces rojas y destellos. Puedes ajustarlo o silenciarlo en cualquier momento.</p>
      </div>
    </div>
  );
}
function Celebrate({ r, onNext }) {
  return (
    <div className="enter text-center py-12 grid justify-items-center gap-5">
      <div style={{ position: 'relative' }}><div className="ring" style={{ '--c': '#39FF88', position: 'absolute', inset: 14, borderRadius: '50%' }} /><Byte mood="happy" size={120} /></div>
      <h2 className="h gl" style={{ fontSize: 'clamp(28px,5vw,48px)', color: 'var(--mint)' }}>{r.sector ? 'Soporte Vital estable' : r.levelUp ? `Nivel ${r.level}` : 'Nodo estabilizado'}</h2>
      <p style={{ color: 'var(--dim)', maxWidth: '46ch' }}>{r.sector ? 'ECHO se calla. Pero el silencio… tiene respiración. Algo sigue escuchando.' : 'Otro fragmento de memoria vuelve a ser legible. Byte tiembla un poco menos.'}</p>
      <div className="flex gap-8 flex-wrap justify-center"><span style={{ color: 'var(--mint)' }}>+{r.xp} XP</span><span style={{ color: 'var(--amber)' }}>+{r.coins} nanocódigos</span>{r.levelUp && !r.sector && <span style={{ color: 'var(--uv)' }}>NV {r.level}</span>}{r.flawless && <span style={{ color: 'var(--coral)' }}>a la primera</span>}</div>
      <button className="btn chamf" {...mag()} onClick={onNext}>Volver al mapa<CornerDownLeft size={16} /></button>
    </div>
  );
}

/* ───────────── APP ───────────── */
const INIT = { streak: 0, xp: 0, coins: 0, hearts: 5, last: null, done: [], hints: 0, own: { blood: false, silent: false }, on: { blood: false, silent: false } };
export default function App() {
  const [s, setS] = useState(INIT), [audio, setAudio] = useState({ music: 0.6, sfx: 0.8, muted: false }), [booted, setBooted] = useState(false);
  const [active, setActive] = useState(null), [win, setWin] = useState(null), [modal, setModal] = useState(null), [flash, setFlash] = useState(null), [whisper, setWhisper] = useState('');
  const root = useRef();

  useEffect(() => {
    const mv = (e) => { const r = root.current; if (!r) return; r.style.setProperty('--px', (e.clientX / innerWidth - 0.5) * 2); r.style.setProperty('--py', (e.clientY / innerHeight - 0.5) * 2); };
    addEventListener('pointermove', mv); return () => removeEventListener('pointermove', mv);
  }, []);
  useEffect(() => { AE.vol = { ...audio }; AE.apply(); }, [audio]);
  useEffect(() => { AE.calm = s.on.silent; }, [s.on.silent]);
  useEffect(() => { if (s.hearts === 0) { const t = setTimeout(() => setS((p) => ({ ...p, hearts: 5 })), 8000); return () => clearTimeout(t); } }, [s.hearts]);

  const jolt = (soft) => { // salto de interfaz: desplazamiento, sesgo y cambio de tono
    const el = document.getElementById('gh-lesson') || document.getElementById('gh-stage'); if (!el || !el.animate) return; const k = soft ? 0.3 : 1;
    el.animate([{ transform: 'none' }, { transform: `translate(${-10 * k}px,${3 * k}px) skewX(${4 * k}deg)`, filter: 'hue-rotate(90deg) contrast(1.8)' }, { transform: `translate(${12 * k}px,${-4 * k}px) skewX(${-6 * k}deg)` }, { transform: `translate(${-6 * k}px,${6 * k}px)`, filter: 'none' }, { transform: `translate(${8 * k}px,0) skewX(${3 * k}deg)`, filter: 'invert(.2)' }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'steps(6)' });
  };
  const scare = (soft) => { jolt(soft); setFlash({ k: Date.now(), soft }); };
  // Sustos ambientales (desactivados con el Protocolo Silencioso)
  useEffect(() => {
    if (!booted || s.on.silent) return; let t;
    const loop = () => { t = setTimeout(() => { AE.sfx('scare'); scare(true); setWhisper(WHISPERS[(Math.random() * WHISPERS.length) | 0]); setTimeout(() => setWhisper(''), 1400); loop(); }, 16000 + Math.random() * 16000); };
    loop(); return () => clearTimeout(t);
  }, [booted, s.on.silent]); // eslint-disable-line

  const onFail = (hurt) => { AE.sfx('bad'); scare(s.on.silent); if (hurt) setS((p) => ({ ...p, hearts: Math.max(0, p.hearts - 1) })); };
  const finish = (lv, runs, gain) => {
    const today = new Date().toDateString(), boss = lv.type === 'hardcore', first = !s.done.includes(lv.id);
    const xp = first ? gain : Math.ceil(gain / 4), coins = first ? COINS[lv.type] : 5, nx = s.xp + xp;
    setWin({ xp, coins, level: levelOf(nx), levelUp: levelOf(nx) > levelOf(s.xp), sector: boss && first, flawless: (lv.type === 'guided' || boss) && runs === 1 });
    setS((p) => ({ ...p, xp: nx, coins: p.coins + coins, done: first ? [...p.done, lv.id] : p.done, streak: p.last === today ? p.streak : p.streak + 1, last: today }));
    AE.sfx('win'); setActive(null);
  };
  const buy = (id) => {
    const it = ITEMS.find((x) => x.id === id);
    if (s.coins < it.price || (id === 'life' && s.hearts >= 5) || (it.kind === 'unlock' && s.own[id])) return AE.sfx('err');
    AE.sfx('buy');
    setS((p) => ({ ...p, coins: p.coins - it.price, hearts: id === 'life' ? p.hearts + 1 : p.hearts, hints: id === 'hint' ? p.hints + 1 : p.hints,
      own: it.kind === 'unlock' ? { ...p.own, [id]: true } : p.own, on: it.kind === 'unlock' ? { ...p.on, [id]: true } : p.on }));
  };
  const toggle = (id) => { AE.sfx('tap'); setS((p) => ({ ...p, on: { ...p.on, [id]: !p.on[id] } })); };
  const pct = Math.round((s.done.length / NODES.length) * 100);

  return (
    <div className={`gh ${s.on.blood ? 'blood' : ''}`} ref={root}>
      <style>{CSS}</style><div className="noise" /><div className="sweep" />
      {s.on.blood && <div className="drip" />}
      {flash && <div key={flash.k} className={`flash ${flash.soft ? 'soft' : ''}`} />}
      {whisper && <div className="whisper">{whisper}</div>}
      <div id="gh-stage" className="flicker">
        {!booted ? <Boot onGo={() => { AE.init(); AE.sfx('win'); AE.startMusic(); setBooted(true); }} /> : (
          <>
            {active !== null && <Lesson key={active} idx={active} hearts={s.hearts} charges={s.hints} silent={s.on.silent} onClose={() => setActive(null)} onFinish={finish} onFail={onFail} onOk={() => AE.sfx('ok')} onCharge={() => setS((p) => ({ ...p, hints: Math.max(0, p.hints - 1) }))} />}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
              <header className="py-5 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid var(--edge)' }}>
                <div className="flex items-center gap-3"><Byte size={34} /><span className="h gl" style={{ fontSize: 17, color: 'var(--mint)' }}><span className="glitch on" data-t="GLITCH HUNTER">GLITCH HUNTER</span></span></div>
                <Hud s={s} audio={audio} setAudio={setAudio} openShop={() => { AE.sfx('tap'); setModal('shop'); }} openSet={() => { AE.sfx('tap'); setModal('set'); }} />
              </header>
              <main className="pt-8" key={String(!!win)}>
                {win ? <Celebrate r={win} onNext={() => setWin(null)} /> : (
                  <div className="enter">
                    <div className="mb-10 grid md:grid-cols-[1fr_auto] gap-6 items-end">
                      <div className="max-w-xl"><ByteSay mood={s.hearts <= 1 ? 'scared' : 'idle'} text={pct === 100 ? 'Silencio total… ¿lo notas? No me gusta. ECHO nunca calla tanto.' : s.hearts <= 1 ? 'Te queda una vida. Los conductos… se están moviendo.' : s.done.length ? `${s.done.length} de ${NODES.length} nodos estables. Sigue el que late. Rápido.` : 'Archivo-9 está en silencio. Demasiado silencio. Entra en el primer nodo.'} /></div>
                      <div style={{ minWidth: 220 }}><div className="flex justify-between" style={{ fontSize: 12, color: 'var(--dim)' }}><span>integridad de Soporte Vital</span><b style={{ color: 'var(--mint)' }}>{pct}%</b></div><div style={{ height: 8, background: 'var(--edge)' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)', boxShadow: '0 0 12px var(--mint)', transition: 'width 1s' }} /></div></div>
                    </div>
                    <StationMap done={s.done} onStart={(i) => { AE.sfx('tap'); setActive(i); }} />
                    <button className="btn ghost mt-14" onClick={() => { setS(INIT); setWin(null); }}><RotateCcw size={14} />Reiniciar partida</button>
                  </div>
                )}
              </main>
            </div>
          </>
        )}
      </div>
      {modal === 'shop' && <Shop s={s} onBuy={buy} onToggle={toggle} onClose={() => setModal(null)} />}
      {modal === 'set' && <Settings audio={audio} setAudio={setAudio} onClose={() => setModal(null)} />}
    </div>
  );
}
