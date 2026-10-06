import {
  machineFromWorkshop,
  verifyPuzzle,
  type PuzzleRefusalReason,
  type PuzzleRunner,
} from '../application/puzzle/puzzle-workshop';
import { authorSchema, levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { encodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import { encodeShareFragment } from '../infrastructure/level-share/level-share-codec';
import { runLevelOutcome } from '../simulation/level-outcome';

/** ADR 0020: the two kinds of level the export dialog offers. */
export type LevelExportKind = 'puzzle' | 'machine';

type LevelExportPreparation =
  | {
      /** Both kinds are available. */
      readonly status: 'ready';
      /** The verified puzzle: the file holds it, and so does the share link. */
      readonly puzzle: LevelDocument;
      /** The same workshop as a machine to watch, nothing to place. */
      readonly machine: LevelDocument;
      readonly fileName: string;
      readonly mimeType: string;
      readonly fileText: string;
    }
  | {
      /** The puzzle is refused (`refusal`), the machine is still available. */
      readonly status: 'machine-only';
      readonly refusal: string;
      readonly machine: LevelDocument;
      readonly mimeType: string;
    }
  | { readonly status: 'invalid'; readonly reasons: readonly string[] };

const refusalMessages: Readonly<Record<PuzzleRefusalReason, string>> = {
  'no-complete-goal':
    'L’objectif est incomplet : pose la balle rouge et le panier depuis le catalogue.',
  'no-object-to-place':
    'Aucun objet n’est à placer : sélectionne chaque objet que le joueur devra poser, puis choisis « À placer » dans ses propriétés.',
  'invalid-puzzle': 'Le puzzle obtenu depuis l’atelier n’est pas un niveau valide.',
  'solution-not-playable':
    'Le joueur ne pourrait pas poser tous les objets à placer là où ils sont : garde-les dans une zone de construction.',
  'solution-does-not-win':
    'La machine complète ne gagne pas : avec tous les objets en place, la balle doit atteindre le panier.',
  'wins-without-player':
    'La balle atteint le panier sans les objets à placer : le joueur n’aurait rien à faire.',
};

/** U22: why the workshop cannot be played or exported as a puzzle, in the author's words. */
export const puzzleRefusalMessage = (reason: PuzzleRefusalReason): string =>
  refusalMessages[reason];

const MIME_TYPE = 'application/json';

/**
 * U16, U22 (ADR 0013, 0020): validates the author's committed workshop, turns
 * it into a puzzle and checks it by deterministic simulation. A refused puzzle
 * leaves the machine, available for any valid document. The schema messages
 * are already written for people, so they are shown as-is, without duplicates.
 * `run` is injected for tests.
 */
export const prepareLevelExport = (
  document: LevelDocument,
  run: PuzzleRunner = runLevelOutcome,
): LevelExportPreparation => {
  const validation = levelDocumentSchema.safeParse(document);
  if (!validation.success) {
    return {
      status: 'invalid',
      reasons: [...new Set(validation.error.issues.map(({ message }) => message))],
    };
  }

  const machine = machineFromWorkshop(validation.data);
  const verification = verifyPuzzle(validation.data, run);
  if (verification.status === 'refused') {
    return {
      status: 'machine-only',
      refusal: refusalMessages[verification.reason],
      machine,
      mimeType: MIME_TYPE,
    };
  }

  return {
    status: 'ready',
    puzzle: verification.puzzle,
    machine,
    fileName: `${verification.puzzle.id}.json`,
    mimeType: MIME_TYPE,
    fileText: encodeLevelFile(verification.puzzle),
  };
};

type NamedLevelExport = Readonly<{
  readonly puzzle: LevelDocument;
  readonly fileName: string;
  readonly fileText: string;
}>;

/** Mirrors the level identifier's length limit (`level-document.ts`). */
const MAX_LEVEL_ID_LENGTH = 128;

/** « Le Grand Saut de l’été ! » → `le-grand-saut-de-l-ete`: accents dropped, the rest dashed. */
const levelIdFromName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_LEVEL_ID_LENGTH)
    .replace(/^-+|-+$/g, '');

/**
 * M14 (ADR 0016 § Pseudo): why the pseudonym typed in the export dialog is
 * refused, in the schema's words, once its edge spaces are removed; `null`
 * when it is accepted. A blank field means no author, which is accepted.
 */
export const pseudoRefusal = (pseudo: string): string | null => {
  const author = pseudo.trim();
  if (author === '') return null;
  const validation = authorSchema.safeParse(author);
  return validation.success ? null : (validation.error.issues[0]?.message ?? null);
};

/** The metadata once the typed pseudonym is applied: trimmed, and removed when blank (M14). */
const withPseudo = (
  metadata: LevelDocument['metadata'],
  pseudo: string | undefined,
): LevelDocument['metadata'] => {
  if (pseudo === undefined) return metadata;
  const { author: ignoredAuthor, ...metadataWithoutAuthor } = metadata;
  void ignoredAuthor;
  const author = pseudo.trim();
  return author === '' ? metadataWithoutAuthor : { ...metadataWithoutAuthor, author };
};

/** The metadata once the typed description is applied: trimmed, and removed when blank (M14b). */
const withDescription = (
  metadata: LevelDocument['metadata'],
  typed: string | undefined,
): LevelDocument['metadata'] => {
  if (typed === undefined) return metadata;
  const { description: ignoredDescription, ...metadataWithoutDescription } = metadata;
  void ignoredDescription;
  const description = typed.trim();
  return description === ''
    ? metadataWithoutDescription
    : { ...metadataWithoutDescription, description };
};

/**
 * Names the verified puzzle (or the machine) before it leaves the workshop: the name becomes
 * its title, and its identifier and file name when it holds a letter or a
 * digit. A blank name is refused (`null`). When `pseudo` is given, it becomes
 * the author, edge spaces removed, or removes it when blank (M14); an invalid
 * pseudonym is refused (`null`). `description` follows the same rule (M14b).
 */
export const nameExportedLevel = (
  puzzle: LevelDocument,
  name: string,
  pseudo?: string,
  description?: string,
): NamedLevelExport | null => {
  const title = name.trim();
  if (title === '') return null;

  const id = levelIdFromName(title);
  const validation = levelDocumentSchema.safeParse({
    ...puzzle,
    id: id === '' ? puzzle.id : id,
    metadata: withDescription(withPseudo({ ...puzzle.metadata, title }, pseudo), description),
  });
  if (!validation.success) return null;
  return {
    puzzle: validation.data,
    fileName: `${validation.data.id}.json`,
    fileText: encodeLevelFile(validation.data),
  };
};

/** `/shared` under the app's base path (ADR 0008 amendment), followed by the L23 fragment. */
export const buildShareUrl = (fragment: string, origin: string, basePath: string): string =>
  `${origin}${basePath.endsWith('/') ? basePath : `${basePath}/`}shared${fragment}`;

/** Encodes a level with the L23 codec and returns its absolute share link. */
export const createShareLink = async (
  document: LevelDocument,
  origin: string,
  basePath: string,
): Promise<string> => buildShareUrl(await encodeShareFragment(document), origin, basePath);
