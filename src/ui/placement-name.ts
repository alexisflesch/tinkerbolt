import type { LevelDocument } from '../domain/level-document';

const placementNames: Readonly<Record<LevelDocument['objects'][number]['type'], string>> = {
  ball: 'Balle',
  basket: 'Panier',
  beam: 'Poutre',
  seesaw: 'Bascule',
  mass: 'Masse',
  box: 'Caisse',
  'electro-magnet': 'Électroaimant',
  piston: 'Piston',
  lever: 'Levier',
  conveyor: 'Convoyeur',
  button: 'Bouton',
  fan: 'Ventilateur',
  barrier: 'Barrière',
  springboard: 'Tremplin',
};

const masculineTypes: ReadonlySet<LevelDocument['objects'][number]['type']> = new Set([
  'basket',
  'lever',
  'conveyor',
  'button',
  'piston',
  'fan',
  'springboard',
]);

/** The French display name for a placed object, shared by `BoardView` and `ContextPanel`. */
export const placementName = (object: LevelDocument['objects'][number]): string =>
  object.type === 'box'
    ? object.props.material === 'wood'
      ? 'Caisse en bois'
      : 'Caisse métallique'
    : placementNames[object.type];

/** « la poutre », « le panier » : the name with its definite article, in lower case. */
export const placementNameWithArticle = (object: LevelDocument['objects'][number]): string =>
  object.type === 'electro-magnet'
    ? 'l’électroaimant'
    : `${masculineTypes.has(object.type) ? 'le' : 'la'} ${placementName(object).toLowerCase()}`;
