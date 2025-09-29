import * as THREE from 'three';
import './styles.css';

// Game state and controls
const keys: { [key: string]: boolean } = {};
let playerScore = 0;
let highScore = 0;
let lastTime = 0;

// Game Configuration Constants
const COIN_VALUE = 10;
const COIN_DROP_COUNT = 3;
const RESPAWN_TIME = 3000; // 3 seconds

// Update materials for Tron-style theme
const neonBlue = 0x00ffff;
const neonMagenta = 0xff00ff;
const neonCyan = 0x00D4FF;
const neonPurple = 0x9933ff;
const darkBackground = 0x101010;

// Trail configuration
const TRAIL_COLOR = 0x00D4FF;
const BASE_TRAIL_LENGTH = 50;
const TRAIL_UPDATE_INTERVAL = 16;
const TRAIL_WIDTH = 3.0;
const TRAIL_HEIGHT = 0.1;

// Arena configuration
const ARENA_SIZE = 400;
const WALL_HEIGHT = 20;
const STANDS_DEPTH = 40;
const STANDS_ROWS = 8;
const SPECTATORS_PER_ROW = 100;
const BOUNDARY_LIMIT = (ARENA_SIZE / 2) - 5;

// AI configuration
const AI_COLORS = [0xff0000, 0x00ff00, 0x9933ff, 0xffff00]; // Red, Green, Purple, Yellow
const AI_SPAWN_POINTS = [
    { x: -50, z: -50, rotation: Math.PI / 4 },
    { x: 50, z: -50, rotation: -Math.PI / 4 },
    { x: 0, z: 50, rotation: Math.PI },
    { x: -50, z: 50, rotation: -Math.PI / 4 }
];
const MOVEMENT_PATTERNS = {
    CIRCULAR: 'circular',
    ZIGZAG: 'zigzag',
    PATROL: 'patrol',
    SNAKE: 'snake'  // New pattern
};

// Player state
interface PlayerState {
    name: string;
    color: number;
    isPlaying: boolean;
}

const playerState: PlayerState = {
    name: '',
    color: 0x00D4FF,
    isPlaying: false
};

// Scene setup
const scene = new THREE.Scene();

