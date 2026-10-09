const FACES = ["U", "L", "F", "R", "B", "D"];

const COLORS = {
  U: "W",
  L: "O",
  F: "G",
  R: "R",
  B: "B",
  D: "Y",
};

// ========================================
// CREATE SOLVED CUBE
// ========================================

export function createSolvedCube() {
  const cube = {};

  for (const face of FACES) {
    cube[face] = Array(9).fill(COLORS[face]);
  }

  return cube;
}

// ========================================
// CLONE
// ========================================

export function cloneCube(cube) {
  const result = {};

  for (const face of FACES) {
    result[face] = [...cube[face]];
  }

  return result;
}

// ========================================
// STICKER ACCESS
// ========================================

export function getCubeFace(cube, face) {
  return cube[face];
}

export function getSticker(cube, face, index) {
  return cube[face][index];
}

export function setSticker(cube, face, index, color) {
  if (!cube[face]) {
    throw new Error(`Face ${face} tidak ditemukan`);
  }

  if (index < 0 || index >= 9) {
    throw new Error(`Sticker index tidak valid: ${index}`);
  }

  cube[face][index] = color;
}

// ========================================
// ROTATE FACE
//
// Index:
//
// 0 1 2
// 3 4 5
// 6 7 8
// ========================================

function rotateFaceClockwise(cube, face) {
  const old = [...cube[face]];

  cube[face][0] = old[6];
  cube[face][1] = old[3];
  cube[face][2] = old[0];

  cube[face][3] = old[7];
  cube[face][4] = old[4];
  cube[face][5] = old[1];

  cube[face][6] = old[8];
  cube[face][7] = old[5];
  cube[face][8] = old[2];
}

function rotateFaceCounterClockwise(cube, face) {
  const old = [...cube[face]];

  cube[face][0] = old[2];
  cube[face][1] = old[5];
  cube[face][2] = old[8];

  cube[face][3] = old[1];
  cube[face][4] = old[4];
  cube[face][5] = old[7];

  cube[face][6] = old[0];
  cube[face][7] = old[3];
  cube[face][8] = old[6];
}

// ========================================
// U MOVE
// ========================================

function moveU(cube) {
  rotateFaceClockwise(cube, "U");

  const F = [...cube.F];
  const R = [...cube.R];
  const B = [...cube.B];
  const L = [...cube.L];

  cube.F[0] = R[0];
  cube.F[1] = R[1];
  cube.F[2] = R[2];

  cube.R[0] = B[0];
  cube.R[1] = B[1];
  cube.R[2] = B[2];

  cube.B[0] = L[0];
  cube.B[1] = L[1];
  cube.B[2] = L[2];

  cube.L[0] = F[0];
  cube.L[1] = F[1];
  cube.L[2] = F[2];
}

// ========================================
// D MOVE
// ========================================

function moveD(cube) {
  rotateFaceClockwise(cube, "D");

  const F = [...cube.F];
  const R = [...cube.R];
  const B = [...cube.B];
  const L = [...cube.L];

  cube.F[6] = L[6];
  cube.F[7] = L[7];
  cube.F[8] = L[8];

  cube.L[6] = B[6];
  cube.L[7] = B[7];
  cube.L[8] = B[8];

  cube.B[6] = R[6];
  cube.B[7] = R[7];
  cube.B[8] = R[8];

  cube.R[6] = F[6];
  cube.R[7] = F[7];
  cube.R[8] = F[8];
}

// ========================================
// R MOVE
// ========================================

function moveR(cube) {
  rotateFaceClockwise(cube, "R");

  const U = [...cube.U];
  const F = [...cube.F];
  const D = [...cube.D];
  const B = [...cube.B];

  cube.U[2] = F[2];
  cube.U[5] = F[5];
  cube.U[8] = F[8];

  cube.F[2] = D[2];
  cube.F[5] = D[5];
  cube.F[8] = D[8];

  cube.D[2] = B[6];
  cube.D[5] = B[3];
  cube.D[8] = B[0];

  cube.B[6] = U[2];
  cube.B[3] = U[5];
  cube.B[0] = U[8];
}

// ========================================
// L MOVE
// ========================================

