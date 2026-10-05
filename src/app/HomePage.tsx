import type { ReactNode } from 'react';
import { ChevronRight, Pencil, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

import { embeddedLevels } from '../content/embedded-levels';
import {
  publicAssetUrl,
  spriteThumbnailPath,
  type SpriteThumbnail,
} from '../presentation/sprite-loader';
import { AppFrame } from '../ui/AppFrame';
import { PwaInvitation } from '../ui/PwaInvitation';
import { withSolutionPlaced } from './home-hero';
import { LevelPreview } from './LevelPreview';
import { useCampaignProgress } from './use-campaign-progress';
import { usePwaInvitation } from './use-pwa-invitation';

/** The level shown beside the welcome text (V4): the fifth tutorial, else the last one. */
const heroSource = embeddedLevels.find(({ id }) => id === 'tuto-5') ?? embeddedLevels.at(-1);
/** Drawn solved, so that the picture shows a whole machine rather than its starting state. */
const heroLevel = heroSource === undefined ? undefined : withSolutionPlaced(heroSource);

/**
 * The chain of the fifth tutorial, as dotted arrows in world units over its
 * 16 × 9 scene: the blue ball is blown onto the springboard and bounces into
 * the lever; the mass then falls on the seesaw, which throws the red ball
 * into the basket. Decorative, and tied to that level's reference solution.
 */
const heroHints =
  heroSource?.id === 'tuto-5'
    ? [
        {
          path: 'M7.56 6.41 C9.16 6.21 10.33 6.69 10.96 8.26',
          head: 'M10.68 8.03 L10.96 8.26 L11 7.9',
        },
        {
          path: 'M11.33 8.23 C11.95 7.97 12.28 7.8 12.42 7.6',
          head: 'M12.38 7.96 L12.42 7.6 L12.1 7.76',
        },
        {
          path: 'M2.65 2.63 C1.29 2.85 0.64 4.56 0.64 6.29',
          head: 'M0.47 5.97 L0.64 6.29 L0.81 5.97',
        },
        {
          path: 'M3.51 6.44 C6.01 0.85 12.02 0.57 14.35 3.3',
          head: 'M14.01 3.17 L14.35 3.3 L14.28 2.95',
        },
      ]
    : [];

const boltIllustration = publicAssetUrl('/assets/home/bolt.webp', import.meta.env.BASE_URL);

interface PlaceProps {
  /** The campaign: on a narrow screen, where the hero's buttons are hidden, it is the main call. */
  readonly primary?: boolean;
  readonly to: string;
  readonly title: string;
  readonly text: string;
  readonly sprite: SpriteThumbnail;
  readonly children?: ReactNode;
}

/** One of the three destinations below the welcome text, illustrated by a sprite. */
function Place({ primary = false, to, title, text, sprite, children }: PlaceProps) {
  return (
    <Link className={primary ? 'home-place home-place-primary' : 'home-place'} to={to}>
      <span className="home-place-art">
        <img src={spriteThumbnailPath(sprite)} alt="" draggable={false} />
      </span>
      <span className="home-place-copy">
        <h3>{title}</h3>
        <p>{text}</p>
        {children}
      </span>
      <span className="home-place-go" aria-hidden="true">
        <ChevronRight size={20} />
      </span>
    </Link>
  );
}

/**
 * `/` (V7, identité visuelle du 5 octobre 2026): the workshop scene with one call
 * to play, then the three places.
 */
export function HomePage() {
  const { levels, loading, known, storageError, storageWarning } = useCampaignProgress();
  const pwaInvitation = usePwaInvitation(null);
  const resolvedCount = embeddedLevels.filter(
    (level) => levels[level.id]?.resolved === true,
  ).length;
  const total = embeddedLevels.length;

  return (
    <AppFrame variant="page">
      <div className="page-content home-page">
        {pwaInvitation !== null && (
          <PwaInvitation
            kind={pwaInvitation.kind}
            onAccept={pwaInvitation.onAccept}
            onDismiss={pwaInvitation.onDismiss}
          />
        )}
        <section className="home-hero" aria-labelledby="home-title">
          <span className="home-prop home-prop-plans" aria-hidden="true" />
          <span className="home-shelf" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="home-prop home-prop-screwdriver" aria-hidden="true" />
          <span className="home-prop home-prop-bolts" aria-hidden="true" />
          <div className="home-stage">
            <div className="home-sheet">
              <div className="home-hero-copy">
                <h2 id="home-title">
                  Amène la balle
                  <br />
                  <em>jusqu’au panier.</em>
                </h2>
                <p>
                  Poutres, tremplins, ventilateurs, leviers&nbsp;: place les pièces, lance la
                  machine et regarde ce qui se passe. Raté&nbsp;? Ajuste et relance.
                </p>
                <div className="home-hero-actions">
                  <Link className="home-play" to="/levels">
                    <Play size={22} aria-hidden="true" />
                    Jouer
                  </Link>
                  <Link className="home-create" to="/editor">
                    <Pencil size={18} aria-hidden="true" />
                    Créer un niveau
                  </Link>
                </div>
              </div>
            </div>
            {heroLevel !== undefined && (
              <div className="home-frame">
                <div
                  className="home-board"
                  role="img"
                  aria-label={`Aperçu du niveau « ${heroLevel.metadata.title} »`}
                >
                  <div className="home-board-scene">
                    <LevelPreview document={heroLevel} />
                    <svg className="home-hints" viewBox="0 0 16 9" aria-hidden="true">
                      {heroHints.map(({ path, head }) => (
                        <g key={path}>
                          <path className="home-hint-trail" d={path} />
                          <path d={head} />
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            )}
            <figure className="home-bolt" aria-hidden="true">
              <img src={boltIllustration} alt="" draggable={false} />
            </figure>
          </div>
        </section>

        <div className="home-places-zone">
          <span className="home-prop home-prop-square" aria-hidden="true" />
          <nav className="home-places" aria-label="Explorer TinkerBolt">
            <Place
              primary
              to="/levels"
              title="Campagne"
              text="Sept niveaux pour découvrir chaque pièce."
              sprite="basket"
            >
              <div className="home-meter">
                {known && (
                  <progress
                    aria-label="Progression de la campagne"
                    value={resolvedCount}
                    max={total}
                  />
                )}
                <span>
                  {loading
                    ? 'Chargement…'
                    : known
                      ? `${String(resolvedCount)} / ${String(total)}`
                      : 'Progression inconnue'}
                </span>
              </div>
            </Place>
            <Place
              to="/editor"
              title="Atelier"
              text="Construis ton propre niveau, teste-le, puis envoie-le à qui tu veux."
              sprite="lever"
            />
            <Place
              to="/my-levels"
              title="Mes niveaux"
              text="Tes créations et les niveaux qu’on t’a envoyés."
              sprite="box-wood"
            />
          </nav>

          {(storageError !== null || storageWarning !== null) && (
            <p className="home-storage-note" role="status">
              {storageError !== null
                ? 'La progression ne peut pas être enregistrée sur cet appareil.'
                : 'Une ancienne sauvegarde illisible a été mise de côté.'}
            </p>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
