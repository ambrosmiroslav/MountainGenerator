import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const DEFAULTS = Object.freeze({
  width: 4,
  depth: 3,
  spread: 1,
  iterations: 4,
  seed: 18427,
  colorMode: "elevation",
});

const COLORS = {
  low: new THREE.Color("#36493f"),
  middle: new THREE.Color("#99b881"),
  high: new THREE.Color("#e4e8d5"),
  monochrome: new THREE.Color("#d7dfd6"),
  slopeLow: new THREE.Color("#35584d"),
  slopeHigh: new THREE.Color("#d7bd83"),
};

const elements = {
  canvas: document.querySelector("#viewer-canvas"),
  form: document.querySelector("#settings-form"),
  width: document.querySelector("#width"),
  depth: document.querySelector("#depth"),
  spread: document.querySelector("#spread"),
  spreadOutput: document.querySelector("#spread-output"),
  iterations: document.querySelector("#iterations"),
  seed: document.querySelector("#seed"),
  colorMode: document.querySelector("#color-mode"),
  wireframe: document.querySelector("#wireframe"),
  message: document.querySelector("#form-message"),
  pointCount: document.querySelector("#point-count"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#15211d");
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
camera.position.set(8, 8, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.setAttribute("aria-label", "Interactive 3D terrain model");
elements.canvas.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 3;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight("#dcebd9", "#26332c", 2.1));
const keyLight = new THREE.DirectionalLight("#fff1d7", 2.5);
keyLight.position.set(-5, 10, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight("#91bbaf", 1.25);
rimLight.position.set(7, 5, -6);
scene.add(rimLight);

const groundGrid = new THREE.GridHelper(30, 30, "#405047", "#2b3832");
groundGrid.position.y = -0.015;
groundGrid.material.transparent = true;
groundGrid.material.opacity = 0.43;
scene.add(groundGrid);

const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  metalness: 0.02,
  side: THREE.DoubleSide,
});

let terrainMesh = null;
let currentDimensions = { width: DEFAULTS.width, depth: DEFAULTS.depth };
let animationFrame = 0;

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseSplitIntervals(intervalCount, splitCount, passIndex) {
  if (splitCount <= 0) return new Set();
  const indices = new Set();
  const offset = (passIndex * 3) % intervalCount;
  for (let i = 0; i < splitCount; i += 1) {
    indices.add((Math.floor(((i + 0.5) * intervalCount) / splitCount) + offset) % intervalCount);
  }
  return indices;
}

function refineHeightMap(grid, xAxis, yAxis, splitX, splitY, random, offsetLimit) {
  const xSplits = chooseSplitIntervals(xAxis.length - 1, splitX, xAxis.length);
  const ySplits = chooseSplitIntervals(yAxis.length - 1, splitY, yAxis.length + 1);
  const nextX = [];
  const nextY = [];

  for (let x = 0; x < xAxis.length - 1; x += 1) {
    nextX.push({ coordinate: xAxis[x], oldIndex: x });
    if (xSplits.has(x)) {
      nextX.push({
        coordinate: (xAxis[x] + xAxis[x + 1]) / 2,
        interval: x,
      });
    }
  }
  nextX.push({ coordinate: xAxis.at(-1), oldIndex: xAxis.length - 1 });

  for (let y = 0; y < yAxis.length - 1; y += 1) {
    nextY.push({ coordinate: yAxis[y], oldIndex: y });
    if (ySplits.has(y)) {
      nextY.push({
        coordinate: (yAxis[y] + yAxis[y + 1]) / 2,
        interval: y,
      });
    }
  }
  nextY.push({ coordinate: yAxis.at(-1), oldIndex: yAxis.length - 1 });

  const refined = nextY.map((y) => nextX.map((x) => {
    if (x.oldIndex !== undefined && y.oldIndex !== undefined) {
      return grid[y.oldIndex][x.oldIndex];
    }

    let average;
    if (x.interval !== undefined && y.interval !== undefined) {
      average = (
        grid[y.interval][x.interval]
        + grid[y.interval][x.interval + 1]
        + grid[y.interval + 1][x.interval]
        + grid[y.interval + 1][x.interval + 1]
      ) / 4;
    } else if (x.interval !== undefined) {
      average = (grid[y.oldIndex][x.interval] + grid[y.oldIndex][x.interval + 1]) / 2;
    } else {
      average = (grid[y.interval][x.oldIndex] + grid[y.interval + 1][x.oldIndex]) / 2;
    }

    return average + (random() * 2 - 1) * offsetLimit;
  }));

  return {
    grid: refined,
    xAxis: nextX.map((point) => point.coordinate),
    yAxis: nextY.map((point) => point.coordinate),
  };
}

function createHeightMap(settings) {
  const random = makeRandom(settings.seed);
  let xAxis = Array.from({ length: settings.width + 1 }, (_, index) => index - settings.width / 2);
  let yAxis = Array.from({ length: settings.depth + 1 }, (_, index) => index - settings.depth / 2);
  let grid = yAxis.map(() => xAxis.map(() => (random() * 2 - 1) * settings.spread * 0.45));

  for (let pass = 0; pass < settings.iterations; pass += 1) {
    const refined = refineHeightMap(
      grid,
      xAxis,
      yAxis,
      xAxis.length - 1,
      yAxis.length - 1,
      random,
      settings.spread * 0.55 / (2 ** pass),
    );
    ({ grid, xAxis, yAxis } = refined);
  }

  return { grid, xAxis, yAxis };
}

function mixColors(first, second, amount) {
  return first.clone().lerp(second, THREE.MathUtils.clamp(amount, 0, 1));
}

function vertexColor(mode, height, minHeight, maxHeight, slope) {
  const elevation = maxHeight === minHeight ? 0.5 : (height - minHeight) / (maxHeight - minHeight);
  if (mode === "monochrome") return COLORS.monochrome.clone();
  if (mode === "slope") return mixColors(COLORS.slopeLow, COLORS.slopeHigh, slope);
  const elevationColor = elevation < 0.58
    ? mixColors(COLORS.low, COLORS.middle, elevation / 0.58)
    : mixColors(COLORS.middle, COLORS.high, (elevation - 0.58) / 0.42);
  if (mode === "combined") {
    return elevationColor.lerp(COLORS.slopeHigh, slope * 0.42);
  }
  return elevationColor;
}

function buildGeometry(heightMap, mode) {
  const { grid, xAxis, yAxis } = heightMap;
  const rows = yAxis.length;
  const columns = xAxis.length;
  const minHeight = Math.min(...grid.flat());
  const maxHeight = Math.max(...grid.flat());
  const positions = [];
  const colors = [];
  const indices = [];

  const getHeight = (x, y) => grid[y][x];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const height = getHeight(column, row);
      const left = getHeight(Math.max(0, column - 1), row);
      const right = getHeight(Math.min(columns - 1, column + 1), row);
      const up = getHeight(column, Math.max(0, row - 1));
      const down = getHeight(column, Math.min(rows - 1, row + 1));
      const dx = (right - left) / Math.max(xAxis[Math.min(column + 1, columns - 1)] - xAxis[Math.max(column - 1, 0)], 0.001);
      const dz = (down - up) / Math.max(yAxis[Math.min(row + 1, rows - 1)] - yAxis[Math.max(row - 1, 0)], 0.001);
      const slope = Math.atan(Math.hypot(dx, dz)) / (Math.PI / 2);
      const color = vertexColor(mode, height, minHeight, maxHeight, slope);
      positions.push(xAxis[column], height, yAxis[row]);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      if ((row + column) % 2 === 0) {
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      } else {
        indices.push(topLeft, bottomLeft, bottomRight, topLeft, bottomRight, topRight);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function readSettings() {
  const width = Number(elements.width.value);
  const depth = Number(elements.depth.value);
  const seed = Number(elements.seed.value);
  const iterations = Number(elements.iterations.value);
  const spread = Number(elements.spread.value);

  const invalid = [
    [elements.width, Number.isInteger(width) && width >= 1 && width <= 12, "Width must be between 1 and 12 cells."],
    [elements.depth, Number.isInteger(depth) && depth >= 1 && depth <= 10, "Depth must be between 1 and 10 cells."],
    [elements.seed, Number.isInteger(seed) && seed >= 0 && seed <= 4294967295, "Seed must be an integer from 0 to 4294967295."],
  ].find(([, isValid]) => !isValid);

  for (const input of [elements.width, elements.depth, elements.seed]) {
    input.removeAttribute("aria-invalid");
  }
  elements.message.textContent = "";
  if (invalid) {
    const [input, , message] = invalid;
    input.setAttribute("aria-invalid", "true");
    elements.message.textContent = message;
    input.focus();
    return null;
  }

  return {
    width,
    depth,
    seed,
    iterations,
    spread,
    colorMode: elements.colorMode.value,
  };
}

function renderTerrain(settings) {
  const heightMap = createHeightMap(settings);
  const geometry = buildGeometry(heightMap, settings.colorMode);
  const nextMesh = new THREE.Mesh(geometry, terrainMaterial);
  nextMesh.castShadow = false;
  nextMesh.receiveShadow = false;

  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
  }
  terrainMesh = nextMesh;
  scene.add(terrainMesh);
  groundGrid.position.y = Math.min(...heightMap.grid.flat()) - 0.06;
  currentDimensions = { width: settings.width, depth: settings.depth };
  elements.pointCount.textContent = `${heightMap.xAxis.length} × ${heightMap.yAxis.length} points`;
}

function regenerate() {
  const settings = readSettings();
  if (settings) renderTerrain(settings);
}

function resizeRenderer() {
  const { width, height } = elements.canvas.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function resetView() {
  const span = Math.max(currentDimensions.width, currentDimensions.depth, 4);
  camera.position.set(span * 1.7, span * 1.65, span * 2.2);
  controls.target.set(0, 0, 0);
  controls.minDistance = span * 0.55;
  controls.maxDistance = span * 7;
  controls.update();
}

function animate() {
  animationFrame = window.requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  regenerate();
});
document.querySelector("#regenerate").addEventListener("click", regenerate);
document.querySelector("#randomize-seed").addEventListener("click", () => {
  elements.seed.value = String(Math.floor(Math.random() * 4294967296));
  regenerate();
});
document.querySelector("#reset-view").addEventListener("click", resetView);
elements.spread.addEventListener("input", () => {
  elements.spreadOutput.value = Number(elements.spread.value).toFixed(1);
});
elements.wireframe.addEventListener("change", () => {
  terrainMaterial.wireframe = elements.wireframe.checked;
});
elements.colorMode.addEventListener("change", regenerate);
elements.iterations.addEventListener("change", regenerate);
elements.width.addEventListener("change", regenerate);
elements.depth.addEventListener("change", regenerate);
elements.spread.addEventListener("change", regenerate);
elements.seed.addEventListener("change", regenerate);

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(elements.canvas);
window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrame);
  resizeObserver.disconnect();
  controls.dispose();
  if (terrainMesh) terrainMesh.geometry.dispose();
  terrainMaterial.dispose();
  renderer.dispose();
});

elements.spreadOutput.value = Number(elements.spread.value).toFixed(1);
resizeRenderer();
renderTerrain({ ...DEFAULTS });
resetView();
animate();
