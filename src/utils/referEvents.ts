/* The menu's "Refer a Friend" form (components/AdminMenu.tsx) and the student's
   My Referrals page (pages/panel/student/MyReferrals.tsx) talk through these
   window events: the page asks the menu to open the form, and the menu says
   when a referral was saved so the page reloads its list. */
export const OPEN_REFER = "rt:open-refer";
export const REFER_ADDED = "rt:refer-added";
