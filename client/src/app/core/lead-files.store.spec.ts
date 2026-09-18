import { TestBed } from '@angular/core/testing';

import { LeadFilesStore } from './lead-files.store';
import { NotifyService } from './notify.service';
import { SupabaseService } from './supabase.service';

const row = (id: string, name = `${id}.pdf`) => ({
  id,
  lead_id: 'lead-1',
  name,
  mime_type: 'application/pdf',
  size_bytes: 12,
  storage_path: `tenant-1/lead-1/${id}.pdf`,
  created_at: '2026-08-05T10:00:00.000Z',
});

describe('LeadFilesStore', () => {
  let store: LeadFilesStore;
  let run: jasmine.Spy;
  let upload: jasmine.Spy;
  let createSignedUrl: jasmine.Spy;
  let notify: {
    online: () => boolean;
    blockedOffline: jasmine.Spy;
    failed: jasmine.Spy;
    succeeded: jasmine.Spy;
  };

  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    insert: () => query,
    single: () => query,
  };

  beforeEach(() => {
    run = jasmine.createSpy('run');
    upload = jasmine.createSpy('upload').and.resolveTo({ error: null });
    createSignedUrl = jasmine.createSpy('createSignedUrl');
    notify = {
      online: () => true,
      blockedOffline: jasmine.createSpy('blockedOffline'),
      failed: jasmine.createSpy('failed'),
      succeeded: jasmine.createSpy('succeeded'),
    };

    TestBed.configureTestingModule({
      providers: [
        LeadFilesStore,
        {
          provide: SupabaseService,
          useValue: {
            run,
            resolveTenantId: () => Promise.resolve('tenant-1'),
            client: {
              from: () => query,
              storage: {
                from: () => ({
                  upload,
                  remove: () => Promise.resolve({ error: null }),
                  createSignedUrl,
                }),
              },
            },
          },
        },
        { provide: NotifyService, useValue: notify },
      ],
    });
    store = TestBed.inject(LeadFilesStore);
  });

  it('can reload the same lead and replaces its visible file list', async () => {
    run.and.returnValues(Promise.resolve([row('old')]), Promise.resolve([row('new')]));

    await store.load('lead-1');
    await store.load('lead-1');

    expect(run).toHaveBeenCalledTimes(2);
    expect(store.filesFor('lead-1').map((file) => file.id)).toEqual(['new']);
  });

  it('renders the inserted server row immediately after the object uploads', async () => {
    run.and.resolveTo(row('fresh', 'הצעה.pdf'));
    const file = new File(['proposal'], 'הצעה.pdf', { type: 'application/pdf' });

    await expectAsync(store.upload('lead-1', [file])).toBeResolvedTo(1);

    expect(upload).toHaveBeenCalled();
    expect(store.filesFor('lead-1').map((item) => item.name)).toEqual(['הצעה.pdf']);
    expect(notify.succeeded).toHaveBeenCalled();
  });

  it('opens a tab before awaiting the private file URL, then navigates that tab', async () => {
    let resolveUrl!: (value: { data: { signedUrl: string }; error: null }) => void;
    createSignedUrl.and.returnValue(
      new Promise((resolve) => {
        resolveUrl = resolve;
      }),
    );
    const replace = jasmine.createSpy('replace');
    const tab = { opener: window, location: { replace }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(tab as unknown as Window);

    const opening = store.open({
      id: 'fresh',
      leadId: 'lead-1',
      name: 'הצעה.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      storagePath: 'tenant-1/lead-1/fresh.pdf',
      createdAt: new Date('2026-08-05T10:00:00.000Z'),
    });

    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(replace).not.toHaveBeenCalled();

    resolveUrl({ data: { signedUrl: 'https://files.example/signed' }, error: null });
    await opening;

    expect(replace).toHaveBeenCalledWith('https://files.example/signed');
    expect(tab.opener).toBeNull();
  });
});