function moveL(cube) {
  rotateFaceClockwise(cube, "L");

  const U = [...cube.U];
  const F = [...cube.F];
  const D = [...cube.D];
  const B = [...cube.B];

  cube.U[0] = B[8];
  cube.U[3] = B[5];
  cube.U[6] = B[2];

  cube.B[8] = D[0];
  cube.B[5] = D[3];
  cube.B[2] = D[6];

  cube.D[0] = F[0];
  cube.D[3] = F[3];
  cube.D[6] = F[6];

  cube.F[0] = U[0];
  cube.F[3] = U[3];
  cube.F[6] = U[6];
}

// ========================================
// F MOVE
// ========================================

function moveF(cube) {
  rotateFaceClockwise(cube, "F");

  const U = [...cube.U];
  const R = [...cube.R];
  const D = [...cube.D];
  const L = [...cube.L];

  cube.U[6] = L[8];
  cube.U[7] = L[5];
  cube.U[8] = L[2];

  cube.R[0] = U[6];
  cube.R[3] = U[7];
  cube.R[6] = U[8];

  cube.D[2] = R[0];
  cube.D[1] = R[3];
  cube.D[0] = R[6];

  cube.L[2] = D[0];
  cube.L[5] = D[1];
  cube.L[8] = D[2];
}

// ========================================
// B MOVE
// ========================================

function moveB(cube) {
  rotateFaceClockwise(cube, "B");

  const U = [...cube.U];
  const R = [...cube.R];
  const D = [...cube.D];
  const L = [...cube.L];

  cube.U[0] = R[2];
  cube.U[1] = R[5];
  cube.U[2] = R[8];

  cube.L[0] = U[2];
  cube.L[3] = U[1];
  cube.L[6] = U[0];

  cube.D[6] = L[0];
  cube.D[7] = L[3];
  cube.D[8] = L[6];

  cube.R[2] = D[8];
  cube.R[5] = D[7];
  cube.R[8] = D[6];
}

// ========================================
// SINGLE MOVE
// ========================================

function applyBasicMove(cube, move) {
  switch (move) {
    case "U":
      moveU(cube);
      break;

    case "D":
      moveD(cube);
      break;

    case "L":
      moveL(cube);
      break;

    case "R":
      moveR(cube);
      break;

    case "F":
      moveF(cube);
      break;

    case "B":
      moveB(cube);
      break;

    default:
      throw new Error(`Gerakan tidak dikenal: ${move}`);
  }
}

// ========================================
// APPLY MOVE
//
// U
// U'
// U2
// ========================================

export function applyMove(cube, move) {
  const face = move[0];
  const modifier = move.slice(1);

  if (!["U", "D", "L", "R", "F", "B"].includes(face)) {
    throw new Error(`Gerakan tidak valid: ${move}`);
  }

  if (modifier !== "" && modifier !== "'" && modifier !== "2") {
    throw new Error(`Modifier tidak valid: ${move}`);
  }

  // Normal
  if (modifier === "") {
    applyBasicMove(cube, face);

    return;
  }

  // Double
  if (modifier === "2") {
    applyBasicMove(cube, face);
    applyBasicMove(cube, face);

    return;
  }

  // Prime = 3x clockwise
  if (modifier === "'") {
    applyBasicMove(cube, face);
    applyBasicMove(cube, face);
    applyBasicMove(cube, face);

    return;
  }
}

// ========================================
// APPLY MOVE LIST
// ========================================

export function applyMoves(cube, moves) {
  for (const move of moves) {
    applyMove(cube, move);
  }

  return cube;
}

// ========================================
// EXPORT OBJECT
// ========================================

export function cubeToObject(cube) {
  return {
    U: [...cube.U],
    L: [...cube.L],
    F: [...cube.F],
    R: [...cube.R],
    B: [...cube.B],
    D: [...cube.D],
  };
}

export function inverseMove(move) {
  const face = move[0];
  const modifier = move.slice(1);

  if (!["U", "D", "L", "R", "F", "B"].includes(face)) {
    throw new Error(`Gerakan tidak valid: ${move}`);
  }

  if (modifier === "") {
    return face + "'";
  }

  if (modifier === "'") {
    return face;
  }

  if (modifier === "2") {
    return face + "2";
  }

  throw new Error(`Modifier tidak valid: ${move}`);
}
