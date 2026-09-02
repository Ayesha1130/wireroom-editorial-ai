"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Line, Float } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Status = "pending" | "running" | "completed" | "failed";
const STATUS_COLOR: Record<Status, string> = { pending: "#3a3f52", running: "#8b5cf6", completed: "#34d399", failed: "#ef4444" };
const POSITIONS: [number, number, number][] = [[-4.2, 0.1, 0], [-2.1, .55, .25], [0, -.35, 0], [2.1, .55, -.1], [4.2, 0.05, 0]];

function Node({ position, status, label, index }: { position: [number, number, number]; status: Status; label: string; index: number }) {
  const ref = useRef<THREE.Group>(null);
  const color = STATUS_COLOR[status];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * (.16 + index * .02);
    ref.current.position.y = position[1] + Math.sin(t * .9 + index) * .06;
  });
  return <Float speed={1.1} floatIntensity={.18} rotationIntensity={.12}>
    <group ref={ref} position={position}>
      <mesh scale={status === "pending" ? .62 : .8}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={status === "running" ? 1.3 : .65} roughness={.3} metalness={.45} />
      </mesh>
      <mesh scale={1.05}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={.18} />
      </mesh>
      <Text position={[0, -1.12, 0]} fontSize={.23} color={status === "pending" ? "#7a7f95" : "#e8e9f3"} anchorX="center" anchorY="top">{label}</Text>
    </group>
  </Float>;
}

function FlowParticles({ curve, active }: { curve: THREE.CatmullRomCurve3; active: boolean }) {
  const count = 24; const ref = useRef<THREE.InstancedMesh>(null);
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => i / count), []);
  useFrame(({ clock }) => {
    if (!ref.current) return; const dummy = new THREE.Object3D(); const t = clock.getElapsedTime();
    offsets.forEach((offset, i) => { const p = curve.getPointAt((t * .12 + offset) % 1); dummy.position.copy(p); dummy.scale.setScalar(active ? .045 : .012); dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#22d3ee" /></instancedMesh>;
}

function Scene({ statuses, labels }: { statuses: Status[]; labels: string[] }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(POSITIONS.map((p) => new THREE.Vector3(...p))), []);
  const points = useMemo(() => curve.getPoints(120), [curve]);
  return <><ambientLight intensity={.55} /><directionalLight position={[2,4,3]} intensity={1.2} /><pointLight position={[0,-2,2]} intensity={.8} color="#8b5cf6" /><pointLight position={[3,2,1]} intensity={.65} color="#22d3ee" /><Line points={points} color="#34384b" lineWidth={2} /><FlowParticles curve={curve} active={statuses.includes("running")} />{POSITIONS.map((p,i)=><Node key={i} position={p} status={statuses[i] ?? "pending"} label={labels[i] ?? `Stage ${i+1}`} index={i} />)}</>;
}

export default function Pipeline3D({ statuses, labels }: { statuses: Status[]; labels: string[] }) {
  return <div className="h-full w-full"><Canvas camera={{ position: [0,.7,9.4], fov: 38 }} dpr={[1,1.5]}><Suspense fallback={null}><Scene statuses={statuses} labels={labels} /></Suspense></Canvas></div>;
}