// Update scene background to be darker
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Adjust lighting for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Increased from 0.1
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // Reduced intensity
directionalLight.position.set(50, 50, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Create sky grid
const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x001133, // Dark blue instead of black
    wireframe: true,
    transparent: true,
    opacity: 0.5  // Increased from 0.3
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Ground - increased size
const groundGeometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: neonBlue,
    metalness: 0.5,
    roughness: 0.5,
    emissive: neonBlue,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Enhanced grid pattern
const gridHelper = new THREE.GridHelper(ARENA_SIZE, 100, neonBlue, neonBlue);
gridHelper.position.y = 0.01;
gridHelper.material.opacity = 0.4;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// Create Arena Walls and Stands
function createArenaWallsAndStands() {
    const wallsGroup = new THREE.Group();

    // Create walls with neon trim
    const wallGeometry = new THREE.BoxGeometry(ARENA_SIZE + 10, WALL_HEIGHT, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: darkBackground,
        metalness: 0.8,
        roughness: 0.2,
        emissive: neonBlue,
        emissiveIntensity: 0.2
    });

    // Neon trim material
    const trimMaterial = new THREE.MeshStandardMaterial({
        color: neonCyan,
        emissive: neonCyan,
        emissiveIntensity: 1.0
    });

    // Create walls with trim
    const walls: THREE.Mesh[] = [];
    const wallPositions = [
        { pos: [0, WALL_HEIGHT/2, ARENA_SIZE/2], rot: [0, 0, 0] },
        { pos: [0, WALL_HEIGHT/2, -ARENA_SIZE/2], rot: [0, 0, 0] },
        { pos: [ARENA_SIZE/2, WALL_HEIGHT/2, 0], rot: [0, Math.PI/2, 0] },
        { pos: [-ARENA_SIZE/2, WALL_HEIGHT/2, 0], rot: [0, Math.PI/2, 0] }
    ];

    wallPositions.forEach(({pos, rot}) => {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(pos[0], pos[1], pos[2]);
        wall.rotation.set(rot[0], rot[1], rot[2]);
        wall.receiveShadow = true;
        wall.castShadow = true;
        walls.push(wall);
        wallsGroup.add(wall);

        // Add neon trim to top of wall
        const trimGeometry = new THREE.BoxGeometry(ARENA_SIZE + 10, 0.5, 0.5);
        const trim = new THREE.Mesh(trimGeometry, trimMaterial);
        trim.position.set(pos[0], WALL_HEIGHT, pos[2]);
        trim.rotation.set(rot[0], rot[1], rot[2]);
        wallsGroup.add(trim);
    });

    // Create stands behind each wall
    walls.forEach((wall, index) => {
        const standGroup = new THREE.Group();
        const isVertical = index > 1;
        
        // Create tiered seating
        for (let row = 0; row < STANDS_ROWS; row++) {
            const rowHeight = 2;
            const rowDepth = STANDS_DEPTH / STANDS_ROWS;
            const seatGeometry = new THREE.BoxGeometry(
                isVertical ? 2 : ARENA_SIZE + 10,
                rowHeight,
                isVertical ? ARENA_SIZE + 10 : 2
            );
            
            const seatMaterial = new THREE.MeshStandardMaterial({
                color: darkBackground,
                metalness: 0.7,
                roughness: 0.3,
                emissive: neonBlue,
                emissiveIntensity: 0.1
            });

            const seat = new THREE.Mesh(seatGeometry, seatMaterial);
            const angle = Math.PI / 6; // 30-degree angle for stands
            
            if (isVertical) {
                seat.position.x = wall.position.x + (row + 1) * rowDepth * Math.cos(angle);
                seat.position.y = WALL_HEIGHT + row * rowHeight + rowHeight/2;
                seat.position.z = wall.position.z;
                seat.rotation.z = -angle;
            } else {
                seat.position.x = wall.position.x;
                seat.position.y = WALL_HEIGHT + row * rowHeight + rowHeight/2;
                seat.position.z = wall.position.z + (row + 1) * rowDepth * Math.cos(angle);
                seat.rotation.x = angle;
            }
            
            standGroup.add(seat);

            // Add spectators for this row
            const spectatorGeometry = new THREE.ConeGeometry(0.4, 1.5, 4);
            const spectatorMaterials = [
                new THREE.MeshStandardMaterial({ color: neonCyan, emissive: neonCyan }),
                new THREE.MeshStandardMaterial({ color: neonMagenta, emissive: neonMagenta }),
                new THREE.MeshStandardMaterial({ color: neonPurple, emissive: neonPurple })
            ];

            // Create instanced mesh for spectators
            const spectatorInstance = new THREE.InstancedMesh(
                spectatorGeometry,
                spectatorMaterials[row % 3],
                SPECTATORS_PER_ROW
            );

            for (let i = 0; i < SPECTATORS_PER_ROW; i++) {
                const matrix = new THREE.Matrix4();
                const spacing = (isVertical ? ARENA_SIZE : ARENA_SIZE) / SPECTATORS_PER_ROW;
                const offset = -ARENA_SIZE/2 + spacing * i + spacing/2;
                
                if (isVertical) {
                    matrix.setPosition(
                        seat.position.x,
                        seat.position.y + 1,
                        offset
                    );
                } else {
                    matrix.setPosition(
                        offset,
                        seat.position.y + 1,
                        seat.position.z
                    );
                }
                spectatorInstance.setMatrixAt(i, matrix);
            }
            
            standGroup.add(spectatorInstance);
        }
        
        wallsGroup.add(standGroup);
    });

    // Add corner light beams
    const cornerPositions = [
        [-ARENA_SIZE/2, 0, -ARENA_SIZE/2],
        [ARENA_SIZE/2, 0, -ARENA_SIZE/2],
        [-ARENA_SIZE/2, 0, ARENA_SIZE/2],
        [ARENA_SIZE/2, 0, ARENA_SIZE/2]
    ];

    cornerPositions.forEach(pos => {
        const beamGeometry = new THREE.CylinderGeometry(0.5, 0.5, WALL_HEIGHT * 2, 8);
        const beamMaterial = new THREE.MeshStandardMaterial({
            color: neonCyan,
            transparent: true,
            opacity: 0.6,
            emissive: neonCyan,
            emissiveIntensity: 1.0
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.set(pos[0], WALL_HEIGHT, pos[2]);
        wallsGroup.add(beam);
    });

    scene.add(wallsGroup);
    return wallsGroup;
}

// Create arena
const arena = createArenaWallsAndStands();

// Update camera position and settings
camera.position.set(0, 35, 45); // Move camera further back and higher
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();

// Update fog settings
scene.fog = new THREE.Fog(0x000000, 100, 300); // Increased fog distances

// Create Light Cycle with improved model
function createLightCycle() {
    const cycleGroup = new THREE.Group();

    // Main body - more streamlined
    const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 5);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: neonCyan,
        emissive: neonCyan,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    cycleGroup.add(body);

    // Front section - angled and sleek
    const frontGeometry = new THREE.BoxGeometry(1.8, 1, 2);
    const front = new THREE.Mesh(frontGeometry, bodyMaterial);
    front.position.set(0, 0.7, -2.5);
    front.rotation.x = -Math.PI * 0.05; // Slight upward angle
    cycleGroup.add(front);

    // Windshield
    const windshieldGeometry = new THREE.BoxGeometry(1.6, 0.8, 0.1);
    const windshieldMaterial = new THREE.MeshStandardMaterial({
        color: neonCyan,
        emissive: neonCyan,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.3
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 1.1, -1.8);
    windshield.rotation.x = -Math.PI * 0.2;
    cycleGroup.add(windshield);

    // Side panels
    const sidePanelGeometry = new THREE.BoxGeometry(0.1, 0.8, 4);
    const leftPanel = new THREE.Mesh(sidePanelGeometry, bodyMaterial);
    leftPanel.position.set(-1, 0.8, 0);
    cycleGroup.add(leftPanel);

    const rightPanel = leftPanel.clone();
    rightPanel.position.set(1, 0.8, 0);
    cycleGroup.add(rightPanel);

    // Wheels - larger and more detailed
    const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: neonCyan,
        emissive: neonCyan,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    });

    // Wheel rims
    const rimGeometry = new THREE.TorusGeometry(0.6, 0.1, 8, 12);
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: neonCyan,
        emissive: neonCyan,
        emissiveIntensity: 0.8,
        metalness: 1,
        roughness: 0
    });

    // Front wheel assembly
    const frontWheel = new THREE.Group();
    const frontWheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const frontRim = new THREE.Mesh(rimGeometry, rimMaterial);
    frontWheel.add(frontWheelMesh, frontRim);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.8, -2);
    cycleGroup.add(frontWheel);

    // Back wheel assembly
    const backWheel = new THREE.Group();
    const backWheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const backRim = new THREE.Mesh(rimGeometry, rimMaterial);
    backWheel.add(backWheelMesh, backRim);
    backWheel.rotation.z = Math.PI / 2;
    backWheel.position.set(0, 0.8, 2);
    cycleGroup.add(backWheel);

    // Energy effects
    const engineGlowGeometry = new THREE.BoxGeometry(1.6, 0.2, 0.5);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: neonCyan,
        transparent: true,
        opacity: 0.7
    });

    // Engine glow effects
    const engineGlow = new THREE.Mesh(engineGlowGeometry, glowMaterial);
    engineGlow.position.set(0, 0.5, 2.5);
    cycleGroup.add(engineGlow);

    return cycleGroup;
}

