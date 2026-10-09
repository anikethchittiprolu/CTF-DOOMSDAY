// Scenes load on travel so the first load stays small: each is its own chunk.
const loaders = {
  doomstadt: () => import('./doomstadt.js'), embassy: () => import('./embassy.js'), foundry: () => import('./foundry.js'),
  archives: () => import('./archives.js'), haasenstadt: () => import('./haasenstadt.js'), monastery: () => import('./monastery.js'),
  wundagore: () => import('./wundagore.js'), baxter: () => import('./baxter.js'), timeplatform: () => import('./timeplatform.js'),
  citadel: () => import('./citadel.js'),
};
export const loadScene = async (id) => (await loaders[id]()).default;
export const sceneIds = Object.keys(loaders);
