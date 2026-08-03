import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';

import { LucideX } from '@lucide/angular';

import {
  ACTIVITY_LABEL,
  ANSWER_ARIA,
  ANSWER_LABEL,
  CHECKLIST_QUESTION,
  CHECKLIST_WHY,
  COPY,
  LEAD_FIELD_HELP,
  LeadFieldKey,
  LOST_REASONS,
  SOURCE_LABEL,
  formatValue,
  formatDue,
} from '../../core/copy';
import {
  Activity,
  CHECKLIST_ITEMS,
  ChecklistAnswers,
  ChecklistItem,
  Lead,
  LeadDraft,
  LeadSource,
  NOTE_TYPES,
  QualificationAnswer,
  ActivityType,
  ReminderAction,
} from '../../core/lead.model';
import { hasErrors, validateLeadForm } from '../../core/lead-validation';
import { LeadsStore } from '../../core/leads.store';
import { StagesStore } from '../../core/stages.store';
import { FormError } from '../../shared/form-error';
import { StageTag } from '../../shared/stage-tag';
import { DuePicker } from '../../shared/due-picker';
import { TextField } from '../../shared/text-field';

/** How many history entries show before the timeline asks to be expanded. */
const TIMELINE_PAGE = 20;

const SOURCES: readonly LeadSource[] = ['website', 'referral', 'social_media', 'phone', 'other'];

/** The footer is one strip that changes job, so a confirm never stacks a second modal. */
type FooterMode = 'default' | 'dirty' | 'delete';

/**
 * The lead sheet — §3 in one surface.
 *
 * Add (3.1), detail (3.2), edit (3.3), the checklist (3.4), logging activity (3.5),
 * closing (3.6) and deleting (3.7) are the same moment seen from different entry points,
 * so they are one component in two modes rather than seven screens that drift apart.
 *
 * One save commits everything — fields, the note, and any checklist answers touched —
 * through the save_lead RPC, so a stage change can never land while a typed note is
 * lost. Nothing is written until the user asks for it.
 */
@Component({
  selector: 'lf-lead-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, A11yModule, LucideX, TextField, FormError, StageTag, DuePicker],
  templateUrl: './lead-sheet.html',
  styleUrl: './lead-sheet.scss',
})
export class LeadSheet {
  private readonly store = inject(LeadsStore);
  private readonly stagesStore = inject(StagesStore);
  private readonly router = inject(Router);

  /** Bound from the route: absent on /lead/new, the lead id on /lead/:id. */
  readonly id = input<string | undefined>(undefined);

  /**
   * `?at=checklist` — where to land. Set by the stage-move nudge's `מלא עכשיו`, which owes
   * the user the questions themselves rather than the top of a long sheet.
   */
  readonly at = input<string | undefined>(undefined);

  protected readonly copy = COPY;
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly activityLabel = ACTIVITY_LABEL;
  protected readonly question = CHECKLIST_QUESTION;
  protected readonly why = CHECKLIST_WHY;
  protected readonly answerLabel = ANSWER_LABEL;
  protected readonly answerAria = ANSWER_ARIA;
  protected readonly fieldHelp = LEAD_FIELD_HELP;
  protected readonly lostReasons = LOST_REASONS;
  /** Live stages, in position order — the "שלב" select reads straight off the pipeline. */
  protected readonly stages = this.stagesStore.active;
  protected readonly sources = SOURCES;
  protected readonly items = CHECKLIST_ITEMS;
  protected readonly noteTypes = NOTE_TYPES;
  protected readonly checklistTotal = CHECKLIST_ITEMS.length;
  /** Typed so the template can index the label maps without casting. */
  protected readonly answerOptions: readonly QualificationAnswer[] = ['yes', 'no', 'unknown'];
  protected readonly formatValue = formatValue;

