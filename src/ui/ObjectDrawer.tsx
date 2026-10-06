import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

import {
  currentEditorAttempt,
  type EditorSession,
} from '../application/editor-session/editor-session';
import {
  authorCatalogue,
  catalogueCategories,
  inventoryTypeByObjectKind,
  objectKinds,
  type AuthorCatalogueEntry,
  type CatalogueCategory,
  type ObjectKind,
} from '../app/object-catalog';
import type { PlacementSource } from '../app/use-board-pointers';
import type { LevelDocument } from '../domain/level-document';
import {
  spriteThumbnailPath,
  type SpriteFamily,
  type SpriteThumbnail,
} from '../presentation/sprite-loader';

/** The same art the board draws, pre-composed, so a catalogue card looks like the object it places. */
const beamSizeLabels = { short: 'courte', medium: 'moyenne', long: 'longue' } as const;

const categoryThumbnails: Readonly<Record<CatalogueCategory, SpriteThumbnail>> = {
  'Ce qui bouge': 'second-ball',
  Structures: 'box-wood',
  Appareils: 'fan',
  Commandes: 'lever',
};

const searchText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();

/** A ball from the player's inventory is never the goal's: it is drawn blue. */
const playerThumbnail = (family: Exclude<SpriteFamily, 'box'>): SpriteThumbnail =>
  family === 'ball' ? 'second-ball' : family;

interface DrawerCard {
  readonly key: string;
  readonly kind: ObjectKind;
  readonly name: string;
  readonly accessibleName: string;
  readonly detail: string;
  /** The author's catalogue is grouped; the player's inventory is not. */
  readonly category?: CatalogueCategory;
  readonly thumbnail: SpriteThumbnail;
  readonly isDepleted: boolean;
  readonly source: PlacementSource;
}

type InventoryEntry = LevelDocument['inventory'][number];

/** ADR 0020: the red ball and the basket exist once at most; the card is off once the goal names it. */
const isGoalRoleTaken = (
  entry: AuthorCatalogueEntry,
  goal: LevelDocument['goal'] | undefined,
): boolean =>
  (entry.goalRole === 'ball' && goal?.ballId !== undefined) ||
  (entry.goalRole === 'basket' && goal?.basketId !== undefined);

const authorCard =
  (goal: LevelDocument['goal'] | undefined) =>
  (entry: AuthorCatalogueEntry): DrawerCard => ({
    key: entry.key,
    kind: entry.kind,
    name: entry.name,
    accessibleName: entry.accessibleName,
    detail: entry.description,
    category: entry.category,
    // Only the card with the goal role is the red ball: any other ball added here is blue.
    thumbnail:
      entry.type === 'box'
        ? entry.props.material === 'wood'
          ? 'box-wood'
          : 'box-metal'
        : entry.type === 'ball' && entry.goalRole === undefined
          ? 'second-ball'
          : entry.type,
    isDepleted: isGoalRoleTaken(entry, goal),
    source: { from: 'catalogue', entry },
  });

const inventoryCards = (inventoryEntry: InventoryEntry): DrawerCard[] => {
  const catalogEntry = objectKinds.find(
    ({ kind }) => inventoryTypeByObjectKind[kind] === inventoryEntry.type,
  );
  if (catalogEntry === undefined) return [];
  const { kind } = catalogEntry;
  const name =
    inventoryEntry.type === 'box'
      ? inventoryEntry.props.material === 'wood'
        ? 'Caisse en bois'
        : 'Caisse métallique'
      : inventoryEntry.type === 'beam'
        ? `Poutre ${beamSizeLabels[inventoryEntry.props.size]}`
        : kind;
  const quantity = String(inventoryEntry.quantity);
  return [
    {
      key: inventoryEntry.id,
      kind,
      name,
      accessibleName: `${name}, quantité : ${quantity}`,
      detail: `Quantité : ${quantity}`,
      thumbnail:
        inventoryEntry.type === 'box'
          ? inventoryEntry.props.material === 'wood'
            ? 'box-wood'
            : 'box-metal'
          : playerThumbnail(inventoryEntry.type === 'wire' ? 'ball' : inventoryEntry.type),
      isDepleted: inventoryEntry.quantity === 0,
      source: { from: 'inventory', inventoryEntryId: inventoryEntry.id },
    },
  ];
};

