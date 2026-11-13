/**
 * The two things the store needs to know about projects. They are kept apart from `review.ts` (the Review tab's arithmetic) so that
 * the store, which every screen loads, does not bring that whole file with it.
 */
export const PROJECT_MAX = 12
/** a project name as it is kept: no control characters or markup, single spaces, at most 24 characters */
export const tidyProject = (s: unknown): string => String(s ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
