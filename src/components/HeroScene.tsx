import { useEffect, useRef } from "react";
import * as THREE from "three";

const CUBES: [string, string][] = [
  ["Who We Are", "AI innovation"],
  ["Our Mission", "Smart solutions"],
  ["Our Services", "Training and automation"],
  ["Our Impact", "Real world value"],
  ["Our Focus", "Software and AI"],
  ["Our Vision", "Scalable growth"],
];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, yy);
      line = words[i] + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}

const ORBITS = [
  { r: 3.15, inc: 0.70, yaw: 1.05, dir: 1, speed: 0.083, offset: 0.00 },
  { r: 3.30, inc: 0.62, yaw: 1.30, dir: -1, speed: 0.099, offset: 1.05 },
  { r: 3.40, inc: 0.70, yaw: 1.57, dir: 1, speed: 0.115, offset: 2.10 },
  { r: 3.30, inc: 0.78, yaw: 1.85, dir: -1, speed: 0.131, offset: 3.15 },
  { r: 3.15, inc: 0.70, yaw: 2.10, dir: 1, speed: 0.083, offset: 4.20 },
  { r: 3.05, inc: 0.55, yaw: 2.35, dir: -1, speed: 0.099, offset: 5.25 },
];

const PHONE_ORBITS = [
  { r: 3.18, inc: 0.46, yaw: 1.00, dir: 1, speed: 0.11, offset: 0.00 },
  { r: 3.18, inc: 0.58, yaw: 1.40, dir: 1, speed: 0.11, offset: 1.57 },
  { r: 3.18, inc: 0.38, yaw: 1.80, dir: 1, speed: 0.11, offset: 2.88 },
  { r: 3.18, inc: 0.52, yaw: 2.20, dir: 1, speed: 0.11, offset: 5.24 },
];

const LABEL_PX = 512;
const LABEL_PX_PHONE = 256;

