# MysteryBox Web3D — Visual 3D Update

This update changes only the World Tree and Mystery Box rendering/presentation layer.

## World Tree
- One procedural Three.js 3D tree model; Growth changes the same model's scale, leaf detail visibility, lighting and idle animation.
- `worldTreeGrowth` remains the single Growth source of truth.
- Vertical Growth meter remains the only Growth meter.
- Lightweight particles and real WebGL shadows are used.
- OrbitControls is limited to the World Tree view.

## Mystery Box
- Existing box logic and reward/coin flow are unchanged.
- Box meshes now use more dimensional metallic materials, recessed interior, rounded geometry, hardware, emissive accents, lights and real shadows.
- Existing opening animation hooks (`lidPivot`, `rewardGroup`, `rewardMesh`) are preserved.

## Fallback / Performance
- WebGL renderer creation is guarded with a fallback class instead of crashing the page.
- Pixel ratio is capped for performance.
- Particle count is reduced on small screens.
- Existing Login, coins, Mystery Box logic, rewards, Admin and Supabase files were not edited outside the rendering/UI code paths required for this visual update.

## Validation
- `node --check` passed for every JavaScript file in the project.
- CSS parsed successfully with no top-level parse errors.
- Source scan confirms no `710 / 1000` duplicate progress markup was introduced.
