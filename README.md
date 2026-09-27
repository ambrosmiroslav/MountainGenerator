# Mountain Generator

A build-free, browser-based procedural terrain playground. Serve this directory with any static file server and visit `index.html` in a modern browser with an internet connection; Three.js and OrbitControls are loaded as ES modules from the CDN. A local server is needed because browsers restrict ES module imports from `file://` URLs.

## Using the generator

- Set the base width and depth in cells, then choose a spread, refinement count, and numeric seed.
- Click **Regenerate** to apply the settings. Changing a setting also regenerates the terrain.
- Use **Randomize seed** for a new deterministic terrain, **Reset view** to restore the camera, and **Wireframe** to inspect the triangles.
- Choose monochrome, elevation, slope, or combined vertex coloring. Drag to orbit and scroll to zoom.

The default 4 × 3-cell grid starts with 5 × 4 points. Every refinement pass splits every interval in both axes, producing 65 × 49 points after four passes. Existing samples are preserved; new edge samples use the average of their endpoints, and new cell-center samples use the average of the four corners. Each receives a seeded, bounded perturbation that decreases with every pass. Each resulting grid cell is covered by two indexed triangles.

## Limits and compatibility

Width is limited to 1–12 cells, depth to 1–10 cells, refinement to 0–4 passes, spread to 0–3, and seed to an unsigned 32-bit integer. The renderer requires WebGL and a browser that supports JavaScript modules and import maps. Because dependencies are fetched from a CDN, the page requires internet access.
