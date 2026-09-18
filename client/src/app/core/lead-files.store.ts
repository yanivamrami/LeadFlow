import { Injectable, computed, inject, signal } from '@angular/core';

import { COPY, formatBytes } from './copy';
import { NotifyService } from './notify.service';
import { SupabaseService } from './supabase.service';

/** The bucket created by supabase/migrations/20260804100100_lead_files.sql. */
const BUCKET = 'lead-files';

/**
 * 5MB, the same ceiling the bucket enforces. Checked here as well so an over-sized file is
 * refused in Hebrew before it is pushed up a phone connection, not after.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * The bucket's allowlist, mirrored. A browser sometimes reports an empty or wrong `type` for
 * Office documents — Windows especially, where the value comes from the registry — so the
 * extension below is accepted as a second opinion. Storage still has the final say; this pair
 * only decides whether it is worth attempting the upload.
 */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp',
]);

/** What the file input advertises, so the OS picker filters before the user even chooses. */
export const FILE_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.png', '.jpg', '.jpeg', '.webp',
].join(',');

export interface LeadFile {
  id: string;
  leadId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
}

interface LeadFileRow {
  id: string;
  lead_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** Why this file cannot be uploaded, or null if it can. */
export function rejectionOf(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return COPY.lead.files.tooBig(file.name, formatBytes(MAX_FILE_BYTES));
  }
  if (file.size === 0) return COPY.lead.files.zeroBytes(file.name);
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.has(extOf(file.name))) {
    return COPY.lead.files.badType(file.name);
  }
  return null;
}

/**
 * Files attached to a lead.
 *
 * Two places hold state and only one of them is the record: `lead_files` rows are what RLS
 * protects and what this store lists, and the object in the bucket is addressed by the row's
 * `storage_path`. That ordering is why an upload writes the object first and the row second —
 * a row with no object would be a broken entry in the list, whereas an object with no row is
 * invisible and gets cleaned up below.
 *
 * Deleting a row deletes the object, in the database, via a trigger — so nothing here has to
 * remember to do it, and a lead or tenant cascade cannot leave paid-for bytes behind.
 */
