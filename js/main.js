import {
  createSolvedCube,
  setSticker,
  applyMove,
  inverseMove,
} from "./cube.js";

import { validateCube } from "./validator.js";

import { solveCube, getFaceletString } from "./solver.js";

import { saveCube, loadCube, clearSavedCube } from "./storage.js";

import { generateScramble, applyScramble } from "./scramble.js";

import { Cube3D } from "./cube3d.js";

import { CubeScanner } from "./scanner.js";

window.createSolvedCube = createSolvedCube;
window.applyMove = applyMove;
window.getFaceletString = getFaceletString;
window.solveCube = solveCube;
// ========================================
// STATE
// ========================================

let cube = createSolvedCube();

let selectedColor = null;

let solution = [];

let currentMoveIndex = -1;

let scramble = [];

let solutionStartCube = null;

let isAutoPlaying = false;

let autoPlayTimer = null;

let autoPlaySpeed = 1;

window.getCurrentCube = () => cube;
// ========================================
// ELEMENTS
// ========================================

const palette = document.getElementById("colorPalette");

const selectedColorText = document.getElementById("selectedColor");

const statusElement = document.getElementById("status");

const solutionElement = document.getElementById("solution");

const scrambleElement = document.getElementById("scramble");

const currentMoveElement = document.getElementById("currentMove");

const validateBtn = document.getElementById("validateBtn");

const scrambleBtn = document.getElementById("scrambleBtn");

const solveBtn = document.getElementById("solveBtn");

const saveBtn = document.getElementById("saveBtn");

const loadBtn = document.getElementById("loadBtn");

const resetBtn = document.getElementById("resetBtn");

const previousBtn = document.getElementById("previousBtn");

const nextBtn = document.getElementById("nextBtn");

const playBtn = document.getElementById("playBtn");

const speedButtons = document.querySelectorAll(".speed-btn");

const resetSolutionBtn = document.getElementById("resetSolutionBtn");

const scanBtn = document.getElementById("scanBtn");

// ========================================
// COLOR CSS
// ========================================

const colorClasses = {
  W: "white",
  Y: "yellow",
  G: "green",
  B: "blue",
  R: "red",
  O: "orange",
};

// ========================================
// 3D CUBE
// ========================================

const cube3dElement = document.getElementById("cube3d");
const cube3D = new Cube3D(cube3dElement);

window.cube3D = cube3D;
window.createSolvedCube = createSolvedCube;

// ========================================
// STICKY CUBE PANEL
// ========================================

const PIN_KEY = "rubik_cube_pinned";

const cubePanel = document.getElementById("cubePanel");

const pinBtn = document.getElementById("pinBtn");

function setPinned(pinned) {
  cubePanel.classList.toggle("pinned", pinned);

  pinBtn.textContent = pinned ? "📌 Terkunci" : "📌 Kunci kubus";

  pinBtn.setAttribute("aria-pressed", String(pinned));

  try {
    localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
  } catch (error) {
    // localStorage bisa diblokir; abaikan saja
  }
}

let savedPin = null;

try {
  savedPin = localStorage.getItem(PIN_KEY);
} catch (error) {
  savedPin = null;
}

setPinned(savedPin !== "0");

pinBtn.addEventListener("click", () => {
  setPinned(!cubePanel.classList.contains("pinned"));
});