interface ObjectDrawerProps {
  readonly session: EditorSession;
  readonly selectedObject: ObjectKind | undefined;
  /** Key of the card the active placement tool came from. */
  readonly selectedEntryKey: string | undefined;
  readonly onSelectKind: (kind: ObjectKind, source: PlacementSource) => void;
  /** Whether the "Fil" tool is active (U15, U21). */
  readonly isWiringActive: boolean;
  /** The author's card passes nothing; the player's names its inventory entry (U21). */
  readonly onSelectWire: (inventoryEntryId?: string) => void;
}

interface WireCardProps {
  readonly accessibleName: string;
  readonly detail: string;
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: () => void;
}

/** The "Fil" card: the author's catalogue entry, or a wire entry of the player's inventory. */
function WireCard({ accessibleName, detail, isActive, isDisabled, onSelect }: WireCardProps) {
  return (
    <button
      className={`object-card object-card-wire${isActive ? ' object-card-selected' : ''}`}
      type="button"
      disabled={isDisabled}
      aria-label={accessibleName}
      aria-pressed={isActive}
      onClick={onSelect}
    >
      <span className="object-thumb" aria-hidden="true">
        <WireThumbnail />
      </span>
      <span className="object-card-copy">
        <strong>Fil</strong>
        <span>{detail}</span>
      </span>
      <span className="object-card-action" aria-hidden="true">
        {isActive ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
      </span>
    </button>
  );
}

/**
 * Stand-in thumbnail for the "Fil" card until the author draws one: two
 * terminals joined by a wire in the first circuit's colours (dark casing,
 * blue core, as `wire-renderer.ts` draws them).
 */
function WireThumbnail() {
  return (
    <svg viewBox="0 0 56 40" width="56" height="40" focusable="false">
      <path
        d="M10 30 C 22 30, 22 10, 34 10 L 46 10"
        fill="none"
        stroke="#1d1f24"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M10 30 C 22 30, 22 10, 34 10 L 46 10"
        fill="none"
        stroke="#1e88e5"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="25"
        width="10"
        height="10"
        rx="2"
        fill="#6b7280"
        stroke="#1d1f24"
        strokeWidth="2"
      />
      <rect
        x="43"
        y="5"
        width="10"
        height="10"
        rx="2"
        fill="#6b7280"
        stroke="#1d1f24"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * The catalogue of placeable objects, always open beside the board (identité
 * visuelle): a column of cards, or a strip under the board on a phone held
 * upright. The player sees the level's inventory; the author sees every
 * family, and places it outside any inventory.
 */
export function ObjectDrawer({
  session,
  selectedObject,
  selectedEntryKey,
  onSelectKind,
  isWiringActive,
  onSelectWire,
}: ObjectDrawerProps) {
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<ReadonlySet<CatalogueCategory>>(
    () => new Set(),
  );
  const [searchCollapsedCategories, setSearchCollapsedCategories] = useState<
    ReadonlySet<CatalogueCategory>
  >(() => new Set());
  const term = searchText(query);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);
  const closeSearch = (): void => {
    setQuery('');
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  };
  const toggleCategory = (category: CatalogueCategory): void => {
    const setCollapsed = term === '' ? setCollapsedCategories : setSearchCollapsedCategories;
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  const inventory =
    session.mode === 'resolution' ? currentEditorAttempt(session).document.inventory : null;
  const drawerCards =
    inventory === null
      ? authorCatalogue.map(authorCard(currentEditorAttempt(session).document.goal))
      : inventory.flatMap(inventoryCards);
  // U21: a puzzle may give the player wires, laid with the author's gesture.
  const wireEntries = inventory?.filter((entry) => entry.type === 'wire') ?? [];
  const entryCount = drawerCards.length + wireEntries.length;
  const objectCountLabel =
    inventory === null
      ? `${String(drawerCards.length)} objets`
      : `${String(entryCount)} ${entryCount === 1 ? 'entrée' : 'entrées'}`;
  const isConstruction = session.phase === 'construction';
  const filteredCards = drawerCards.filter((card) =>
    searchText(`${card.name} ${card.accessibleName}`).includes(term),
  );
  const matchesWire = searchText('Fil de commande').includes(term);
  const filteredWireEntries = matchesWire ? wireEntries : [];
  const resultCount =
    filteredCards.length + (inventory === null && matchesWire ? 1 : filteredWireEntries.length);

  const renderCard = (card: DrawerCard) => {
    const isSelected = selectedObject === card.kind && selectedEntryKey === card.key;

    return (
      <button
        className={`object-card${isSelected ? ' object-card-selected' : ''}`}
        key={card.key}
        type="button"
        disabled={session.phase !== 'construction' || card.isDepleted}
        aria-label={card.accessibleName}
        aria-pressed={isSelected}
        title={card.detail}
        onClick={() => {
          onSelectKind(card.kind, card.source);
        }}
      >
        <span className="object-thumb" aria-hidden="true">
          <img src={spriteThumbnailPath(card.thumbnail)} alt="" draggable={false} />
        </span>
        <span className="object-card-copy">
          <strong>{card.name}</strong>
          <span>{card.detail}</span>
        </span>
        <span className="object-card-action" aria-hidden="true">
          {isSelected ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="object-drawer" aria-label="Objets disponibles">
        <div className="drawer-heading">
          <div>
            <h2>Catalogue</h2>
            <span className="object-count">{objectCountLabel}</span>
          </div>
          <button
            ref={searchButtonRef}
            type="button"
            className="drawer-search-toggle"
            aria-label={searchOpen ? 'Fermer la recherche' : 'Rechercher un objet'}
            aria-expanded={searchOpen}
            aria-controls={searchId}
            onClick={() => {
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
          >
            {searchOpen ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Search size={21} aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="drawer-search" id={searchId} hidden={!searchOpen}>
          <input
            ref={inputRef}
            type="search"
            aria-label="Rechercher dans le catalogue"
            placeholder="Rechercher un objet…"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSearchCollapsedCategories(new Set());
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeSearch();
              }
            }}
          />
        </div>

        <div className="drawer-content">
          <div
            className={inventory === null ? 'object-list object-list-author' : 'object-list'}
            id="object-list"
          >
            {inventory === null
              ? catalogueCategories.map((category, index) => {
                  const cards = filteredCards.filter((card) => card.category === category);
                  const hasWire = category === 'Commandes' && matchesWire;
                  if (cards.length === 0 && !hasWire) return null;
                  const collapsed = (
                    term === '' ? collapsedCategories : searchCollapsedCategories
                  ).has(category);
                  const groupId = `${searchId}-group-${String(index)}`;
                  return (
                    <div className="object-group" key={category} role="group" aria-label={category}>
                      <h3 className="object-group-title">
                        <button
                          type="button"
                          className="object-group-toggle"
                          aria-label={category}
                          aria-expanded={!collapsed}
                          aria-controls={groupId}
                          onClick={() => {
                            toggleCategory(category);
                          }}
                        >
                          <img
                            src={spriteThumbnailPath(categoryThumbnails[category])}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                          />
                          <span>{category === 'Ce qui bouge' ? 'Bouge' : category}</span>
                          <ChevronDown size={20} aria-hidden="true" />
                        </button>
                      </h3>
                      <div className="object-group-panel" data-expanded={!collapsed}>
                        <div
                          className="object-group-cards"
                          id={groupId}
                          aria-hidden={collapsed}
                          inert={collapsed}
                        >
                          {cards.map(renderCard)}
                          {hasWire && (
                            <WireCard
                              accessibleName="Fil de commande"
                              detail="Relie une commande à un appareil"
                              isActive={isWiringActive}
                              isDisabled={!isConstruction}
                              onSelect={() => {
                                onSelectWire();
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              : filteredCards.map(renderCard)}
            {filteredWireEntries.map((entry) => (
              <WireCard
                key={entry.id}
                accessibleName={`Fil de commande, quantité : ${String(entry.quantity)}`}
                detail={`Quantité : ${String(entry.quantity)}`}
                isActive={isWiringActive}
                isDisabled={!isConstruction || entry.quantity === 0}
                onSelect={() => {
                  onSelectWire(entry.id);
                }}
              />
            ))}
          </div>

          <p className="drawer-hint" aria-live="polite">
            {term === ''
              ? 'Choisis un objet pour le placer.'
              : resultCount === 0
                ? 'Aucun objet ne correspond à ta recherche.'
                : `${String(resultCount)} résultat${resultCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </section>
    </>
  );
}
