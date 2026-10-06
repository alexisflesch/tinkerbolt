import {
  hasCompleteGoal,
  levelDocumentSchema,
  type LevelDocument,
} from '../../domain/level-document';

export interface ContentLevelFile {
  readonly filePath: string;
  readonly value: unknown;
  readonly parseError?: string;
}

type ContentCatalogIssueKind = 'invalid-file' | 'duplicate-id';

interface ContentCatalogIssue {
  readonly filePath: string;
  readonly kind: ContentCatalogIssueKind;
  readonly message: string;
}

interface ContentCatalogValidationResult {
  readonly valid: boolean;
  readonly levels: readonly LevelDocument[];
  readonly issues: readonly ContentCatalogIssue[];
}

const formatIssuePath = (path: readonly PropertyKey[]): string => {
  if (path.length === 0) return 'document';

  return path
    .map((part) => (typeof part === 'number' ? `[${String(part)}]` : String(part)))
    .join('.')
    .replaceAll('.[', '[');
};

/**
 * Validates untrusted embedded level files and catalog-wide level id
 * uniqueness. Only schema-validated documents are returned as levels.
 */
export const validateContentCatalog = (
  files: readonly ContentLevelFile[],
  campaignLevelIds: ReadonlySet<string> = new Set<string>(),
): ContentCatalogValidationResult => {
  const issues: ContentCatalogIssue[] = [];
  const parsedFiles: Array<{ readonly filePath: string; readonly level: LevelDocument }> = [];

  for (const file of files) {
    if (file.parseError !== undefined) {
      issues.push({ filePath: file.filePath, kind: 'invalid-file', message: file.parseError });
      continue;
    }

    const parsed = levelDocumentSchema.safeParse(file.value);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
        .join('; ');
      issues.push({
        filePath: file.filePath,
        kind: 'invalid-file',
        message: details,
      });
      continue;
    }

    if (campaignLevelIds.has(parsed.data.id)) {
      if (!hasCompleteGoal(parsed.data)) {
        issues.push({
          filePath: file.filePath,
          kind: 'invalid-file',
          message: 'goal : un niveau de campagne exige un objectif complet.',
        });
        continue;
      }
      const unlockedPlacements = parsed.data.objects.flatMap((placement, index) =>
        placement.permissions.move || placement.permissions.rotate || placement.permissions.remove
          ? [index]
          : [],
      );
      if (unlockedPlacements.length > 0) {
        for (const index of unlockedPlacements) {
          issues.push({
            filePath: file.filePath,
            kind: 'invalid-file',
            message: `objects[${String(index)}].permissions : les trois permissions doivent être false dans un niveau de campagne.`,
          });
        }
        continue;
      }
    }

    parsedFiles.push({ filePath: file.filePath, level: parsed.data });
  }

  const firstFileById = new Map<string, string>();
  for (const parsedFile of parsedFiles) {
    const firstFile = firstFileById.get(parsedFile.level.id);
    if (firstFile === undefined) {
      firstFileById.set(parsedFile.level.id, parsedFile.filePath);
      continue;
    }

    issues.push({
      filePath: parsedFile.filePath,
      kind: 'duplicate-id',
      message: `L’identifiant de niveau « ${parsedFile.level.id} » est dupliqué (déjà défini dans ${firstFile}).`,
    });
  }

  return {
    valid: issues.length === 0,
    levels: parsedFiles.map((parsedFile) => parsedFile.level),
    issues,
  };
};
