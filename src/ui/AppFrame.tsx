import type { ReactNode } from 'react';

import { AppHeader, type MainSection, type MenuAction } from './AppHeader';

/** The place a screen belongs to, read from its title or its context line. */
const sectionByLabel: Readonly<Record<string, MainSection>> = {
  Campagne: 'campaign',
  Atelier: 'workshop',
  'Mes niveaux': 'my-levels',
  Paramètres: 'settings',
};

interface AppFrameProps {
  /** None on the home page, whose header has no title (V7). */
  readonly title?: string;
  /** The title's context (« Atelier »…), shown as « Titre · Contexte ». */
  readonly subtitle?: string;
  /** ADR 0016 § Affichage: replaces the subtitle line when present. */
  readonly attribution?: string | undefined;
  /** `board` for the plateau screen (fixed viewport, no page scroll); `page` for scrolling content pages. */
  readonly variant: 'board' | 'page';
  /** Optional screen-specific control shown in the header, before the menu. */
  readonly headerAction?: ReactNode;
  /** Screen-specific commands listed first in the header menu. */
  readonly menuActions?: readonly MenuAction[];
  /**
   * A board screen in the workshop identity: the header shows the main
   * navigation instead of the title, which the board's own bar carries.
   */
  readonly desk?: boolean;
  readonly children: ReactNode;
  readonly beforeNavigate?: (() => Promise<void>) | undefined;
}

/**
 * The chrome shared by every route (ADR 0008): the header with its menu
 * and one `<main>`. Pages differ only by what they put inside, so the four
 * screens keep one look without each re-declaring the shell.
 */
export function AppFrame({
  title,
  subtitle,
  attribution,
  variant,
  headerAction,
  menuActions,
  children,
  beforeNavigate,
  desk = false,
}: AppFrameProps) {
  // A content page (identité visuelle): the header shows the main navigation,
  // and the page says its own name in a heading shared by every such page.
  const isTitledPage = variant === 'page' && title !== undefined;
  return (
    <div className={`app-shell app-shell-${variant}${desk ? ' app-shell-desk' : ''}`}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        attribution={attribution}
        action={isTitledPage ? undefined : headerAction}
        beforeNavigate={beforeNavigate}
        navigation={
          isTitledPage || desk
            ? (sectionByLabel[title ?? ''] ?? sectionByLabel[subtitle ?? ''] ?? 'none')
            : undefined
        }
        {...(menuActions === undefined ? {} : { menuActions })}
      />
      <main className="app-main">
        {isTitledPage && (
          <>
            <span className="page-prop page-prop-plans" aria-hidden="true" />
            <span className="page-prop page-prop-square" aria-hidden="true" />
            <span className="page-prop page-prop-screwdriver" aria-hidden="true" />
            <div className="page-head">
              <div className="page-head-title">
                <h2>{title}</h2>
                {(attribution ?? subtitle) !== undefined && (
                  <p className="page-head-context">{attribution ?? subtitle}</p>
                )}
              </div>
              {headerAction !== undefined && (
                <div className="page-head-actions">{headerAction}</div>
              )}
            </div>
          </>
        )}
        {children}
      </main>
    </div>
  );
}
