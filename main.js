import WindowManager from './WindowManager.js'


const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let connectingLines = []; // Array to store the lines connecting the spheres
let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}


// Setup reset button functionality
document.addEventListener('DOMContentLoaded', () => {
	const resetButton = document.getElementById('resetButton');
	if (resetButton) {
		resetButton.addEventListener('click', () => {
				// First perform a thorough cleanup
				cleanup();
				
				// Reset the initialized state
				initialized = false;
				
				// Clear localStorage completely
				localStorage.clear();
				
				// Broadcast a reset event to other windows
				localStorage.setItem('windows_reset', Date.now());
				
				// Force a complete page reload (bypassing cache)
				window.location.reload(true);
		});
	}
});

// Listen for reset events from other windows
window.addEventListener('storage', (event) => {
	if (event.key === 'windows_reset') {
		// First perform a thorough cleanup
		cleanup();
		
		// Reset the initialized state
		initialized = false;
		
		// Force a complete page reload (bypassing cache)
		window.location.reload(true);
	}
});

// this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
document.addEventListener("visibilitychange", () => 
{
	if (document.visibilityState != 'hidden' && !initialized)
	{
		init();
	}
});

window.onload = () => {
	if (document.visibilityState != 'hidden')
	{
		init();
	}
};


function init() {
	// Check if already initialized to prevent multiple init
	if (initialized) {
		console.log("Already initialized, skipping duplicate initialization");
		return;
	}
	
	initialized = true;
	console.log("Initializing window:", window.name || "unnamed");

	// Clean up any existing scene elements before setting up new ones
	cleanup();

	// add a short timeout because window.offsetX reports wrong values before a short period 
	setTimeout(() => {
		setupScene();
		setupWindowManager();
		resize();
		updateWindowShape(false);
		render();
		window.addEventListener('resize', resize);
	}, 500);
}

// Clean up any existing elements and animation frames
function cleanup() {
	console.log("Cleaning up existing elements");
	
	// Remove existing scene element
	const existingScene = document.getElementById("scene");
	if (existingScene) {
		console.log("Removing existing scene element");
		existingScene.parentNode.removeChild(existingScene);
	}

	// Cancel any running animation frames
	if (window.animationFrameId) {
		console.log("Cancelling animation frame:", window.animationFrameId);
		cancelAnimationFrame(window.animationFrameId);
		window.animationFrameId = null;
	}
	
	// Properly dispose Three.js objects
	if (cubes && cubes.length > 0) {
		cubes.forEach(complexSphere => {
			if (!complexSphere) return;
			
			// Dispose each child in the complex sphere
			if (complexSphere.children) {
				complexSphere.children.forEach(child => {
					if (child.geometry) {
						child.geometry.dispose();
					}
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach(m => m.dispose());
						} else {
							child.material.dispose();
						}
					}
				});
			}
			world?.remove(complexSphere);
		});
	}
	
	// Dispose scene objects
	if (scene) {
		scene.clear();
	}
	
	// Dispose renderer
	if (renderer) {
		renderer.dispose();
		renderer = null;
	}
	
	// Reset variables
	cubes = [];
	scene = null;
	world = null;
}