@Injectable({ providedIn: 'root' })
export class LeadFilesStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);

  /** Per lead, because one sheet is open at a time and it wants exactly one lead's files. */
  private readonly byLead = signal<Record<string, LeadFile[]>>({});
  private readonly loadingFor = signal<string | null>(null);
  private readonly busy = signal(false);

  /** True while an upload or delete is in flight, so the sheet can disable its controls. */
  readonly working = computed(() => this.busy());

  filesFor(leadId: string | undefined): LeadFile[] {
    if (!leadId) return [];
    return this.byLead()[leadId] ?? [];
  }

  /**
   * `.from()` and `.storage` are reached through a widened client: `lead_files` is not in the
   * generated Database types yet, and regenerating them needs a reachable database. Every row
   * that comes back is mapped through `LeadFileRow` immediately, so the widening stops at this
   * file rather than leaking `any` into the sheet.
   */
  private table(): any {
    return (this.supabase.client as unknown as { from(t: string): any }).from('lead_files');
  }

  /** Storage is not table-typed, so it needs no widening. */
  private get storage() {
    return this.supabase.client.storage;
  }

  async load(leadId: string): Promise<void> {
    if (this.loadingFor() === leadId) return;
    this.loadingFor.set(leadId);
    try {
      const rows = await this.supabase.run<LeadFileRow[]>(
        this.table()
          .select('id, lead_id, name, mime_type, size_bytes, storage_path, created_at')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false }) as never,
      );
      this.byLead.update((all) => ({ ...all, [leadId]: (rows ?? []).map(toFile) }));
    } catch {
      // A list that will not load is not worth a modal on top of the sheet the user opened to
      // do something else. The block renders empty and the next open retries.
    } finally {
      // This is an in-flight guard, not a loaded cache. Leaving the lead id here permanently
      // made the refresh after a successful upload a no-op, so the new row stayed invisible.
      if (this.loadingFor() === leadId) this.loadingFor.set(null);
    }
  }

  /**
   * Uploads each file and records it. Returns how many landed.
   *
   * Files are taken one at a time on purpose: a phone on a bad connection pushing five 5MB
   * documents in parallel is how all five fail together. Each is independent, so a rejected
   * third file does not lose the two that already succeeded.
   */
  async upload(leadId: string, files: readonly File[]): Promise<number> {
    if (!files.length) return 0;
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return 0;
    }

    const tenantId = await this.supabase.resolveTenantId();
    if (!tenantId) {
      this.notify.failed(COPY.lead.files.uploadFailed);
      return 0;
    }

    this.busy.set(true);
    let landed = 0;
    try {
      for (const file of files) {
        const rejection = rejectionOf(file);
        if (rejection) {
          this.notify.failed(rejection);
          continue;
        }

        const ext = extOf(file.name);
        // Tenant first: the Storage policies can only see the path, so the segment they check
        // membership against has to be the first one. The name is a fresh uuid rather than the
        // user's — two files called הצעה.pdf must not collide, and a display name has no
        // business being a key.
        const path = `${tenantId}/${leadId}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;

        const { error: uploadError } = await this.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || 'application/octet-stream' });
        if (uploadError) {
          this.notify.failed(COPY.lead.files.uploadFailedFor(file.name));
          continue;
        }

        try {
          const row = await this.supabase.run<LeadFileRow>(
            this.table()
              .insert({
                tenant_id: tenantId,
                lead_id: leadId,
                storage_path: path,
                name: file.name,
                mime_type: file.type || 'application/octet-stream',
                size_bytes: file.size,
              })
              .select('id, lead_id, name, mime_type, size_bytes, storage_path, created_at')
              .single() as never,
          );
          // Use the inserted server row as the receipt and render it immediately. A later load
          // still reconciles the full list, but visibility no longer depends on a second request.
          this.byLead.update((all) => ({
            ...all,
            [leadId]: [toFile(row), ...(all[leadId] ?? [])],
          }));
          landed++;
        } catch {
          // The object is up but nothing references it, so it would be paid for and unreachable
          // forever. Take it back down before reporting the failure.
          await this.storage.from(BUCKET).remove([path]);
          this.notify.failed(COPY.lead.files.uploadFailedFor(file.name));
        }
      }

      if (landed > 0) {
        this.notify.succeeded(COPY.lead.files.uploaded(landed));
      }
    } finally {
      this.busy.set(false);
    }
    return landed;
  }

  /**
   * Removes the row, then the bytes.
   *
   * Not a database trigger: Storage refuses direct SQL deletes from `storage.objects`
   * (`storage.protect_delete`), so a cleanup trigger would raise and take the row delete — and
   * any lead delete that cascades to it — down with it. See §5 of the migration.
   *
   * Row first: if the object removal fails the file is still gone from the user's list, which is
   * what they asked for, and the cost is an orphan nothing can reach. The other order would leave
   * a visible row pointing at bytes that no longer exist.
   */
  async remove(file: LeadFile): Promise<boolean> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return false;
    }
    this.busy.set(true);
    try {
      await this.supabase.run(
        this.table().delete().eq('id', file.id) as never,
      );
      await this.storage.from(BUCKET).remove([file.storagePath]);
      this.byLead.update((all) => ({
        ...all,
        [file.leadId]: (all[file.leadId] ?? []).filter((f) => f.id !== file.id),
      }));
      this.notify.succeeded(COPY.lead.files.deleted);
      return true;
    } catch {
      this.notify.failed(COPY.lead.files.deleteFailed);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Opens the file. The bucket is private, so this mints a short-lived signed URL rather than
   * linking a path — a link that keeps working after it is forwarded is the whole reason the
   * bucket is not public.
   */
  async open(file: LeadFile): Promise<void> {
    // Open during the click's user-activation window. Waiting for the signed URL first lets
    // popup blockers treat the eventual window as unsolicited, even though the user clicked.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;

    const { data, error } = await this.storage
      .from(BUCKET)
      .createSignedUrl(file.storagePath, 60);
    if (error || !data?.signedUrl) {
      tab?.close();
      this.notify.failed(COPY.lead.files.openFailed);
      return;
    }
    if (tab) {
      tab.location.replace(data.signedUrl);
      return;
    }
    this.notify.failed(COPY.lead.files.openBlocked);
  }

  /**
   * Removes every object belonging to a lead, for callers about to delete the lead itself.
   *
   * The FK cascade takes the rows; nothing in the database can take the objects, so this has to
   * happen before the lead goes — afterwards the rows are gone and the paths with them. Failures
   * are swallowed: the user asked to delete a lead, and refusing to because a stored file could
   * not be tidied would be the wrong trade. What is left is an unreachable orphan.
   */
  async purgeObjectsFor(leadId: string): Promise<void> {
    const paths = this.filesFor(leadId).map((f) => f.storagePath);
    if (!paths.length) return;
    try {
      await this.storage.from(BUCKET).remove(paths);
    } catch {
      // Orphaned bytes, no row. See the migration's §5 note on the sweep that would collect them.
    }
  }

  /** Called when a lead is deleted from under us, so a reopened sheet does not show ghosts. */
  forget(leadId: string): void {
    this.byLead.update((all) => {
      const next = { ...all };
      delete next[leadId];
      return next;
    });
  }
}

function toFile(row: LeadFileRow): LeadFile {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    createdAt: new Date(row.created_at),
  };
}
