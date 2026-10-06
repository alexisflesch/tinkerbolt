import type { BoardDeviceView, BoardSimulationView } from '../presentation/board-renderer';
import type { SimulationSnapshot } from '../simulation/simulation-session';

/**
 * Collects what a running simulation moves — the ball, the seesaw's board,
 * a lever's handle, a conveyor's belt, a button's cap, a fan's blades, a
 * barrier's bar, a springboard's spring, a piston's rod and plate. The simulated document itself is
 * never rewritten: static parts keep reading their placement.
 */
export const simulationView = (simulation: SimulationSnapshot): BoardSimulationView => ({
  bodyPoses: new Map(
    simulation.bodies
      .filter((body) => body.role !== 'base')
      .map((body) => [body.placementId, { position: body.position, rotation: body.rotation }]),
  ),
  conveyorBelts: new Map(
    simulation.devices.flatMap((device) =>
      device.kind === 'conveyor'
        ? [[device.placementId, { offset: device.beltOffset, facing: device.facing }] as const]
        : [],
    ),
  ),
  devices: new Map(
    simulation.devices.flatMap((device): (readonly [string, BoardDeviceView])[] => {
      switch (device.kind) {
        case 'button':
          return [[device.placementId, { kind: 'button', pressed: device.pressed }]];
        case 'electro-magnet':
          return [[device.placementId, { kind: 'electro-magnet', active: device.active }]];
        case 'fan':
          return [[device.placementId, { kind: 'fan', bladeAngle: device.bladeAngle }]];
        case 'barrier':
          return [[device.placementId, { kind: 'barrier', retraction: device.retraction }]];
        case 'springboard':
          return [[device.placementId, { kind: 'springboard', compression: device.compression }]];
        case 'timer':
          return [
            [
              device.placementId,
              {
                kind: 'timer',
                remainingSeconds: device.remainingSeconds,
                handAngle: device.handAngle,
              },
            ],
          ];
        case 'piston':
          return [];
        case 'lever':
        case 'conveyor':
          return [];
      }
    }),
  ),
});
