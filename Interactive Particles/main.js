// ============================================
// GLOBAL VARIABLES
// ============================================

let scene, camera, renderer, particles;
let particleGeometry, particleMaterial, particleSystem;
let hands, videoElement, canvasElement, canvasCtx;
let handLandmarks = null;
let gestureData = {
    handDetected: false,
    handDistance: 0,
    handOpenness: 0,
    palmCenter: { x: 0, y: 0, z: 0 }
};

const PARTICLE_COUNT = 3000;
let particlePositions = [];
let particleVelocities = [];
let particleColors = [];
let targetExpansion = 1.0;
let currentExpansion = 1.0;
let colorHue = 220;
let targetColorHue = 220;

// FPS Counter
let lastTime = performance.now();
let frameCount = 0;
let fps = 60;

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    // Initialize Three.js
    initThreeJS();

    // Initialize MediaPipe Hands
    await initHandTracking();

    // Start animation loop
    animate();

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 1500);
}

// ============================================
// THREE.JS SETUP
// ============================================

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 400;

    // Renderer
    const canvas = document.getElementById('particleCanvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);

    // Create particle system
    createParticleSystem();



    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function createParticleSystem() {
    particleGeometry = new THREE.BufferGeometry();

    // Initialize particle data
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Random positions in a sphere
        const radius = Math.random() * 200 + 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        // Store initial positions
        particlePositions.push({
            x: positions[i * 3],
            y: positions[i * 3 + 1],
            z: positions[i * 3 + 2]
        });

        // Initialize velocities
        particleVelocities.push({ x: 0, y: 0, z: 0 });

        // Initial color (blue-purple)
        const color = new THREE.Color();
        color.setHSL(colorHue / 360, 0.8, 0.6);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        particleColors.push({ h: colorHue, s: 0.8, l: 0.6 });

        // Random sizes
        sizes[i] = Math.random() * 2 + 1;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleMaterial = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

async function initHandTracking() {
    videoElement = document.getElementById('cameraFeed');
    canvasElement = document.getElementById('handCanvas');
    canvasCtx = canvasElement.getContext('2d');

    // Initialize MediaPipe Hands
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onHandResults);

    // Setup camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });

        videoElement.srcObject = stream;



        // Start processing video frames
        processVideoFrame();

    } catch (error) {
        console.error('Camera access denied:', error);
    }
}

async function processVideoFrame() {
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        await hands.send({ image: videoElement });
    }

    requestAnimationFrame(processVideoFrame);
}

// ============================================
// HAND TRACKING RESULTS
// ============================================

function onHandResults(results) {
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        gestureData.handDetected = true;

        // Draw hand landmarks
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#6366f1',
                lineWidth: 2
            });
            drawLandmarks(canvasCtx, landmarks, {
                color: '#ec4899',
                fillColor: '#8b5cf6',
                radius: 3
            });
        }

        // Process gestures
        processGestures(results.multiHandLandmarks);

    } else {
        gestureData.handDetected = false;
    }

    canvasCtx.restore();
}

function processGestures(handsData) {
    if (handsData.length === 1) {
        // Single hand gestures
        const hand = handsData[0];

        // Calculate palm center (average of key points)
        const palmX = (hand[0].x + hand[5].x + hand[9].x + hand[13].x + hand[17].x) / 5;
        const palmY = (hand[0].y + hand[5].y + hand[9].y + hand[13].y + hand[17].y) / 5;
        const palmZ = (hand[0].z + hand[5].z + hand[9].z + hand[13].z + hand[17].z) / 5;

        // Convert to 3D space coordinates
        gestureData.palmCenter = {
            x: (palmX - 0.5) * 800,
            y: -(palmY - 0.5) * 600,
            z: palmZ * 500
        };

        // Calculate hand openness (distance between thumb and pinky)
        const thumbTip = hand[4];
        const pinkyTip = hand[20];
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - pinkyTip.x, 2) +
            Math.pow(thumbTip.y - pinkyTip.y, 2)
        );

        gestureData.handOpenness = distance;

        // Update color based on hand openness
        targetColorHue = 180 + (distance * 300);



    } else if (handsData.length === 2) {
        // Two hands - measure distance for expansion
        const hand1 = handsData[0];
        const hand2 = handsData[1];

        const palm1X = (hand1[0].x + hand1[9].x) / 2;
        const palm1Y = (hand1[0].y + hand1[9].y) / 2;
        const palm2X = (hand2[0].x + hand2[9].x) / 2;
        const palm2Y = (hand2[0].y + hand2[9].y) / 2;

        const handDistance = Math.sqrt(
            Math.pow(palm1X - palm2X, 2) +
            Math.pow(palm1Y - palm2Y, 2)
        );

        gestureData.handDistance = handDistance;

        // Map distance to expansion (0.5 to 3.0)
        targetExpansion = 0.5 + (handDistance * 5);
        targetExpansion = Math.max(0.3, Math.min(3.0, targetExpansion));


    }
}

