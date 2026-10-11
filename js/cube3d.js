import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// ========================================
// COLORS
// ========================================

const STICKER_COLORS = {
  W: 0xf5f5f5,
  Y: 0xf4d35e,
  G: 0x55a868,
  B: 0x4c78a8,
  R: 0xe45756,
  O: 0xf28e2b,
};

// Warna bagian dalam cubie
const INNER_COLOR = 0x222222;

// Jarak antar cubie
const OFFSET = 1.04;

// ========================================
// FACE / NORMAL MAP
// ========================================

const FACE_NORMALS = {
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

const FACE_ORDER = ["R", "L", "U", "D", "F", "B"];

// Warna solved berdasarkan posisi face
const SOLVED_COLOR_BY_FACE = {
  R: "R",
  L: "O",
  U: "W",
  D: "Y",
  F: "G",
  B: "B",
};

// ========================================
// CUBE3D
// ========================================

export class Cube3D {
  constructor(container) {
    this.container = container;

    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.cubeGroup = null;
    this.cubies = [];

    this.rotationX = -0.35;
    this.rotationY = 0.65;

    this.isDragging = false;
    this.previousMouseX = 0;
    this.previousMouseY = 0;

    this.isAnimating = false;

    // Callback: (face, index) => void, dipanggil saat sticker diklik
    this.onStickerClick = null;

    this.pointerDownX = 0;
    this.pointerDownY = 0;

    this.raycaster = new THREE.Raycaster();

    this.init();
  }

  // ========================================
  // INIT
  // ========================================

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    const width = this.container.clientWidth || 650;
    const height = this.container.clientHeight || 500;

    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);

    this.camera.position.set(0, 0, 9);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.renderer.setSize(width, height);

    this.container.appendChild(this.renderer.domElement);

    this.setupLights();

    this.cubeGroup = new THREE.Group();

    this.scene.add(this.cubeGroup);

    this.createCubies();

    this.setupMouseControls();

    window.addEventListener("resize", () => {
      this.resize();
    });

    // Tinggi kontainer bisa berubah lewat CSS (mis. clamp(vh)),
    // jadi pantau ukuran kontainer, bukan hanya window.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });

      this.resizeObserver.observe(this.container);
    }

    this.render();
  }

  // ========================================
  // LIGHT
  // ========================================

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 2);

    directional.position.set(5, 8, 10);

    this.scene.add(directional);
  }

  // ========================================
  // MATERIAL
  // ========================================

  createMaterial(colorCode) {
    const color =
      STICKER_COLORS[colorCode] !== undefined
        ? STICKER_COLORS[colorCode]
        : INNER_COLOR;

    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0,
    });
  }

  // ========================================
  // CREATE SINGLE CUBIE
  // ========================================

  createCubie(x, y, z) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    /*
      BoxGeometry material order:

      0 = +X = R
      1 = -X = L
      2 = +Y = U
      3 = -Y = D
      4 = +Z = F
      5 = -Z = B
    */

    const materials = [
      this.createMaterial(x === 1 ? "R" : null),
      this.createMaterial(x === -1 ? "O" : null),

      this.createMaterial(y === 1 ? "W" : null),
      this.createMaterial(y === -1 ? "Y" : null),

      this.createMaterial(z === 1 ? "G" : null),
      this.createMaterial(z === -1 ? "B" : null),
    ];

    const cubie = new THREE.Mesh(geometry, materials);

    cubie.position.set(x * OFFSET, y * OFFSET, z * OFFSET);

    cubie.userData.coord = {
      x,
      y,
      z,
    };

    cubie.userData.homeCoord = {
      x,
      y,
      z,
    };

    return cubie;
  }

  // ========================================
  // CREATE ALL CUBIES
  // ========================================

  createCubies() {
    this.cubeGroup.clear();

    this.cubies = [];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = this.createCubie(x, y, z);

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  // ========================================
  // GET CUBIE
  // ========================================

  getCubieAt(x, y, z) {
    return this.cubies.find((cubie) => {
      return (
        cubie.userData.coord.x === x &&
        cubie.userData.coord.y === y &&
        cubie.userData.coord.z === z
      );
    });
  }

  // ========================================
  // CUBE STATE → STICKER DATA
  // ========================================

  getStateSticker(cube, face, index) {
    if (!cube || !cube[face]) {
      return null;
    }

    return cube[face][index];
  }

  // ========================================
  // GLOBAL FACE INDEX
  // ========================================

  getFaceIndex(face, x, y, z) {
    /*
      Face indexing mengikuti cube.js:

      0 1 2
      3 4 5
      6 7 8
    */

    switch (face) {
      // U: baris atas = sisi belakang (z = -1), baris bawah = depan (z = +1)
      case "U":
        return (z + 1) * 3 + (x + 1);

      // D: baris atas = sisi depan (z = +1), baris bawah = belakang (z = -1)
      case "D":
        return (1 - z) * 3 + (x + 1);

      case "F":
        return (1 - y) * 3 + (x + 1);

      case "B":
        return (1 - y) * 3 + (1 - x);

      case "R":
        return (1 - y) * 3 + (1 - z);

      case "L":
        return (1 - y) * 3 + (z + 1);

      default:
        return 0;
    }
  }

  // ========================================
  // GET STICKER ON GLOBAL FACE
  // ========================================

  getStickerAtGlobalFace(cube, face, x, y, z) {
    const index = this.getFaceIndex(face, x, y, z);

    return this.getStateSticker(cube, face, index);
  }

  // ========================================
  // GET OBSERVED COLORS OF CUBIE
  // ========================================

  getCubieGlobalColors(cube, x, y, z) {
    const result = {};

    if (x === 1) {
      result.R = this.getStickerAtGlobalFace(cube, "R", x, y, z);
    }

    if (x === -1) {
      result.L = this.getStickerAtGlobalFace(cube, "L", x, y, z);
    }

    if (y === 1) {
      result.U = this.getStickerAtGlobalFace(cube, "U", x, y, z);
    }

    if (y === -1) {
      result.D = this.getStickerAtGlobalFace(cube, "D", x, y, z);
    }

    if (z === 1) {
      result.F = this.getStickerAtGlobalFace(cube, "F", x, y, z);
    }

    if (z === -1) {
      result.B = this.getStickerAtGlobalFace(cube, "B", x, y, z);
    }

    return result;
  }

  // ========================================
  // FIND SOLVED HOME POSITION
  // ========================================

  findHomePositionForColors(colors) {
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const solved = {};

          if (x === 1) solved.R = "R";
          if (x === -1) solved.L = "O";
          if (y === 1) solved.U = "W";
          if (y === -1) solved.D = "Y";
          if (z === 1) solved.F = "G";
          if (z === -1) solved.B = "B";

          const wantedColors = Object.values(colors).filter(Boolean);

          const solvedColors = Object.values(solved);

          if (wantedColors.length !== solvedColors.length) {
            continue;
          }

          if (wantedColors.every((color) => solvedColors.includes(color))) {
            return {
              x,
              y,
              z,
            };
          }
        }
      }
    }

    return null;
  }

  // ========================================
  // ROTATION MATRIX
  // ========================================

  getRotationForCubie(homeX, homeY, homeZ, colors) {
    const homeFaces = {};

    if (homeX === 1) homeFaces.R = "R";
    if (homeX === -1) homeFaces.L = "O";

    if (homeY === 1) homeFaces.U = "W";
    if (homeY === -1) homeFaces.D = "Y";

    if (homeZ === 1) homeFaces.F = "G";
    if (homeZ === -1) homeFaces.B = "B";

    /*
      Kita mencari salah satu dari 24 rotasi
      kubus yang memetakan sticker solved
      ke posisi sticker sekarang.
    */

    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    const rotations = [];

    for (const forward of axes) {
      for (const up of axes) {
        if (Math.abs(forward.dot(up)) > 0.001) {
          continue;
        }

        const right = new THREE.Vector3().crossVectors(up, forward).normalize();

        const matrix = new THREE.Matrix4();

        matrix.makeBasis(right, up, forward);

        const quaternion = new THREE.Quaternion();

        quaternion.setFromRotationMatrix(matrix);

        rotations.push(quaternion);
      }
    }

    for (const quaternion of rotations) {
      let valid = true;

      for (const [homeFace, color] of Object.entries(homeFaces)) {
        const localNormal = FACE_NORMALS[homeFace];

        const globalNormal = localNormal.clone().applyQuaternion(quaternion);

        const globalFace = this.normalToFace(globalNormal);

        if (!globalFace) {
          valid = false;
          break;
        }

        if (colors[globalFace] !== color) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return quaternion;
      }
    }

    return new THREE.Quaternion();
  }

  // ========================================
  // NORMAL → FACE
  // ========================================

  normalToFace(normal) {
    let bestFace = null;
    let bestDot = -Infinity;

    for (const face of FACE_ORDER) {
      const dot = normal.dot(FACE_NORMALS[face]);

      if (dot > bestDot) {
        bestDot = dot;
        bestFace = face;
      }
    }

    if (bestDot < 0.9) {
      return null;
    }

    return bestFace;
  }

  // ========================================
  // APPLY STATE
  // ========================================

  setState(cube) {
    if (!cube) {
      return;
    }

    if (this.isAnimating) {
      console.warn("Tidak bisa setState saat cube sedang animasi.");

      return;
    }

    /*
      Cara paling aman: setiap cubie dipasang ulang ke posisinya
      dengan orientasi default, lalu warna tiap sisi diambil langsung
      dari state sticker. Dengan begitu state apa pun (termasuk warna
      yang diedit manual dan belum valid) tetap tampil dengan benar.
    */

    let i = 0;

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = this.cubies[i++];

          cubie.position.set(x * OFFSET, y * OFFSET, z * OFFSET);

          cubie.quaternion.identity();

          cubie.userData.coord = { x, y, z };

          this.updateCubieMaterials(cubie, cube, x, y, z);
        }
      }
    }
  }

  // ========================================
  // UPDATE MATERIAL COLORS
  // ========================================

  updateCubieMaterials(cubie, cube, x, y, z) {
    /*
      Material index:
      0 = local +X
      1 = local -X
      2 = local +Y
      3 = local -Y
      4 = local +Z
      5 = local -Z
    */

    const localFaces = ["R", "L", "U", "D", "F", "B"];

    for (let i = 0; i < localFaces.length; i++) {
      const localFace = localFaces[i];

      const localNormal = FACE_NORMALS[localFace];

      const globalNormal = localNormal
        .clone()
        .applyQuaternion(cubie.quaternion);

      const globalFace = this.normalToFace(globalNormal);

      let colorCode = null;

      if (globalFace) {
        /*
          Hanya ambil sticker jika cubie memang
          berada di permukaan cube.
        */

        const isOnFace =
          (globalFace === "R" && x === 1) ||
          (globalFace === "L" && x === -1) ||
          (globalFace === "U" && y === 1) ||
          (globalFace === "D" && y === -1) ||
          (globalFace === "F" && z === 1) ||
          (globalFace === "B" && z === -1);

        if (isOnFace) {
          colorCode = this.getStickerAtGlobalFace(cube, globalFace, x, y, z);
        }
      }

      if (colorCode && STICKER_COLORS[colorCode] !== undefined) {
        cubie.material[i].color.setHex(STICKER_COLORS[colorCode]);
      } else {
        cubie.material[i].color.setHex(INNER_COLOR);
      }
    }
  }

  // ========================================
  // MOVE INFO
  // ========================================

  getMoveInfo(move) {
    const face = move[0];

    let angle = Math.PI / 2;

    if (move.includes("'")) {
      angle = -Math.PI / 2;
    }

    if (move.includes("2")) {
      angle = Math.PI;
    }

    switch (face) {
      case "R":
        return {
          axis: "x",
          layer: 1,
          angle: -angle,
        };

      case "L":
        return {
          axis: "x",
          layer: -1,
          angle: angle,
        };

      case "U":
        return {
          axis: "y",
          layer: 1,
          angle: -angle,
        };

      case "D":
        return {
          axis: "y",
          layer: -1,
          angle: angle,
        };

      case "F":
        return {
          axis: "z",
          layer: 1,
          angle: -angle,
        };

      case "B":
        return {
          axis: "z",
          layer: -1,
          angle: angle,
        };

      default:
        return null;
    }
  }

  // ========================================
  // GET LAYER
  // ========================================

  getLayer(info) {
    return this.cubies.filter(
      (cubie) => cubie.userData.coord[info.axis] === info.layer,
    );
  }

  // ========================================
  // ANIMATE MOVE
  // ========================================

  async animateMove(move, duration = 450) {
    if (this.isAnimating) {
      return;
    }

    const info = this.getMoveInfo(move);

    if (!info) {
      console.error("Gerakan 3D tidak dikenal:", move);

      return;
    }

    const layer = this.getLayer(info);

    if (layer.length !== 9) {
      console.error("Layer 3D tidak lengkap:", move, layer.length);

      return;
    }

    this.isAnimating = true;

    const pivot = new THREE.Group();

    this.cubeGroup.add(pivot);

    /*
      Simpan parent asli.
    */

    for (const cubie of layer) {
      pivot.attach(cubie);
    }

    const start = performance.now();

    return new Promise((resolve) => {
      const animate = (now) => {
        const elapsed = now - start;

        const progress = Math.min(elapsed / duration, 1);

        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const angle = info.angle * eased;

        if (info.axis === "x") {
          pivot.rotation.x = angle;
        }

        if (info.axis === "y") {
          pivot.rotation.y = angle;
        }

        if (info.axis === "z") {
          pivot.rotation.z = angle;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);

          return;
        }

        this.finishLayerRotation(layer, pivot, info);

        this.isAnimating = false;

        resolve();
      };

      requestAnimationFrame(animate);
    });
  }

  // ========================================
  // FINISH ROTATION
  // ========================================

  finishLayerRotation(layer, pivot, info) {
    pivot.updateMatrixWorld(true);

    /*
      Kembalikan cubie ke cubeGroup.
    */

    for (const cubie of layer) {
      this.cubeGroup.attach(cubie);
    }

    this.cubeGroup.remove(pivot);

    /*
      Snap posisi dan rotasi
      untuk menghindari floating-point error.
    */

    for (const cubie of layer) {
      this.snapCubie(cubie);

      this.updateCoordinate(cubie);
    }
  }

  // ========================================
  // SNAP POSITION + ROTATION
  // ========================================

  snapCubie(cubie) {
    const position = cubie.position;

    const x = Math.round(position.x / OFFSET);

    const y = Math.round(position.y / OFFSET);

    const z = Math.round(position.z / OFFSET);

    cubie.position.set(x * OFFSET, y * OFFSET, z * OFFSET);

    this.snapRotation(cubie);
  }

  snapRotation(cubie) {
    // Pastikan quaternion terbaru sudah digunakan.
    cubie.updateMatrix();

    const current = cubie.quaternion.clone();

    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    let bestQuaternion = new THREE.Quaternion();
    let bestScore = -Infinity;

    // Cari orientasi kubus valid yang paling dekat
    // dengan rotasi hasil animasi.
    for (const forward of axes) {
      for (const up of axes) {
        if (Math.abs(forward.dot(up)) > 0.001) {
          continue;
        }

        const right = new THREE.Vector3().crossVectors(up, forward).normalize();

        const matrix = new THREE.Matrix4();
        matrix.makeBasis(right, up, forward);

        const candidate = new THREE.Quaternion();
        candidate.setFromRotationMatrix(matrix);

        const score = Math.abs(current.dot(candidate));

        if (score > bestScore) {
          bestScore = score;
          bestQuaternion.copy(candidate);
        }
      }
    }

    cubie.quaternion.copy(bestQuaternion);
  }

  // ========================================
  // UPDATE COORDINATE
  // ========================================

  updateCoordinate(cubie) {
    cubie.userData.coord.x = Math.round(cubie.position.x / OFFSET);

    cubie.userData.coord.y = Math.round(cubie.position.y / OFFSET);

    cubie.userData.coord.z = Math.round(cubie.position.z / OFFSET);
  }

  // ========================================
  // PLAY MOVES
  // ========================================

  async playMoves(moves, duration = 450, delay = 100) {
    for (const move of moves) {
      await this.animateMove(move, duration);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // ========================================
  // RESET TO SOLVED
  // ========================================

  reset() {
    if (this.isAnimating) {
      return;
    }

    this.createCubies();
  }

  // ========================================
  // RESIZE
  // ========================================

  resize() {
    if (!this.renderer || !this.camera) {
      return;
    }

    const width = this.container.clientWidth;

    const height = this.container.clientHeight;

    if (!width || !height) {
      return;
    }

    this.camera.aspect = width / height;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  // ========================================
  // MOUSE / POINTER
  // ========================================

  setupMouseControls() {
    const canvas = this.renderer.domElement;

    // Tanpa ini, browser HP menganggap geser jari = scroll halaman
    // lalu membatalkan pointer (pointercancel), sehingga kubus
    // hanya berputar sedikit lalu berhenti.
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.webkitUserSelect = "none";
    canvas.style.webkitTouchCallout = "none";

    // Tekan lama di HP tidak boleh memunculkan menu
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    canvas.addEventListener("pointerdown", (event) => {
      // Memutar tampilan tetap boleh saat animasi berjalan
      // (hanya memutar kamera, tidak mengubah state kubus).
      this.isDragging = true;

      this.previousMouseX = event.clientX;

      this.previousMouseY = event.clientY;

      this.pointerDownX = event.clientX;

      this.pointerDownY = event.clientY;

      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.isDragging) {
        return;
      }

      const deltaX = event.clientX - this.previousMouseX;

      const deltaY = event.clientY - this.previousMouseY;

      this.previousMouseX = event.clientX;

      this.previousMouseY = event.clientY;

      const sensitivity = event.pointerType === "touch" ? 0.013 : 0.01;

      this.rotationY += deltaX * sensitivity;

      this.rotationX += deltaY * sensitivity;

      this.rotationX = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.rotationX),
      );
    });

    canvas.addEventListener("pointerup", (event) => {
      const wasDragging = this.isDragging;

      this.isDragging = false;

      // Klik (bukan drag) = pilih sticker
      if (wasDragging) {
        const moved = Math.hypot(
          event.clientX - this.pointerDownX,
          event.clientY - this.pointerDownY,
        );

        // Jari bergetar lebih banyak daripada mouse,
        // jadi batas "tap" di layar sentuh dibuat lebih longgar.
        const tapLimit = event.pointerType === "touch" ? 10 : 5;

        if (moved < tapLimit) {
          this.handleCanvasClick(event);
        }
      }

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener("pointercancel", () => {
      this.isDragging = false;
    });
  }

  // ========================================
  // PICK STICKER
  // ========================================

  handleCanvasClick(event) {
    if (!this.onStickerClick || this.isAnimating) {
      return;
    }

    const picked = this.pickSticker(event);

    if (picked) {
      this.onStickerClick(picked.face, picked.index);
    }
  }

  pickSticker(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();

    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.cubeGroup.updateMatrixWorld(true);

    this.raycaster.setFromCamera(pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.cubies, false);

    if (hits.length === 0) {
      return null;
    }

    const hit = hits[0];

    const cubie = hit.object;

    const localFaces = ["R", "L", "U", "D", "F", "B"];

    const localFace = localFaces[hit.face.materialIndex];

    const globalNormal = FACE_NORMALS[localFace]
      .clone()
      .applyQuaternion(cubie.quaternion);

    const face = this.normalToFace(globalNormal);

    if (!face) {
      return null;
    }

    const { x, y, z } = cubie.userData.coord;

    const onSurface =
      (face === "R" && x === 1) ||
      (face === "L" && x === -1) ||
      (face === "U" && y === 1) ||
      (face === "D" && y === -1) ||
      (face === "F" && z === 1) ||
      (face === "B" && z === -1);

    if (!onSurface) {
      return null;
    }

    return { face, index: this.getFaceIndex(face, x, y, z) };
  }

  // ========================================
  // RENDER LOOP
  // ========================================

  render() {
    if (!this.renderer || !this.cubeGroup) {
      return;
    }

    this.cubeGroup.rotation.x = this.rotationX;

    this.cubeGroup.rotation.y = this.rotationY;

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.render());
  }
}
