import { useEffect } from 'react';
import { addAfterEffect, useThree } from '@react-three/fiber';
/** Public, numeric render diagnostics on the canvas; never copies game/private data. */
export function SceneDiagnostics() {
  const { gl } = useThree();
  useEffect(() => {
    let frames = 0;
    let previousFrame = -1;
    return addAfterEffect(() => {
      if (gl.info.render.frame === previousFrame) return;
      previousFrame = gl.info.render.frame;
      const data = gl.domElement.dataset;
      data.sceneFrames = String(++frames);
      data.sceneDrawCalls = String(gl.info.render.calls);
      data.sceneTriangles = String(gl.info.render.triangles);
      data.sceneTextures = String(gl.info.memory.textures);
      data.sceneGeometries = String(gl.info.memory.geometries);
    });
  }, [gl]);
  return null;
}