// Kalau kubus tidak di-sticky dan sedang di luar layar,
// scroll otomatis ke kubus saat animasi dimulai.
function ensureCubeVisible() {
  if (cubePanel.classList.contains("pinned")) {
    return;
  }

  const rect = cube3dElement.getBoundingClientRect();

  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    cube3dElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
// ========================================
// RENDER CUBE
// ========================================

function renderCube() {
  // Tampilan 2D sudah diganti dengan cube 3D.
  // Untuk sekarang renderCube tidak melakukan apa-apa.
}

// ========================================
// STICKER CLICK
// ========================================

function handleStickerClick(face, index) {
  if (!selectedColor) {
    setStatus("Pilih warna terlebih dahulu.", true);

    return;
  }

  // Edit manual membatalkan solusi yang sedang aktif
  stopAutoPlay();

  setSticker(cube, face, index, selectedColor);

  cube3D.setState(cube);

  solution = [];

  currentMoveIndex = -1;

  solutionStartCube = null;

  renderCube();
  renderSolution();

  setStatus("Sticker diubah. Klik Validasi untuk memeriksa kubus.");
}

cube3D.onStickerClick = handleStickerClick;

// ========================================
// COLOR SELECTION
// ========================================

palette.querySelectorAll(".color-btn").forEach((button) => {
  button.addEventListener("click", () => {
    palette.querySelectorAll(".color-btn").forEach((btn) => {
      btn.classList.remove("selected");
    });

    button.classList.add("selected");

    selectedColor = button.dataset.color;

    selectedColorText.textContent = `Warna dipilih: ${selectedColor}`;
  });
});

// ========================================
// STATUS
// ========================================

function setStatus(message, error = false) {
  statusElement.textContent = message;

  statusElement.style.color = error ? "#ff7777" : "#ccc";
}

// ========================================
// VALIDATE
// ========================================

function validateCurrentCube() {
  const result = validateCube(cube);

  if (!result.valid) {
    setStatus(result.errors.join(" "), true);

    return false;
  }

  setStatus("Cube valid.");

  return true;
}

function stopAutoPlay() {
  isAutoPlaying = false;

  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }

  playBtn.textContent = "▶ Play";

  updateStepButtons();
}

// ========================================
// SCRAMBLE
// ========================================

