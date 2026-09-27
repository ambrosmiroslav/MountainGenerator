# Mountain Generator

A build-free, browser-based procedural terrain playground. Serve this directory with any static file server and visit `index.html` in a modern browser with an internet connection; Three.js and OrbitControls are loaded as ES modules from the CDN. A local server is needed because browsers restrict ES module imports from `file://` URLs.

## Using the generator

- Set the base width and depth in cells, then choose a spread, refinement count, and numeric seed.
- Click **Regenerate** to apply the settings. Changing a setting also regenerates the terrain.
- Use **Randomize seed** for a new deterministic terrain, **Reset view** to restore the camera, and **Wireframe** to inspect the triangles.
- Set spread from 0 to 1.2 in increments of 0.05; the current value is shown to two decimal places.
- Choose monochrome, elevation, slope, or combined vertex coloring. Drag to orbit and scroll to zoom.
- Adjust the sun with range sliders for declination (-90° to 90°) and right ascension (0° to 360°), or use their arrow keys for precise one-degree changes. The live angle readouts stay in degrees. Set intensity from 0 to 5 with its slider; the combined readout follows each change and the directional light moves without regenerating the terrain.

Declination measures the light angle above or below the horizon. Right ascension rotates around the terrain, with 0° along +X and increasing angles toward +Z when viewed from above. At intensity 0, the directional sun is off; ambient and rim lighting remain.

The default 4 × 3-cell grid starts with 5 × 4 points. Every refinement pass splits every interval in both axes, producing 65 × 49 points after four passes. Existing samples are preserved; new edge samples use the average of their endpoints, and new cell-center samples use the average of the four corners. Each receives a seeded, bounded perturbation that decreases with every pass. Each resulting grid cell is covered by two indexed triangles.

## Limits and compatibility

Width is limited to 1–24 cells, depth to 1–20 cells, and refinement to 0–8 passes. To avoid excessive browser memory use, the generated height map is capped at 250,000 points. Settings exceeding that point budget are rejected before grid or mesh allocation with a message explaining how to reduce the dimensions or pass count; the width, depth, and pass limits still apply individually. For example, an 8-pass 1 × 1-cell grid is supported, while combining maximum dimensions with many passes may exceed the budget. Spread is limited to 0–1.2 in increments of 0.05, and seed to an unsigned 32-bit integer. The renderer requires WebGL and a browser that supports JavaScript modules and import maps. Because dependencies are fetched from a CDN, the page requires internet access.
