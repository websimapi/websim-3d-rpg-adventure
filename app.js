import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import SimplexNoise from 'simplex-noise';

class Game {
  constructor() {
    this.initScene();
    this.createWorld();
    this.createPlayer();
    this.setupControls();
    this.setupEventListeners();
    this.gameLoop();
    this.controls.isLocked = false; // Add initial lock state
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(100, 100, 100);
    this.scene.add(light);
  }

  createWorld() {
    const noise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    // Updated vertex manipulation for newer Three.js versions
    const positions = terrainGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = noise.noise2D(positions[i] * 0.1, positions[i + 2] * 0.1) * 5;
    }
    terrainGeometry.computeVertexNormals(); // Needed for proper lighting
    
    const terrainMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ff88,
      wireframe: false,
      flatShading: true
    });
    
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    this.scene.add(terrain);

    // Generate trees
    for (let i = 0; i < 50; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.5, 2),
        new THREE.MeshPhongMaterial({ color: 0x4a3520 })
      );
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(1.5),
        new THREE.MeshPhongMaterial({ color: 0x228833 })
      );
      leaves.position.y = 1.5;
      tree.add(trunk, leaves);
      tree.position.set(
        Math.random() * 180 - 90,
        0,
        Math.random() * 180 - 90
      );
      this.scene.add(tree);
    }
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
    this.moveState = { forward: 0, right: 0 };
    this.velocity = new THREE.Vector3();

    const togglePointerLock = () => {
      if (!this.controls) return; // Safety check
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
      if (this.controls) { // Add null check
        this.controls.isLocked = document.pointerLockElement === document.body;
      }
    });

    document.addEventListener('keydown', e => this.onKey(e, true));
    document.addEventListener('keyup', e => this.onKey(e, false));
  }

  onKey(event, isDown) {
    switch(event.key.toLowerCase()) {
      case 'w': this.moveState.forward = isDown ? 1 : 0; break;
      case 's': this.moveState.forward = isDown ? -1 : 0; break;
      case 'a': this.moveState.right = isDown ? -1 : 0; break;
      case 'd': this.moveState.right = isDown ? 1 : 0; break;
      case ' ': if(isDown && this.player.isGrounded) this.player.velocity.y = 0.15; break;
    }
  }

  updatePlayer(delta) {
    const speed = 0.1;
    this.velocity.x = this.moveState.right * speed;
    this.velocity.z = this.moveState.forward * speed;
    
    this.velocity.applyQuaternion(this.camera.quaternion);
    this.player.object.position.add(this.velocity);
    
    // Simple ground collision
    if (this.player.object.position.y > 1) {
      this.player.velocity.y -= 0.01;
    } else {
      this.player.object.position.y = 1;
      this.player.velocity.y = 0;
      this.player.isGrounded = true;
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