import { createContext, useContext } from 'react';
import type { CanvasTexture } from 'three';
type Materials = { wood: CanvasTexture; felt: CanvasTexture; fontsReady: boolean };
export const MaterialContext = createContext<Materials | null>(null);
export function useSceneMaterials() {
  const materials = useContext(MaterialContext);
  if (!materials) throw new Error('SceneMaterials eksik.');
  return materials;
}
