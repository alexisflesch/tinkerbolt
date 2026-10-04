import { describe, expect, it } from 'vitest';

import {
  createObjectFamilyRegistry,
  initialObjectFamilyRegistry,
  type ObjectFamilyDefinition,
} from './object-family-registry';

describe('registre des familles d’objet', () => {
  it('enregistre les familles du catalogue dans l’ordre du tiroir', () => {
    expect(initialObjectFamilyRegistry.definitions.map(({ id }) => id)).toEqual([
      'ball',
      'basket',
      'beam',
      'seesaw',
      'mass',
      'box',
      'lever',
      'conveyor',
      'button',
      'fan',
      'electro-magnet',
      'piston',
      'timer',
      'barrier',
      'springboard',
    ]);
    expect(initialObjectFamilyRegistry.get('mass')?.catalogue.label).toBe('Masse');
    expect(initialObjectFamilyRegistry.get('fan')?.catalogue.label).toBe('Ventilateur');
    expect(initialObjectFamilyRegistry.get('springboard')?.catalogue.label).toBe('Tremplin');
    expect(initialObjectFamilyRegistry.get('piston')?.catalogue.label).toBe('Piston');
    expect(initialObjectFamilyRegistry.get('timer')?.catalogue.label).toBe('Minuteur');

    expect(initialObjectFamilyRegistry.get('ball')?.catalogue.label).toBe('Balle');
    expect(initialObjectFamilyRegistry.get('basket')?.catalogue.label).toBe('Panier');
    expect(initialObjectFamilyRegistry.get('beam')?.catalogue.label).toBe('Poutre');
    expect(initialObjectFamilyRegistry.get('seesaw')?.catalogue.label).toBe('Bascule');
    expect(initialObjectFamilyRegistry.get('unknown')).toBeUndefined();
  });

  it('porte les capacités minimales déjà requises par le domaine', () => {
    expect(initialObjectFamilyRegistry.get('ball')?.capabilities).toEqual(['movable']);
    expect(initialObjectFamilyRegistry.get('basket')?.capabilities).toEqual(['movable', 'sensor']);
    expect(initialObjectFamilyRegistry.get('beam')?.capabilities).toEqual([
      'movable',
      'rotatable',
      'sized',
    ]);
    expect(initialObjectFamilyRegistry.get('seesaw')?.capabilities).toEqual(['movable']);
    expect(initialObjectFamilyRegistry.get('mass')?.capabilities).toEqual(['movable']);
    expect(initialObjectFamilyRegistry.get('button')?.capabilities).toEqual(['movable', 'sensor']);
  });

  it('valide les propriétés sérialisables propres à chaque famille', () => {
    const ball = initialObjectFamilyRegistry.get('ball');
    const basket = initialObjectFamilyRegistry.get('basket');
    const beam = initialObjectFamilyRegistry.get('beam');
    const seesaw = initialObjectFamilyRegistry.get('seesaw');

    expect(ball?.propertiesSchema.safeParse({}).success).toBe(true);
    expect(basket?.propertiesSchema.safeParse({}).success).toBe(true);
    expect(seesaw?.propertiesSchema.safeParse({}).success).toBe(true);
    const piston = initialObjectFamilyRegistry.get('piston');
    const timer = initialObjectFamilyRegistry.get('timer');
    expect(piston?.propertiesSchema.safeParse({}).success).toBe(true);
    expect(piston?.propertiesSchema.safeParse({ state: 'on' }).success).toBe(false);
    for (const delaySeconds of [1, 3, 10]) {
      expect(timer?.propertiesSchema.safeParse({ delaySeconds }).success).toBe(true);
    }
    for (const delaySeconds of [0, 11, 1.5]) {
      expect(timer?.propertiesSchema.safeParse({ delaySeconds }).success).toBe(false);
    }
    expect(timer?.propertiesSchema.safeParse({}).success).toBe(false);
    expect(ball?.propertiesSchema.safeParse({ color: 'red' }).success).toBe(false);

    for (const size of ['short', 'medium', 'long']) {
      expect(beam?.propertiesSchema.safeParse({ size }).success).toBe(true);
    }
    expect(beam?.propertiesSchema.safeParse({ size: 'extra-long' }).success).toBe(false);
    expect(beam?.propertiesSchema.safeParse({}).success).toBe(false);

    const mass = initialObjectFamilyRegistry.get('mass');
    expect(mass?.propertiesSchema.safeParse({ weight: '10kg' }).success).toBe(true);
    expect(mass?.propertiesSchema.safeParse({}).success).toBe(false);

    const lever = initialObjectFamilyRegistry.get('lever');
    for (const position of ['left', 'center', 'right']) {
      expect(lever?.propertiesSchema.safeParse({ position }).success).toBe(true);
    }
    const conveyor = initialObjectFamilyRegistry.get('conveyor');
    for (const direction of ['left', 'stopped', 'right']) {
      expect(conveyor?.propertiesSchema.safeParse({ direction }).success).toBe(true);
    }
    expect(conveyor?.propertiesSchema.safeParse({ direction: 'up' }).success).toBe(false);
  });

  it('refuse les identifiants de famille dupliqués', () => {
    const ball = initialObjectFamilyRegistry.get('ball');
    expect(ball).toBeDefined();
    if (ball === undefined) return;

    expect(() => createObjectFamilyRegistry([ball, ball])).toThrow(
      'La famille d’objet « ball » est déjà enregistrée.',
    );
  });

  it('valide les définitions compilées lors de la création du registre', () => {
    const ball = initialObjectFamilyRegistry.get('ball');
    expect(ball).toBeDefined();
    if (ball === undefined) return;

    const invalidDefinition: ObjectFamilyDefinition = {
      id: 'invalid-family',
      dataVersion: 0,
      catalogue: { label: '', description: '' },
      capabilities: ['movable', 'movable'],
      propertiesSchema: ball.propertiesSchema,
    };

    expect(() => createObjectFamilyRegistry([invalidDefinition])).toThrow();
  });
});
