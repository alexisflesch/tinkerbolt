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
  | 'Piston'
  | 'Minuteur'
  | 'Barrière'
  | 'Tremplin';

/** The catalogue's groups, in the order the author reads them. */
export const catalogueCategories = [
  'Ce qui bouge',
  'Structures',
  'Appareils',
  'Commandes',
] as const;
export type CatalogueCategory = (typeof catalogueCategories)[number];

interface ObjectCatalogEntry {
  readonly kind: ObjectKind;
  readonly category: CatalogueCategory;
  readonly description: string;
}

export const objectKinds: readonly ObjectCatalogEntry[] = [
  { kind: 'Balle', category: 'Ce qui bouge', description: 'Roule, tombe et rebondit' },
  { kind: 'Panier', category: 'Ce qui bouge', description: 'La cible finale de la scène' },
  {
    kind: 'Masse',
    category: 'Ce qui bouge',
    description: 'Un poids de 10 kg pour appuyer ou faire basculer',
  },
  {
    kind: 'Caisse',
    category: 'Ce qui bouge',
    description: 'Une caisse à pousser ou à transporter',
  },
  { kind: 'Poutre', category: 'Structures', description: 'Un support fixe, en trois longueurs' },
  { kind: 'Bascule', category: 'Structures', description: 'Une planche qui pivote sous le poids' },
  { kind: 'Tremplin', category: 'Structures', description: 'Fait rebondir ce qui tombe dessus' },
  {
    kind: 'Convoyeur',
    category: 'Appareils',
    description: 'Un tapis roulant, vers la gauche ou la droite',
  },
  {
    kind: 'Ventilateur',
    category: 'Appareils',
    description: 'Souffle devant lui quand il est en marche',
  },
  {
    kind: 'Électroaimant',
    category: 'Appareils',
    description: 'Attire les caisses métalliques quand il est en marche',
  },
  { kind: 'Piston', category: 'Appareils', description: 'Pousse d’un coup ce qui est devant lui' },
  {
    kind: 'Barrière',
    category: 'Appareils',
    description: 'Une barre qui s’ouvre ou se ferme sur commande',
  },
  {
    kind: 'Levier',
    category: 'Commandes',
    description: 'Trois positions pour commander un appareil',
  },
  { kind: 'Bouton', category: 'Commandes', description: 'Actif tant qu’un objet appuie dessus' },
  {
    kind: 'Minuteur',
    category: 'Commandes',
    description: 'Retarde le signal de quelques secondes',
  },
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
  Piston: 'piston',
  Minuteur: 'timer',
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
  readonly category: CatalogueCategory;
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
  const { category, description } = objectKinds.find((entry) => entry.kind === kind) ?? {
    category: 'Ce qui bouge',
    description: '',
  };
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
    category,
    description,
  };
};

/**
 * The goal's red ball and its basket are unique and already on the board
 * (LevelDocument v2 has a single goal): the author only adds blue balls,
 * listed simply as « Balle ». Entries follow `catalogueCategories`.
 */
export const authorCatalogue: readonly AuthorCatalogueEntry[] = [
  authorEntry('Balle', 'ball'),
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
    description: 'Une caisse que l’électroaimant attire',
  },
  { ...authorEntry('Poutre', 'beam', { size: 'medium' }), accessibleName: 'Poutre moyenne' },
  authorEntry('Bascule', 'seesaw'),
  authorEntry('Tremplin', 'springboard'),
  authorEntry('Convoyeur', 'conveyor', { direction: 'stopped' }),
  authorEntry('Ventilateur', 'fan', { state: 'on' }),
  authorEntry('Électroaimant', 'electro-magnet', { state: 'on' }),
  authorEntry('Piston', 'piston'),
  authorEntry('Barrière', 'barrier', { state: 'closed' }),
  authorEntry('Levier', 'lever', { position: 'center' }),
  authorEntry('Bouton', 'button'),
  authorEntry('Minuteur', 'timer', { delaySeconds: 3 }),
];
