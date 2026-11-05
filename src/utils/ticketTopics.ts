/* What a student's support ticket is about ("Concern about") — shown as tiles
   in the Raise a Ticket popup (components/RaiseTicketModal.tsx) and as the
   ticket's title on My Tickets (pages/panel/student/MyTickets.tsx).
   The values must match TICKET_TYPES in api/student/my-tickets/my-tickets.js.
   The first six values existed before (with shorter labels); keep them so older
   tickets still show a name. */
export const TICKET_TYPES: [string, string][] = [
  ["enrollment", "Enrollment & onboarding"],
  ["community", "Skool & WhatsApp access"],
  ["payments", "Payments, refunds & invoices"],
  ["account", "Account & sign-in"],
  ["classes", "Live classes & batches"],
  ["assignments", "Assignments & projects"],
  ["certificates", "Certificates"],
  ["placement", "Placement & career support"],
  ["corporate", "Corporate, B2B & POC"],
  ["workshops", "Workshops & events"],
  ["website", "Website, accessibility & security"],
  ["referrals", "Referrals"],
  ["other", "Something else"],
];

// The ticket's category — must match TICKET_CATEGORIES in the same API file.
export const TICKET_CATEGORIES: [string, string][] = [
  ["technical", "Technical issue"],
  ["content", "Course content"],
  ["billing", "Billing"],
  ["general", "General question"],
];

// stored value -> its name (the value itself for anything unknown)
export const ticketLabel = (list: [string, string][], v: any) =>
  list.find(([k]) => k === String(v))?.[1] || String(v || "—");
