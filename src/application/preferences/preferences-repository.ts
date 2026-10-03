/**
 * ADR 0016 § Pseudo: the only personal datum kept, the last pseudonym typed.
 * ADR 0011 (amendment of 2 Oct. 2026, U8): whether level 1's hint was closed
 * or followed — not a personal datum; only `true` is ever recorded.
 * ADR 0012 (amendment of 2 Oct. 2026, U10): whether the invitation to install
 * the app was declined — likewise only `true`.
 */
export interface Preferences {
  readonly author?: string;
  readonly firstLevelHintDone?: true;
  readonly installInvitationDeclined?: true;
}

export type PreferencesRepositoryErrorCode =
  | 'storage-unavailable'
  | 'quota-exceeded'
  | 'invalid-preferences'
  | 'unsupported-version';

export type PreferencesLoadResult =
  | {
      readonly status: 'ok';
      readonly preferences: Preferences;
      readonly warning?: 'invalid-data-backed-up';
    }
  | { readonly status: 'error'; readonly code: PreferencesRepositoryErrorCode };

export type PreferencesSaveResult =
  | { readonly status: 'ok'; readonly warning?: 'invalid-data-backed-up' }
  | { readonly status: 'error'; readonly code: PreferencesRepositoryErrorCode };

export type PreferencesPatch = {
  readonly author?: string | null;
  readonly firstLevelHintDone?: true;
  readonly installInvitationDeclined?: true;
};

export type PreferencesPatchResult =
  | {
      readonly status: 'ok';
      readonly preferences: Preferences;
      readonly warning?: 'invalid-data-backed-up';
    }
  | { readonly status: 'error'; readonly code: PreferencesRepositoryErrorCode };

/** Application port for the player's local preferences (ADR 0011, `tinkerbolt:preferences`). */
export interface PreferencesRepository {
  load(): Promise<PreferencesLoadResult>;
  save(preferences: Preferences): Promise<PreferencesSaveResult>;
  patch(changes: PreferencesPatch): Promise<PreferencesPatchResult>;
}
