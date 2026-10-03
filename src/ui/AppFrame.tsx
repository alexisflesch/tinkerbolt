import type { ReactNode } from 'react';

import { AppHeader, type MenuAction } from './AppHeader';

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
}: AppFrameProps) {
  return (
    <div className={`app-shell app-shell-${variant}`}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        attribution={attribution}
        action={headerAction}
        beforeNavigate={beforeNavigate}
        {...(menuActions === undefined ? {} : { menuActions })}
      />
      <main className="app-main">{children}</main>
    </div>
  );
}
