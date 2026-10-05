import type { ReactNode } from 'react';
import { Play, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import { embeddedLevels } from '../content/embedded-levels';
import { spriteThumbnailPath, type SpriteThumbnail } from '../presentation/sprite-loader';
import { AppFrame } from '../ui/AppFrame';
import { PwaInvitation } from '../ui/PwaInvitation';
import { LevelPreview } from './LevelPreview';
import { useCampaignProgress } from './use-campaign-progress';
import { usePwaInvitation } from './use-pwa-invitation';

/** The level shown beside the welcome text (V4): the fifth tutorial, else the last one. */
const heroLevel = embeddedLevels.find(({ id }) => id === 'tuto-5') ?? embeddedLevels.at(-1);

interface PlaceProps {
  readonly to: string;
  readonly title: string;
  readonly text: string;
  readonly sprite: SpriteThumbnail;
  readonly children?: ReactNode;
}

/** One of the three destinations below the welcome text, illustrated by a sprite. */
function Place({ to, title, text, sprite, children }: PlaceProps) {
  return (
    <Link className="home-place" to={to}>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
      <img src={spriteThumbnailPath(sprite)} alt="" draggable={false} />
    </Link>
  );
}

/** `/` (V7, maquette validée en V4): one call to play, then the three places. */
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
          <div className="home-hero-copy">
            <h2 id="home-title">
              Amène la balle
              <br />
              jusqu’au panier.
            </h2>
            <p>
              Poutres, tremplins, ventilateurs, leviers&nbsp;: place les pièces, lance la machine et
              regarde ce qui se passe. Raté&nbsp;? Ajuste et relance.
            </p>
            <div className="home-hero-actions">
              <Link className="btn btn-go home-play" to="/levels">
                <Play size={20} aria-hidden="true" />
                Jouer
              </Link>
              <Link className="home-create" to="/editor">
                ou créer un niveau
              </Link>
              <figure className="home-bolt" aria-hidden="true">
                <img src="/assets/bolt/bolt-explaining.webp" alt="" draggable={false} />
              </figure>
            </div>
          </div>
          {heroLevel !== undefined && (
            <div
              className="home-board"
              role="img"
              aria-label={`Aperçu du niveau « ${heroLevel.metadata.title} »`}
            >
              <LevelPreview document={heroLevel} />
            </div>
          )}
        </section>

        <nav className="home-places" aria-label="Explorer TinkerBolt">
          <Place
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
            sprite="springboard"
          />
        </nav>

        {(storageError !== null || storageWarning !== null) && (
          <p className="home-storage-note" role="status">
            {storageError !== null
              ? 'La progression ne peut pas être enregistrée sur cet appareil.'
              : 'Une ancienne sauvegarde illisible a été mise de côté.'}
          </p>
        )}

        <footer className="home-foot">
          <span>Les niveaux partagés sont sous licence CC BY 4.0.</span>
          <Link to="/settings">
            <Settings size={16} aria-hidden="true" />
            Paramètres
          </Link>
        </footer>
      </div>
    </AppFrame>
  );
}
