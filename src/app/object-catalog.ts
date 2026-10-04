import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';

/** The placeable families (catalogue-initial.md), and their inventory wiring. */
export type ObjectKind =
  | 'Balle'
  | 'Panier'
  | 'Poutre'
  | 'Bascule'
  | 'Masse'
  | 'Caisse'
  | 'Levier'
  | 'Convoyeur'
  | 'Bouton'
  | 'Ventilateur'
  | 'Électroaimant'
  | 'Barrière'
  | 'Tremplin';

interface ObjectCatalogEntry {
  readonly kind: ObjectKind;
  readonly description: string;
}

export const objectKinds: readonly ObjectCatalogEntry[] = [
  { kind: 'Balle', description: 'Un corps libre entraîné par la gravité' },
  { kind: 'Panier', description: 'La cible finale de la scène' },
  { kind: 'Poutre', description: 'Trois longueurs pour guider la balle' },
  { kind: 'Bascule', description: 'Une bascule préassemblée' },
  { kind: 'Caisse', description: 'Un corps libre en bois ou en métal' },
  { kind: 'Masse', description: 'Un poids lourd qui fait basculer' },
  { kind: 'Levier', description: 'Commande un appareil : gauche, arrêt, droite' },
  { kind: 'Convoyeur', description: 'Un tapis qui entraîne ce qu’il porte' },
  { kind: 'Bouton', description: 'Actif tant qu’un objet appuie dessus' },
  {
    kind: 'Électroaimant',
    description: 'Attire les caisses métalliques lorsqu’il est en marche',
  },
  { kind: 'Ventilateur', description: 'Souffle sur ce qui passe devant lui' },
  { kind: 'Barrière', description: 'Une barre qui rentre dans son poteau' },
  { kind: 'Tremplin', description: 'Renvoie vers le haut ce qui tombe dessus' },
];

export const inventoryTypeByObjectKind = {
  Balle: 'ball',
  Panier: 'basket',
  Poutre: 'beam',
  Bascule: 'seesaw',
  Masse: 'mass',
  Caisse: 'box',
  Levier: 'lever',
  Convoyeur: 'conveyor',
  Bouton: 'button',
  Ventilateur: 'fan',
  Électroaimant: 'electro-magnet',
  Barrière: 'barrier',
  Tremplin: 'springboard',
} as const satisfies Readonly<Record<ObjectKind, string>>;

type Placement = LevelDocument['objects'][number];

/**
 * A card of the author's catalogue. It places an object straight into the
 * level, outside the player's inventory, so it works on any level (U20).
 */
interface AuthorCatalogueMetadata {
  readonly key: string;
  readonly kind: ObjectKind;
  readonly name: string;
  /** Spoken name when it says more than the card title. */
  readonly accessibleName: string;
  readonly description: string;
}
export type AuthorCatalogueEntry = AuthorCatalogueMetadata &
  {
    [Type in Placement['type']]: Pick<Extract<Placement, { type: Type }>, 'type' | 'props'>;
  }[Placement['type']];

const authorEntry = (
  kind: ObjectKind,
  type: Placement['type'],
  props: Placement['props'] = {},
): AuthorCatalogueEntry => {
  const { description } = objectKinds.find((entry) => entry.kind === kind) ?? { description: '' };
  const definition = levelDocumentSchema.shape.objects.element.parse({
    id: 'catalogue',
    type,
    props,
    transform: { position: { x: 0, y: 0 }, rotation: 0 },
    permissions: { move: true, rotate: false, remove: true },
  });
  return {
    ...definition,
    key: type,
    kind,
    name: kind,
    accessibleName: kind,
    description,
  };
};

/**
 * The goal's red ball and its basket are unique and already on the board
 * (LevelDocument v2 has a single goal): the author only adds blue balls,
 * listed simply as « Balle ».
 */
export const authorCatalogue: readonly AuthorCatalogueEntry[] = [
  {
    ...authorEntry('Balle', 'ball'),
    description: 'Une pièce de la machine',
  },
  { ...authorEntry('Poutre', 'beam', { size: 'medium' }), accessibleName: 'Poutre moyenne' },
  authorEntry('Bascule', 'seesaw'),
  authorEntry('Masse', 'mass', { weight: '10kg' }),
  {
    ...authorEntry('Caisse', 'box', { material: 'wood' }),
    key: 'box-wood',
    name: 'Caisse en bois',
    accessibleName: 'Caisse en bois',
  },
  {
    ...authorEntry('Caisse', 'box', { material: 'metal' }),
    key: 'box-metal',
    name: 'Caisse métallique',
    accessibleName: 'Caisse métallique',
  },
  authorEntry('Levier', 'lever', { position: 'center' }),
  authorEntry('Convoyeur', 'conveyor', { direction: 'stopped' }),
  authorEntry('Bouton', 'button'),
  authorEntry('Électroaimant', 'electro-magnet', { state: 'on' }),
  authorEntry('Ventilateur', 'fan', { state: 'on' }),
  authorEntry('Barrière', 'barrier', { state: 'closed' }),
  authorEntry('Tremplin', 'springboard'),
];
