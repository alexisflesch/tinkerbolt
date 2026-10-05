// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CampaignVictoryDialog, type CampaignVictory } from './CampaignVictoryDialog';

const victory = (overrides: Partial<CampaignVictory> = {}): CampaignVictory => ({
  tier: 'resolved',
  objectsUsed: 1,
  hasChallenge: true,
  hint: null,
  isNewRecord: false,
  onNextLevel: null,
  onRemix: null,
  ...overrides,
});

const renderDialog = (
  campaign: CampaignVictory,
  { onReplay = () => undefined, onClose = () => undefined } = {},
): HTMLElement => {
  render(<CampaignVictoryDialog campaign={campaign} onReplay={onReplay} onClose={onClose} />);
  return screen.getByRole('dialog', { name: 'Bravo !' });
};

/** Whether a tier of the row is lit, read from its text rather than its color. */
const tierItem = (dialog: HTMLElement, name: string): HTMLElement => {
  const tiers = within(dialog).getByRole('list', { name: 'Paliers' });
  const item = within(tiers)
    .getAllByRole('listitem')
    .find((candidate) => candidate.textContent.includes(name));
  if (item === undefined) throw new Error(`Palier ${name} introuvable.`);
  return item;
};

const expectEarned = (dialog: HTMLElement, name: string, earned: boolean): void => {
  const item = tierItem(dialog, name);
  expect(item).toHaveAttribute('data-earned', String(earned));
  expect(item).toHaveTextContent(earned ? `${name} obtenu` : `${name} non obtenu`);
};