function setupScene() {
	// We now handle cleanup in a separate function before init
	camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
	
	camera.position.z = 2.5;
	near = camera.position.z - .5;
	far = camera.position.z + 0.5;

	scene = new t.Scene();
	scene.background = new t.Color(0.02, 0.02, 0.05); // Slightly blue-black for modern look
	scene.add(camera);

	// Create ambient particles in the background for a modern effect
	// Main star field (distant)
	var starGeometry = new THREE.Geometry();
	for (let i = 0; i < 5000; i++) {
		var star = new THREE.Vector3();
		star.x = Math.random() * 5000 - 2000;
		star.y = Math.random() * 5000 - 2000;
		star.z = Math.random() * 5000 - 2000;
		starGeometry.vertices.push(star);
		var color = new THREE.Color();
		if (Math.random() < 0.3) {
			color.setHSL(0.16, 0.5, Math.random() * 0.5 + 0.25);
		} else if (Math.random() < 0.6) {
			color.setHSL(0.6, 0.5, Math.random() * 0.5 + 0.25);
		} else {
			color.setHSL(0.0, 0.0, Math.random() * 0.5 + 0.5);
		}
		starGeometry.colors.push(color);
	}
	
	var starMaterial = new THREE.PointsMaterial({
		size: 2,
		vertexColors: THREE.VertexColors,
		transparent: true,
		opacity: 0.8
	});
	
	var starField = new THREE.Points(starGeometry, starMaterial);
	scene.add(starField);
	
	// Add foreground ambient particles - these will move slightly
	var ambientParticleGeometry = new THREE.BufferGeometry();
	var particleCount = 800;
	var positions = new Float32Array(particleCount * 3);
	var scales = new Float32Array(particleCount);
	var colors = new Float32Array(particleCount * 3);
	
	// Set position, color, and size for each particle
	for (let i = 0; i < particleCount; i++) {
		positions[i * 3] = (Math.random() * 2 - 1) * window.innerWidth;
		positions[i * 3 + 1] = (Math.random() * 2 - 1) * window.innerHeight;
		positions[i * 3 + 2] = Math.random() * 200 - 100;
		
		scales[i] = Math.random() * 2 + 0.5;
		
		// Add subtle color variations
		if (Math.random() > 0.8) {
			// Blue-ish particles
			colors[i * 3] = 0.5 + Math.random() * 0.2; // R
			colors[i * 3 + 1] = 0.5 + Math.random() * 0.3; // G
			colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B
		} else {
			// White/gray particles
			const brightness = 0.4 + Math.random() * 0.4;
			colors[i * 3] = brightness; // R
			colors[i * 3 + 1] = brightness; // G
			colors[i * 3 + 2] = brightness + Math.random() * 0.2; // B
		}
	}
	
	ambientParticleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	ambientParticleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
	ambientParticleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	
	// Custom shader for the ambient particles
	const particleShader = {
		vertexShader: `
			attribute float scale;
			attribute vec3 color;
			varying vec3 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = scale * (300.0 / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			varying vec3 vColor;
			void main() {
				// Create a soft glowing particle
				float distanceToCenter = length(gl_PointCoord - vec2(0.5));
				if (distanceToCenter > 0.5) discard;
				float strength = 1.0 - (distanceToCenter * 2.0);
				strength = pow(strength, 1.5);
				gl_FragColor = vec4(vColor, strength);
			}
		`
	};
	
	const ambientParticleMaterial = new THREE.ShaderMaterial({
		uniforms: {},
		vertexShader: particleShader.vertexShader,
		fragmentShader: particleShader.fragmentShader,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthTest: false
	});
	
	const ambientParticles = new THREE.Points(ambientParticleGeometry, ambientParticleMaterial);
	ambientParticles.name = "ambientParticles";
	scene.add(ambientParticles);

	renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true, alpha: true});
	renderer.setPixelRatio(pixR);
	
	world = new t.Object3D();
	scene.add(world);

	renderer.domElement.setAttribute("id", "scene");
	document.body.appendChild( renderer.domElement );

	// Enhanced lighting for a more modern look
	var ambientLight = new THREE.AmbientLight(0x404040, 0.5); // soft white light
	scene.add(ambientLight);

	var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(0, 128, 128);
	scene.add(directionalLight);
	
	// Add a subtle point light to enhance the depth
	var pointLight = new THREE.PointLight(0x8088ff, 1, 1000);
	pointLight.position.set(100, -100, 200);
	scene.add(pointLight);
}

	
function setupWindowManager ()
{
	windowManager = new WindowManager();
	windowManager.setWinShapeChangeCallback(updateWindowShape);
	windowManager.setWinChangeCallback(windowsUpdated);

	// here you can add your custom metadata to each windows instance
	let metaData = {foo: "bar"};

	// this will init the windowmanager and add this window to the centralised pool of windows
	windowManager.init(metaData);

	// call update windows initially (it will later be called by the win change callback)
	windowsUpdated();
}

	
function windowsUpdated ()
{
	updateNumberOfCubes();
}

	
function updateNumberOfCubes() {
	let wins = windowManager.getWindows();

	// First remove existing cubes
	cubes.forEach((c) => {
		world.remove(c);
	});
	cubes = [];

	// First remove existing connecting lines
	connectingLines.forEach((line) => {
		world.remove(line);
	});
	connectingLines = [];

	// Calculate the maximum size based on window dimensions (60% of the smallest dimension)
	const maxSize = Math.min(window.innerWidth, window.innerHeight) * 0.6;

	for (let i = 0; i < wins.length; i++) {
		let win = wins[i];

		let c;
		if (i == 0) {
			c = new t.Color('hsl(230, 80%, 75%)');
		} else if (i == 1) {
			c = new t.Color('hsl(350, 60%, 65%)');
		} else {
			let idBasedHueValue = (win.id % 10) / 10;
			let hue;
			if (idBasedHueValue < 0.5) {
				hue = 240 - (idBasedHueValue * 2 * 60);
			} else {
				hue = 360 - ((idBasedHueValue - 0.5) * 2 * 60);
			}
			c = new t.Color(`hsl(${hue}, 50%, 70%)`);
		}

		// Calculate a size that scales with window count but is capped at maxSize
let baseSize = 100 + i * 25; // Increased base size and scaling
		let size = Math.min(baseSize, maxSize);
		let radius = size / 2;

		let sphere = createComplexSphere(radius, c);
		
		// Position the sphere in the center of the window, accounting for scene offset
		sphere.position.x = win.shape.x + (win.shape.w * .5);
		sphere.position.y = win.shape.y + (win.shape.h * .5);
		sphere.position.z = 0;

		world.add(sphere);
		cubes.push(sphere);
	}
	
// After creating all spheres, create connecting lines between them
if (cubes.length >= 2) {
console.log("Creating connecting lines between " + cubes.length + " spheres");
console.log("Sphere positions:", cubes.map(cube => cube.position));
updateConnectingLines();
}
}

	
function createComplexSphere(radius, color) {
	let innerSize = radius * 0.9; 
	let outerSize = radius;
	let innerColor = color;
	let outerColor = color;

	let complexSphere = new THREE.Group();

	let sphereWireframeInner = new THREE.Mesh(
		new THREE.IcosahedronGeometry(innerSize, 2),
new THREE.MeshLambertMaterial({
color: innerColor,
wireframe: true,
transparent: true
})
	);
	complexSphere.add(sphereWireframeInner);

	let sphereWireframeOuter = new THREE.Mesh(
		new THREE.IcosahedronGeometry(outerSize, 3),
new THREE.MeshLambertMaterial({
color: outerColor,
wireframe: true,
transparent: true
})
	);
	complexSphere.add(sphereWireframeOuter);


	let sphereGlassInner = new THREE.Mesh(
		new THREE.SphereGeometry(innerSize, 32, 32),
		new THREE.MeshPhongMaterial({
			color: innerColor,
			transparent: true,
			shininess: 25,
			opacity: 0.3
		})
	);
	complexSphere.add(sphereGlassInner);

	let sphereGlassOuter = new THREE.Mesh(
		new THREE.SphereGeometry(outerSize, 32, 32),
		new THREE.MeshPhongMaterial({
			color: outerColor,
			transparent: true,
			shininess: 25,
			opacity: 0.3
		})
	);
	complexSphere.add(sphereGlassOuter);

	let particlesOuter = createParticles(outerSize, outerColor);
	complexSphere.add(particlesOuter);

	let particlesInner = createParticles(innerSize, innerColor);
	complexSphere.add(particlesInner);

	return complexSphere;
}

