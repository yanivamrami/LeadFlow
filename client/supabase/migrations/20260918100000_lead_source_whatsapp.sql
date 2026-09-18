-- `whatsapp` joins lead_source. Its own migration on purpose: a value added by
-- `alter type ... add value` cannot be referenced in the same transaction, and
-- 20260918100100 uses it. First caller is the Netlush WhatsApp bot through
-- capture-lead (documents/PLAN-capture-lead.md).
alter type public.lead_source add value if not exists 'whatsapp';