// Replace car with light cycle
const lightCycle = createLightCycle();
scene.add(lightCycle);

// Car state
const carState = {
    velocity: 0,
    rotation: 0,
    maxSpeed: 1.5,
    acceleration: 0.03,
    deceleration: 0.015,
    rotationSpeed: 0.05,
    verticalVelocity: 0,
    height: 0.5,
    gravity: 0.015,
    onGround: true
};

// Trail system
class EnhancedTrail {
    positions: THREE.Vector3[] = [];
    material: THREE.MeshPhongMaterial;
    mesh: THREE.Mesh;
    lastUpdateTime: number = 0;
    
    constructor(scene: THREE.Scene) {
        this.material = new THREE.MeshPhongMaterial({
            color: TRAIL_COLOR,
            emissive: TRAIL_COLOR,
            emissiveIntensity: 8.0,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }
    
    setColor(color: number) {
        this.material.color.setHex(color);
        this.material.emissive.setHex(color);
    }
    
    reset() {
        this.positions = [];
        this.updateGeometry();
    }
    
    update(vehicle: THREE.Object3D, velocity: number, maxSpeed: number, deltaTime: number) {
        const currentTime = performance.now();
        if (currentTime - this.lastUpdateTime < TRAIL_UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = currentTime;

        // Calculate the rear position of the bike
        const bikeDirection = new THREE.Vector3(
            Math.sin(vehicle.rotation.y),
            0,
            Math.cos(vehicle.rotation.y)
        );
        
        const currentPos = new THREE.Vector3()
            .setFromMatrixPosition(vehicle.matrixWorld)
            .sub(bikeDirection.multiplyScalar(1.5));
        currentPos.y = 0.1;

        // Add new position
        this.positions.push(currentPos.clone());

        // Remove old positions
        while (this.positions.length > BASE_TRAIL_LENGTH) {
            this.positions.shift();
        }

        // Update geometry
        this.updateGeometry();

        // Update material based on speed
        const speedRatio = velocity / maxSpeed;
        this.material.opacity = 0.5 + speedRatio * 0.5;
        this.material.emissiveIntensity = 2.0 + speedRatio * 2.0;
    }
    
    updateGeometry() {
        if (this.positions.length < 2) return;

        const vertices: number[] = [];
        const indices: number[] = [];
        
        // Create a ribbon-like trail
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            const nextPos = this.positions[i + 1] || pos;
            
            // Calculate perpendicular vector for width
            const direction = new THREE.Vector3();
            direction.subVectors(nextPos, pos).normalize();
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            perpendicular.multiplyScalar(TRAIL_WIDTH);
            
            // Add vertices for both sides of the trail
            vertices.push(
                pos.x + perpendicular.x, TRAIL_HEIGHT, pos.z + perpendicular.z,
                pos.x - perpendicular.x, TRAIL_HEIGHT, pos.z - perpendicular.z
            );
            
            // Create faces
            if (i < this.positions.length - 1) {
                const baseIndex = i * 2;
                indices.push(
                    baseIndex, baseIndex + 1, baseIndex + 2,
                    baseIndex + 1, baseIndex + 3, baseIndex + 2
                );
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
    }
}

// Coin interface and creation
interface Coin {
    mesh: THREE.Mesh;
    collected: boolean;
    value: number;
}

function createCoin(): Coin {
    const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16); // Increased size from 0.5 to 1.5
    const material = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 1.5, // Increased intensity
        metalness: 1,
        roughness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 1;
    
    return {
        mesh,
        collected: false,
        value: COIN_VALUE
    };
}

// Create coins with initial positions
function initializeCoins() {
    const coinPositions = [
        { x: 50, z: 50 },
        { x: -50, z: -50 },
        { x: 75, z: 0 },
        { x: 0, z: 75 },
        { x: 0, z: -75 }
    ];

    return coinPositions.map(pos => {
        const coin = createCoin();
        coin.mesh.position.set(pos.x, 1, pos.z);
        scene.add(coin.mesh);
        return coin;
    });
}

// Create new trail instance
const trail = new EnhancedTrail(scene);

// Initialize coins
const coins = initializeCoins();

// Create score display
const scoreElement = document.createElement('div');
scoreElement.style.position = 'absolute';
scoreElement.style.top = '20px';
scoreElement.style.right = '20px';
scoreElement.style.left = 'auto';
scoreElement.style.color = '#00ffff';
scoreElement.style.fontFamily = 'Arial, sans-serif';
scoreElement.style.fontSize = '18px';
scoreElement.style.textShadow = '0 0 5px #00ffff';
scoreElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
scoreElement.style.padding = '10px';
scoreElement.style.borderRadius = '5px';
scoreElement.style.zIndex = '1000';
document.body.appendChild(scoreElement);

// AI Light Cycle class definition
class AICycle {
    mesh: THREE.Group;
    trail: EnhancedTrail;
    pattern: string;
    patternTime: number = 0;
    state = {
        alive: true,
        respawnTimer: 0,
        score: 0,
        velocity: 0,
        maxSpeed: 2.0,
        rotation: 0
    };

    constructor(scene: THREE.Scene, color: number, spawnPoint: { x: number, z: number, rotation: number }, pattern: string) {
        this.mesh = createLightCycle();
        this.mesh.position.set(spawnPoint.x, 0.6, spawnPoint.z);
        this.state.rotation = spawnPoint.rotation;
        this.mesh.rotation.y = this.state.rotation;

        // Update cycle color
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const material = child.material instanceof THREE.MeshStandardMaterial ? 
                    child.material : new THREE.MeshStandardMaterial();
                child.material = material.clone();
                child.material.color.setHex(color);
                child.material.emissive.setHex(color);
                child.material.emissiveIntensity = 0.5;
            }
        });

        this.trail = new EnhancedTrail(scene);
        this.trail.setColor(color);
        this.pattern = pattern;
        scene.add(this.mesh);
    }

