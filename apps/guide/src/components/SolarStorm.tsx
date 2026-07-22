import { useEffect, useRef } from 'react';

// The hero's backdrop: the villain of the story. Space black behind
// the header and the intro, a field of faint stars, and the sun that
// fired the storm — a giant disc shouldering into the top-right
// corner, rendered by a WebGL fragment shader: simplex-noise
// granulation boiling across a limb-darkened surface, sunspots where
// the convection dips, a streaky corona, and flares — tongues of
// plasma shredded by turbulence — bursting off the limb into the open
// sky. A shader, because gradient art cannot boil: realism here is
// noise, and noise is what GPUs are for. No rendering library — one
// fullscreen triangle and raw WebGL1, so the guide still runs
// offline. Every color is resolved from the shared semantic tokens —
// probed inside the hero, whose forced dark scheme picks their dark
// side. Pure decoration: catches no pointer events, hides from the
// accessibility tree, and stands still under prefers-reduced-motion.
// If WebGL is unavailable the component paints a plain starry sky on
// a 2D context instead — the hero stays legible, just sunless.

const TOKENS = ['brand-ink', 'warn', 'danger', 'ink'] as const;
type Token = (typeof TOKENS)[number];

/** Resolve the semantic tokens to concrete colors — the shader cannot
 *  read CSS variables, and light-dark() values resolve only through an
 *  element's computed style. The probe lives inside the hero, so the
 *  hero's forced dark scheme decides which side it sees. */
function resolveTokens(host: HTMLElement): Record<Token, string> {
  const probe = document.createElement('span');
  host.append(probe);
  const colors = {} as Record<Token, string>;
  for (const token of TOKENS) {
    probe.style.color = `var(--color-${token})`;
    colors[token] = getComputedStyle(probe).color;
  }
  probe.remove();
  return colors;
}

/** The channels of a probed 'rgb(r, g, b)' color, 0..1, for uniforms. */
function rgbVec(color: string): [number, number, number] {
  const parts = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255];
}

/** Re-tune a probed token around its channel mean: saturation spreads
 *  the channels apart, lightness scales them — below 1 crushes toward
 *  black (the sky), above 1 washes toward white (the disc's core). */
function tone(color: string, saturation: number, lightness: number): string {
  const parts = color.match(/\d+/g);
  if (!parts) return color;
  const [r = 0, g = 0, b = 0] = parts.map(Number);
  const mean = (r + g + b) / 3;
  const channel = (c: number) =>
    Math.round(
      Math.max(0, Math.min(255, (mean + (c - mean) * saturation) * lightness))
    );
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}

/** Blend two probed tokens — the palette has amber and red, and the
 *  sun lives in the oranges between them. */
function mix(a: string, b: string, t: number): string {
  const pa = a.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const pb = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const channel = (i: number) =>
    Math.round((pa[i] ?? 0) + ((pb[i] ?? 0) - (pa[i] ?? 0)) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** djb2 folded to [0, 1) — the 2D fallback's stars must sit still
 *  across rerenders, so they derive from indices, never randomness. */
function hash01(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return h / 2 ** 32;
}

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// The scene, per pixel. Coordinates are CSS pixels with y down, so
// the geometry matches the layout above it. Noise is Ashima's classic
// 3D simplex (public domain), the lingua franca of procedural suns.
const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_hot;    // white-hot core
uniform vec3 u_warm;   // amber body
uniform vec3 u_orange; // between amber and red
uniform vec3 u_deep;   // deep red limb and haze
uniform vec3 u_sky;    // the warm-black sky tint
uniform vec3 u_star;   // starlight

const float PI = 3.14159265;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    f += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return f;
}

float hash(vec2 q) {
  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453);
}

float angDiff(float a, float b) {
  return mod(a - b + PI, 2.0 * PI) - PI;
}