// ============================================
// PARTICLE ANIMATION
// ============================================

// Enhanced Global State
let previousPalmCenter = null;
let handVelocity = { x: 0, y: 0, z: 0 };
let time = 0;

// ============================================
// PARTICLE ANIMATION
// ============================================

function animate() {
    requestAnimationFrame(animate);

    time += 0.01;

    // Smooth interpolation
    currentExpansion += (targetExpansion - currentExpansion) * 0.05;
    colorHue += (targetColorHue - colorHue) * 0.02;

    // Calculate hand velocity
    if (gestureData.handDetected && gestureData.palmCenter) {
        if (previousPalmCenter) {
            handVelocity = {
                x: gestureData.palmCenter.x - previousPalmCenter.x,
                y: gestureData.palmCenter.y - previousPalmCenter.y,
                z: gestureData.palmCenter.z - previousPalmCenter.z
            };
        }
        previousPalmCenter = { ...gestureData.palmCenter };
    } else {
        previousPalmCenter = null;
        handVelocity = { x: 0, y: 0, z: 0 };
    }

    // Update particles
    updateParticles();

    // Rotate particle system slowly
    particleSystem.rotation.y += 0.002; // Slightly faster rotation

    // Render scene
    renderer.render(scene, camera);
}

function updateParticles() {
    const positions = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;

        // Get original position
        const originalPos = particlePositions[i];

        // 1. ORGANIC IDLE MOVEMENT (The "Alive" Feel)
        // Use sine waves based on position and time to create a "breathing"/floating effect
        const noiseX = Math.sin(time + originalPos.y * 0.01) * 20;
        const noiseY = Math.cos(time * 0.8 + originalPos.x * 0.01) * 20;
        const noiseZ = Math.sin(time * 0.5 + originalPos.z * 0.01) * 20;

        // Apply expansion
        let targetX = originalPos.x * currentExpansion + noiseX;
        let targetY = originalPos.y * currentExpansion + noiseY;
        let targetZ = originalPos.z * currentExpansion + noiseZ;

        // 2. INTERACTION PHYSICS
        if (gestureData.handDetected) {
            const dx = gestureData.palmCenter.x - positions[idx];
            const dy = gestureData.palmCenter.y - positions[idx + 1];
            const dz = gestureData.palmCenter.z - positions[idx + 2];
            const distSq = dx * dx + dy * dy + dz * dz;
            const distance = Math.sqrt(distSq);

            // Increased interaction radius for "single moment" impact (500 units)
            const interactionRadius = 500;

            if (distance < interactionRadius) {
                const forceStart = (interactionRadius - distance) / interactionRadius;
                // Cubic falloff for smoother, punchier center
                const force = forceStart * forceStart * forceStart;

                // A. Repulsion/Attraction
                const attractionStrength = gestureData.handOpenness > 0.15 ? -1 : 1;
                // Much stronger base force (was 2, now 15)
                const power = 15;

                particleVelocities[i].x += (dx / distance) * force * attractionStrength * power;
                particleVelocities[i].y += (dy / distance) * force * attractionStrength * power;
                particleVelocities[i].z += (dz / distance) * force * attractionStrength * power;

                // B. Drag/Wake Effect (Follow hand movement)
                // Add a portion of hand velocity to particles near the hand
                if (Math.abs(handVelocity.x) > 0.1 || Math.abs(handVelocity.y) > 0.1) {
                    const dragInfluence = 0.3 * force; // Influence decreases with distance
                    particleVelocities[i].x += handVelocity.x * dragInfluence;
                    particleVelocities[i].y += handVelocity.y * dragInfluence;
                    particleVelocities[i].z += handVelocity.z * dragInfluence;
                }
            }
        }

        // Apply velocity
        positions[idx] += particleVelocities[i].x;
        positions[idx + 1] += particleVelocities[i].y;
        positions[idx + 2] += particleVelocities[i].z;

        // 3. RETURN HOME (Spring force)
        // Gently pull particles back to their target position so they don't fly away forever
        // Calculate where the particle "wants" to be (expanded pos + noise)
        const homeX = targetX;
        const homeY = targetY;
        const homeZ = targetZ;

        // Spring stiffness (lower = looser/floatier)
        const spring = 0.03;

        particleVelocities[i].x += (homeX - positions[idx]) * spring;
        particleVelocities[i].y += (homeY - positions[idx + 1]) * spring;
        particleVelocities[i].z += (homeZ - positions[idx + 2]) * spring;

        // 4. DAMPING (Friction)
        // Higher damping (0.9 ish) makes them slippery/glidey. Lower (0.8) makes them stop fast.
        // We want them to carry momentum but settle.
        particleVelocities[i].x *= 0.92;
        particleVelocities[i].y *= 0.92;
        particleVelocities[i].z *= 0.92;

        // Update colors dynamically
        particleColors[i].h += (colorHue - particleColors[i].h) * 0.02;
        const color = new THREE.Color();
        // Add brightness based on velocity (fast particles glow brighter)
        const speed = Math.sqrt(
            particleVelocities[i].x ** 2 +
            particleVelocities[i].y ** 2 +
            particleVelocities[i].z ** 2
        );
        const lightness = 0.5 + Math.min(0.5, speed * 0.02); // Base 0.5, up to 1.0

        color.setHSL(particleColors[i].h / 360, 0.8, lightness);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;

        // Update size dynamically? (Optional: larger when fast)
        // const newSize = 2 + Math.min(5, speed * 0.5);
        // particleGeometry.attributes.size.array[i] = newSize; // Requires size updates enabled
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    // particleGeometry.attributes.size.needsUpdate = true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// MediaPipe drawing utilities
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
];