function makeLabelTexture(title: string, subtitle: string, titleOnly = false) {
  const px = titleOnly ? LABEL_PX_PHONE : LABEL_PX;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const s = px / 2048; // the reference was drawn at 2048
  const grad = ctx.createLinearGradient(0, 0, px, px);
  grad.addColorStop(0, "rgba(8,14,30,1)");
  grad.addColorStop(1, "rgba(18,28,52,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, px, px);

  ctx.strokeStyle = "rgba(125,232,255,0.95)";
  ctx.lineWidth = 32 * s;
  ctx.strokeRect(72 * s, 72 * s, 1904 * s, 1904 * s);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (titleOnly) {
    ctx.fillStyle = "#b8fbff";
    ctx.font = `900 ${260 * s}px Arial, sans-serif`;
    wrapText(ctx, title, 1024 * s, 700 * s, 1500 * s, 270 * s);

    ctx.strokeStyle = "rgba(165,110,255,0.95)";
    ctx.lineWidth = 16 * s;
    ctx.beginPath();
    ctx.moveTo(420 * s, 1110 * s);
    ctx.lineTo(1628 * s, 1110 * s);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${150 * s}px Arial, sans-serif`;
    wrapText(ctx, subtitle, 1024 * s, 1400 * s, 1500 * s, 170 * s);
  } else {
    ctx.fillStyle = "#b8fbff";
    ctx.font = `900 ${210 * s}px Arial, sans-serif`;
    wrapText(ctx, title, 1024 * s, 700 * s, 1500 * s, 210 * s);

    ctx.strokeStyle = "rgba(165,110,255,0.95)";
    ctx.lineWidth = 14 * s;
    ctx.beginPath();
    ctx.moveTo(420 * s, 1040 * s);
    ctx.lineTo(1628 * s, 1040 * s);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${112 * s}px Arial, sans-serif`;
    wrapText(ctx, subtitle, 1024 * s, 1320 * s, 1450 * s, 130 * s);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export default function HeroScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // A WebGL context that never renders is worse than no canvas at all: it
    // still costs memory. Bail out cleanly where WebGL is unavailable.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;

    const isPhone = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const CAM_Z = isPhone ? 10.7 : 9.5;
    const RING_COUNT = 6;
    const ORBIT_SET = isPhone ? PHONE_ORBITS : ORBITS;
    const CUBE_SIZE = isPhone ? 1.00 : 0.72;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.15, CAM_Z);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isPhone,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.8 : 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    // Tracked so unmount can dispose every one of them.
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const geo = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
    const mat = <T extends THREE.Material>(m: T) => (materials.push(m), m);

    scene.add(new THREE.AmbientLight(0x8aa4ff, 1.15));
    const key = new THREE.PointLight(0x62e6ff, 20, 16);
    key.position.set(3, 3, 4);
    scene.add(key);
    const fill = new THREE.PointLight(0x9e6cff, 16, 14);
    fill.position.set(-3, -2, 3);
    scene.add(fill);

    const group = new THREE.Group();
    scene.add(group);

    const core = new THREE.Mesh(
      geo(new THREE.IcosahedronGeometry(1.90, isPhone ? 2 : 4)),
      mat(new THREE.MeshPhysicalMaterial({
        color: 0x0b1b36, emissive: 0x183f6f, emissiveIntensity: 0.85,
        metalness: 0.55, roughness: 0.23, clearcoat: 1,
      })),
    );
    group.add(core);

    const shell = new THREE.Mesh(
      geo(new THREE.IcosahedronGeometry(2.25, 2)),
      mat(new THREE.MeshBasicMaterial({ color: 0x79ddff, wireframe: true, transparent: true, opacity: 0.22 })),
    );
    group.add(shell);

    const glow = new THREE.Mesh(
      geo(new THREE.SphereGeometry(1.45, 32, 32)),
      mat(new THREE.MeshBasicMaterial({
        color: 0x6d7cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending,
      })),
    );
    group.add(glow);

    const ringA = mat(new THREE.MeshBasicMaterial({
      color: 0x67e8ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
    }));
    const ringB = mat(new THREE.MeshBasicMaterial({
      color: 0xa66fff, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false,
    }));

    const tubeScale = 494 / Math.max(240, host.clientHeight || 494);
    const rings: THREE.Mesh[] = [];
    const RINGS = [
      [2.50, 0.020, 1.03, 0, 0.000],
      [2.72, 0.019, 1.14, 0, 0.524],
      [2.94, 0.018, 1.25, 0, 1.047],
      [3.16, 0.017, 1.36, 0, 1.571],
      [3.38, 0.016, 1.47, 0, 2.094],
      [3.60, 0.015, 1.58, 0, 2.618],
    ] as const;
    RINGS.slice(0, RING_COUNT).forEach((r, i) => {
      const ring = new THREE.Mesh(
        geo(new THREE.TorusGeometry(r[0], r[1] * tubeScale, 8, isPhone ? 80 : 160)),
        i % 2 === 1 ? ringB : ringA,
      );
      ring.rotation.order = "ZXY";
      ring.rotation.set(r[2], r[3], r[4]);
      ring.userData = { tilt: r[2] };
      group.add(ring);
      rings.push(ring);
    });

    const cubeGroup = new THREE.Group();
    group.add(cubeGroup);
    const cubes: THREE.Group[] = [];
    const size = CUBE_SIZE;
    const cubeGeo = geo(new THREE.BoxGeometry(size, size, size));
    const edgeGeo = geo(new THREE.EdgesGeometry(cubeGeo));
    const panelGeo = geo(new THREE.PlaneGeometry(size * 1.12, size * 1.12));
    const sideMat = mat(new THREE.MeshPhysicalMaterial({
      color: 0x10213f, emissive: 0x16335e, emissiveIntensity: 0.22,
      metalness: 0.34, roughness: 0.26, clearcoat: 0.78, transparent: true, opacity: 0.97,
    }));
    const edgeMat = mat(new THREE.LineBasicMaterial({ color: 0x98f4ff, transparent: true, opacity: 0.9 }));
    const panelMat = mat(new THREE.MeshBasicMaterial({
      color: 0x7b68ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending,
    }));

    CUBES.slice(0, ORBIT_SET.length).forEach(([title, subtitle], i) => {
      const texture = makeLabelTexture(title, subtitle, isPhone);
      if (texture) textures.push(texture);
      const frontMat = mat(new THREE.MeshPhysicalMaterial({
        map: texture, color: 0xffffff, emissive: 0x12264d, emissiveIntensity: 0.15,
        metalness: 0.18, roughness: 0.22, clearcoat: 0.84,
      }));
      const mesh = new THREE.Mesh(cubeGeo, [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]);
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.z = -size / 2 - 0.02;

      const cube = new THREE.Group();
      cube.add(panel, mesh, edges);
      cube.userData = {
        ...ORBIT_SET[i],
        a: ORBIT_SET[i].offset,
        wobble: i * 0.18,
        tiltX: i % 2 === 0 ? -0.16 : 0.14,
        tiltY: ((i % 3) - 1) * 0.24,
      };
      cubeGroup.add(cube);
      cubes.push(cube);
    });

    const network = new THREE.Group();
    group.add(network);
    const nodeGeo = geo(new THREE.SphereGeometry(0.05, 8, 8));
    const nodeMat = mat(new THREE.MeshBasicMaterial({ color: 0xb7f4ff }));
    const points: THREE.Vector3[] = [];
    const nodeCount = isPhone ? 20 : 34;
    for (let i = 0; i < nodeCount; i++) {
      const p = new THREE.Vector3().randomDirection().multiplyScalar(2.1 + Math.random() * 1.3);
      p.y *= 0.72;
      points.push(p);
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.copy(p);
      network.add(node);
    }
    const linePositions: number[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) < 1.02 && Math.random() > 0.6) {
          linePositions.push(...points[i].toArray(), ...points[j].toArray());
        }
      }
    }
    const lineGeo = geo(new THREE.BufferGeometry());
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    network.add(new THREE.LineSegments(lineGeo, mat(new THREE.LineBasicMaterial({
      color: 0x6487ff, transparent: true, opacity: 0.14,
    }))));

    const particleCount = isPhone ? 260 : 850;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const particleGeo = geo(new THREE.BufferGeometry());
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeo, mat(new THREE.PointsMaterial({
      color: 0x83bfff, size: 0.018, transparent: true, opacity: 0.38,
    })));
    scene.add(particles);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    let visible = true;
    let onscreen = true;

    const draw = () => {
      const t = clock.getElapsedTime();
      if (!reduced) {
        core.rotation.y = t * 0.30;
        core.rotation.x = Math.sin(t * 0.80) * 0.08;
        shell.rotation.y = -t * 0.20;
        shell.rotation.z = t * 0.075;
        glow.scale.setScalar(1 + Math.sin(t * 3.4) * 0.05);
        rings.forEach((ring, i) => {
          const base = (ring.userData as { tilt: number }).tilt;
          ring.rotation.x = base + Math.sin(t * 0.45 + i * 0.7) * 0.06;
        });

        cubes.forEach((cube) => {
          const d = cube.userData as Record<string, number>;
          const angle = d.a + t * d.speed * d.dir;
          const cx = Math.cos(angle) * d.r;
          const cz = Math.sin(angle) * d.r;
          const yi = -cz * Math.sin(d.inc);
          const zi = cz * Math.cos(d.inc);
          cube.position.set(
            cx * Math.cos(d.yaw) + zi * Math.sin(d.yaw),
            yi,
            -cx * Math.sin(d.yaw) + zi * Math.cos(d.yaw),
          );
          cube.lookAt(camera.position);
          cube.rotateY(d.tiltY + Math.sin(t * 0.4 + d.wobble) * 0.035);
          cube.rotateX(d.tiltX + Math.cos(t * 0.35 + d.wobble) * 0.025);
          cube.rotateZ(Math.sin(t * 0.45 + d.wobble) * 0.012);
        });

        network.rotation.y = t * 0.075;
        particles.rotation.y = t * 0.018;
        group.rotation.x = Math.sin(t * 0.55) * 0.045;
        camera.position.x = Math.sin(t * 0.26) * 0.45;
        camera.position.y = 0.15 + Math.sin(t * 0.40) * 0.08;
        camera.position.z = CAM_Z + Math.cos(t * 0.26) * 0.18;
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!frame && visible && onscreen) {
        clock.getDelta(); // drop the time spent paused
        frame = requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // Reduced motion still needs one frame drawn, but never a loop.
    if (reduced) {
      renderer.render(scene, camera);
    } else {
      start();
    }

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (reduced) return;
      visible ? start() : stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry.isIntersecting;
        if (reduced) return;
        onscreen ? start() : stop();
      },
      { rootMargin: "120px" },
    );
    io.observe(host);

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      ro.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((tx) => tx.dispose());
      renderer.dispose();
      // Frees the GPU context outright. Browsers allow only a handful of live
      // contexts, and React mounts this twice in development.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="rt-hero-scene" aria-hidden="true" />;
}
