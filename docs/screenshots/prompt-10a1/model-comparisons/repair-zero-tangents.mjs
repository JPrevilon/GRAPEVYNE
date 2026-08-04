import { NodeIO } from "@gltf-transform/core";
import { EXTTextureWebP } from "@gltf-transform/extensions";

const [inputPath, outputPath, expectedRepairCountValue] = process.argv.slice(2);
const expectedRepairCount = Number(expectedRepairCountValue);

if (!inputPath || !outputPath || !Number.isInteger(expectedRepairCount)) {
  throw new Error(
    "Usage: node repair-zero-tangents.mjs <input.glb> <output.glb> <expected-count>",
  );
}

const io = new NodeIO().registerExtensions([EXTTextureWebP]);
const document = await io.read(inputPath);
let repaired = 0;

for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const normals = primitive.getAttribute("NORMAL");
    const tangents = primitive.getAttribute("TANGENT");

    if (!normals || !tangents) {
      continue;
    }

    const normalArray = normals.getArray();
    const tangentArray = new Float32Array(tangents.getArray());

    for (let index = 0; index < tangents.getCount(); index += 1) {
      const tangentOffset = index * 4;
      const tangentX = tangentArray[tangentOffset];
      const tangentY = tangentArray[tangentOffset + 1];
      const tangentZ = tangentArray[tangentOffset + 2];

      if (Math.hypot(tangentX, tangentY, tangentZ) > 1e-6) {
        continue;
      }

      const normalOffset = index * 3;
      const normalX = normalArray[normalOffset];
      const normalY = normalArray[normalOffset + 1];
      const normalZ = normalArray[normalOffset + 2];

      let repairedX;
      let repairedY;
      let repairedZ;

      if (Math.abs(normalX) < 0.9) {
        repairedX = 0;
        repairedY = normalZ;
        repairedZ = -normalY;
      } else {
        repairedX = -normalZ;
        repairedY = 0;
        repairedZ = normalX;
      }

      const repairedLength = Math.hypot(repairedX, repairedY, repairedZ);
      tangentArray[tangentOffset] = repairedX / repairedLength;
      tangentArray[tangentOffset + 1] = repairedY / repairedLength;
      tangentArray[tangentOffset + 2] = repairedZ / repairedLength;

      const authoredHandedness = tangentArray[tangentOffset + 3];
      tangentArray[tangentOffset + 3] =
        Number.isFinite(authoredHandedness) && authoredHandedness !== 0
          ? Math.sign(authoredHandedness)
          : 1;
      repaired += 1;
    }

    tangents.setArray(tangentArray);
  }
}

if (repaired !== expectedRepairCount) {
  throw new Error(
    `Expected ${expectedRepairCount} zero-length tangents, repaired ${repaired}`,
  );
}

await io.write(outputPath, document);
console.log(JSON.stringify({ repaired }));
