import source from './levels/demo-landing.json';
import { levelDocumentSchema } from '../domain/level-document';

/** Author export, validated before the home page derives its display-only machine. */
export const homeLevel = levelDocumentSchema.parse(source);