// A flare: a tongue of plasma rooted on the limb — an angular lobe
// that bends as it reaches out, dying with distance and shredded by
// turbulence so its edges are filaments, not an airbrush.
float flare(vec2 rel, float d, float ang, float t,
            float a0, float len, float wid, float seed) {
  float rad = (d - 0.98) / len;
  if (rad < 0.0 || rad > 1.3) return 0.0;
  float bend = 0.3 * sin(seed * 7.0) + 0.08 * sin(t * 0.15 + seed * 3.0);
  float dA = angDiff(ang, a0 + bend * rad);
  float lobe = exp(-pow(dA / (wid * (1.0 - 0.4 * rad)), 2.0));
  float env = pow(max(1.0 - rad, 0.0), 1.6);
  float n = fbm(vec3(rel * 2.5 + seed * 11.0, t * 0.1));
  float shred = smoothstep(-0.35 + 0.9 * rad, 0.45 + 0.9 * rad, n + 0.25);
  float surge = 0.8 + 0.2 * sin(t * 0.23 + seed * 5.0);
  return lobe * env * shred * surge;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float R = clamp(min(u_res.x, u_res.y) * 0.45, 150.0, 400.0);
  vec2 sun = vec2(u_res.x - R * 0.45, R * 0.25);
  vec2 rel = (p - sun) / R;
  float d = length(rel);
  float ang = atan(rel.y, rel.x);
  float t = u_time;

  // The sky: the warm-black tint, barely brightening down the page.
  vec3 col = u_sky * (0.6 + 0.9 * p.y / u_res.y);

  // Stars: one candidate per cell, most cells empty, each twinkling
  // on its own clock. The sun's glow owns its patch of sky.
  vec2 cell = floor(p / 60.0);
  vec2 starPos = (cell + vec2(hash(cell), hash(cell + 7.3))) * 60.0;
  float twinkle = 0.5 + 0.5 * sin(t * (0.4 + hash(cell + 3.1)) + hash(cell + 1.7) * 6.28);
  float lit = smoothstep(1.7, 0.4, length(p - starPos))
    * step(0.45, hash(cell + 5.2))
    * step(R * 1.45, distance(p, sun));
  col += u_star * lit * (0.14 + 0.22 * twinkle);

  float out_ = max(d - 1.0, 0.0);

  // The storm's menace: red haze soaking the corner, and a corona
  // whose brightness streaks along noise — structure, not a halo.
  col += u_deep * 0.13 * exp(-out_ * 0.8);
  float streak = fbm(vec3(ang * 2.5, d * 1.3 - t * 0.05, 3.7));
  col += (u_orange * 0.5 + u_deep * 0.35) * exp(-out_ * 2.6) * (0.6 + 0.5 * streak);

  // The flares: one dominant eruption and three lesser, aimed into
  // the visible sky (angles run clockwise from screen-right).
  float fl = 0.0;
  fl += flare(rel, d, ang, t, 2.35, 1.25, 0.16, 0.0);
  fl += flare(rel, d, ang, t, 3.05, 0.75, 0.12, 1.0);
  fl += flare(rel, d, ang, t, 1.62, 0.55, 0.10, 2.0);
  fl += flare(rel, d, ang, t, 1.95, 0.35, 0.08, 3.0);
  col += (u_orange * 0.85 + u_deep * 0.4) * fl + u_warm * fl * fl * 0.8;

  // The surface. The limb itself boils — displaced by low-frequency
  // noise — and the body is granulation over limb darkening: white
  // hot at the center of the disc, amber, orange, then deep red where
  // the sphere turns away. Sunspots open where the convection dips.
  float limb = 0.012 * fbm(vec3(cos(ang) * 2.0, sin(ang) * 2.0, t * 0.08));
  float ds = d + limb;
  float body = smoothstep(1.0, 0.99, ds);
  if (body > 0.0) {
    float g1 = fbm(vec3(rel * 3.0, t * 0.02));
    float g2 = fbm(vec3(rel * 8.0 + 5.0, t * 0.04));
    float mu = sqrt(max(1.0 - ds * ds, 0.0));
    vec3 surf = mix(u_deep * 0.8, u_orange, smoothstep(0.0, 0.55, mu));
    surf = mix(surf, u_warm, smoothstep(0.35, 0.9, mu));
    surf = mix(surf, u_hot, smoothstep(0.7, 1.0, mu) * 0.85);
    surf *= 0.82 + 0.2 * g1 + 0.12 * g2;
    surf *= 1.0 - 0.45 * smoothstep(0.45, 0.8, -g1);
    col = mix(col, surf, body);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/** No WebGL: a plain warm-black sky with still stars, so the hero is
 *  a night without its sun rather than a broken page. */
function drawFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: Record<Token, string>
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, tone(colors['brand-ink'], 1.1, 0.02));
  sky.addColorStop(1, tone(colors['brand-ink'], 1.1, 0.045));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.ink;
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.1 + 0.2 * hash01(`star o ${i}`);
    ctx.beginPath();
    ctx.arc(
      hash01(`star x ${i}`) * width,
      hash01(`star y ${i}`) * height,
      0.6 + hash01(`star size ${i}`) * 0.9,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Compile and link the scene; null (with the driver's log on the
 *  console) if the driver rejects it. */
function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const shader = gl.createShader(kind);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('SolarStorm shader:', gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('SolarStorm shader:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export function SolarStorm() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colors = resolveTokens(canvas.parentElement ?? document.body);
    // Reduced motion freezes the boil, the flares and the twinkle at
    // one frame; the scene still renders as a still.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capped pixel ratio: background art doesn't need retina, and the
    // smaller raster keeps the fragment work light on dense screens.
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const paint = () => {
        const scale = dpr();
        canvas.width = canvas.clientWidth * scale;
        canvas.height = canvas.clientHeight * scale;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawFallback(ctx, canvas.clientWidth, canvas.clientHeight, colors);
      };
      const observer = new ResizeObserver(paint);
      observer.observe(canvas);
      paint();
      return () => observer.disconnect();
    }

    const program = buildProgram(gl);
    if (!program) {
      // A driver that grants the context but rejects the shader still
      // owes the hero its black sky — clear is the call that cannot
      // fail. (The 2D fallback is out of reach: a canvas that has had
      // a WebGL context will not hand out a 2D one.)
      const [skyR, skyG, skyB] = rgbVec(tone(colors['brand-ink'], 1.1, 0.03));
      const paint = () => {
        canvas.width = canvas.clientWidth * dpr();
        canvas.height = canvas.clientHeight * dpr();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(skyR, skyG, skyB, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      };
      const observer = new ResizeObserver(paint);
      observer.observe(canvas);
      paint();
      return () => observer.disconnect();
    }
    gl.useProgram(program);

    // One triangle big enough to cover clip space — no quad, no index
    // buffer, nothing to cull.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uRes = uniform('u_res');
    const uTime = uniform('u_time');
    gl.uniform3fv(uniform('u_hot'), rgbVec(tone(colors.warn, 0.35, 1.85)));
    gl.uniform3fv(uniform('u_warm'), rgbVec(colors.warn));
    gl.uniform3fv(
      uniform('u_orange'),
      rgbVec(mix(colors.warn, colors.danger, 0.5))
    );
    gl.uniform3fv(uniform('u_deep'), rgbVec(tone(colors.danger, 1.5, 0.72)));
    gl.uniform3fv(
      uniform('u_sky'),
      rgbVec(tone(colors['brand-ink'], 1.1, 0.04))
    );
    gl.uniform3fv(uniform('u_star'), rgbVec(colors.ink));

    const render = (time: number) => {
      // The shader works in CSS pixels (to match the layout), scaled
      // up to the raster by the viewport.
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.clientWidth, canvas.clientHeight);
      gl.uniform1f(uTime, reduced ? 40 : time / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr();
      canvas.height = canvas.clientHeight * dpr();
      if (reduced) render(0);
    };
    // The hero's height follows its content (the intro loads after the
    // first poll), so the canvas watches its own box, not the window.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    let frame = 0;
    if (reduced) {
      render(0);
    } else {
      frame = requestAnimationFrame(function loop(time) {
        render(time);
        frame = requestAnimationFrame(loop);
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      aria-hidden
    />
  );
}
