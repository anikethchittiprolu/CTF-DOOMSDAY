export const TIERS = [
  { id: 'apprentice', label: 'Apprentice', max: 75, colour: '#3ddc84', shape: 'circle' },
  { id: 'journeyman', label: 'Journeyman', max: 125, colour: '#f4d03f', shape: 'square' },
  { id: 'adept', label: 'Adept', max: 175, colour: '#ff9f43', shape: 'triangle' },
  { id: 'magister', label: 'Magister', max: 250, colour: '#ff4d4d', shape: 'diamond' },
  { id: 'sorcerer-scientist', label: 'Sorcerer-Scientist', max: Infinity, colour: '#b36bff', shape: 'star' },
];
export const tierForValue = (v) => TIERS.find((t) => v <= t.max) || TIERS[TIERS.length - 1];
export const tierById = (id) => TIERS.find((t) => t.id === id);

const SHAPES = {
  circle: '<circle cx="10" cy="10" r="7.5"/>',
  square: '<rect x="3" y="3" width="14" height="14"/>',
  triangle: '<polygon points="10,2.5 18,17 2,17"/>',
  diamond: '<polygon points="10,1.5 18.5,10 10,18.5 1.5,10"/>',
  star: '<polygon points="10,1.5 12.4,7.4 18.5,7.8 13.8,11.8 15.4,18 10,14.6 4.6,18 6.2,11.8 1.5,7.8 7.6,7.4"/>',
};
/** Tier is shown by shape and label as well as colour. */
export function tierBadge(tier, size = 18) {
  return `<svg class="tier-shape" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" fill="${tier.colour}" stroke="#0b0e0d" stroke-width="1">${SHAPES[tier.shape]}</svg>`;
}