    update(deltaTime: number, playerCycle: THREE.Group, playerTrail: EnhancedTrail) {
        // Add debug logging
        const firstChild = this.mesh.children[0] as THREE.Mesh;
        const material = firstChild.material as THREE.MeshStandardMaterial;
        console.log(`AI Update - Color: ${material.color.getHexString()}`);
        console.log(`  Pattern: ${this.pattern}`);
        console.log(`  Position: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
        console.log(`  Rotation: ${this.state.rotation.toFixed(2)}`);
        console.log(`  Pattern Time: ${this.patternTime.toFixed(2)}`);

        if (!this.state.alive) {
            this.state.respawnTimer -= deltaTime * 1000;
            if (this.state.respawnTimer <= 0) {
                this.respawn();
            }
            return;
        }

        this.patternTime += deltaTime;

        // Check for collisions with other AI trails
        for (const otherAI of aiCycles) {
            if (otherAI !== this && otherAI.state.alive && this.checkTrailCollision(otherAI.trail)) {
                this.die();
                playerScore += 50; // Bonus for AI killing each other
                this.dropCoins();
                return;
            }
        }

        // Update movement pattern
        switch (this.pattern) {
            case MOVEMENT_PATTERNS.CIRCULAR:
                this.circularMovement(deltaTime);
                break;
            case MOVEMENT_PATTERNS.ZIGZAG:
                this.zigzagMovement(deltaTime);
                break;
            case MOVEMENT_PATTERNS.PATROL:
                this.patrolMovement(deltaTime);
                break;
            case MOVEMENT_PATTERNS.SNAKE:
                this.snakeMovement(deltaTime);
                break;
        }

        this.state.velocity = this.state.maxSpeed;

        // Calculate next position
        const nextX = this.mesh.position.x + Math.sin(this.state.rotation) * this.state.velocity;
        const nextZ = this.mesh.position.z + Math.cos(this.state.rotation) * this.state.velocity;

        // Improved boundary avoidance
        const boundaryBuffer = 20; // Start turning before hitting the actual boundary
        if (Math.abs(nextX) >= BOUNDARY_LIMIT - boundaryBuffer || Math.abs(nextZ) >= BOUNDARY_LIMIT - boundaryBuffer) {
            // Calculate angle to center of arena
            const angleToCenter = Math.atan2(-this.mesh.position.x, -this.mesh.position.z);
            // Gradually turn towards center
            const turnSpeed = 0.1;
            const angleDiff = (angleToCenter - this.state.rotation) % (2 * Math.PI);
            this.state.rotation += turnSpeed * Math.sign(angleDiff);
            return;
        }

        // Update position if safe
        this.mesh.position.x = nextX;
        this.mesh.position.z = nextZ;
        this.mesh.rotation.y = this.state.rotation;

        // Update trail
        this.trail.update(this.mesh, this.state.velocity, this.state.maxSpeed, deltaTime);

        // Check collision with player trail
        if (this.checkTrailCollision(playerTrail)) {
            this.die();
            playerScore += 100;
            this.dropCoins();
        }

        // Add coin collection for AI
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (!coin.collected && coin.mesh.position.distanceTo(this.mesh.position) < 3) {
                scene.remove(coin.mesh);
                coin.collected = true;
                coins.splice(i, 1);
                this.state.score += COIN_VALUE;
                
                // Create a small visual effect for AI coin collection
                const coinEffect = createCoinCollectionEffect(coin.mesh.position);
                scene.add(coinEffect);
                setTimeout(() => scene.remove(coinEffect), 500);
            }
        }
    }

    private circularMovement(deltaTime: number) {
        // Variable radius circular movement
        const radiusVariation = Math.sin(this.patternTime * 0.7) * 0.01;
        this.state.rotation += 0.02 + radiusVariation;
    }

    private zigzagMovement(deltaTime: number) {
        // Reset pattern time every 10 seconds to prevent accumulation
        if (this.patternTime > 10) {
            this.patternTime = 0;
        }
        
        // Dynamic zigzag with varying amplitude
        const baseAngle = this.state.rotation;
        const amplitude = Math.PI / 3 + (Math.sin(this.patternTime * 0.5) * Math.PI / 6);
        const period = 1.5 + Math.sin(this.patternTime * 0.3) * 0.5;
        
        const targetAngle = baseAngle + 
            Math.sin(this.patternTime * (Math.PI / period)) * amplitude +
            (Math.random() * 0.1 - 0.05);
        
        const angleDiff = ((targetAngle - this.state.rotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.state.rotation += angleDiff * 0.15;
    }

    private patrolMovement(deltaTime: number) {
        // Variable patrol timing and angles
        const patrolDuration = 3 + Math.sin(this.patternTime * 0.4) * 1;
        if (this.patternTime > patrolDuration) {
            const turnAngle = (Math.PI / 2) + (Math.random() * Math.PI / 4 - Math.PI / 8);
            this.state.rotation += turnAngle;
            this.patternTime = 0;
        }
    }

    private snakeMovement(deltaTime: number) {
        // Reset pattern time periodically
        if (this.patternTime > 10) {
            this.patternTime = 0;
        }

        // Improved snake-like movement
        const period = 2.0; // Shorter period for more frequent direction changes
        const baseAmplitude = Math.PI / 4; // Increased amplitude
        
        // Calculate distance to arena center
        const distanceToCenter = new THREE.Vector3(
            -this.mesh.position.x,
            0,
            -this.mesh.position.z
        ).length();
        
        // Enhanced center-seeking behavior
        const centerInfluence = Math.min(1, Math.max(0, (distanceToCenter - 50) / 100));
        const centerAngle = Math.atan2(-this.mesh.position.x, -this.mesh.position.z);
        
        // Calculate target angle with improved wave pattern
        const waveAngle = this.patternTime * (Math.PI / period);
        const waveOffset = Math.sin(waveAngle) * baseAmplitude;
        
        // Combine center-seeking with wave pattern
        let targetAngle = this.state.rotation;
        if (distanceToCenter > 100) {
            // Strong center-seeking when far from center
            targetAngle = centerAngle;
        } else {
            // Normal snake pattern with mild center influence
            targetAngle = this.state.rotation + waveOffset + (centerAngle * centerInfluence * 0.2);
        }
        
        // Add small random variation to prevent getting stuck
        targetAngle += (Math.random() - 0.5) * 0.1;
        
        // Smooth rotation towards target angle
        const angleDiff = ((targetAngle - this.state.rotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.state.rotation += angleDiff * deltaTime * 2; // Increased rotation speed
        
        // Occasional sharp turns to break out of loops
        if (Math.random() < 0.02) { // Increased probability
            this.state.rotation += (Math.random() - 0.5) * Math.PI * 0.25;
        }
    }

    private checkTrailCollision(trail: EnhancedTrail): boolean {
        const position = this.mesh.position;
        const collisionThreshold = 2;

        for (let i = 0; i < trail.positions.length - 1; i++) {
            const p1 = trail.positions[i];
            const p2 = trail.positions[i + 1];

            const distance = this.pointToLineDistance(
                position,
                p1,
                p2
            );

            if (distance < collisionThreshold) {
                return true;
            }
        }

        return false;
    }

    private pointToLineDistance(point: THREE.Vector3, lineStart: THREE.Vector3, lineEnd: THREE.Vector3): number {
        const line = lineEnd.clone().sub(lineStart);
        const len = line.length();
        line.normalize();

        const v = point.clone().sub(lineStart);
        const d = v.dot(line);

        if (d <= 0) return point.distanceTo(lineStart);
        if (d >= len) return point.distanceTo(lineEnd);

        const projection = lineStart.clone().add(line.multiplyScalar(d));
        return point.distanceTo(projection);
    }

    private dropCoins() {
        for (let i = 0; i < COIN_DROP_COUNT; i++) {
            const coin = createCoin();
            const spread = 8; // Increased spread
            coin.mesh.position.copy(this.mesh.position);
            coin.mesh.position.x += (Math.random() - 0.5) * spread;
            coin.mesh.position.z += (Math.random() - 0.5) * spread;
            scene.add(coin.mesh);
            coins.push(coin);
        }
    }

    die() {
        this.state.alive = false;
        this.state.respawnTimer = RESPAWN_TIME;
        this.mesh.visible = false;
        this.trail.reset();
        createExplosion(this.mesh.position);
    }

    respawn() {
        const spawnPoint = AI_SPAWN_POINTS[Math.floor(Math.random() * AI_SPAWN_POINTS.length)];
        this.mesh.position.set(spawnPoint.x, 0.6, spawnPoint.z);
        this.state.rotation = spawnPoint.rotation;
        this.mesh.rotation.y = this.state.rotation;
        this.state.alive = true;
        this.mesh.visible = true;
        this.trail.reset();
    }
}

// Create explosion effect
function createExplosion(position: THREE.Vector3) {
    const particleCount = 20;
    const geometry = new THREE.SphereGeometry(0.2, 4, 4);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 2,
        transparent: true
    });

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const direction = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() * 0.5,
            Math.random() - 0.5
        ).normalize();
        const speed = 0.2 + Math.random() * 0.3;

        const animate = () => {
            particle.position.add(direction.multiplyScalar(speed));
            material.opacity -= 0.02;
            
            if (material.opacity <= 0) {
                scene.remove(particle);
                return;
            }
            
            requestAnimationFrame(animate);
        };

        animate();
    }
}

// Initialize AI cycles with logging
console.log('Initializing AI Cycles:');
const MOVEMENT_PATTERN_ARRAY = Object.values(MOVEMENT_PATTERNS);
console.log('Movement Patterns:', MOVEMENT_PATTERN_ARRAY);

const aiCycles = AI_COLORS.map((color, index) => {
    const pattern = MOVEMENT_PATTERN_ARRAY[index % MOVEMENT_PATTERN_ARRAY.length];
    console.log(`AI ${index + 1} - Color: ${color.toString(16)}, Pattern: ${pattern}`);
    return new AICycle(
        scene,
        color,
        AI_SPAWN_POINTS[index],
        pattern
    );
});

// Animation loop
function animate(currentTime: number = 0) {
    if (!playerState.isPlaying) return;
    
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    requestAnimationFrame(animate);

    // Update light cycle position and rotation with delta time
    if (keys['w']) {
        carState.velocity = Math.min(
            carState.velocity + carState.acceleration * deltaTime * 60,
            carState.maxSpeed
        );
    } else if (keys['s']) {
        carState.velocity = Math.max(
            carState.velocity - carState.acceleration * deltaTime * 60,
            -carState.maxSpeed
        );
    } else {
        carState.velocity *= Math.pow(1 - carState.deceleration, deltaTime * 60);
    }

    if (Math.abs(carState.velocity) > 0.01) {
        if (keys['a']) carState.rotation += carState.rotationSpeed * deltaTime * 60;
        if (keys['d']) carState.rotation -= carState.rotationSpeed * deltaTime * 60;
    }

    const nextX = lightCycle.position.x + Math.sin(carState.rotation) * carState.velocity;
    const nextZ = lightCycle.position.z + Math.cos(carState.rotation) * carState.velocity;

    // Update boundary limits for larger arena
    lightCycle.position.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, nextX));
    lightCycle.position.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, nextZ));
    lightCycle.rotation.y = carState.rotation;

    // Update trail with current speed and delta time
    trail.update(lightCycle, Math.abs(carState.velocity), carState.maxSpeed, deltaTime);

    // Ensure camera follows light cycle with better positioning
    const cameraDistance = 25;
    const cameraHeight = 15;
    const lookAheadDistance = 8;
    
    camera.position.x = lightCycle.position.x - Math.sin(carState.rotation) * cameraDistance;
    camera.position.z = lightCycle.position.z - Math.cos(carState.rotation) * cameraDistance;
    camera.position.y = lightCycle.position.y + cameraHeight;
    
    const lookAtPoint = new THREE.Vector3(
        lightCycle.position.x + Math.sin(carState.rotation) * lookAheadDistance,
        lightCycle.position.y,
        lightCycle.position.z + Math.cos(carState.rotation) * lookAheadDistance
    );
    camera.lookAt(lookAtPoint);

    // Rotate sky grid
    sky.rotation.y += 0.0001 * deltaTime * 60;

    // Update AI cycles
    aiCycles.forEach(aiCycle => {
        aiCycle.update(deltaTime, lightCycle, trail);
    });

    // Check coin collection
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (!coin.collected && coin.mesh.position.distanceTo(lightCycle.position) < 3) {
            scene.remove(coin.mesh);
            coin.collected = true;
            coins.splice(i, 1);
            playerScore += coin.value;
        }
    }

    // Check player collision with AI trails
    let playerDied = false;
    aiCycles.forEach(aiCycle => {
        if (aiCycle.state.alive && aiCycle.trail.positions.length > 1) {
            for (let i = 0; i < aiCycle.trail.positions.length - 1; i++) {
                const p1 = aiCycle.trail.positions[i];
                const p2 = aiCycle.trail.positions[i + 1];
                
                // Calculate distance from player to trail segment
                const playerPos = lightCycle.position;
                const line = p2.clone().sub(p1);
                const len = line.length();
                line.normalize();
                
                const v = playerPos.clone().sub(p1);
                const d = v.dot(line);
                
                let distance;
                if (d <= 0) {
                    distance = playerPos.distanceTo(p1);
                } else if (d >= len) {
                    distance = playerPos.distanceTo(p2);
                } else {
                    const projection = p1.clone().add(line.multiplyScalar(d));
                    distance = playerPos.distanceTo(projection);
                }
                
                if (distance < TRAIL_WIDTH * 1.5) {
                    playerDied = true;
                    break;
                }
            }
        }
    });

    if (playerDied) {
        // Reset player position and score
        lightCycle.position.set(0, 0.6, 0);
        carState.rotation = 0;
        carState.velocity = 0;
        playerScore = 0; // Reset score to zero on death
        trail.reset();
        createExplosion(lightCycle.position);
    }

    // Update score display
    highScore = Math.max(highScore, playerScore);
    scoreElement.innerHTML = `
        <h2 style="margin: 0 0 10px 0">Leaderboard</h2>
        <div>${playerState.name}: ${playerScore}</div>
        <div>High Score: ${highScore}</div>
        <div id="ai-scores">
            ${aiCycles.map((ai, index) => 
                `AI ${index + 1}: ${ai.state.score} (${ai.state.alive ? 'Alive' : 'Respawning'})`
            ).join('<br>')}
        </div>
    `;

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('5. Adding event listeners');
document.addEventListener('keydown', (e) => {
    console.log('Keydown event:', e.key);
    keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
    console.log('Keyup event:', e.key);
    keys[e.key.toLowerCase()] = false;
});

console.log('6. Starting animation loop');
// animate(); // This line should be removed or commented out

// Update the car outline creation
if (lightCycle.children[0] instanceof THREE.Mesh) {
    const outlineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00D4FF, 
        side: THREE.BackSide 
    });
    const carOutline = new THREE.Mesh(
        (lightCycle.children[0] as THREE.Mesh).geometry.clone(),
        outlineMaterial
    );
    carOutline.scale.multiplyScalar(1.02);
    lightCycle.children[0].add(carOutline);
}

// Create menu overlay
function createStartMenu() {
    const menuOverlay = document.createElement('div');
    menuOverlay.className = 'menu-overlay';
    
    const menuHTML = `
        <div class="menu-container">
            <h1 class="menu-title">ByteTrail Arena</h1>
            <form class="menu-form" id="startForm">
                <div class="form-group">
                    <label for="playerName">Enter Your Name</label>
                    <input type="text" id="playerName" required minlength="2" maxlength="15">
                    <span class="error-message">Name must be between 2 and 15 characters</span>
                </div>
                <div class="form-group">
                    <label>Choose Your Color</label>
                    <div class="color-options">
                        <div class="color-option" style="background: #00D4FF" data-color="0x00D4FF"></div>
                        <div class="color-option" style="background: #FF1493" data-color="0xFF1493"></div>
                        <div class="color-option" style="background: #7FFF00" data-color="0x7FFF00"></div>
                        <div class="color-option" style="background: #FFD700" data-color="0xFFD700"></div>
                    </div>
                </div>
                <button type="submit" class="start-button">Enter the Grid</button>
            </form>
        </div>
    `;
    
    menuOverlay.innerHTML = menuHTML;
    document.body.appendChild(menuOverlay);

    // Color selection handling
    const colorOptions = menuOverlay.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            playerState.color = parseInt(option.getAttribute('data-color') || '0x00D4FF');
        });
    });

    // Select default color
    colorOptions[0].classList.add('selected');

    // Form submission handling
    const form = document.getElementById('startForm');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('playerName') as HTMLInputElement;
        const name = nameInput.value.trim();
        
        if (name.length >= 2 && name.length <= 15) {
            playerState.name = name;
            playerState.isPlaying = true;
            menuOverlay.remove();
            startGame();
        } else {
            const errorMessage = menuOverlay.querySelector('.error-message') as HTMLElement;
            errorMessage.style.display = 'block';
        }
    });
}

// Wait for game initialization
document.addEventListener('DOMContentLoaded', () => {
    createStartMenu();
});

// Modify the game start logic
function startGame() {
    // Update light cycle color with player's chosen color
    lightCycle.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            const material = child.material instanceof THREE.MeshStandardMaterial ? 
                child.material : new THREE.MeshStandardMaterial();
            material.color.setHex(playerState.color);
            material.emissive.setHex(playerState.color);
        }
    });

    // Update trail color
    trail.setColor(playerState.color);

    // Update score display with player name
    const originalScoreHTML = scoreElement.innerHTML;
    scoreElement.innerHTML = `
        <h2 style="margin: 0 0 10px 0">Leaderboard</h2>
        <div>${playerState.name}: ${playerScore}</div>
        <div>High Score: ${highScore}</div>
        <div id="ai-scores">
            ${aiCycles.map((ai, index) => 
                `AI ${index + 1}: ${ai.state.score} (${ai.state.alive ? 'Alive' : 'Respawning'})`
            ).join('<br>')}
        </div>
    `;

    // Start animation loop
    animate();
}

// Add a visual effect for coin collection
function createCoinCollectionEffect(position: THREE.Vector3) {
    const group = new THREE.Group();
    const particleCount = 8;
    const geometry = new THREE.CircleGeometry(0.2, 8);
    
    for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        group.add(particle);
        
        // Animate particles
        const angle = (i / particleCount) * Math.PI * 2;
        const speed = 0.1;
        const dx = Math.cos(angle) * speed;
        const dz = Math.sin(angle) * speed;
        
        const animate = () => {
            particle.position.x += dx;
            particle.position.z += dz;
            particle.position.y += 0.1;
            particle.scale.multiplyScalar(0.95);
            material.opacity -= 0.05;
            
            if (material.opacity > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    return group;
}

// Add stadium spotlights
function createStadiumLights() {
    const lights: THREE.SpotLight[] = [];
    const positions = [
        { x: ARENA_SIZE/2, y: 60, z: ARENA_SIZE/2 },
        { x: -ARENA_SIZE/2, y: 60, z: ARENA_SIZE/2 },
        { x: ARENA_SIZE/2, y: 60, z: -ARENA_SIZE/2 },
        { x: -ARENA_SIZE/2, y: 60, z: -ARENA_SIZE/2 }
    ];

    positions.forEach(pos => {
        const spotlight = new THREE.SpotLight(0xffffff, 1);
        spotlight.position.set(pos.x, pos.y, pos.z);
        spotlight.angle = Math.PI / 4;
        spotlight.penumbra = 0.3;
        spotlight.decay = 1;
        spotlight.distance = 500;
        spotlight.castShadow = true;
        spotlight.shadow.bias = -0.001;
        spotlight.target.position.set(0, 0, 0);
        scene.add(spotlight.target);
        scene.add(spotlight);
        lights.push(spotlight);
    });

    return lights;
}

const stadiumLights = createStadiumLights(); 