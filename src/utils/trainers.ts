import { listFetch } from "./listCache";

/* Every trainer and the courses they teach, in one request: api/get-trainers
   without a course answers one row per trainer and course ({ mem_id, name,
   email, qualification, course }). listFetch keeps the answer for 10 minutes
   (and drops it after any change), so opening a form or picking another course
   doesn't fetch again — the trainers of a course are picked from this list.
   Used by the admin Assignments and Live Classes pages. */

export type TrainerRow = {
  mem_id: string;
  name: string;
  email?: string;
  qualification?: string;
  course?: string;
};

// one request even when several parts of a page ask at the same moment
let pending: Promise<TrainerRow[]> | null = null;

export function loadAllTrainers(fresh = false): Promise<TrainerRow[]> {
  if (pending && !fresh) return pending;
  const p = listFetch("api/get-trainers", { status: "", course: "" }, { fresh })
    .then((res) => (res.data && res.data.success && Array.isArray(res.data.data) ? res.data.data : []))
    .catch(() => [] as TrainerRow[])
    .finally(() => {
      if (pending === p) pending = null;
    });
  pending = p;
  return p;
}

/** The trainers of one course (all trainers when no course), each once, by name. */
export function trainersForCourse(rows: TrainerRow[], course?: string): TrainerRow[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => (!course || r.course === course) && !seen.has(r.mem_id) && !!seen.add(r.mem_id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
