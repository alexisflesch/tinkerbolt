import { describe, expect, it } from 'vitest';

import { modifiedOn, receivedOn } from './modified-on';

describe('modifiedOn — date de modification d’une création (V6)', () => {
  const today = new Date(2026, 9, 2, 15, 0);

  it('écrit le jour (1er pour le premier) et le mois en toutes lettres pour une date de l’année en cours', () => {
    expect(modifiedOn(new Date(2026, 9, 2, 9, 30).toISOString(), today)).toBe(
      'Modifié le 2 octobre',
    );
    expect(modifiedOn(new Date(2026, 0, 1, 0, 5).toISOString(), today)).toBe(
      'Modifié le 1er janvier',
    );
  });

  it('ajoute l’année quand la date n’est pas de l’année en cours', () => {
    expect(modifiedOn(new Date(2025, 11, 31, 23, 0).toISOString(), today)).toBe(
      'Modifié le 31 décembre 2025',
    );
  });

  it('ne dit rien d’une date illisible', () => {
    expect(modifiedOn('pas une date', today)).toBeUndefined();
  });

  it('emploie « Reçu le » pour la réception, avec les mêmes règles de date', () => {
    expect(receivedOn(new Date(2026, 9, 1, 12).toISOString(), today)).toBe('Reçu le 1er octobre');
    expect(receivedOn(new Date(2025, 8, 3, 12).toISOString(), today)).toBe(
      'Reçu le 3 septembre 2025',
    );
    expect(receivedOn('illisible', today)).toBeUndefined();
  });
});
