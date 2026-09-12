import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The liquid gradient behind the hero.
 *
 * A full-screen fragment shader on an orthographic quad — no 3D scene, no lights, no geometry
 * beyond two triangles. The motion comes from domain warping: fractal noise is used to distort
 * the coordinates fed into more fractal noise, which is what produces the slow folding, marbled
 * look rather than a plain animated blur.
 *
 * This module is loaded lazily. three.js is ~180 KB gzipped and must never delay the listings,
 * which are the reason anyone visits.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2  uPointer;
  uniform float uIntensity;
  varying vec2  vUv;

  // --- value noise -------------------------------------------------------
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // quintic smoothstep: no visible grid creases where cells meet
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Rotating each octave stops the layers lining up into obvious diagonal banding.
  const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

  // Two octaves. Used for the warp layers, whose output is immediately distorted again —
  // detail there is invisible, so paying for it is waste.
  float fbm2(vec2 p) {
    float sum = 0.5 * noise(p);
    p = ROT * p * 2.02;
    return sum + 0.25 * noise(p);
  }

  // Three octaves for the layer actually seen.
  float fbm3(vec2 p) {
    float sum = 0.5 * noise(p);
    p = ROT * p * 2.02;
    sum += 0.25 * noise(p);
    p = ROT * p * 2.02;
    return sum + 0.125 * noise(p);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.2;
    float t = uTime * 0.035;

    // Domain warping — the whole effect lives in these three lines.
    vec2 q = vec2(fbm2(p + t), fbm2(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(
      fbm2(p + 3.4 * q + vec2(1.7, 9.2) + 0.22 * t),
      fbm2(p + 3.4 * q + vec2(8.3, 2.8) - 0.19 * t)
    );
    float f = fbm3(p + 3.0 * r);

    // Deep, unsaturated base so white text stays readable over any part of it.
    vec3 ink    = vec3(0.030, 0.033, 0.051);
    vec3 violet = vec3(0.345, 0.145, 0.780);
    vec3 rose   = vec3(0.880, 0.220, 0.420);
    vec3 azure  = vec3(0.090, 0.420, 0.880);

    vec3 col = ink;
    col = mix(col, violet, smoothstep(0.22, 0.95, f) * 0.85);
    col = mix(col, azure,  smoothstep(0.30, 1.00, dot(q, q)) * 0.55);
    col = mix(col, rose,   smoothstep(0.42, 1.05, r.x * r.x + r.y * r.y) * 0.50);

    // A soft light that follows the cursor. Tiny touch, makes the page feel alive.
    float d = distance(p, uPointer);
    col += vec3(0.16, 0.10, 0.26) * exp(-d * 2.4) * 0.9;

    // Lift where the noise folds over itself, so the surface reads as liquid rather than fog.
    col += vec3(0.35, 0.30, 0.45) * pow(smoothstep(0.55, 0.95, f), 3.0) * 0.32;

    // Vignette pulls attention to the headline.
    col *= smoothstep(1.85, 0.30, length(p * vec2(0.72, 1.0)));

    // Grain, or the gradient bands badly on 8-bit displays.
    col += (hash(vUv * 900.0 + fract(uTime)) - 0.5) * 0.022;

    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

function LiquidPlane({ intensity }: { intensity: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const pointer = useRef(new THREE.Vector2(0, 0));
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uIntensity: { value: intensity },
    }),
    [intensity],
  );

  useFrame((state, delta) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uTime.value += delta;
    u.uAspect.value = size.width / size.height;
    // Ease toward the cursor rather than snapping — the light should feel heavy.
    pointer.current.lerp(state.pointer, 0.045);
    u.uPointer.value.set(pointer.current.x * 1.1, pointer.current.y * 0.75);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function LiquidHero({
  intensity = 1,
  paused = false,
}: {
  intensity?: number;
  paused?: boolean;
}) {
  return (
    <Canvas
      // No depth, stencil or antialiasing: it is one flat quad, so they are pure cost.
      gl={{ antialias: false, depth: false, stencil: false, powerPreference: "low-power" }}
      // A fragment shader costs per pixel, so resolution is the single biggest lever — and this
      // image is a soft, blurry gradient with no edges to lose. Rendering it at 60% and letting
      // the compositor scale it up is visually identical and roughly four times cheaper than
      // retina-native. Measured: at full DPR this shader locked up the renderer.
      dpr={0.75}
      // Scrolled past the hero? Render nothing at all. Most of a visit is spent below it.
      frameloop={paused ? "never" : "always"}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <LiquidPlane intensity={intensity} />
    </Canvas>
  );
}
