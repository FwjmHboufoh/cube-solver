// ========================================
// CUBE SCANNER
//
// Scan 6 sisi Rubik lewat kamera atau upload foto.
// Hasil akhirnya berupa objek cube { U, L, F, R, B, D }
// yang kompatibel dengan cube.js.
// ========================================

// edges = warna center sisi tetangga yang harus berada di
// tepi atas / bawah / kiri / kanan GAMBAR (panduan orientasi).
const STEPS = [
  {
    face: "F",
    color: "G",
    title: "Sisi depan (HIJAU)",
    text: "Hadapkan sisi dengan center HIJAU ke kamera, sisi PUTIH di atas.",
    edges: { top: "W", bottom: "Y", left: "O", right: "R" },
  },
  {
    face: "R",
    color: "R",
    title: "Sisi kanan (MERAH)",
    text: "Putar kubus (bukan dimiringkan) sampai center MERAH menghadap kamera. PUTIH tetap di atas.",
    edges: { top: "W", bottom: "Y", left: "G", right: "B" },
  },
  {
    face: "B",
    color: "B",
    title: "Sisi belakang (BIRU)",
    text: "Putar lagi sampai center BIRU menghadap kamera. PUTIH tetap di atas.",
    edges: { top: "W", bottom: "Y", left: "R", right: "O" },
  },
  {
    face: "L",
    color: "O",
    title: "Sisi kiri (ORANYE)",
    text: "Putar lagi sampai center ORANYE menghadap kamera. PUTIH tetap di atas.",
    edges: { top: "W", bottom: "Y", left: "B", right: "G" },
  },
  {
    face: "U",
    color: "W",
    title: "Sisi atas (PUTIH)",
    text: "Kembali ke posisi awal (HIJAU menghadap kamera, PUTIH di atas). Lalu condongkan bagian ATAS kubus ke arah kamera sampai sisi PUTIH menghadap kamera. Hasilnya HIJAU ada di bagian BAWAH gambar.",
    edges: { top: "B", bottom: "G", left: "O", right: "R" },
  },
  {
    face: "D",
    color: "Y",
    title: "Sisi bawah (KUNING)",
    text: "Kembali ke posisi awal (HIJAU menghadap kamera, PUTIH di atas). Lalu condongkan bagian BAWAH kubus ke arah kamera sampai sisi KUNING menghadap kamera. Hasilnya HIJAU ada di bagian ATAS gambar.",
    edges: { top: "G", bottom: "B", left: "O", right: "R" },
  },
];

const COLOR_CSS = {
  W: "#f5f5f5",
  Y: "#f4d35e",
  G: "#55a868",
  B: "#4c78a8",
  R: "#e45756",
  O: "#f28e2b",
};

const COLOR_LETTER = { W: "P", Y: "K", G: "H", B: "B", R: "M", O: "O" };

// Posisi tiap sisi pada tampilan net (kolom, baris)
const NET_POSITION = {
  U: [2, 1],
  L: [1, 2],
  F: [2, 2],
  R: [3, 2],
  B: [4, 2],
  D: [2, 3],
};

// Ukuran kanvas sampling & area grid (harus sama dengan overlay CSS)
const SAMPLE_SIZE = 300;
const GRID_MARGIN = 0.12; // 12% tiap sisi
const CELL_SAMPLE_RATIO = 0.4; // ambil 40% bagian tengah tiap sel

// ========================================
// WARNA
// ========================================