function drawConnectors(ctx, landmarks, connections, style) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    for (const connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];

        ctx.beginPath();
        ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
        ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
        ctx.stroke();
    }
}

function drawLandmarks(ctx, landmarks, style) {
    for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(
            landmark.x * ctx.canvas.width,
            landmark.y * ctx.canvas.height,
            style.radius,
            0,
            2 * Math.PI
        );
        ctx.fillStyle = style.fillColor;
        ctx.fill();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// ============================================
// START APPLICATION
// ============================================

// Initialize when page loads
window.addEventListener('load', init);// DEBUG / UI
// ============================================

function updateDebugInfo() {
    const debugDiv = document.getElementById('debugInfo');
    if (!debugDiv) return;

    let debugText = `
        FPS: ${fps.toFixed(0)}<br>
        Hand Detected: ${gestureData.handDetected}<br>
        Expansion: ${currentExpansion.toFixed(2)} (Target: ${targetExpansion.toFixed(2)})<br>
        Color Hue: ${colorHue.toFixed(0)} (Target: ${targetColorHue.toFixed(0)})<br>
    `;

    if (gestureData.handDetected) {
        debugText += `
            Palm Center: X:${gestureData.palmCenter.x.toFixed(0)}, Y:${gestureData.palmCenter.y.toFixed(0)}, Z:${gestureData.palmCenter.z.toFixed(0)}<br>
            Hand Openness: ${gestureData.handOpenness.toFixed(2)}<br>
            Hand Velocity: X:${handVelocity.x.toFixed(1)}, Y:${handVelocity.y.toFixed(1)}, Z:${handVelocity.z.toFixed(1)}<br>
        `;
    }

    debugDiv.innerHTML = debugText;
}

// FPS Counter Update
setInterval(() => {
    const currentTime = performance.now();
    fps = (frameCount * 1000) / (currentTime - lastTime);
    lastTime = currentTime;
    frameCount = 0;
}, 1000);

// Call updateDebugInfo in animate loop
const originalAnimate = animate;
animate = function() {
    originalAnimate();
    frameCount++;
    updateDebugInfo();
};