scrambleBtn.addEventListener("click", () => {
  if (cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();
  // Kembali ke cube solved terlebih dahulu
  cube = createSolvedCube();

  // Buat scramble 20 langkah
  scramble = generateScramble(20);

  // Terapkan scramble ke cube
  applyScramble(cube, scramble);

  cube3D.setState(cube);

  // Reset solution
  solution = [];

  currentMoveIndex = -1;

  solutionStartCube = null;

  // Update tampilan
  renderCube();
  renderSolution();

  scrambleElement.textContent = scramble.join(" ");

  setStatus(`Scramble: ${scramble.join(" ")}`);
});

// ========================================
// SOLVE
// ========================================

solveBtn.addEventListener("click", async () => {
  if (cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();

  if (!validateCurrentCube()) {
    return;
  }

  setStatus("Sedang mencari solusi...");

  solveBtn.disabled = true;

  try {
    solutionStartCube = structuredClone(cube);

    solution = await solveCube(cube);

    cube = structuredClone(solutionStartCube);
    cube3D.setState(cube);

    currentMoveIndex = -1;

    renderSolution();

    if (solution.length === 0) {
      setStatus("Rubik sudah dalam keadaan solved.");
    } else {
      setStatus(`Solusi ditemukan: ${solution.length} langkah.`);
    }
  } catch (error) {
    console.error(error);

    setStatus(error.message || "Rubik tidak dapat diselesaikan.", true);
  } finally {
    solveBtn.disabled = false;
  }
});

// ========================================
// VALIDATE BUTTON
// ========================================

validateBtn.addEventListener("click", () => {
  validateCurrentCube();
});

// ========================================
// GO TO SOLUTION STEP
// ========================================

function goToSolutionStep(targetIndex) {
  if (!solutionStartCube || solution.length === 0 || cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();

  // Kembali ke posisi awal solusi
  cube = structuredClone(solutionStartCube);

  // Terapkan semua gerakan sampai step yang dipilih
  for (let i = 0; i <= targetIndex; i++) {
    applyMove(cube, solution[i]);
  }

  // Update visual kubus 3D
  cube3D.setState(cube);

  // Update index
  currentMoveIndex = targetIndex;

  // Update tampilan
  renderCube();
  renderSolution();

  setStatus(
    `Step ${targetIndex + 1}: Lakukan gerakan ${solution[targetIndex]} pada Rubik kamu.`,
  );
}

// ========================================
// AUTO PLAY
// ========================================

async function stepForward() {
  const nextIndex = currentMoveIndex + 1;

  const move = solution[nextIndex];

  await cube3D.animateMove(move, 450 / autoPlaySpeed);

  // Gerakan SELALU diterapkan setelah animasi selesai,
  // supaya state logika tetap sinkron dengan tampilan 3D
  // (termasuk saat user menekan Pause di tengah animasi).
  applyMove(cube, move);

  currentMoveIndex = nextIndex;

  renderCube();
  renderSolution();

  setStatus(`Lakukan gerakan ${move} pada Rubik kamu.`);
}

async function playNextMove() {
  if (!isAutoPlaying) {
    return;
  }

  if (currentMoveIndex >= solution.length - 1) {
    stopAutoPlay();

    setStatus("Solusi selesai. Rubik sudah solved.");

    return;
  }

  await stepForward();

  if (!isAutoPlaying) {
    return;
  }

  autoPlayTimer = setTimeout(() => {
    playNextMove();
  }, 700 / autoPlaySpeed);
}

playBtn.addEventListener("click", () => {
  // Hindari dua loop auto play berjalan bersamaan
  if (cube3D.isAnimating) {
    return;
  }

  if (isAutoPlaying) {
    stopAutoPlay();
    setStatus("Auto play dihentikan.");
    return;
  }

  if (solution.length === 0) {
    setStatus("Belum ada solusi.", true);
    return;
  }

  if (currentMoveIndex >= solution.length - 1) {
    setStatus("Solusi sudah selesai.", true);
    return;
  }

  ensureCubeVisible();

  isAutoPlaying = true;
  playBtn.textContent = "⏸ Pause";

  updateStepButtons();
  playNextMove();
});

// ========================================
// RENDER SOLUTION
// ========================================

function renderSolution() {
  if (solution.length === 0) {
    solutionElement.textContent = "Tidak ada langkah.";

    currentMoveElement.textContent = "-";

    updateStepButtons();

    return;
  }

  solutionElement.innerHTML = "";

  solution.forEach((move, index) => {
    const element = document.createElement("span");

    element.className = "move";

    element.textContent = `${index + 1}. ${move}`;

    if (index < currentMoveIndex) {
      element.classList.add("done");
    }

    if (index === currentMoveIndex) {
      element.classList.add("current");
    }

    // Klik untuk langsung menuju step ini
    element.addEventListener("click", () => {
      goToSolutionStep(index);
    });

    solutionElement.appendChild(element);
  });

  if (currentMoveIndex >= 0 && currentMoveIndex < solution.length) {
    currentMoveElement.textContent = `Lakukan: ${solution[currentMoveIndex]}`;
  } else {
    currentMoveElement.textContent = "Belum ada gerakan.";
  }

  updateStepButtons();
}

// ========================================
// NEXT MOVE
// ========================================

nextBtn.addEventListener("click", async () => {
  if (cube3D.isAnimating || isAutoPlaying) {
    return;
  }

  if (currentMoveIndex >= solution.length - 1) {
    return;
  }

  ensureCubeVisible();

  await stepForward();
});

// ========================================
// PREVIOUS MOVE
// ========================================

previousBtn.addEventListener("click", async () => {
  if (cube3D.isAnimating || isAutoPlaying) {
    return;
  }

  if (currentMoveIndex < 0) {
    return;
  }

  ensureCubeVisible();

  const move = solution[currentMoveIndex];

  const inverse = inverseMove(move);

  await cube3D.animateMove(inverse, 450 / autoPlaySpeed);

  applyMove(cube, inverse);

  currentMoveIndex--;

  renderCube();
  renderSolution();

  if (currentMoveIndex >= 0) {
    setStatus(`Mundur. Gerakan berikutnya: ${solution[currentMoveIndex]}.`);
  } else {
    setStatus("Kembali ke posisi sebelum solusi.");
  }
});

// ========================================
// RESET SOLUTION
// ========================================

resetSolutionBtn.addEventListener("click", () => {
  if (cube3D.isAnimating && !isAutoPlaying) {
    return;
  }

  stopAutoPlay();

  // Animasi yang masih berjalan akan selesai dulu
  if (cube3D.isAnimating) {
    setTimeout(() => resetSolutionBtn.click(), 100);

    return;
  }

  if (!solutionStartCube || solution.length === 0) {
    setStatus("Belum ada solusi yang aktif.", true);

    return;
  }

  cube = structuredClone(solutionStartCube);

  cube3D.setState(cube);

  currentMoveIndex = -1;

  renderCube();
  renderSolution();

  setStatus("Cube dikembalikan ke posisi awal solusi.");
});

// ========================================
// SCAN (KAMERA / UPLOAD FOTO)
// ========================================

function handleScanComplete(scanned) {
  cube = scanned;

  cube3D.setState(cube);

  solution = [];

  currentMoveIndex = -1;

  solutionStartCube = null;

  scramble = [];

  scrambleElement.textContent = "Belum ada scramble.";

  renderCube();
  renderSolution();

  const result = validateCube(cube);

  if (result.valid) {
    setStatus(
      "Scan selesai dan cube valid. Periksa warna di kubus 3D (koreksi dengan palet + klik sticker bila perlu), lalu klik Solve.",
    );
  } else {
    setStatus(
      `Scan selesai, tapi ada masalah: ${result.errors.join(" ")} Koreksi warna dengan palet lalu klik Validasi.`,
      true,
    );
  }

  ensureCubeVisible();
}

const scanner = new CubeScanner({ onComplete: handleScanComplete });

scanBtn.addEventListener("click", () => {
  if (cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();

  scanner.open();
});

// ========================================
// SPEED
// ========================================

speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    autoPlaySpeed = Number(button.dataset.speed);

    speedButtons.forEach((btn) => btn.classList.remove("selected"));

    button.classList.add("selected");
  });
});

