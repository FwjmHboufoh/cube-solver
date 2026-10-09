const STORAGE_KEY = "rubik_solver_cube";

export function saveCube(cube) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cube));
}

export function loadCube() {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Gagal membaca cube dari storage:", error);

    return null;
  }
}

export function clearSavedCube() {
  localStorage.removeItem(STORAGE_KEY);
}
