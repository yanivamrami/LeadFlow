import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { DragDropModule } from '@angular/cdk/drag-drop';

import { LucideGripVertical, LucideTrash2, LucideX } from '@lucide/angular';

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
  formatDue,
  // Used inside `valueRead`, not from a binding — a formatter called from a computed runs
  // once per change, which is exactly what the pipes exist to achieve for templates.
  formatValue,
} from '../../core/copy';
import { GuidanceService } from '../../core/guidance.service';
import { NotifyService } from '../../core/notify.service';
import { nextStepOf } from '../../core/guidance';
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
  Stage,
  ActivityType,
  ReminderAction,
} from '../../core/lead.model';
import { hasErrors, validateLeadForm } from '../../core/lead-validation';
import { LeadsStore } from '../../core/leads.store';
import { LeadFile, LeadFilesStore, rejectionOf } from '../../core/lead-files.store';
import { StagesStore } from '../../core/stages.store';
import { FormError } from '../../shared/form-error';
import { ValuePipe } from '../../shared/format.pipes';
import { StageTag } from '../../shared/stage-tag';
import { DuePicker } from '../../shared/due-picker';
import { TextField } from '../../shared/text-field';
import { StampPipe } from './stamp.pipe';
import { LeadFiles } from './lead-files';

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
  imports: [
    FormsModule,
    A11yModule,
    DragDropModule,
    LucideX,
    LucideGripVertical,
    LucideTrash2,
    TextField,
    FormError,
    StageTag,
    DuePicker,
    ValuePipe,
    StampPipe,
    LeadFiles,
  ],
  templateUrl: './lead-sheet.html',
  styleUrl: './lead-sheet.scss',
})
export class LeadSheet {
  private readonly store = inject(LeadsStore);
  private readonly stagesStore = inject(StagesStore);
  private readonly filesStore = inject(LeadFilesStore);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  /** Read by the template: how much of the teaching layer is expanded by default. */
  protected readonly guidance = inject(GuidanceService);

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
  // Was STATUS_MEANING / STATUS_GUIDANCE keyed by enum value. Both now live on the stage row,
  // so the template reads them off `selectedStage()` and a stage nobody described shows
  // nothing rather than a generic line.
  protected readonly lostReasons = LOST_REASONS;
  /** Live stages, in position order — the "שלב" select reads straight off the pipeline. */
  protected readonly stages = this.stagesStore.active;
  protected readonly sources = SOURCES;
  protected readonly items = CHECKLIST_ITEMS;
  protected readonly noteTypes = NOTE_TYPES;
  protected readonly checklistTotal = CHECKLIST_ITEMS.length;
  /** Typed so the template can index the label maps without casting. */
  protected readonly answerOptions: readonly QualificationAnswer[] = ['yes', 'no', 'unknown'];

  /**
   * The per-field "why does this matter" aria-label, resolved once per field instead of on
   * every change-detection pass: `copy.lead.fieldHelpAria(...)` was being called from seven
   * bindings across this template for a string that never changes once COPY is loaded.
   * A plain readonly map, not a `computed()` — nothing here depends on a signal.
   */
  protected readonly fieldHelpAria: Record<LeadFieldKey, string> = {
    name: COPY.lead.fieldHelpAria(COPY.lead.fields.name),
    company: COPY.lead.fieldHelpAria(COPY.lead.fields.company),
    phone: COPY.lead.fieldHelpAria(COPY.lead.fields.phone),
    email: COPY.lead.fieldHelpAria(COPY.lead.fields.email),
    source: COPY.lead.fieldHelpAria(COPY.lead.fields.source),
    value: COPY.lead.fieldHelpAria(COPY.lead.fields.value),
    status: COPY.lead.fieldHelpAria(COPY.lead.fields.status),
  };

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
  /**
   * All five "why ask?" lines at once rather than one signal per question. Five separate
   * toggles cost a 44px row each and answered the same question — someone who wants the
   * reasoning wants the set, not the third one. Forced open by the verbose guidance setting,
   * the same way every field's help is.
   */
  protected readonly whyAllOpen = signal(false);
  protected readonly whyShown = computed(() => this.guidance.verbose() || this.whyAllOpen());

  /**
   * Below 900px in edit mode the identity fields fold behind a read grid: they are typed once
   * and then read for months, so they are reference rather than the task. Opening is one-way
   * for the life of the sheet — having asked to edit, nobody wants it folding back under them.
   * Create has nothing to read, so its facts block never renders, and above 900px the second
   * column removes the reason to fold at all (see the stylesheet).
   */
  protected readonly factsOpen = signal(false);
  protected readonly folded = computed(() => !this.create() && !this.factsOpen());
  /**
   * One-at-a-time, same as `whyOpen` — but a separate signal, deliberately not shared with
   * it. A field's help and a checklist question's "why ask?" are different questions; if
   * they shared one signal, opening one would silently close the other for no reason the
   * user could see.
   */
  protected readonly fieldHelpOpen = signal<LeadFieldKey | null>(null);
  protected readonly timelineExpanded = signal(false);

