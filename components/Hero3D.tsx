"use client";

import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import { Suspense } from "react";

function Shapes() {
  return (
    <>
      <Float speed={1.4} rotationIntensity={1.1} floatIntensity={1.6}>
        <mesh position={[-1.4, 0.6, 0]} scale={1.15}>
          <icosahedronGeometry args={[1, 0]} />
          <MeshDistortMaterial
            color="#8b5cf6"
            distort={0.4}
            speed={2}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      </Float>
      <Float speed={1.1} rotationIntensity={1.4} floatIntensity={1.2}>
        <mesh position={[1.6, -0.4, -1]} scale={0.85}>
          <torusKnotGeometry args={[0.7, 0.22, 128, 16]} />
          <MeshDistortMaterial
            color="#22d3ee"
            distort={0.25}
            speed={1.4}
            roughness={0.3}
            metalness={0.45}
          />
        </mesh>
      </Float>
      <Float speed={1.8} rotationIntensity={0.8} floatIntensity={2}>
        <mesh position={[0.6, 1.4, -1.6]} scale={0.5}>
          <octahedronGeometry args={[1, 0]} />
          <MeshDistortMaterial
            color="#f472b6"
            distort={0.5}
            speed={2.4}
            roughness={0.25}
            metalness={0.35}
          />
        </mesh>
      </Float>
      <Sparkles count={70} scale={7} size={2} speed={0.3} color="#c4b5fd" />
    </>
  );
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 3, 3]} intensity={1.6} />
          <pointLight position={[-3, -2, 2]} intensity={1.2} color="#22d3ee" />
          <pointLight position={[2, -3, 1]} intensity={0.9} color="#f472b6" />
          <Shapes />
        </Suspense>
      </Canvas>
    </div>
  );
}
