import { Stage } from './lead.model';

/**
 * What archiving a stage is allowed to do, per documents/PLAN-stages.md §4.1:
 *
 * - `ok` — archives outright, nothing else to decide.
 * - `needs-destination` — the stage still holds leads; the manager must ask where they go
 *   before the archive button enables.
 * - `{ refused }` — archiving is not offered at all, with the reason spelled out rather
 *   than a disabled control the user has to guess at.
 */
export type ArchiveVerdict = 'ok' | 'needs-destination' | { refused: string };

/**
 * Pure gate for archiving a stage — no store, no query, so every branch is assertable on
 * its own (documents/CONTRACT-stages.md §3). The three outright refusals come first and
 * win regardless of lead count: a pipeline missing its won stage, its lost stage, or its
 * only open stage is a worse failure than a blocked archive button.
 *
 * `all` is every stage the tenant has, archived included — the "only open stage" count
 * has to see the whole live set to know whether this is really the last one.
 */
export function archiveCheck(
  stage: Stage,
  leadCount: number,
  all: readonly Stage[],
): ArchiveVerdict {
  if (stage.kind === 'won') {
    return {
      refused: `אי אפשר לארכב את "${stage.name}" — זה שלב הזכייה, וכל מספרי ההצלחה בתובנות נשענים עליו.`,
    };
  }

  if (stage.kind === 'lost') {
    return {
      refused: `אי אפשר לארכב את "${stage.name}" — זה שלב האי-הצלחה, וכל מספרי ההצלחה בתובנות נשענים עליו.`,
    };
  }

  if (stage.kind === 'open') {
    const liveOpen = all.filter((s) => s.kind === 'open' && s.archivedAt === null);
    if (liveOpen.length <= 1) {
      return {
        refused: `אי אפשר לארכב את "${stage.name}" — זה השלב הפתוח היחיד, ובלעדיו אין לאן להכניס ליד חדש.`,
      };
    }
  }

  return leadCount > 0 ? 'needs-destination' : 'ok';
}