  protected readonly create = computed(() => this.id() === undefined);
  protected readonly lead = computed<Lead | undefined>(() =>
    this.store.leads().find((l) => l.id === this.id()),
  );
  protected readonly loading = this.store.loading;
  /** Deep-linked at an id that is gone, or that RLS hides. Says so rather than hanging. */
  protected readonly missing = computed(
    () => !this.create() && !this.loading() && this.store.loaded() && !this.lead(),
  );

  /* ---------- the draft ---------- */

  protected readonly name = signal('');
  protected readonly company = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly source = signal<LeadSource>('other');
  /** Empty until either the lead hydrates or the pipeline's first-open stage arrives —
   *  see the constructor's default-picking effect below. */
  protected readonly stageId = signal<string>('');
  /** Kept as text: an empty field is not zero, and zero is a real estimate. */
  protected readonly value = signal('');
  protected readonly lostReason = signal('');

  protected readonly note = signal('');
  protected readonly noteType = signal<ActivityType>('note');

  /**
   * Follow-up intent for this save. Default `keep`, so an ordinary save never touches the
   * reminder — the sheet only changes it when the user says so.
   */
  protected readonly reminderAction = signal<ReminderAction>('keep');
  protected readonly reminderDue = signal<Date | null>(null);
  protected readonly pickingReminder = signal(false);
  /** Only what the user touched this session — absent stays absent. */
  protected readonly touchedAnswers = signal<ChecklistAnswers>({});

  protected readonly footerMode = signal<FooterMode>('default');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly whyOpen = signal<ChecklistItem | null>(null);
  /**
   * One-at-a-time, same as `whyOpen` — but a separate signal, deliberately not shared with
   * it. A field's help and a checklist question's "why ask?" are different questions; if
   * they shared one signal, opening one would silently close the other for no reason the
   * user could see.
   */
  protected readonly fieldHelpOpen = signal<LeadFieldKey | null>(null);
  protected readonly timelineExpanded = signal(false);

  private readonly checklistEl = viewChild<ElementRef<HTMLElement>>('checklist');
  private readonly composerEl = viewChild<ElementRef<HTMLElement>>('composer');
  private readonly noteInputEl = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');
  /** Landing happens once per arrival, never on every later render. */
  private landed = false;
  private landedNote = false;

  constructor() {
    // A fresh lead defaults to the first-open stage once the pipeline has loaded — which
    // may still be in flight when this component mounts on a direct /lead/new visit. Runs
    // only in create mode and only until something sets stageId (the user, or this), so it
    // never overwrites a deliberate choice.
    effect(() => {
      if (!this.create() || this.stageId()) return;
      const first = this.stagesStore.firstOpen();
      if (first) untracked(() => this.stageId.set(first.id));
    });

    // Fill the form once the lead arrives — on a deep link the store may still be reading.
    effect(() => {
      const lead = this.lead();
      if (!lead) return;
      untracked(() => this.hydrate(lead));
    });

    // `?at=checklist` — wait for the lead, because the checklist does not render without it.
    effect(() => {
      if (this.at() !== 'checklist' || this.landed || !this.lead()) return;
      const el = this.checklistEl()?.nativeElement;
      if (!el) return;
      this.landed = true;
      untracked(() => this.landOnChecklist(el));
    });

    // `?at=note` — land on the activity composer. Unlike the checklist, the user's next
    // act here is typing, so focus goes straight into the textarea.
    effect(() => {
      if (this.at() !== 'note' || this.landedNote || !this.lead()) return;
      const section = this.composerEl()?.nativeElement;
      const input = this.noteInputEl()?.nativeElement;
      if (!section || !input) return;
      this.landedNote = true;
      untracked(() => this.landOnComposer(section, input));
    });
  }

  /**
   * Scroll the questions into view and put focus on the section, not on an answer: focusing
   * a radio would sit on `לא` and one stray keystroke would answer a question nobody asked.
   * Reduced motion gets an instant jump — the point is arriving, not the travel.
   */
  private landOnChecklist(el: HTMLElement): void {
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }

