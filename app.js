import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

class GravityScene {
  constructor(container, gravityValue) {
    this.container = container;
    this.gravityValue = gravityValue;

    // Setup Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth/container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7);
    this.scene.add(light);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({color: 0x555555});
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI/2;
    this.groundMesh.position.y = 1; // Ground at y=1
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Cannon.js world
    this.world = new CANNON.World();
    this.world.gravity.set(0, -gravityValue, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    // Materials & Contact Material (bouncy)
    this.groundMaterial = new CANNON.Material("groundMaterial");
    this.ballMaterial = new CANNON.Material("ballMaterial");

    // Ball-ground contact material
    const contactMaterial = new CANNON.ContactMaterial(this.ballMaterial, this.groundMaterial, {
      friction: 0.4,
      restitution: 0.8
    });
    this.world.addContactMaterial(contactMaterial);

    // Ball-ball contact material (this is key for bouncing between balls)
    const ballBallContactMaterial = new CANNON.ContactMaterial(this.ballMaterial, this.ballMaterial, {
      friction: 0.3,
      restitution: 0.9
    });
    this.world.addContactMaterial(ballBallContactMaterial);

    // Ground body
    this.groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.groundMaterial
    });
    this.groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    this.groundBody.position.y = 1; // Sync physics ground height
    this.world.addBody(this.groundBody);

    this.ballRadius = 1;

    // Store all balls here {mesh, body, done}
    this.balls = [];

    // Clock
    this.clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Mouse click adds ball
    this.renderer.domElement.addEventListener('click', () => this.addBall());

    // Custom gravity input
    this.gravityInput = this.container.querySelector('.gravityInput');
    if (this.gravityInput) {
      this.gravityInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          this.gravityValue = val;
          this.world.gravity.set(0, -this.gravityValue, 0);
        }
      });
    }

    this.onWindowResize();
  }

  onWindowResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  addBall() {
    // Create Three.js mesh
    const ballGeo = new THREE.SphereGeometry(this.ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({color: 0xff4444});
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    this.scene.add(ballMesh);

    // Create Cannon.js body
    const ballShape = new CANNON.Sphere(this.ballRadius);
    const ballBody = new CANNON.Body({
      mass: 5,
      shape: ballShape,
      material: this.ballMaterial
    });
    ballBody.position.set(0, 8, 0);  // Drop from y=8
    ballBody.linearDamping = 0.31;
    this.world.addBody(ballBody);

    // Add to balls list with a "done" flag false
    this.balls.push({mesh: ballMesh, body: ballBody, done: false});
  }

  animate() {
    const delta = this.clock.getDelta();
    this.world.step(1/60, delta);

    // Update balls
    for(let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      // Sync mesh to physics
      ball.mesh.position.copy(ball.body.position);
      ball.mesh.quaternion.copy(ball.body.quaternion);

      // Check if ball is "resting" on ground: 
      // velocity magnitude very low AND position near ground
      const velocity = ball.body.velocity.length();
      const nearGround = ball.body.position.y <= this.ballRadius + 1; // radius + ground height

        if (!ball.done && velocity < 0.1 && nearGround) {
  ball.done = true;

  // Remove immediately (instead of setTimeout delay)
  this.scene.remove(ball.mesh);
  this.world.removeBody(ball.body);
  this.balls.splice(i, 1);
}

    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Create 3 scenes with different gravity
const earthScene = new GravityScene(document.getElementById('earthContainer'), 9.8);
const moonScene = new GravityScene(document.getElementById('moonContainer'), 1.6);
const jupiterScene = new GravityScene(document.getElementById('jupiterContainer'), 24.8);

function animateAll() {
  requestAnimationFrame(animateAll);
  earthScene.animate();
  moonScene.animate();
  jupiterScene.animate();
}
animateAll();
