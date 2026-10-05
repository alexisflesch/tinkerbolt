import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { House, LayoutGrid, Map, Menu, Settings, Wrench } from 'lucide-react';

import { Button } from './Button';

interface AppHeaderProps {
  readonly beforeNavigate?: (() => Promise<void>) | undefined;
  /** The page's title, centred; none on the home page, which shows the main navigation instead. */
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
  /**
   * Shows the main navigation in place of the title, this section being the
   * current one: the wide board screens, whose title moves to their toolbar.
   * The home page, which has no title, always shows it.
   */
  readonly navigation?: MainSection | undefined;
}

/**
 * The four places of the main navigation; `home` is the page without a title,
 * `none` a page that belongs to no place (« Paramètres »).
 */
export type MainSection = 'home' | 'campaign' | 'workshop' | 'my-levels' | 'settings' | 'none';

const mainSections = [
  { id: 'home', to: '/', label: 'Accueil', Icon: House },
  { id: 'campaign', to: '/levels', label: 'Campagne', Icon: Map },
  { id: 'workshop', to: '/editor', label: 'Atelier', Icon: Wrench },
  { id: 'my-levels', to: '/my-levels', label: 'Mes niveaux', Icon: LayoutGrid },
  { id: 'settings', to: '/settings', label: 'Paramètres', Icon: Settings },
] as const satisfies readonly { readonly id: MainSection; readonly [key: string]: unknown }[];

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
  navigation,
}: AppHeaderProps) {
  const section = navigation ?? (title === undefined ? 'home' : undefined);
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
        <span className="brand-logo" aria-hidden="true" />
        <h1 className="brand-name visually-hidden">TinkerBolt</h1>
      </Link>
      {section !== undefined ? (
        <nav className="main-nav" aria-label="Navigation principale">
          {mainSections.map(({ id, to, label, Icon }) => (
            <Link
              key={id}
              to={to}
              aria-current={id === section ? 'page' : undefined}
              onClick={(event) => {
                if (beforeNavigate === undefined) return;
                event.preventDefault();
                void beforeNavigate().then(() => navigate(to));
              }}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
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
          className="icon-button menu-toggle"
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
          {mainSections.map(({ id, to, label, Icon }) => (
            <Button
              key={id}
              className={id === section ? 'level-menu-current' : undefined}
              aria-current={id === section ? 'page' : undefined}
              onClick={() => {
                if (beforeNavigate === undefined) void navigate(to);
                else void beforeNavigate().then(() => navigate(to));
              }}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>
      )}
    </header>
  );
}
