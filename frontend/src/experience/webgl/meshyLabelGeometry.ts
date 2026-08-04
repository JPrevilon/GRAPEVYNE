import { BufferGeometry, Float32BufferAttribute } from "three";

export const MESHY_LABEL_FIT = Object.freeze({
  artworkHalfAngle: 0.95,
  artworkRadius: 0.262,
  bodyRadius: 0.253,
  height: 0.66,
  maskRadius: 0.258,
  y: -0.36,
});

export function createCurvedLabelGeometry(segments: number) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row < 2; row += 1) {
    const y =
      MESHY_LABEL_FIT.y +
      (row === 0 ? -MESHY_LABEL_FIT.height / 2 : MESHY_LABEL_FIT.height / 2);

    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments;
      const theta =
        -MESHY_LABEL_FIT.artworkHalfAngle +
        u * MESHY_LABEL_FIT.artworkHalfAngle * 2;
      positions.push(
        MESHY_LABEL_FIT.artworkRadius * Math.sin(theta),
        y,
        MESHY_LABEL_FIT.artworkRadius * Math.cos(theta),
      );
      uvs.push(u, row);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const bottomLeft = segment;
    const bottomRight = segment + 1;
    const topLeft = segments + 1 + segment;
    const topRight = topLeft + 1;
    indices.push(
      bottomLeft,
      bottomRight,
      topRight,
      bottomLeft,
      topRight,
      topLeft,
    );
  }

  geometry.name = "GRAPEVYNE_Label_Runtime_Curved";
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