describe('CampaignVictoryDialog — victoire de campagne (U4b)', () => {
  afterEach(() => {
    cleanup();
  });

  it('est une boîte modale nommée par son titre « Bravo ! »', () => {
    const dialog = renderDialog(victory());

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = within(dialog).getByRole('heading', { name: 'Bravo !' });
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(dialog).not.toHaveAttribute('aria-label');
  });

  it('affiche Bolt à côté du résumé sans ajouter de texte décoratif aux commandes', () => {
    const dialog = renderDialog(victory());
    const illustration = dialog.querySelector<HTMLElement>('.victory-bolt');
    const image = illustration?.querySelector('img');

    expect(illustration).not.toBeNull();
    expect(illustration).toHaveAttribute('aria-hidden', 'true');
    expect(illustration?.previousElementSibling).toHaveClass('victory-summary');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.getAttribute('src')).toBe('/assets/home/bolt-victoire.webp');
    expect(within(dialog).getByRole('button', { name: 'Recommencer' })).toBeVisible();
  });

  it('annonce le palier résolu et le nombre d’objets, sans objectif chiffré sans défi', () => {
    const dialog = renderDialog(victory({ objectsUsed: 1 }));

    expect(dialog).toHaveAttribute('data-level-tier', 'resolved');
    expectEarned(dialog, 'Résolu', true);
    expect(tierItem(dialog, 'Résolu').querySelector('svg.lucide-circle-check')).toBeInTheDocument();
    expectEarned(dialog, 'Élégant', false);
    expectEarned(dialog, 'Minimal', false);
    expect(within(dialog).getByText('Résolu avec 1 objet.')).toBeVisible();
    expect(within(dialog).queryByText(/Tu penses/)).not.toBeInTheDocument();
  });

  it('n’affiche que le palier Résolu pour un niveau sans défi (ADR 0010)', () => {
    const dialog = renderDialog(victory({ hasChallenge: false }));

    const tiers = within(dialog).getByRole('list', { name: 'Paliers' });
    expect(within(tiers).getAllByRole('listitem')).toHaveLength(1);
    expectEarned(dialog, 'Résolu', true);
    expect(tierItem(dialog, 'Résolu').querySelector('svg.lucide-circle-check')).toBeInTheDocument();
  });

  it('accorde le compte au pluriel et sans objet posé', () => {
    renderDialog(victory({ objectsUsed: 0 }));
    expect(screen.getByText('Résolu sans poser d’objet.')).toBeVisible();
    cleanup();

    renderDialog(victory({ objectsUsed: 7 }));
    expect(screen.getByText('Résolu avec 7 objets.')).toBeVisible();
  });

  it('propose la cible Élégant après une réussite non élégante (ADR 0010)', () => {
    const dialog = renderDialog(
      victory({ objectsUsed: 7, hint: { nextTier: 'elegant', objectCount: 5 } }),
    );

    expect(within(dialog).getByText('Tu penses pouvoir le faire avec 5 ?')).toBeVisible();
  });

  it('révèle le record Minimal après une réussite élégante', () => {
    const dialog = renderDialog(
      victory({
        tier: 'elegant',
        objectsUsed: 3,
        hint: { nextTier: 'minimal', objectCount: 2 },
      }),
    );

    expect(dialog).toHaveAttribute('data-level-tier', 'elegant');
    expectEarned(dialog, 'Résolu', true);
    expect(tierItem(dialog, 'Résolu').querySelector('svg.lucide-circle-check')).toBeInTheDocument();
    expectEarned(dialog, 'Élégant', true);
    expectEarned(dialog, 'Minimal', false);
    expect(within(dialog).getByText('Record à battre : avec 2 objets.')).toBeVisible();
  });

  it('ne demande rien de plus après Minimal, et signale un nouveau record', () => {
    const minimal = renderDialog(victory({ tier: 'minimal', objectsUsed: 2 }));
    expect(minimal).toHaveAttribute('data-level-tier', 'minimal');
    expectEarned(minimal, 'Résolu', true);
    expectEarned(minimal, 'Élégant', true);
    expectEarned(minimal, 'Minimal', true);
    expect(within(minimal).queryByText(/Tu penses|Record|record/)).not.toBeInTheDocument();
    cleanup();

    const record = renderDialog(victory({ tier: 'minimal', objectsUsed: 1, isNewRecord: true }));
    expect(within(record).getByText('Nouveau record : moins que le minimum connu !')).toBeVisible();
  });

  it('ouvre le niveau suivant, garde une seule commande Recommencer et ne renvoie plus à la liste', () => {
    const onNextLevel = vi.fn();
    const dialog = renderDialog(victory({ onNextLevel }));

    const next = within(dialog).getByRole('button', { name: 'Niveau suivant' });
    expect(next).toHaveFocus();
    fireEvent.click(next);
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    expect(within(dialog).getAllByRole('button', { name: /Recommencer/ })).toHaveLength(1);
    expect(within(dialog).queryByRole('button', { name: 'Retour aux niveaux' })).toBeNull();
  });

  it('n’offre pas de niveau suivant quand il n’y en a pas', () => {
    const dialog = renderDialog(victory({ onNextLevel: null }));

    expect(within(dialog).queryByRole('button', { name: 'Niveau suivant' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Recommencer' })).toHaveFocus();
  });

  it('recommence, ou se ferme pour voir la scène, au toucher comme au clavier', () => {
    const onReplay = vi.fn();
    const onClose = vi.fn();
    const dialog = renderDialog(victory(), { onReplay, onClose });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Recommencer' }));
    expect(onReplay).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Voir la scène' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('propose « Remixer » quand la victoire peut être remixée (M11)', () => {
    const onRemix = vi.fn();
    const dialog = renderDialog(victory({ onRemix }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remixer' }));

    expect(onRemix).toHaveBeenCalledTimes(1);
  });

  it('n’offre pas « Remixer » sans remix possible, et dit pourquoi un remix a échoué (M11)', () => {
    const dialog = renderDialog(victory({ onRemix: null }));
    expect(within(dialog).queryByRole('button', { name: 'Remixer' })).toBeNull();
    cleanup();

    const failed = renderDialog(
      victory({ onRemix: () => undefined, remixError: 'Le remix n’a pas pu être créé.' }),
    );
    expect(within(failed).getByRole('alert')).toHaveTextContent('Le remix n’a pas pu être créé.');
  });
});
