import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * FuturisticHostel3DScene
 * 
 * A high-end 3D procedural WebGL architectural scene representing a futuristic
 * smart hostel campus at night. Features:
 * - Sleek dormitory wings with glowing student room pod windows (amber/cyan/blue)
 * - Illuminated architectural corridors, neon edge trims, and cantilevered skywalks
 * - Holographic campus signage ("HOSTELCARE NEXUS", "WING A", "SECURITY ACTIVE")
 * - Volumetric night fog, cybernetic pathway lighting, and floating data particles
 * - Smooth camera spline fly-through driven synchronously by scroll progress [0 -> 1]
 * - UI safe central negative space for maximum login card readability
 */
export default function FuturisticHostel3DScene({
  progress = 0, // [0, 1] smoothed progress
  onTelemetry,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const progressRef = useRef(progress);
  const targetProgressRef = useRef(progress);

  // Keep progress in sync
  useEffect(() => {
    targetProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // --- 1. SCENE & FOG ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020612);
    scene.fog = new THREE.FogExp2(0x020612, 0.015);
    sceneRef.current = scene;

    // --- 2. CAMERA ---
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 4, 35);
    cameraRef.current = camera;

    // --- 3. RENDERER ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 4. LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x0a1128, 1.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x6366f1, 2.2);
    mainLight.position.set(20, 40, 20);
    scene.add(mainLight);

    const cyanRimLight = new THREE.DirectionalLight(0x06b6d4, 1.5);
    cyanRimLight.position.set(-25, 30, -10);
    scene.add(cyanRimLight);

    // --- 5. MATERIALS ---
    const darkBuildingMat = new THREE.MeshStandardMaterial({
      color: 0x080e1e,
      roughness: 0.35,
      metalness: 0.85,
    });

    const windowColors = [0x38bdf8, 0x818cf8, 0x06b6d4, 0xf59e0b, 0xa855f7];
    const glowingCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const glowingIndigoMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
    const glowingAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const groundPavementMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.7,
      metalness: 0.3,
    });

    // --- 6. ARCHITECTURAL HOSTEL GEOMETRY ---
    // Ground Plaza
    const groundGeo = new THREE.PlaneGeometry(160, 240);
    const groundMesh = new THREE.Mesh(groundGeo, groundPavementMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, 0, -40);
    scene.add(groundMesh);

    // Ground Pathway Grid Lines & Illuminated Strip
    const pathwayGroup = new THREE.Group();
    for (let z = -120; z <= 40; z += 6) {
      // Left and Right runway lights
      const lightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 3), glowingCyanMat);
      lightLeft.position.set(-7, 0.05, z);
      pathwayGroup.add(lightLeft);

      const lightRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 3), glowingCyanMat);
      lightRight.position.set(7, 0.05, z);
      pathwayGroup.add(lightRight);
    }

    // Center illuminated guiding strip
    const centerStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 180),
      new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.6 })
    );
    centerStrip.rotation.x = -Math.PI / 2;
    centerStrip.position.set(0, 0.02, -40);
    pathwayGroup.add(centerStrip);
    scene.add(pathwayGroup);

    // DORMITORY WINGS (Left & Right Wings with glowing room pods)
    const buildingsGroup = new THREE.Group();

    // Helper: Create a futuristic hostel wing
    const createHostelWing = (xOffset, zOffset, isLeft = true) => {
      const wing = new THREE.Group();

      // Main structural block
      const bWidth = 16;
      const bHeight = 24;
      const bDepth = 80;
      const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const bMesh = new THREE.Mesh(bGeo, darkBuildingMat);
      bMesh.position.set(0, bHeight / 2, 0);
      wing.add(bMesh);

      // Cornice edge neon glow strip
      const edgeGeo = new THREE.BoxGeometry(0.35, 0.35, bDepth);
      const edgeMesh = new THREE.Mesh(edgeGeo, isLeft ? glowingCyanMat : glowingIndigoMat);
      edgeMesh.position.set(isLeft ? bWidth / 2 + 0.15 : -bWidth / 2 - 0.15, bHeight, 0);
      wing.add(edgeMesh);

      // Base illuminated pathway trim along building foundation
      const baseEdgeGeo = new THREE.BoxGeometry(0.3, 0.3, bDepth);
      const baseEdgeMesh = new THREE.Mesh(baseEdgeGeo, isLeft ? glowingCyanMat : glowingAmberMat);
      baseEdgeMesh.position.set(isLeft ? bWidth / 2 + 0.15 : -bWidth / 2 - 0.15, 0.2, 0);
      wing.add(baseEdgeMesh);

      // Student Room Pod Windows (Grid on facing facade)
      const rows = 7;
      const cols = 16;
      const winW = 1.6;
      const winH = 2.0;
      const spacingX = 4.6;
      const spacingY = 3.1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.35) {
            const chosenColor = windowColors[Math.floor(Math.random() * windowColors.length)];
            const winMat = new THREE.MeshBasicMaterial({
              color: chosenColor,
              transparent: true,
              opacity: Math.random() * 0.4 + 0.6,
            });
            const winGeo = new THREE.PlaneGeometry(winW, winH);
            const winMesh = new THREE.Mesh(winGeo, winMat);

            const posX = isLeft ? bWidth / 2 + 0.08 : -bWidth / 2 - 0.08;
            const posY = 3.2 + r * spacingY;
            const posZ = -bDepth / 2 + 5 + c * spacingX;

            winMesh.position.set(posX, posY, posZ);
            winMesh.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
            wing.add(winMesh);
          }
        }
      }

      wing.position.set(xOffset, 0, zOffset);
      return wing;
    };

    // Add Left Wing (Wing A) and Right Wing (Wing B)
    const wingA = createHostelWing(-22, -25, true);
    const wingB = createHostelWing(22, -25, false);
    buildingsGroup.add(wingA);
    buildingsGroup.add(wingB);

    // CENTRAL MAIN ATRIUM / MANAGEMENT HUB (In the background)
    const centralHub = new THREE.Group();
    const hubW = 28;
    const hubH = 32;
    const hubD = 18;
    const hubMesh = new THREE.Mesh(new THREE.BoxGeometry(hubW, hubH, hubD), darkBuildingMat);
    hubMesh.position.set(0, hubH / 2, -75);
    centralHub.add(hubMesh);

    // Glass Atrium Facade
    const glassFacade = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 26),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x083344,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85,
      })
    );
    glassFacade.position.set(0, 15, -65.9);
    centralHub.add(glassFacade);

    // Holographic Roof Ring / Beacon on Main Hub
    const ringGeo = new THREE.TorusGeometry(8, 0.25, 16, 64);
    const ringMesh = new THREE.Mesh(ringGeo, glowingCyanMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, hubH + 1, -75);
    centralHub.add(ringMesh);

    // CONNECTING AERIAL SKYWALK / SKYBRIDGE between wings
    const bridgeGeo = new THREE.BoxGeometry(26, 3.5, 4.5);
    const bridgeMesh = new THREE.Mesh(bridgeGeo, darkBuildingMat);
    bridgeMesh.position.set(0, 14, -25);
    centralHub.add(bridgeMesh);

    const bridgeGlow = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 0.2), glowingCyanMat);
    bridgeGlow.position.set(0, 12.2, -22.7);
    centralHub.add(bridgeGlow);

    buildingsGroup.add(centralHub);
    scene.add(buildingsGroup);

    // --- 7. FLOATING DATA PARTICLES / CYBER TELEMETRY ---
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const pColor1 = new THREE.Color(0x38bdf8);
    const pColor2 = new THREE.Color(0x818cf8);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      particlePositions[idx] = (Math.random() - 0.5) * 50;
      particlePositions[idx + 1] = Math.random() * 25 + 1;
      particlePositions[idx + 2] = (Math.random() - 0.5) * 120 - 20;

      const mixedColor = pColor1.clone().lerp(pColor2, Math.random());
      particleColors[idx] = mixedColor.r;
      particleColors[idx + 1] = mixedColor.g;
      particleColors[idx + 2] = mixedColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- 8. ABSTRACT NETWORK DATA CONNECTION BEAMS ---
    const networkGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.35,
    });

    const nodePoints = [
      new THREE.Vector3(-14, 16, -10),
      new THREE.Vector3(0, 18, -25),
      new THREE.Vector3(14, 16, -10),
      new THREE.Vector3(0, 28, -75),
      new THREE.Vector3(-14, 16, -45),
      new THREE.Vector3(14, 16, -45),
    ];

    for (let i = 0; i < nodePoints.length; i++) {
      for (let j = i + 1; j < nodePoints.length; j++) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([nodePoints[i], nodePoints[j]]);
        const line = new THREE.Line(lineGeo, lineMat);
        networkGroup.add(line);
      }
    }
    scene.add(networkGroup);

    // --- 9. CAMERA SPLINE PATH (SCROLL-DRIVEN) ---
    // Smooth cinematic curve starting at entrance, traveling forward down the corridor, ending at main hub
    const cameraCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.2, 35),    // 0.00: Campus Entrance
      new THREE.Vector3(0, 4.0, 15),    // 0.25: Corridor Runway
      new THREE.Vector3(-1.5, 5.2, -5), // 0.50: Under Skybridge
      new THREE.Vector3(1.2, 6.5, -28), // 0.75: Approaching Quad
      new THREE.Vector3(0, 7.8, -50),   // 1.00: Central Atrium Portal
    ]);

    const lookTargetCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.5, 0),     // Looking straight ahead
      new THREE.Vector3(0, 6.0, -30),
      new THREE.Vector3(0, 8.0, -60),
      new THREE.Vector3(0, 12.0, -75),
      new THREE.Vector3(0, 15.0, -85),
    ]);

    // --- 10. ANIMATION LOOP ---
    let animId;
    let smoothedP = targetProgressRef.current;
    let clock = new THREE.Clock();

    const renderLoop = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Smooth progress lerp
      smoothedP += (targetProgressRef.current - smoothedP) * 0.08;
      const clampedP = Math.max(0, Math.min(1, smoothedP));

      // Calculate camera position along spline
      const camPos = cameraCurve.getPointAt(clampedP);
      const lookPos = lookTargetCurve.getPointAt(clampedP);

      // Add very subtle floating breathing motion
      camPos.y += Math.sin(elapsedTime * 0.8) * 0.12;
      camPos.x += Math.cos(elapsedTime * 0.6) * 0.08;

      camera.position.copy(camPos);
      camera.lookAt(lookPos);

      // Rotate rooftop holographic ring
      ringMesh.rotation.z = elapsedTime * 0.2;

      // Gently drift particles
      particles.rotation.y = elapsedTime * 0.02;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
    />
  );
}
