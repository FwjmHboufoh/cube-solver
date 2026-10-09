import { applyMove } from "./cube.js";

const FACES = ["U", "D", "L", "R", "F", "B"];

const MODIFIERS = ["", "'", "2"];

export function generateScramble(length = 20) {
  const moves = [];

  let previousFace = null;

  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];

    // Jangan mengulang face yang sama
    if (face === previousFace) {
      continue;
    }

    const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

    moves.push(face + modifier);

    previousFace = face;
  }

  return moves;
}

export function applyScramble(cube, moves) {
  for (const move of moves) {
    applyMove(cube, move);
  }

  return cube;
}