  /**
   * Whether the sheet can be dragged. Desktop only: under 900px it is a full-width drawer
   * on the bottom edge, so there is nowhere to move it to and dragging would only let the
   * user hide their own form. Tracked live rather than read once, because a window resized
   * across the breakpoint must not leave a drawer that can be dragged off screen.
   */
  protected readonly canDrag = signal(false);

  private readonly checklistEl = viewChild<ElementRef<HTMLElement>>('checklist');
  private readonly composerEl = viewChild<ElementRef<HTMLElement>>('composer');
  private readonly noteInputEl = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');
  /** Landing happens once per arrival, never on every later render. */
  private landed = false;
  private landedNote = false;
  /** Which lead the draft was filled from — see the hydrate effect. */
  private hydratedFor: string | null = null;

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

    if (typeof matchMedia === 'function') {
      const wide = matchMedia('(min-width: 900px)');
      this.canDrag.set(wide.matches);
      const onChange = (event: MediaQueryListEvent) => this.canDrag.set(event.matches);
      wide.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => wide.removeEventListener('change', onChange));
    }

    // Fill the form once the lead arrives — on a deep link the store may still be reading.
    //
    // Once per lead, not on every store emission. `lead()` is derived from the store, so any
    // reload hands back a new object and re-ran this: adding a note reloads the store, which
    // would have re-hydrated the draft and silently thrown away whatever the user had typed
    // into the fields but not saved. The timeline still updates live, because it reads
    // `lead().activities` directly rather than through the draft.
    effect(() => {
      const lead = this.lead();
      if (!lead || this.hydratedFor === lead.id) return;
      this.hydratedFor = lead.id;
      untracked(() => this.hydrate(lead));
    });

    // Load this lead's files once, when we know which lead we are. Keyed off the route input
    // rather than the loaded lead, so the list is on its way while the store is still reading.
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.filesStore.load(id));
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

  /** The meaning and guidance of the selected stage, for the field help below the picker.
   *  Was `STATUS_MEANING[status]` / `STATUS_GUIDANCE[status]`; both now live on the row, so a
   *  stage the user invented explains itself in their own words or not at all. */
  protected readonly selectedStage = computed(() => this.stagesStore.byId(this.stageId()) ?? null);

  /**
   * The two hand-rolled select blocks ask this instead of comparing signals inline three
   * times each: the `@if`, the `aria-expanded` and the `aria-describedby` must agree, and
   * three copies of the same condition is how they stop agreeing.
   */
  protected readonly statusHelpOpen = computed(
    () => this.guidance.verbose() || this.fieldHelpOpen() === 'status',
  );
  protected readonly sourceHelpOpen = computed(
    () => this.guidance.verbose() || this.fieldHelpOpen() === 'source',
  );

  /**
   * The one next thing to do with this lead. Derived, never stored: it is a function of the
   * stage, the follow-up and how long the lead has been silent, all of which the store
   * already knows. Absent in create mode (no lead yet) and for closed leads (nothing owed).
   */
  protected readonly nextStep = computed(() => {
    const lead = this.lead();
    if (!lead) return null;
    return nextStepOf(lead, this.store.now(), this.stagesStore.firstOpen()?.id ?? null);
  });

  /* ---------- answers ---------- */

  /** What is on screen: what the lead already had, overlaid with this session's taps. */
  protected readonly answers = computed<ChecklistAnswers>(() => ({
    ...(this.lead()?.answers ?? {}),
    ...this.touchedAnswers(),
  }));

  protected readonly answeredCount = computed(() => Object.keys(this.answers()).length);

  /** "N of 5 answered". */
  protected readonly checklistProgress = computed(() =>
    COPY.lead.checklist.progress(this.answeredCount(), this.checklistTotal),
  );

  protected setAnswer(item: ChecklistItem, answer: QualificationAnswer): void {
    this.touchedAnswers.update((current) => ({ ...current, [item]: answer }));
  }

  /* ---------- the stage strip ---------- */

  /**
   * A stop's label. `shortName` is the pipeline's own abbreviation where the tenant set one,
   * which is exactly what a six-across strip wants; the full name is the fallback, never a
   * truncation of our own invention. The header's stage tag always carries the full name, so
   * nothing is lost by abbreviating here.
   */

  /* ---------- the value field, which changes job on a `won` stage ---------- */

  /**
   * Closing as won must not let an estimate stand in for revenue, so the field asks for the
   * final amount by name. It stays the *same* field: a second input bound to the same signal
   * is how a typed figure gets overwritten by whichever control the user did not look at.
   */
  protected readonly valueLabel = computed(() =>
    this.selectedKind() === 'won' ? COPY.lead.wonAmount : COPY.lead.fields.value,
  );
  protected readonly valueHelp = computed(() =>
    this.selectedKind() === 'won' ? COPY.lead.wonAmountHint : null,
  );

  /** The value as the read grid shows it: currency, or a word saying it is not filled in. */
  protected readonly valueRead = computed(() => {
    const raw = this.value().trim();
    if (!raw.length) return COPY.lead.factsEmpty;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? formatValue(parsed) : raw;
  });

  /** Same one-at-a-time act as `toggleWhy`, kept on its own signal — see `fieldHelpOpen`. */
  protected toggleFieldHelp(field: LeadFieldKey): void {
    this.fieldHelpOpen.update((open) => (open === field ? null : field));
  }

  /* ---------- timeline ---------- */

  protected readonly activities = computed<Activity[]>(() => this.lead()?.activities ?? []);

  /** The timeline's expand label, which names the full count. */
  protected readonly showAllLabel = computed(() =>
    COPY.lead.timeline.showAll(this.activities().length),
  );

  /** The delete confirmation names the lead and how many history entries go with it. */
  protected readonly deleteConfirmText = computed(() =>
    COPY.lead.deleteConfirm(this.lead()?.name ?? '', this.activities().length),
  );
  protected readonly visibleActivities = computed(() =>
    this.timelineExpanded() ? this.activities() : this.activities().slice(0, TIMELINE_PAGE),
  );
  protected readonly hasMoreActivities = computed(
    () => this.activities().length > TIMELINE_PAGE,
  );

  /** The clock the timeline's stamps are measured against — the `lfStamp` pipe takes it as
   *  an argument rather than reading a clock itself; see stamp.pipe.ts. */
  protected readonly now = this.store.now;

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
    // Files chosen on a new lead are not written until the save, so leaving would lose them.
    if (this.pendingFiles().length > 0) return true;

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
        if (!id) return;
        // A new lead can carry its first note and its first files. Neither can be attached
        // before the lead exists, so unlike the edit case they ride along with the save rather
        // than having their own buttons — written after the insert, against the id we just got
        // back. The lead is already saved by this point, so a failed attachment is reported by
        // the store and costs the user the attachment, never the lead.
        const body = this.note().trim();
        if (body) await this.store.logActivity(id, this.noteType(), body);

        const held = this.pendingFiles();
        if (held.length) {
          await this.filesStore.upload(id, held);
          this.pendingFiles.set([]);
        }

        this.close();
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

  protected async confirmDelete(): Promise<void> {
    const id = this.id();
    if (!id) return;
    // Before the lead goes, not after: the FK cascade takes the file rows with it, and the rows
    // are the only record of where the objects live. Storage cannot be cascaded from SQL, so this
    // is the one moment the paths are still known. Failures do not stop the delete.
    await this.filesStore.purgeObjectsFor(id);
    this.store.remove(id);
    this.filesStore.forget(id);
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

  /* ---------- files ---------- */

  protected readonly filesBusy = this.filesStore.working;

  /** What is already attached. Empty in create mode, where there is nothing to attach to yet. */
  protected readonly files = computed(() => this.filesStore.filesFor(this.id()));

  /**
   * Create mode holds the chosen files in memory and uploads them once the insert returns an
   * id — there is no lead to attach them to before that, and asking the user to save and then
   * come back to add a file would be a worse answer than waiting.
   */
  protected readonly pendingFiles = signal<readonly File[]>([]);

  /** Validated on choosing rather than on saving, so a rejected file is named while it is
   *  still the thing the user is looking at. */
  protected pickFiles(chosen: readonly File[]): void {
    if (!chosen.length) return;

    const accepted: File[] = [];
    for (const file of chosen) {
      const rejection = rejectionOf(file);
      if (rejection) this.notify.failed(rejection);
      else accepted.push(file);
    }
    if (!accepted.length) return;

    const id = this.id();
    if (id) void this.filesStore.upload(id, accepted);
    else this.pendingFiles.update((held) => [...held, ...accepted]);
  }

  protected dropPending(index: number): void {
    this.pendingFiles.update((held) => held.filter((_, i) => i !== index));
  }

  protected openFile(file: LeadFile): void {
    void this.filesStore.open(file);
  }

  protected removeFile(file: LeadFile): void {
    void this.filesStore.remove(file);
  }

  /* ---------- the composer, which commits on its own ---------- */

  /** Busy state for the composer's own button, kept apart from `saving` so the footer's save
   *  is not disabled while a note is being appended and vice versa. */
  protected readonly addingNote = signal(false);
  protected readonly canAddNote = computed(
    () => this.note().trim().length > 0 && !this.addingNote() && !this.saving(),
  );

  /**
   * Appends the typed note to the activity log immediately, without closing the sheet.
   *
   * Clearing `note` on success is what stops the footer's save from writing it a second time:
   * `save()` only sends a note when the textarea still holds one, so there is exactly one
   * insert per typed note and no way to duplicate it by saving afterwards. On failure the
   * text stays exactly where it is — the store has already reported why — so nothing typed
   * is lost and the button can simply be pressed again.
   *
   * This is the one place the sheet's "one save" rule is deliberately relaxed, because an
   * append-only log entry is not a field edit: it cannot conflict, and a note the user has
   * finished writing is more useful in the log than held hostage by the rest of the form.
   */
  protected async addNote(): Promise<void> {
    const id = this.id();
    const body = this.note().trim();
    if (!id || !body.length || this.addingNote() || this.saving()) return;

    this.addingNote.set(true);
    try {
      if (await this.store.logActivity(id, this.noteType(), body)) this.note.set('');
    } finally {
      this.addingNote.set(false);
    }
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
