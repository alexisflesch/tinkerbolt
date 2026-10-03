import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';

import { Button } from './Button';

interface AppHeaderProps {
  readonly beforeNavigate?: (() => Promise<void>) | undefined;
  /** The page's title, centred; none on the home page (V7). */
  readonly title?: string | undefined;
  /** The context after the title (« Atelier », « Campagne »…), if the title needs one. */
  readonly subtitle?: string | undefined;
  /**
   * ADR 0016 § Affichage: the level's author and first source, plain text.
   * Shown in place of the subtitle, which the header has no room to add.
   */
  readonly attribution?: string | undefined;
  /** Optional screen-specific control placed before the menu button. */
  readonly action?: ReactNode;
  /**
   * Screen-specific commands listed first in the menu (M12: an author command
   * kept out of the action bar). Choosing one closes the menu.
   */
  readonly menuActions?: readonly MenuAction[];
}

export interface MenuAction {
  readonly label: string;
  /** A decorative `lucide-react` icon, `aria-hidden`: the label names the command. */
  readonly icon: ReactNode;
  readonly onSelect: () => void;
}

/**
 * The app's brand lockup, current screen label (« Titre · Contexte », V7),
 * and the navigation menu.
 * Every destination is a real route (ADR 0008): selecting one navigates
 * away, which unmounts this component along with its own open/closed state
 * — no explicit "close the menu" step is needed after a selection.
 */
export function AppHeader({
  title,
  subtitle,
  attribution,
  action,
  menuActions = [],
  beforeNavigate,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const context =
    attribution !== undefined ? (
      <span className="level-attribution">{attribution}</span>
    ) : subtitle !== undefined ? (
      <span className="level-mode">{subtitle}</span>
    ) : undefined;

  return (
    <header className="app-header">
      <Link
        className="brand-lockup"
        to="/"
        aria-label="TinkerBolt, accueil"
        onClick={(event) => {
          if (beforeNavigate === undefined) return;
          event.preventDefault();
          void beforeNavigate().then(() => navigate('/'));
        }}
      >
        <span className="brand-mark" aria-hidden="true">
          <Plus size={18} strokeWidth={3.5} />
        </span>
        <h1 className="brand-name">TinkerBolt</h1>
      </Link>
      {title === undefined ? (
        <span aria-hidden="true" />
      ) : (
        <p className="level-label">
          <span className="level-title">{title}</span>
          {context !== undefined && (
            <>
              {/* V7: « Titre · Contexte »; the dot is drawn, the two parts are read. */}
              <span className="level-separator" aria-hidden="true">
                {' · '}
              </span>
              {context}
            </>
          )}
        </p>
      )}
      <div className="header-actions">
        {action}
        <button
          className="icon-button"
          type="button"
          aria-label="Ouvrir le menu"
          aria-expanded={isMenuOpen}
          onClick={() => {
            setIsMenuOpen((open) => !open);
          }}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>
      {isMenuOpen && (
        <nav className="level-menu" aria-label="Menu principal">
          {menuActions.map(({ label, icon, onSelect }) => (
            <Button
              key={label}
              onClick={() => {
                setIsMenuOpen(false);
                onSelect();
              }}
            >
              {icon}
              {label}
            </Button>
          ))}
          <Button
            onClick={() => {
              if (beforeNavigate === undefined) void navigate('/');
              else void beforeNavigate().then(() => navigate('/'));
            }}
          >
            Accueil
          </Button>
          <Button
            onClick={() => {
              if (beforeNavigate === undefined) void navigate('/levels');
              else void beforeNavigate().then(() => navigate('/levels'));
            }}
          >
            Campagne
          </Button>
          <Button
            onClick={() => {
              if (beforeNavigate === undefined) void navigate('/editor');
              else void beforeNavigate().then(() => navigate('/editor'));
            }}
          >
            Atelier
          </Button>
          <Button
            onClick={() => {
              if (beforeNavigate === undefined) void navigate('/my-levels');
              else void beforeNavigate().then(() => navigate('/my-levels'));
            }}
          >
            Mes niveaux
          </Button>
          <Button
            onClick={() => {
              if (beforeNavigate === undefined) void navigate('/settings');
              else void beforeNavigate().then(() => navigate('/settings'));
            }}
          >
            Paramètres
          </Button>
        </nav>
      )}
    </header>
  );
}
