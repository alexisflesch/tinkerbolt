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
import { HomeMachine } from './HomeMachine';
import { useCampaignProgress } from './use-campaign-progress';
import { usePwaInvitation } from './use-pwa-invitation';

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
            <div className="home-frame">
              <HomeMachine />
            </div>
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