function createParticles(size, color) {
	let geometry = new THREE.Geometry();
	for (let i = 0; i < 35000; i++) {
		let x = -1 + Math.random() * 2;
		let y = -1 + Math.random() * 2;
		let z = -1 + Math.random() * 2;
		let d = 1 / Math.sqrt(x * x + y * y + z * z);
		x *= d * size;
		y *= d * size;
		z *= d * size;
		geometry.vertices.push(new THREE.Vector3(x, y, z));
	}
	let material = new THREE.PointsMaterial({
		size: 0.1,
		color: color,
		transparent: true
	});
	return new THREE.Points(geometry, material);
}


// Function to create a flame/smoke connection between spheres
function createConnectingLine(point1, point2, color) {
  // Calculate the distance and direction vector between points
  const distance = Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2) +
    Math.pow(point2.z - point1.z, 2)
  );
  
// Create a particle system for the energy beam effect
  const particleCount = Math.max(3000, Math.min(6000, Math.floor(distance * 24)));
  const particles = new THREE.BufferGeometry();
  
  // Arrays to store particle attributes
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);
  const opacities = new Float32Array(particleCount);
  const angles = new Float32Array(particleCount);
  
  // Calculate direction vector from point1 to point2
  const dirVec = {
    x: point2.x - point1.x,
    y: point2.y - point1.y,
    z: point2.z - point1.z
  };
  
  // Create color variations based on the input color
  const baseColor = new THREE.Color(color);
  const hsl = {};
  baseColor.getHSL(hsl);
  
  // Create particles along the path
  for (let i = 0; i < particleCount; i++) {
    // Position each particle along the path with some randomness
    const ratio = i / particleCount;
    
    // Use a bezier curve to create a nice arc
    const t = ratio;
    const invT = 1 - t;
    
    // Create midpoint with more dramatic elevation and smooth arc
    const elevationFactor = distance * 0.5;  // Increased from 0.35 to 0.5 for higher arc
    const midPoint = {
      x: (point1.x + point2.x) / 2,
      y: (point1.y + point2.y) / 2 + elevationFactor,
      z: (point1.z + point2.z) / 2
    };
    
    // Bezier interpolation
    let x = invT * invT * point1.x + 2 * invT * t * midPoint.x + t * t * point2.x;
    let y = invT * invT * point1.y + 2 * invT * t * midPoint.y + t * t * point2.y;
    let z = invT * invT * point1.z + 2 * invT * t * midPoint.z + t * t * point2.z;
    
    // Add more dynamic randomness to position
    const randomOffset = Math.min(8, distance * 0.08) * (1 + Math.sin(ratio * Math.PI * 8) * 0.3); // Scale with distance and add wave pattern
    x += (Math.random() - 0.5) * randomOffset * (1 - Math.abs(2 * ratio - 1));
    y += (Math.random() - 0.5) * randomOffset * (1 - Math.abs(2 * ratio - 1));
    z += (Math.random() - 0.5) * randomOffset * 0.5; // Less variation in z
    
    // Store positions
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Particle sizes - even larger base size with more dramatic variation
    const sizeVariation = Math.sin(ratio * Math.PI);
    const pulseSize = Math.sin(ratio * Math.PI * 4) * 0.5 + 0.5;
    sizes[i] = (50 + sizeVariation * 80 + pulseSize * 40) * (distance / 50 + 1.0);
    
    // Create color variation along the path - more flame-like
    let particleColor = new THREE.Color();
    
    // Create energetic color transitions with more vibrancy
    const centerIntensity = Math.sin(ratio * Math.PI);
    const energyPulse = Math.sin(ratio * Math.PI * 4) * 0.5 + 0.5;
    
    if (ratio < 0.3) {
      // Start colors - bright core
      particleColor.setHSL(
        (hsl.h + 0.1) % 1.0,
        Math.min(1.0, hsl.s * 1.2),
        Math.min(1.0, hsl.l * 1.3 + energyPulse * 0.2)
      );
    } else if (ratio > 0.7) {
      // End colors - bright core
      particleColor.setHSL(
        (hsl.h - 0.1 + 1.0) % 1.0,
        Math.min(1.0, hsl.s * 1.2),
        Math.min(1.0, hsl.l * 1.3 + energyPulse * 0.2)
      );
    } else {
      // Middle - intense energy core
      const energyHue = (hsl.h + centerIntensity * 0.15) % 1.0;
      particleColor.setHSL(
        energyHue,
        Math.min(1.0, hsl.s * 1.5),
        Math.min(1.0, hsl.l * 1.5 + energyPulse * 0.3)
      );
    }
    
    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
    
    // Opacity - stronger overall with more pronounced center
    opacities[i] = Math.sin(ratio * Math.PI) * 0.3 + 0.3;
    
    // Random angle for texture rotation
    angles[i] = Math.random() * Math.PI;
  }
  
  // Create geometry with attributes
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Create basic point material with custom size attenuation
  const material = new THREE.PointsMaterial({
    size: 3.0,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false
  });

  // Increase the base color brightness
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] *= 1.3;     // R
    colors[i + 1] *= 1.3; // G
    colors[i + 2] *= 1.3; // B
  }

  material.onBeforeCompile = function(shader) {
    shader.uniforms.time = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `
      uniform float time;
      void main() {
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `
      uniform float time;
      void main() {
        vec2 center = vec2(0.5);
        float dist = length(gl_PointCoord - center);
        if (dist > 0.5) discard;

        float pulse = sin(time * 6.0) * 0.5 + 0.5;  // Faster pulse
        float glow = pow(1.0 - dist * 2.0, 3.0);  // Sharper falloff
        glow *= 8.0 + pulse * 3.0;  // Increased base multiplier and pulse effect
		
		// Add a blueish tint
		vec3 tintedColor = vColor * vec3(0.7, 0.9, 1.0);
        gl_FragColor = vec4(tintedColor * (1.0 + glow * 1.0), glow * 0.9);  // Added glow to color and increased alpha
      `
    );
    material.userData.shader = shader;
  };

  // Create the particle system
  const particleSystem = new THREE.Points(particles, material);
  
  // Store original points and other data for animation
  particleSystem.userData = {
    point1: point1,
    point2: point2,
    color: color,
    distance: distance,
    time: 0,
    particleCount: particleCount
  };
  
  return particleSystem;
}

// Helper function to create an energy beam texture
function createFlameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;  // Increased resolution
  canvas.height = 128;
  
  const context = canvas.getContext('2d');
  
  // Create multiple layers of gradients for a more complex effect
  // Core gradient
  const coreGradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  coreGradient.addColorStop(0.2, 'rgba(200, 220, 255, 0.9)');
  coreGradient.addColorStop(0.5, 'rgba(160, 200, 255, 0.5)');
  coreGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
  
  context.fillStyle = coreGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add energy ripples
  for (let i = 0; i < 8; i++) {
    const rippleGradient = context.createRadialGradient(64, 64, 20 * i, 64, 64, 20 * (i + 1));
    rippleGradient.addColorStop(0, 'rgba(150, 200, 255, 0)');
    rippleGradient.addColorStop(0.5, `rgba(180, 220, 255, ${0.1 - i * 0.01})`);
    rippleGradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
    
    context.fillStyle = rippleGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Add some sparkle effects
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 3 + 1;
    
    const distance = Math.sqrt(Math.pow(x - 64, 2) + Math.pow(y - 64, 2));
    if (distance < 64) {
      const sparkleGradient = context.createRadialGradient(x, y, 0, x, y, size);
      sparkleGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      sparkleGradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.4)');
      sparkleGradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
      
      context.fillStyle = sparkleGradient;
      context.fillRect(x - size, y - size, size * 2, size * 2);
    }
  }
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function updateConnectingLines() {
  // First, remove existing connecting lines
  connectingLines.forEach(line => {
    world.remove(line);
  });
  connectingLines = [];
  
  // Only create lines if there are at least 2 spheres
  if (cubes.length >= 2) {
    // Connect each sphere to all other spheres
    for (let i = 0; i < cubes.length; i++) {
      for (let j = i + 1; j < cubes.length; j++) {
        // Get positions of the two spheres
        const sphere1 = cubes[i];
        const sphere2 = cubes[j];
        
        // Calculate distance between spheres
        const distance = sphere1.position.distanceTo(sphere2.position);
        
        // Skip if spheres are too far apart (optional distance limit)
        // if (distance > 1000) continue;
        
        // Create advanced color blending for energy effect
        // Use more vibrant colors for the flame effect
        let lineColor;
        
        if (sphere1.children[1] && sphere2.children[1]) {
          const color1 = sphere1.children[1].material.color.clone();
          const color2 = sphere2.children[1].material.color.clone();
          
          // Extract HSL components to create a more vibrant energy effect
          const hsl1 = {}, hsl2 = {};
          color1.getHSL(hsl1);
          color2.getHSL(hsl2);
          
          // Create new color halfway between the two, but more saturated
          const hue = (hsl1.h + hsl2.h) * 0.5;
          const saturation = Math.min(1.0, Math.max(hsl1.s, hsl2.s) * 1.4); // More saturated
          const lightness = Math.min(0.9, Math.max(hsl1.l, hsl2.l) * 1.3); // Brighter
          
          lineColor = new THREE.Color().setHSL(hue, saturation, lightness);
        } else {
          // Default color if sphere materials can't be accessed
          lineColor = new THREE.Color(0x88aaff);
        }
        
        console.log(`Creating energy connection between spheres at:`, {
          from: sphere1.position,
          to: sphere2.position,
          color: lineColor
        });

        // Create the special flame/energy connection
        const energyConnection = createConnectingLine(
          sphere1.position, 
          sphere2.position, 
          lineColor
        );
        
        if (energyConnection) {
          console.log('Energy connection created successfully with', energyConnection.geometry.attributes.position.count, 'particles');
          // Add to scene and store in our array
          world.add(energyConnection);
          connectingLines.push(energyConnection);
        } else {
          console.error('Failed to create energy connection');
        }
      }
    }
  }
}

function updateWindowShape (easing = true)
{
	// storing the actual offset in a proxy that we update against in the render function
	sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
	if (!easing) sceneOffset = sceneOffsetTarget;

	// Force update connecting lines when window shape changes
	if (cubes.length >= 2) {
		updateConnectingLines();
	}
}



function render() {
	let t = getTime();

	windowManager.update();

	// calculate the new position based on the delta between current offset and new offset times a falloff value
	let falloff = .05;
	sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
	sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

	// set the world position to the offset
	world.position.x = sceneOffset.x;
	world.position.y = sceneOffset.y;

	let wins = windowManager.getWindows();

	// Keep track if any sphere positions have significantly changed
	let positionsChanged = false;

	// loop through all our cubes and update their positions based on current window positions
	for (let i = 0; i < cubes.length; i++) {
		let complexSphere = cubes[i]; 
		let win = wins[i];
		let _t = t; 

		// Make sure win is defined before using it
		if (win && win.shape) {
			let posTarget = {x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5)}
			
			// Store old position to check if it changed significantly
			const oldX = complexSphere.position.x;
			const oldY = complexSphere.position.y;
			
			// Update position with smoothing
			complexSphere.position.x = complexSphere.position.x + (posTarget.x - complexSphere.position.x) * falloff;
			complexSphere.position.y = complexSphere.position.y + (posTarget.y - complexSphere.position.y) * falloff;

			// Check if position changed significantly
			if (Math.abs(oldX - complexSphere.position.x) > 1 || 
				Math.abs(oldY - complexSphere.position.y) > 1) {
				positionsChanged = true;
			}

			complexSphere.rotation.x = _t * .5; 
			complexSphere.rotation.y = _t * .3; 
			updateComplexSphere(complexSphere, t);
		}
	}

	// Update the connecting lines if positions have changed
	if (positionsChanged && connectingLines.length > 0) {
		let k = 0;
		
		// For each pair of spheres, update the connecting line
		for (let i = 0; i < cubes.length; i++) {
			for (let j = i + 1; j < cubes.length; j++, k++) {
				if (k < connectingLines.length) {
					const line = connectingLines[k];
					
					// Skip if line is undefined
					if (!line) continue;
					
					const sphere1 = cubes[i];
					const sphere2 = cubes[j];
					
						// Remove the old line
					world.remove(line);
					
					// Create updated flame effect with the new sphere positions
let lineColor;
        
        if (sphere1.children[1] && sphere2.children[1]) {
          const color1 = sphere1.children[1].material.color.clone();
          const color2 = sphere2.children[1].material.color.clone();
          
          // Extract HSL components 
          const hsl1 = {}, hsl2 = {};
          color1.getHSL(hsl1);
          color2.getHSL(hsl2);
          
          // Create new color halfway between the two, but more saturated and brighter
          const hue = (hsl1.h + hsl2.h) * 0.5;
          const saturation = 1.0; // Force full saturation
          const lightness = 0.75; // Force a brighter lightness
          
          lineColor = new THREE.Color().setHSL(hue, saturation, lightness);
        } else {
          // Default color
          lineColor = new THREE.Color(0xffffff); // White
        }
					
					// Create a new connecting line with updated positions
					const newLine = createConnectingLine(
						sphere1.position,
						sphere2.position,
						lineColor
					);
					
					world.add(newLine);
					connectingLines[k] = newLine;
				}
			}
		}
	}
	updateConnectingLines();

	// Render scene
	renderer.render(scene, camera);
	
	// Store the animation frame ID so we can cancel it if needed
	window.animationFrameId = requestAnimationFrame(render);
}


function updateComplexSphere(complexSphere, elapsedTime) {
	let sphereWireframeInner = complexSphere.children[0];
	let sphereWireframeOuter = complexSphere.children[1];
	let sphereGlassInner = complexSphere.children[2];
	let sphereGlassOuter = complexSphere.children[3];
	let particlesOuter = complexSphere.children[4];
	let particlesInner = complexSphere.children[5];

	sphereWireframeInner.rotation.x += 0.002;
	sphereWireframeInner.rotation.z += 0.002;
  
	sphereWireframeOuter.rotation.x += 0.001;
	sphereWireframeOuter.rotation.z += 0.001;
  
	sphereGlassInner.rotation.y += 0.005;
	sphereGlassInner.rotation.z += 0.005;

	sphereGlassOuter.rotation.y += 0.01;
	sphereGlassOuter.rotation.z += 0.01;

	particlesOuter.rotation.y += 0.0005;
	particlesInner.rotation.y -= 0.002;

	var innerShift = Math.abs(Math.cos(((elapsedTime + 2.5) / 20)));
	var outerShift = Math.abs(Math.cos(((elapsedTime + 5) / 10)));

	sphereWireframeOuter.material.color.setHSL(0.55, 1, outerShift);
	sphereGlassOuter.material.color.setHSL(0.55, 1, outerShift);
	particlesOuter.material.color.setHSL(0.55, 1, outerShift);

	sphereWireframeInner.material.color.setHSL(0.08, 1, innerShift);
	particlesInner.material.color.setHSL(0.08, 1, innerShift);
	sphereGlassInner.material.color.setHSL(0.08, 1, innerShift);

	sphereWireframeInner.material.opacity = Math.abs(Math.cos((elapsedTime + 0.5) / 0.9) * 0.5);
	sphereWireframeOuter.material.opacity = Math.abs(Math.cos(elapsedTime / 0.9) * 0.5);

}


// resize the renderer to fit the window size
function resize ()
{
	let width = window.innerWidth;
	let height = window.innerHeight
	
	camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
	camera.updateProjectionMatrix();
	renderer.setSize( width, height );
}