export function rgbToLab([r, g, b]) {
  const lin = (v) => {
    v /= 255;

    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  // sRGB -> XYZ (D65)
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Jarak warna. Kecerahan (L) diberi bobot kecil supaya
// perbedaan pencahayaan antar-foto tidak terlalu mengganggu.
function colorDistance(a, b) {
  const dL = (a[0] - b[0]) * 0.5;
  const da = a[1] - b[1];
  const db = a[2] - b[2];

  return Math.sqrt(dL * dL + da * da + db * db);
}

// ========================================
// KLASIFIKASI
//
// samples: { F: [{rgb,lab} x9], R: [...], ... }
//
// Warna center TIDAK dipakai sebagai acuan, karena center
// sering berlogo / bertulisan (mis. logo biru di center putih).
// Warna center sudah pasti dari urutan scan.
//
// 1. Acuan awal = warna standar tiap warna Rubik.
// 2. 48 sticker non-center dicocokkan ke acuan terdekat,
//    dengan batas tepat 8 sticker per warna (kubus asli punya
//    9 sticker per warna, termasuk 1 center).
// 3. Acuan dihitung ulang dari rata-rata sticker yang masuk ke
//    tiap warna (menyesuaikan kamera & cahaya), lalu diulang.
// ========================================

// Warna umum Rubik pada foto (hanya dipakai sebagai titik awal)
const PRIOR_RGB = {
  W: [230, 230, 225],
  Y: [225, 205, 60],
  G: [40, 150, 80],
  B: [30, 80, 170],
  R: [190, 35, 40],
  O: [235, 110, 30],
};

const REFINE_ITERATIONS = 5;

function assignWithCapacity(samples, refs) {
  const colors = Object.keys(refs);

  const pairs = [];

  for (const step of STEPS) {
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;

      for (const color of colors) {
        pairs.push({
          face: step.face,
          index: i,
          color,
          distance: colorDistance(samples[step.face][i].lab, refs[color]),
        });
      }
    }
  }

  pairs.sort((a, b) => a.distance - b.distance);

  const capacity = {};

  for (const color of colors) capacity[color] = 8;

  const cube = {};

  for (const step of STEPS) {
    cube[step.face] = Array(9).fill(null);
    cube[step.face][4] = step.color;
  }

  for (const pair of pairs) {
    if (cube[pair.face][pair.index] !== null) continue;

    if (capacity[pair.color] === 0) continue;

    cube[pair.face][pair.index] = pair.color;

    capacity[pair.color]--;
  }

  return cube;
}

export function classifyStickers(samples) {
  const refs = {};

  for (const color of Object.keys(PRIOR_RGB)) {
    refs[color] = rgbToLab(PRIOR_RGB[color]);
  }

  for (let iteration = 0; iteration < REFINE_ITERATIONS; iteration++) {
    const cube = assignWithCapacity(samples, refs);

    const groups = {};

    for (const step of STEPS) {
      for (let i = 0; i < 9; i++) {
        if (i === 4) continue;

        const color = cube[step.face][i];

        (groups[color] = groups[color] || []).push(samples[step.face][i].lab);
      }
    }

    for (const color of Object.keys(groups)) {
      const list = groups[color];

      refs[color] = [0, 1, 2].map(
        (k) => list.reduce((sum, lab) => sum + lab[k], 0) / list.length,
      );
    }
  }

  const cube = assignWithCapacity(samples, refs);

  return {
    U: cube.U,
    L: cube.L,
    F: cube.F,
    R: cube.R,
    B: cube.B,
    D: cube.D,
  };
}

// ========================================
// KOREKSI ORIENTASI SATU SISI
// ========================================

// Putar 90° searah jarum jam
export function rotateCells(cells) {
  const order = [6, 3, 0, 7, 4, 1, 8, 5, 2];

  return order.map((i) => cells[i]);
}

// Cermin kiri-kanan
export function flipCells(cells) {
  const order = [2, 1, 0, 5, 4, 3, 8, 7, 6];

  return order.map((i) => cells[i]);
}

// ========================================
// SCANNER UI
// ========================================

export class CubeScanner {
  constructor({ onComplete }) {
    this.onComplete = onComplete;

    this.stream = null;
    this.cameraReady = false;
    this.isOpen = false;

    this.stepIndex = 0;
    this.samples = {};

    this.sampleCanvas = document.createElement("canvas");
    this.sampleCanvas.width = SAMPLE_SIZE;
    this.sampleCanvas.height = SAMPLE_SIZE;
    this.sampleCtx = this.sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.build();
  }

  // ----------------------------------------
  // DOM
  // ----------------------------------------

  build() {
    const overlay = document.createElement("div");

    overlay.className = "scan-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="scan-modal" role="dialog" aria-modal="true">
        <div class="scan-header">
          <h2 class="scan-title"></h2>
          <button type="button" class="scan-close" aria-label="Tutup">✕</button>
        </div>

        <p class="scan-text"></p>

        <div class="scan-viewport">
          <video playsinline muted></video>
          <div class="scan-grid">
            ${'<span></span>'.repeat(9)}
          </div>
          <div class="scan-edge top"></div>
          <div class="scan-edge bottom"></div>
          <div class="scan-edge left"></div>
          <div class="scan-edge right"></div>
          <div class="scan-message" hidden></div>
        </div>

        <div class="scan-actions">
          <button type="button" class="scan-back">← Sebelumnya</button>
          <button type="button" class="scan-capture">📷 Ambil</button>
          <button type="button" class="scan-upload">🖼 Upload Foto</button>
        </div>

        <p class="scan-net-label">Hasil scan (klik sisi untuk memilih / mengulang):</p>

        <div class="scan-net"></div>

        <div class="scan-fix">
          <button type="button" class="scan-rotate">⟳ Putar 90°</button>
          <button type="button" class="scan-flip">↔ Cermin</button>
        </div>

        <button type="button" class="scan-done" disabled>✔ Selesai</button>

        <input type="file" accept="image/*" hidden />

        <p class="scan-tip">
          Bar warna di tepi gambar menunjukkan warna sisi tetangga yang harus
          berada di arah itu. Pastikan cahaya merata dan tidak ada pantulan.
          Logo/tulisan di center tidak masalah (diabaikan). Kalau susunan
          sisi terlihat terbalik/tercermin, gunakan Putar 90° atau Cermin.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.titleEl = overlay.querySelector(".scan-title");
    this.textEl = overlay.querySelector(".scan-text");
    this.video = overlay.querySelector("video");
    this.messageEl = overlay.querySelector(".scan-message");
    this.netEl = overlay.querySelector(".scan-net");
    this.edgeEls = {
      top: overlay.querySelector(".scan-edge.top"),
      bottom: overlay.querySelector(".scan-edge.bottom"),
      left: overlay.querySelector(".scan-edge.left"),
      right: overlay.querySelector(".scan-edge.right"),
    };
    this.rotateBtn = overlay.querySelector(".scan-rotate");
    this.flipBtn = overlay.querySelector(".scan-flip");
    this.doneBtn = overlay.querySelector(".scan-done");
    this.backBtn = overlay.querySelector(".scan-back");
    this.captureBtn = overlay.querySelector(".scan-capture");
    this.uploadBtn = overlay.querySelector(".scan-upload");
    this.fileInput = overlay.querySelector("input[type=file]");

    overlay.querySelector(".scan-close").addEventListener("click", () => {
      this.close();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) this.close();
    });

    this.backBtn.addEventListener("click", () => {
      if (this.stepIndex > 0) {
        this.stepIndex--;
        this.render();
      }
    });

    this.captureBtn.addEventListener("click", () => {
      this.captureFromCamera();
    });

    this.uploadBtn.addEventListener("click", () => {
      this.fileInput.click();
    });

    this.rotateBtn.addEventListener("click", () => {
      const face = STEPS[this.stepIndex].face;

      if (this.samples[face]) {
        this.samples[face] = rotateCells(this.samples[face]);

        this.render();
      }
    });

    this.flipBtn.addEventListener("click", () => {
      const face = STEPS[this.stepIndex].face;

      if (this.samples[face]) {
        this.samples[face] = flipCells(this.samples[face]);

        this.render();
      }
    });

    this.doneBtn.addEventListener("click", () => {
      if (STEPS.every((step) => this.samples[step.face])) {
        this.finish();
      }
    });

    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files[0];

      this.fileInput.value = "";

      if (file) this.captureFromFile(file);
    });
  }

  // ----------------------------------------
  // OPEN / CLOSE
  // ----------------------------------------

  async open() {
    this.samples = {};
    this.stepIndex = 0;
    this.isOpen = true;

    this.overlay.hidden = false;

    this.render();

    await this.startCamera();
  }

  close() {
    this.isOpen = false;

    this.overlay.hidden = true;

    this.stopCamera();
  }

  // ----------------------------------------
  // CAMERA
  // ----------------------------------------

  async startCamera() {
    this.showMessage("Membuka kamera...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showMessage(
        "Kamera tidak tersedia. Kamera hanya jalan di https:// atau localhost (bukan file://). Kamu tetap bisa memakai Upload Foto.",
      );

      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Modal ditutup sebelum izin kamera selesai
      if (!this.isOpen) {
        stream.getTracks().forEach((track) => track.stop());

        return;
      }

      this.stream = stream;

      this.video.srcObject = stream;

      await this.video.play();

      this.cameraReady = true;

      this.showMessage("");
    } catch (error) {
      console.error(error);

      const denied = error && error.name === "NotAllowedError";

      this.showMessage(
        denied
          ? "Izin kamera ditolak. Izinkan kamera di browser, atau pakai Upload Foto."
          : "Kamera tidak bisa dibuka. Kamu tetap bisa memakai Upload Foto.",
      );
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    this.stream = null;
    this.cameraReady = false;

    this.video.srcObject = null;
  }

  showMessage(text) {
    this.messageEl.textContent = text;
    this.messageEl.hidden = !text;
  }

  // ----------------------------------------
  // CAPTURE
  // ----------------------------------------

  captureFromCamera() {
    if (!this.cameraReady || !this.video.videoWidth) {
      this.showMessage("Kamera belum siap. Gunakan Upload Foto atau tunggu sebentar.");

      return;
    }

    this.processSource(
      this.video,
      this.video.videoWidth,
      this.video.videoHeight,
    );
  }

  captureFromFile(file) {
    const url = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {
      this.processSource(image, image.naturalWidth, image.naturalHeight);

      URL.revokeObjectURL(url);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);

      this.showMessage("File tidak bisa dibaca sebagai gambar.");
    };

    image.src = url;
  }

  // Ambil kotak tengah dari sumber, lalu sampling 3x3 sel
  processSource(source, width, height) {
    const side = Math.min(width, height);

    this.sampleCtx.drawImage(
      source,
      (width - side) / 2,
      (height - side) / 2,
      side,
      side,
      0,
      0,
      SAMPLE_SIZE,
      SAMPLE_SIZE,
    );

    const margin = GRID_MARGIN * SAMPLE_SIZE;
    const cell = (SAMPLE_SIZE - margin * 2) / 3;
    const half = (cell * CELL_SAMPLE_RATIO) / 2;

    const cells = [];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = margin + cell * (col + 0.5);
        const cy = margin + cell * (row + 0.5);

        const size = Math.max(2, Math.round(half * 2));

        const data = this.sampleCtx.getImageData(
          Math.round(cx - half),
          Math.round(cy - half),
          size,
          size,
        ).data;

        const rgb = medianRgb(data);

        cells.push({ rgb, lab: rgbToLab(rgb) });
      }
    }

    this.samples[STEPS[this.stepIndex].face] = cells;

    // Lanjut ke sisi pertama yang belum di-scan.
    // Kalau semua sudah ada, tetap di sini supaya user bisa
    // memeriksa hasilnya dulu sebelum menekan Selesai.
    const next = STEPS.findIndex((step) => !this.samples[step.face]);

    if (next !== -1) {
      this.stepIndex = next;
    }

    this.render();
  }

  finish() {
    const cube = classifyStickers(this.samples);

    this.close();

    this.onComplete(cube);
  }

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  render() {
    const step = STEPS[this.stepIndex];

    const captured = STEPS.filter((st) => this.samples[st.face]).length;

    const hasCurrent = Boolean(this.samples[step.face]);

    this.titleEl.textContent = `Sisi ${this.stepIndex + 1}/6 — ${step.title}${hasCurrent ? " ✓" : ""}`;

    this.textEl.textContent =
      captured === 6
        ? `Semua sisi sudah di-scan. Periksa susunan di bawah: stiker pada sisi yang bersebelahan harus nyambung. Putar/cermin bila perlu, lalu tekan Selesai.\n\n${step.text}`
        : step.text;

    // Bar panduan orientasi di tepi gambar
    for (const side of ["top", "bottom", "left", "right"]) {
      const color = step.edges[side];

      this.edgeEls[side].style.background = COLOR_CSS[color];
      this.edgeEls[side].textContent = COLOR_LETTER[color];
    }

    this.backBtn.disabled = this.stepIndex === 0;

    this.captureBtn.textContent = hasCurrent ? "📷 Ambil ulang" : "📷 Ambil";

    this.rotateBtn.disabled = !hasCurrent;
    this.flipBtn.disabled = !hasCurrent;

    this.doneBtn.disabled = captured < 6;
    this.doneBtn.textContent = `✔ Selesai (${captured}/6)`;

    this.renderNet();
  }

  renderNet() {
    this.netEl.innerHTML = "";

    STEPS.forEach((s, index) => {
      const mini = document.createElement("button");

      mini.type = "button";
      mini.className = "scan-mini";
      mini.title = s.title;
      mini.dataset.face = s.face;

      const [col, row] = NET_POSITION[s.face];

      mini.style.gridColumn = String(col);
      mini.style.gridRow = String(row);

      if (index === this.stepIndex) mini.classList.add("current");

      const cells = this.samples[s.face];

      for (let i = 0; i < 9; i++) {
        const dot = document.createElement("span");

        if (cells && i === 4) {
          // Center selalu warna standar sisi ini (logo diabaikan)
          dot.style.background = COLOR_CSS[s.color];
        } else if (cells) {
          const [r, g, b] = cells[i].rgb;

          dot.style.background = `rgb(${r}, ${g}, ${b})`;
        } else if (i === 4) {
          dot.style.background = COLOR_CSS[s.color];

          dot.style.opacity = "0.35";
        }

        mini.appendChild(dot);
      }

      mini.addEventListener("click", () => {
        this.stepIndex = index;

        this.render();
      });

      this.netEl.appendChild(mini);
    });
  }
}

// Median per channel (tahan terhadap pantulan / noise)
function medianRgb(data) {
  const r = [];
  const g = [];
  const b = [];

  for (let i = 0; i < data.length; i += 4) {
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  }

  const median = (arr) => {
    arr.sort((x, y) => x - y);

    return arr[Math.floor(arr.length / 2)];
  };

  return [median(r), median(g), median(b)];
}