  /**
   * Scroll the composer into view and focus the textarea itself, not the section: the next
   * act here is typing, so there is no wrong keystroke to guard against the way there is on
   * the checklist's radios. Reduced motion gets an instant jump — the point is arriving, not
   * the travel.
   */
  private landOnComposer(section: HTMLElement, input: HTMLTextAreaElement): void {
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    input.focus({ preventScroll: true });
  }

  private hydrate(lead: Lead): void {
    this.name.set(lead.name);
    this.company.set(lead.company ?? '');
    this.phone.set(lead.phone ?? '');
    this.email.set(lead.email ?? '');
    this.source.set(lead.source);
    this.stageId.set(lead.stage.id);
    this.value.set(lead.estimatedValue ? String(lead.estimatedValue) : '');
    this.lostReason.set(lead.lostReason ?? '');
  }

  /** The kind of whatever stage is currently selected — resolved through StagesStore
   *  rather than carried on the draft, since only `kind` (never the stage's name) decides
   *  the lost-reason requirement and the won-amount block (documents/PLAN-stages.md §1). */
  protected readonly selectedKind = computed(() => this.stagesStore.byId(this.stageId())?.kind);

  /* ---------- answers ---------- */

  /** What is on screen: what the lead already had, overlaid with this session's taps. */
  protected readonly answers = computed<ChecklistAnswers>(() => ({
    ...(this.lead()?.answers ?? {}),
    ...this.touchedAnswers(),
  }));

  protected readonly answeredCount = computed(() => Object.keys(this.answers()).length);

  protected answerOf(item: ChecklistItem): QualificationAnswer | undefined {
    return this.answers()[item];
  }

  protected setAnswer(item: ChecklistItem, answer: QualificationAnswer): void {
    this.touchedAnswers.update((current) => ({ ...current, [item]: answer }));
  }

  protected toggleWhy(item: ChecklistItem): void {
    this.whyOpen.update((open) => (open === item ? null : item));
  }

  /** Same one-at-a-time act as `toggleWhy`, kept on its own signal — see `fieldHelpOpen`. */
  protected toggleFieldHelp(field: LeadFieldKey): void {
    this.fieldHelpOpen.update((open) => (open === field ? null : field));
  }

  /* ---------- timeline ---------- */

  protected readonly activities = computed<Activity[]>(() => this.lead()?.activities ?? []);
  protected readonly visibleActivities = computed(() =>
    this.timelineExpanded() ? this.activities() : this.activities().slice(0, TIMELINE_PAGE),
  );
  protected readonly hasMoreActivities = computed(
    () => this.activities().length > TIMELINE_PAGE,
  );

  /** Dated, with the time on anything from today — two entries a day must be tellable apart. */
  protected stamp(at: Date): string {
    const now = this.store.now();
    const sameDay = at.toDateString() === now.toDateString();
    const time = at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `היום ${time}`;
    const yesterday = new Date(now.getTime() - 86_400_000);
    if (at.toDateString() === yesterday.toDateString()) return `אתמול ${time}`;
    return at.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  }

  /* ---------- validation ---------- */

  /** The rules live in core/lead-validation.ts — pure, shared, and tested there. `open` is
   *  a safe default while the selected stage has not resolved yet: it never requires a
   *  lost reason, so it cannot block a save the user did not actually ask to close. */
  private readonly errors = computed(() =>
    validateLeadForm({
      name: this.name(),
      email: this.email(),
      value: this.value(),
      stageKind: this.selectedKind() ?? 'open',
      lostReason: this.lostReason(),
    }),
  );

  /** Errors surface on submit, never while someone is still typing. */
  private readonly shown = computed(() => (this.submitted() ? this.errors() : {}));

  protected readonly nameError = computed(() => this.shown().name ?? null);
  protected readonly emailError = computed(() => this.shown().email ?? null);
  protected readonly valueError = computed(() => this.shown().value ?? null);
  protected readonly lostReasonError = computed(() => this.shown().lostReason ?? null);

