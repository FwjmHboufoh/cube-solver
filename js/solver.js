import { createSolvedCube, applyMove } from "./cube.js";

let Cube = null;

const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];

async function loadCubeJS() {
  if (Cube) {
    return Cube;
  }

  const module = await import("https://cdn.jsdelivr.net/npm/cubejs@1.3.2/+esm");

  Cube = module.default || module.Cube || module;

  Cube.initSolver();

  return Cube;
}

function cubeToFaceletString(cube) {
  const centerMap = {};

  for (const face of FACE_ORDER) {
    const centerColor = cube[face][4];

    centerMap[centerColor] = face;
  }

  return FACE_ORDER.map((face) => {
    return cube[face].map((color) => centerMap[color]).join("");
  }).join("");
}

export async function solveCube(cube) {
  const CubeClass = await loadCubeJS();

  const faceletString = cubeToFaceletString(cube);

  console.log("CubeJS input:", faceletString);

  const cubeObject = CubeClass.fromString(faceletString);

  if (cubeObject.isSolved()) {
    return [];
  }

  const solution = cubeObject.solve();

  if (!solution) {
    throw new Error("Rubik tidak dapat diselesaikan.");
  }

  return solution.trim().split(/\s+/).filter(Boolean);
}

export function getFaceletString(cube) {
  return cubeToFaceletString(cube);
}

export async function testSolverMapping() {
  const CubeClass = await loadCubeJS();

  const moves = [
    "U",
    "U'",
    "U2",
    "D",
    "D'",
    "D2",
    "L",
    "L'",
    "L2",
    "R",
    "R'",
    "R2",
    "F",
    "F'",
    "F2",
    "B",
    "B'",
    "B2",
  ];

  const results = [];

  for (const move of moves) {
    // Buat kubus lokal
    const localCube = createSolvedCube();
    applyMove(localCube, move);

    const localFacelets = cubeToFaceletString(localCube);

    // Buat kubus referensi CubeJS
    const referenceCube = CubeClass.fromString(
      cubeToFaceletString(createSolvedCube()),
    );

    referenceCube.move(move);

    const referenceFacelets = referenceCube.asString();

    const passed = localFacelets === referenceFacelets;

    results.push({
      move,
      passed,
      local: localFacelets,
      cubejs: referenceFacelets,
    });

    if (passed) {
      console.log(`PASS ${move}`);
    } else {
      console.error(`FAIL ${move}`);
      console.log("Local:", localFacelets);
      console.log("CubeJS:", referenceFacelets);
    }
  }

  const failed = results.filter((result) => !result.passed);

  console.log(
    `Hasil: ${results.length - failed.length}/${results.length} gerakan cocok`,
  );

  return results;
}

export async function testScrambleSolver() {
  const CubeClass = await loadCubeJS();

  const scramble = [
    "L2",
    "D'",
    "B",
    "R",
    "U2",
    "B",
    "R2",
    "D2",
    "F2",
    "B2",
    "U2",
    "D2",
    "U'",
    "F",
    "L",
    "D",
    "F'",
    "L2",
    "D'",
    "R2",
  ];

  // Buat kondisi kubus yang sama
  const localCube = createSolvedCube();
  const referenceCube = CubeClass.fromString(
    cubeToFaceletString(createSolvedCube()),
  );

  // Terapkan scramble ke kedua kubus
  for (const move of scramble) {
    applyMove(localCube, move);
    referenceCube.move(move);
  }

  const localFacelets = cubeToFaceletString(localCube);
  const referenceFacelets = referenceCube.asString();

  console.log("Scramble mapping cocok:", localFacelets === referenceFacelets);

  if (localFacelets !== referenceFacelets) {
    console.error("Kondisi kubus setelah scramble berbeda!");
    console.log("Local:", localFacelets);
    console.log("CubeJS:", referenceFacelets);
    return;
  }

  // Cari solusi
  const solution = referenceCube.solve();
  console.log("Solusi:", solution);

  // Uji solusi pada kubus lokal
  for (const move of solution.trim().split(/\s+/).filter(Boolean)) {
    applyMove(localCube, move);
  }

  const solvedFacelets = cubeToFaceletString(localCube);
  const solvedCube = createSolvedCube();
  const expectedFacelets = cubeToFaceletString(solvedCube);

  console.log("Kubus berhasil solved:", solvedFacelets === expectedFacelets);

  return {
    scrambleMatches: localFacelets === referenceFacelets,
    solution,
    solved: solvedFacelets === expectedFacelets,
  };
}
