const VALID_COLORS = ["W", "Y", "G", "B", "R", "O"];

const FACES = ["U", "L", "F", "R", "B", "D"];

export function validateCube(cube) {
  const errors = [];

  const counts = {
    W: 0,
    Y: 0,
    G: 0,
    B: 0,
    R: 0,
    O: 0,
  };

  // =========================
  // CEK FACE
  // =========================

  for (const face of FACES) {
    if (!cube[face]) {
      errors.push(`Face ${face} tidak ditemukan.`);
      continue;
    }

    if (cube[face].length !== 9) {
      errors.push(`Face ${face} harus memiliki 9 sticker.`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  // =========================
  // CEK WARNA
  // =========================

  for (const face of FACES) {
    for (const color of cube[face]) {
      if (!VALID_COLORS.includes(color)) {
        errors.push(`Warna tidak valid ditemukan: ${color}`);

        continue;
      }

      counts[color]++;
    }
  }

  // =========================
  // SETIAP WARNA HARUS 9
  // =========================

  for (const color of VALID_COLORS) {
    if (counts[color] !== 9) {
      errors.push(`Warna ${color} berjumlah ${counts[color]}, seharusnya 9.`);
    }
  }

  // =========================
  // CEK CENTER
  // =========================

  const centers = FACES.map((face) => cube[face][4]);

  const uniqueCenters = new Set(centers);

  if (uniqueCenters.size !== 6) {
    errors.push("Setiap center face harus memiliki warna berbeda.");
  }

  // =========================
  // CEK SOLVABILITY
  // (hanya jika warna & center sudah benar)
  // =========================

  if (errors.length === 0) {
    errors.push(...checkSolvable(cube));
  }

  return {
    valid: errors.length === 0,
    errors,
    counts,
  };
}

// ========================================
// SOLVABILITY CHECK
//
// Mengecek apakah susunan sticker benar-benar bisa
// dihasilkan dari kubus asli (piece lengkap, twist
// corner, flip edge, dan paritas permutasi).
// ========================================

// Urutan facelet: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
const FACELET_ORDER = ["U", "R", "F", "D", "L", "B"];

const CORNER_FACELETS = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
];

const CORNER_COLORS = [
  ["U", "R", "F"],
  ["U", "F", "L"],
  ["U", "L", "B"],
  ["U", "B", "R"],
  ["D", "F", "R"],
  ["D", "L", "F"],
  ["D", "B", "L"],
  ["D", "R", "B"],
];

const EDGE_FACELETS = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
];

const EDGE_COLORS = [
  ["U", "R"],
  ["U", "F"],
  ["U", "L"],
  ["U", "B"],
  ["D", "R"],
  ["D", "F"],
  ["D", "L"],
  ["D", "B"],
  ["F", "R"],
  ["F", "L"],
  ["B", "L"],
  ["B", "R"],
];

function permutationParity(perm) {
  let inversions = 0;

  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[i] > perm[j]) {
        inversions++;
      }
    }
  }

  return inversions % 2;
}

function checkSolvable(cube) {
  // Ubah warna menjadi nama face berdasarkan center
  const centerToFace = {};

  for (const face of FACELET_ORDER) {
    centerToFace[cube[face][4]] = face;
  }

  const f = FACELET_ORDER.flatMap((face) =>
    cube[face].map((color) => centerToFace[color]),
  );

  const problems = [];

  // ----- Corners -----
  const cp = [];
  let twistSum = 0;

  for (let pos = 0; pos < 8; pos++) {
    const cols = CORNER_FACELETS[pos].map((i) => f[i]);

    const ori = cols.findIndex((c) => c === "U" || c === "D");

    const col1 = cols[(ori + 1) % 3];
    const col2 = cols[(ori + 2) % 3];

    let found = -1;

    if (ori >= 0) {
      for (let j = 0; j < 8; j++) {
        if (col1 === CORNER_COLORS[j][1] && col2 === CORNER_COLORS[j][2]) {
          found = j;
          break;
        }
      }
    }

    if (found < 0) {
      problems.push("Ada corner (pojok) dengan kombinasi warna yang tidak mungkin.");

      return problems;
    }

    cp.push(found);
    twistSum += ori;
  }

  // ----- Edges -----
  const ep = [];
  let flipSum = 0;

  for (let pos = 0; pos < 12; pos++) {
    const [a, b] = EDGE_FACELETS[pos].map((i) => f[i]);

    let found = -1;
    let flip = 0;

    for (let j = 0; j < 12; j++) {
      if (a === EDGE_COLORS[j][0] && b === EDGE_COLORS[j][1]) {
        found = j;
        flip = 0;
        break;
      }

      if (a === EDGE_COLORS[j][1] && b === EDGE_COLORS[j][0]) {
        found = j;
        flip = 1;
        break;
      }
    }

    if (found < 0) {
      problems.push("Ada edge (sisi) dengan kombinasi warna yang tidak mungkin.");

      return problems;
    }

    ep.push(found);
    flipSum += flip;
  }

  // ----- Piece harus unik -----
  if (new Set(cp).size !== 8) {
    problems.push("Ada corner yang muncul dua kali atau hilang.");
  }

  if (new Set(ep).size !== 12) {
    problems.push("Ada edge yang muncul dua kali atau hilang.");
  }

  if (problems.length > 0) {
    return problems;
  }

  // ----- Orientasi & paritas -----
  if (twistSum % 3 !== 0) {
    problems.push("Ada satu corner yang terpelintir (twist) — kubus tidak bisa diselesaikan.");
  }

  if (flipSum % 2 !== 0) {
    problems.push("Ada satu edge yang terbalik (flip) — kubus tidak bisa diselesaikan.");
  }

  if (permutationParity(cp) !== permutationParity(ep)) {
    problems.push("Dua piece tertukar (paritas salah) — kubus tidak bisa diselesaikan.");
  }

  return problems;
}