  private readonly invalid = computed(() => hasErrors(this.errors()));

  /* ---------- dirty tracking ---------- */

  protected readonly dirty = computed(() => {
    if (this.note().trim().length > 0) return true;
    if (Object.keys(this.touchedAnswers()).length > 0) return true;

    const lead = this.lead();
    if (!lead) return this.name().trim().length > 0;

    return (
      this.name().trim() !== lead.name ||
      this.company().trim() !== (lead.company ?? '') ||
      this.phone().trim() !== (lead.phone ?? '') ||
      this.email().trim() !== (lead.email ?? '') ||
      this.source() !== lead.source ||
      this.stageId() !== lead.stage.id ||
      this.value().trim() !== (lead.estimatedValue ? String(lead.estimatedValue) : '') ||
      this.lostReason().trim() !== (lead.lostReason ?? '')
    );
  });

  /* ---------- actions ---------- */

  private draft(): LeadDraft {
    const value = this.value().trim();
    return {
      name: this.name().trim(),
      company: this.company().trim() || null,
      email: this.email().trim() || null,
      phone: this.phone().trim() || null,
      source: this.source(),
      stageId: this.stageId(),
      estimatedValue: value.length ? Number(value) : null,
      lostReason: this.selectedKind() === 'lost' ? this.lostReason().trim() || null : null,
    };
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.invalid() || this.saving()) return;

    this.saving.set(true);
    try {
      if (this.create()) {
        const id = await this.store.createLead(this.draft());
        // Null means the write did not happen. Stay open so nothing typed is lost.
        if (id) this.close();
        return;
      }

      // The store reports its own failures. Staying open on a failed save is the point:
      // the typed note is still in the textarea, so nothing is lost while it is retried.
      const saved = await this.store.saveLead(this.id()!, this.draft(), {
        note: this.note().trim() || null,
        noteType: this.noteType(),
        answers: this.touchedAnswers(),
        reminderAction: this.reminderAction(),
        reminderDue: this.reminderDue(),
        reminderTitle: null,
      });
      if (saved) this.close();
    } finally {
      this.saving.set(false);
    }
  }

  protected attemptClose(): void {
    if (this.footerMode() !== 'default') {
      this.footerMode.set('default');
      return;
    }
    if (this.dirty()) {
      this.footerMode.set('dirty');
      return;
    }
    this.close();
  }

  protected confirmDiscard(): void {
    this.footerMode.set('default');
    this.close();
  }

  protected askDelete(): void {
    this.footerMode.set('delete');
  }

  protected confirmDelete(): void {
    const id = this.id();
    if (!id) return;
    this.store.remove(id);
    this.close();
  }

  protected cancelFooter(): void {
    this.footerMode.set('default');
  }

  protected close(): void {
    void this.router.navigate(['/']);
  }

  protected setStageId(value: string): void {
    this.stageId.set(value);
  }

  protected setSource(value: string): void {
    this.source.set(value as LeadSource);
  }

  protected pickLostReason(reason: string): void {
    this.lostReason.set(reason);
  }

  protected setNoteType(type: ActivityType): void {
    this.noteType.set(type);
  }

  /* ---------- follow-up ---------- */

  /** What the reminder line shows: the pending choice if any, else what the lead has. */
  protected readonly reminderLabel = computed(() => {
    if (this.reminderAction() === 'clear') return null;
    const pending = this.reminderDue();
    if (pending) return formatDue(pending, this.store.now());
    const existing = this.lead()?.reminderDueAt;
    return existing ? formatDue(existing, this.store.now()) : null;
  });

  protected pickReminder(due: Date): void {
    this.reminderDue.set(due);
    this.reminderAction.set('set');
    this.pickingReminder.set(false);
  }

  /** Clears on save, not immediately — nothing here is written until the user saves. */
  protected clearReminder(): void {
    this.reminderDue.set(null);
    this.reminderAction.set('clear');
    this.pickingReminder.set(false);
  }
}
