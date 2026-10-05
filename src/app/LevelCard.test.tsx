// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Copy, Pencil, Play, Share2, Trash2 } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { embeddedLevels } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import { LevelCard } from './LevelCard';
import type { LevelPreviewCache } from './level-preview-cache';

const tutorial = (index: number): LevelDocument => {
  const level = embeddedLevels[index];
  if (level === undefined) throw new Error(`Tutoriel ${String(index + 1)} introuvable.`);
  return level;
};

const withMetadata = (
  document: LevelDocument,
  metadata: Partial<LevelDocument['metadata']>,
): LevelDocument => ({ ...document, metadata: { ...document.metadata, ...metadata } });

/** A preview cache that always answers with the same picture, jsdom having no canvas. */
const fakeCache: LevelPreviewCache = {
  acquire: () => Promise.resolve({ url: 'blob:apercu', release: () => undefined }),
};

/** jsdom lays nothing out: give the preview frame a 16:9 size so that it asks for its image. */
const sizeFrames = (): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 320,
    height: 180,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 320,
    bottom: 180,
    toJSON: () => ({}),
  });
};

const card = (name: string): HTMLElement => screen.getByRole('region', { name });

describe('LevelCard — carte de niveau commune (V6)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('nomme la région par son libellé, ou à défaut par le titre du niveau', () => {
    const level = tutorial(0);
    render(
      <>
        <LevelCard document={level} label="Niveau 1" actions={[]} />
        <LevelCard document={withMetadata(level, { title: 'Autre' })} actions={[]} />
      </>,
    );

    expect(card('Niveau 1')).toBeVisible();
    expect(card('Autre')).toBeVisible();
    expect(within(card('Niveau 1')).getByRole('heading', { name: level.metadata.title })).toBe(
      within(card('Niveau 1')).getByRole('heading', { level: 3 }),
    );
  });

  it('montre l’aperçu du niveau en image décorative, sans texte alternatif', async () => {
    sizeFrames();
    render(<LevelCard document={tutorial(0)} actions={[]} previewCache={fakeCache} />);

    const image = await within(card(tutorial(0).metadata.title)).findByRole('presentation');
    expect(image).toHaveAttribute('src', 'blob:apercu');
    expect(image).toHaveAttribute('alt', '');
  });

  it('pose le numéro en surimpression de l’aperçu quand le niveau est numéroté', () => {
    const { rerender } = render(<LevelCard document={tutorial(0)} number={3} actions={[]} />);
    expect(card(tutorial(0).metadata.title).querySelector('.level-card-number')).toHaveTextContent(
      '3',
    );

    rerender(<LevelCard document={tutorial(0)} actions={[]} />);
    expect(card(tutorial(0).metadata.title).querySelector('.level-card-number')).toBeNull();
  });

  it('garde l’inclinaison et la fixation du niveau lors des mises à jour et du remontage', () => {
    const level = tutorial(0);
    const { rerender, unmount } = render(<LevelCard document={level} actions={[]} />);
    const style = card(level.metadata.title).getAttribute('style');
    const attachment = card(level.metadata.title).querySelector('.level-card-attachment');
    expect(style).toContain('--card-tilt:');
    expect(attachment).toHaveAttribute('aria-hidden', 'true');
    const attachmentClass = attachment?.className;

    rerender(
      <LevelCard
        document={withMetadata(level, { title: 'Renommé' })}
        tier="resolved"
        actions={[]}
      />,
    );
    expect(card('Renommé').getAttribute('style')).toBe(style);
    expect(card('Renommé').querySelector('.level-card-attachment')?.className).toBe(
      attachmentClass,
    );
    unmount();
    render(<LevelCard document={level} actions={[]} />);
    expect(card(level.metadata.title).getAttribute('style')).toBe(style);
  });

  it('expose le numéro et le palier en attributs de données', () => {
    render(<LevelCard document={tutorial(0)} number={4} tier="elegant" actions={[]} />);

    const region = card(tutorial(0).metadata.title);
    expect(region).toHaveAttribute('data-level-number', '04');
    expect(region).toHaveAttribute('data-level-tier', 'elegant');
  });

  it.each([
    ['resolved', 'Résolu'],
    ['elegant', 'Élégant'],
    ['minimal', 'Minimal'],
  ] as const)('affiche le palier « %s » en pastille « %s » avec son icône', (tier, label) => {
    render(<LevelCard document={tutorial(0)} tier={tier} actions={[]} />);

    const badge = within(card(tutorial(0).metadata.title)).getByText(label);
    expect(badge).toHaveClass('level-card-tier', `level-card-tier-${tier}`);
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('écrit « Résolu · n objets » pour un niveau reçu résolu, au singulier à un objet', () => {
    const { rerender } = render(
      <LevelCard document={tutorial(0)} tier="resolved" objectCount={4} actions={[]} />,
    );
    expect(screen.getByText('Résolu · 4 objets')).toBeVisible();

    rerender(<LevelCard document={tutorial(0)} tier="resolved" objectCount={1} actions={[]} />);
    expect(screen.getByText('Résolu · 1 objet')).toBeVisible();
  });

  it('n’affiche aucune pastille sans palier, et garde l’état « pas encore résolu » pour les lecteurs d’écran', () => {
    render(<LevelCard document={tutorial(0)} actions={[]} assistiveStatus="Pas encore résolu" />);

    const region = card(tutorial(0).metadata.title);
    expect(region.querySelector('.level-card-tier')).toBeNull();
    expect(region).not.toHaveAttribute('data-level-tier');
    expect(within(region).getByText('Pas encore résolu')).toHaveClass('visually-hidden');
  });

  it('affiche l’auteur et la première source en texte brut quand on le demande', () => {
    const level = withMetadata(tutorial(0), {
      title: 'Titre',
      author: '<i>Lili</i>',
      basedOn: [
        { title: 'La chute', author: 'Max' },
        { title: 'Plus ancien', author: 'Zoé' },
      ],
    });
    const { rerender } = render(<LevelCard document={level} showAttribution actions={[]} />);

    const region = card('Titre');
    expect(within(region).getByText('par <i>Lili</i>')).toBeVisible();
    expect(within(region).getByText('d’après La chute (par Max)')).toBeVisible();
    expect(within(region).queryByText(/Plus ancien/u)).toBeNull();
    expect(region.querySelector('i')).toBeNull();

    rerender(<LevelCard document={level} actions={[]} />);
    expect(within(card('Titre')).queryByText(/^par /u)).toBeNull();
  });

  it('écrit une ligne d’information sous le titre (« Modifié le … »), et rien sans elle', () => {
    const { rerender } = render(
      <LevelCard document={tutorial(0)} meta="Modifié le 2 octobre" actions={[]} />,
    );
    expect(within(card(tutorial(0).metadata.title)).getByText('Modifié le 2 octobre')).toHaveClass(
      'level-card-meta',
    );

    rerender(<LevelCard document={tutorial(0)} actions={[]} />);
    expect(card(tutorial(0).metadata.title).querySelector('.level-card-meta')).toBeNull();
  });

  it('n’affiche pas de ligne d’auteur quand le niveau n’a ni auteur ni source', () => {
    const level = tutorial(0);
    render(
      <LevelCard
        document={{ ...level, metadata: { title: level.metadata.title } }}
        showAttribution
        actions={[]}
      />,
    );

    expect(card(level.metadata.title).querySelector('.level-card-attribution')).toBeNull();
  });

  it('montre la description en texte brut, et rien sans description', () => {
    const level = tutorial(0);
    const { rerender } = render(
      <LevelCard
        document={withMetadata(level, { description: 'Pousse <b>x</b> dans le panier.' })}
        actions={[]}
      />,
    );
    const description = screen.getByText('Pousse <b>x</b> dans le panier.');
    expect(description).toHaveClass('level-card-description');
    expect(description.querySelector('b')).toBeNull();

    rerender(
      <LevelCard document={{ ...level, metadata: { title: level.metadata.title } }} actions={[]} />,
    );
    expect(card(level.metadata.title).querySelector('.level-card-description')).toBeNull();
  });

  it('met en valeur la note « Esquisse non calibrée. » d’une description', () => {
    render(
      <LevelCard
        document={withMetadata(tutorial(0), {
          description: 'Esquisse non calibrée. Une chute simple.',
        })}
        actions={[]}
      />,
    );

    expect(screen.getByText('Esquisse non calibrée.')).toHaveClass('level-card-sketch-note');
    expect(screen.getByText(/Une chute simple\./u)).toHaveClass('level-card-description');
  });

  it('propose une action principale avec icône, libellé visible et nom accessible précis', () => {
    const onSelect = vi.fn();
    render(
      <LevelCard
        document={tutorial(0)}
        number={1}
        label="Niveau 1"
        primary={{ label: 'Jouer', name: 'Jouer le niveau 1', icon: Play, onSelect }}
        actions={[]}
      />,
    );

    const button = within(card('Niveau 1')).getByRole('button', { name: 'Jouer le niveau 1' });
    expect(button).toHaveTextContent('Jouer');
    expect(button).toHaveClass('btn-go');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('prend le libellé de l’action principale pour nom accessible à défaut de nom précis', () => {
    render(
      <LevelCard
        document={tutorial(0)}
        primary={{ label: 'Modifier', icon: Pencil, onSelect: () => undefined }}
        actions={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Modifier' })).toHaveTextContent('Modifier');
  });

  it('range les actions secondaires en boutons-icônes nommés, avec une infobulle', () => {
    const onShare = vi.fn();
    render(
      <LevelCard
        document={tutorial(0)}
        number={1}
        label="Niveau 1"
        actions={[
          {
            label: 'Modifier dans l’Atelier',
            name: 'Modifier le niveau 1',
            icon: Pencil,
            onSelect: () => undefined,
          },
          { label: 'Partager', icon: Share2, onSelect: onShare },
          { label: 'Dupliquer', icon: Copy, onSelect: () => undefined },
          { label: 'Supprimer', icon: Trash2, onSelect: () => undefined, danger: true },
        ]}
      />,
    );

    const region = card('Niveau 1');
    const edit = within(region).getByRole('button', { name: 'Modifier le niveau 1' });
    expect(edit).toHaveAttribute('title', 'Modifier dans l’Atelier');
    expect(edit).toHaveTextContent('');
    expect(edit.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    const share = within(region).getByRole('button', { name: 'Partager' });
    expect(share).toHaveAttribute('title', 'Partager');
    expect(share).toHaveTextContent('');
    fireEvent.click(share);
    expect(onShare).toHaveBeenCalledTimes(1);

    expect(within(region).getByRole('button', { name: 'Supprimer' })).toHaveClass(
      'level-card-tool-danger',
    );
    expect(within(region).getAllByRole('button')).toHaveLength(4);
  });

  describe('aperçu cliquable', () => {
    const hitArea = (region: HTMLElement): HTMLElement | null =>
      region.querySelector<HTMLElement>('.level-card-thumb-action');

    it('déclenche l’action principale, sans second arrêt de tabulation ni second bouton nommé', () => {
      const onSelect = vi.fn();
      render(
        <LevelCard
          document={tutorial(0)}
          label="Niveau 1"
          primary={{ label: 'Jouer', name: 'Jouer le niveau 1', icon: Play, onSelect }}
          actions={[]}
        />,
      );

      const region = card('Niveau 1');
      const area = hitArea(region);
      if (area === null) throw new Error('Aperçu cliquable introuvable.');
      expect(area).toHaveAttribute('tabindex', '-1');
      expect(area).toHaveAttribute('aria-hidden', 'true');
      expect(within(region).getAllByRole('button')).toHaveLength(1);

      fireEvent.click(area);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('n’est pas cliquable sans action principale, ni quand elle est indisponible', () => {
      const { rerender } = render(<LevelCard document={tutorial(0)} label="A" actions={[]} />);
      expect(hitArea(card('A'))).toBeNull();

      rerender(
        <LevelCard
          document={tutorial(0)}
          label="A"
          primary={{ label: 'Jouer', icon: Play, onSelect: vi.fn(), disabled: true }}
          actions={[]}
        />,
      );
      expect(hitArea(card('A'))).toBeNull();

      rerender(
        <LevelCard
          document={tutorial(0)}
          label="A"
          locked
          primary={{ label: 'Jouer', icon: Play, onSelect: vi.fn() }}
          actions={[]}
        />,
      );
      expect(hitArea(card('A'))).toBeNull();
    });
  });

  it('désactive une action qui l’est', () => {
    const onSelect = vi.fn();
    render(
      <LevelCard
        document={tutorial(0)}
        primary={{ label: 'Jouer', icon: Play, onSelect, disabled: true }}
        actions={[{ label: 'Partager', icon: Share2, onSelect, disabled: true }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Jouer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Partager' })).toBeDisabled();
  });

  describe('niveau verrouillé', () => {
    const lockedCard = (extra: { availableWhenLocked?: boolean } = {}) => (
      <LevelCard
        document={tutorial(0)}
        number={2}
        label="Niveau 2"
        locked
        tier="elegant"
        primary={{ label: 'Jouer', name: 'Jouer le niveau 2', icon: Play, onSelect: vi.fn() }}
        actions={[
          { label: 'Modifier', name: 'Modifier le niveau 2', icon: Pencil, onSelect: vi.fn() },
          { label: 'Supprimer', icon: Trash2, onSelect: vi.fn(), ...extra },
        ]}
      />
    );

    it('grise la carte par une classe et pose le badge « Verrouillé » sur l’aperçu', () => {
      render(lockedCard());

      const region = card('Niveau 2');
      expect(region).toHaveClass('level-card-locked');
      expect(region.querySelector('.level-card-lock')).toHaveTextContent('Verrouillé');
      expect(within(region).getAllByText('Verrouillé')).toHaveLength(1);
      expect(region.querySelector('.level-card-tier')).toBeNull();
    });

    it('désactive toutes les actions', () => {
      render(lockedCard());

      const region = card('Niveau 2');
      for (const button of within(region).getAllByRole('button')) expect(button).toBeDisabled();
    });

    it('garde disponible une action qui doit le rester (supprimer une création verrouillée)', () => {
      render(lockedCard({ availableWhenLocked: true }));

      const region = card('Niveau 2');
      expect(within(region).getByRole('button', { name: 'Supprimer' })).toBeEnabled();
      expect(within(region).getByRole('button', { name: 'Modifier le niveau 2' })).toBeDisabled();
    });

    it('n’a ni classe ni badge de verrou quand le niveau est ouvert', () => {
      render(<LevelCard document={tutorial(0)} actions={[]} />);

      const region = card(tutorial(0).metadata.title);
      expect(region).not.toHaveClass('level-card-locked');
      expect(region.querySelector('.level-card-lock')).toBeNull();
    });
  });

  it('ne dessine l’aperçu qu’une fois la carte proche de l’écran (aperçu paresseux conservé)', async () => {
    sizeFrames();
    const observed: { callback: (entries: { isIntersecting: boolean }[]) => void }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          observed.push({ callback });
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const acquire = vi.fn(fakeCache.acquire);
    render(<LevelCard document={tutorial(0)} actions={[]} previewCache={{ acquire }} />);
    expect(acquire).not.toHaveBeenCalled();

    act(() => {
      for (const { callback } of observed) callback([{ isIntersecting: true }]);
    });
    expect(await screen.findByRole('presentation')).toBeInTheDocument();
    expect(acquire).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
