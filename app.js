import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import SimplexNoise from 'simplex-noise';

const GRAVITY = 0.0015;
const JUMP_FORCE = 0.15;
const MOVEMENT_SPEED = 0.1;
const TERRAIN_SIZE = 200;
const TERRAIN_DETAIL = 100;

class Game {
  constructor() {
    this.initScene();
    this.createWorld();
    this.createPlayer();
    this.setupControls();
    this.setupEventListeners();
    this.gameLoop();
    this.raycaster = new THREE.Raycaster();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87ceeb);
    document.body.appendChild(this.renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    this.scene.add(ambientLight, directionalLight);
  }

  createWorld() {
    const noise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_DETAIL, TERRAIN_DETAIL);
    const positions = terrainGeometry.attributes.position.array;

    // Multi-octave noise generation
    for (let i = 0; i < positions.length; i += 3) {
      let x = positions[i];
      let z = positions[i + 2];
      positions[i + 1] = (
        noise.noise2D(x * 0.02, z * 0.02) * 10 +
        noise.noise2D(x * 0.1, z * 0.1) * 3 +
        noise.noise2D(x * 0.5, z * 0.5) * 0.5
      );
    }

    terrainGeometry.computeVertexNormals();
    
    const terrainMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ff88,
      wireframe: false,
      flatShading: false,
      shininess: 100
    });
    
    this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    this.generateVegetation(noise);
  }

  generateVegetation(noise) {
    const treeGeometry = new THREE.CylinderGeometry(0.3, 0.5, 2);
    const treeMaterial = new THREE.MeshPhongMaterial({ color: 0x4a3520 });
    
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * TERRAIN_SIZE;
      const z = (Math.random() - 0.5) * TERRAIN_SIZE;
      const y = this.getTerrainHeight(x, z);
      
      if (y > 3 && noise.noise2D(x * 0.1, z * 0.1) > 0.2) {
        const tree = this.createTree(x, y, z);
        this.scene.add(tree);
      }
    }
  }

  createTree(x, y, z) {
    const tree = new THREE.Group();
    
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 2),
      new THREE.MeshPhongMaterial({ color: 0x4a3520 })
    );
    
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0x228833 })
    );
    
    leaves.position.y = 1.5;
    trunk.position.y = 1;
    tree.add(trunk, leaves);
    tree.position.set(x, y, z);
    tree.castShadow = true;
    return tree;
  }

  getTerrainHeight(x, z) {
    const position = new THREE.Vector3(x, 0, z);
    this.terrain.worldToLocal(position);
    const vertices = this.terrain.geometry.attributes.position.array;
    
    const gridX = Math.round((position.x + TERRAIN_SIZE/2) / TERRAIN_SIZE * TERRAIN_DETAIL);
    const gridZ = Math.round((position.z + TERRAIN_SIZE/2) / TERRAIN_SIZE * TERRAIN_DETAIL);
    const closestIndex = gridX * (TERRAIN_DETAIL + 1) + gridZ;
    
    return vertices[closestIndex * 3 + 1];
  }

  createPlayer() {
    this.player = {
      object: new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.8),
        new THREE.MeshPhongMaterial({ color: 0xffaa33 })
      ),
      velocity: new THREE.Vector3(),
      isGrounded: false
    };
    
    this.player.object.position.y = 10;
    this.scene.add(this.player.object);
    this.camera.position.set(0, 1.6, 0);
    this.player.object.add(this.camera);
  }

  setupControls() {
    this.controls = new PointerLockControls(this.camera, document.body);
    
    const togglePointerLock = () => {
      if (!this.controls) return;
      if (this.controls.isLocked) {
        this.controls.unlock();
      } else {
        this.controls.lock().catch(err => {
          console.log('Pointer lock failed:', err);
        });
      }
    };

    document.addEventListener('click', togglePointerLock);
    document.addEventListener('pointerlockchange', () => {
      this.controls.isLocked = document.pointerLockElement === document.body;
    });

    this.moveState = { forward: 0, right: 0 };
    this.velocity = new THREE.Vector3();

    document.addEventListener('keydown', e => this.onKey(e, true));
    document.addEventListener('keyup', e => this.onKey(e, false));
  }

  onKey(event, isDown) {
    switch(event.key.toLowerCase()) {
      case 'w': this.moveState.forward = isDown ? 1 : 0; break;
      case 's': this.moveState.forward = isDown ? -1 : 0; break;
      case 'a': this.moveState.right = isDown ? -1 : 0; break;
      case 'd': this.moveState.right = isDown ? 1 : 0; break;
      case ' ': if(isDown && this.player.isGrounded) this.player.velocity.y = JUMP_FORCE; break;
    }
  }

  updatePlayer(delta) {
    const moveSpeed = delta * MOVEMENT_SPEED * 60;
    this.velocity.set(0, 0, 0);

    if (this.moveState.forward) this.velocity.z += this.moveState.forward * moveSpeed;
    if (this.moveState.right) this.velocity.x += this.moveState.right * moveSpeed;

    this.velocity.applyQuaternion(this.camera.quaternion);
    this.player.object.position.add(this.velocity);

    // Ground detection
    const groundCheck = this.getTerrainHeight(
      this.player.object.position.x,
      this.player.object.position.z
    ) + 1;

    if (this.player.object.position.y <= groundCheck) {
      this.player.object.position.y = groundCheck;
      this.player.velocity.y = 0;
      this.player.isGrounded = true;
    } else {
      this.player.velocity.y -= GRAVITY * delta * 60;
      this.player.isGrounded = false;
    }

    this.player.object.position.y += this.player.velocity.y;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  gameLoop() {
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      this.updatePlayer(delta);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}

new Game();