// ========================================
// STEP BUTTON STATE
// ========================================

function updateStepButtons() {
  previousBtn.disabled = isAutoPlaying || currentMoveIndex < 0;

  nextBtn.disabled = isAutoPlaying || currentMoveIndex >= solution.length - 1;

  resetSolutionBtn.disabled =
    isAutoPlaying || !solutionStartCube || solution.length === 0;
}

// ========================================
// SAVE
// ========================================

saveBtn.addEventListener("click", () => {
  saveCube(cube);

  setStatus("Cube berhasil disimpan.");
});

// ========================================
// LOAD
// ========================================

loadBtn.addEventListener("click", () => {
  if (cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();
  const saved = loadCube();

  if (!saved) {
    setStatus("Belum ada cube yang disimpan.", true);

    return;
  }

  const check = validateCube(saved);

  if (!check.valid && check.errors.some((e) => e.includes("Face") || e.includes("Warna tidak valid"))) {
    setStatus("Data cube tersimpan rusak.", true);

    return;
  }

  cube = saved;

  cube3D.setState(cube);

  solution = [];

  currentMoveIndex = -1;

  solutionStartCube = null;

  renderCube();
  renderSolution();

  setStatus("Cube berhasil dimuat.");
});

// ========================================
// RESET
// ========================================

resetBtn.addEventListener("click", () => {
  if (cube3D.isAnimating) {
    return;
  }

  stopAutoPlay();
  cube = createSolvedCube();

  cube3D.reset();

  scramble = [];

  solution = [];

  currentMoveIndex = -1;

  solutionStartCube = null;

  selectedColor = null;

  palette.querySelectorAll(".color-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  selectedColorText.textContent = "Warna belum dipilih";

  renderCube();
  renderSolution();

  scrambleElement.textContent = "Belum ada scramble.";

  setStatus("Cube di-reset.");

  clearSavedCube();
});

// ========================================
// INITIAL RENDER
// ========================================

renderCube();

renderSolution();

updateStepButtons();
