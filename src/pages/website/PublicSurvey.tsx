import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Head } from "../../components/Includes";
import SurveyPopup from "../../components/SurveyPopup";
import Home from "./Home";

/* /survey/:id and /feedback/:id — a public survey (Admin → Surveys, audience "Public",
   type Survey or Feedback) that anyone can answer, no account needed. The home
   page shows behind; the popup asks the visitor's name, email and (optional)
   phone, then the questions one at a time (components/SurveyPopup.tsx, publicId
   mode). The link's type must match the survey's.
   API: api/website/surveys/surveys.js (/public/open-survey, /public/open-survey-submit) */

export default function PublicSurvey() {
  const { id = "" } = useParams();
  const kind = useLocation().pathname.startsWith("/feedback/") ? "feedback" : "survey";
  const title = (kind === "feedback" ? "Feedback" : "Survey") + " - Rivira Technologies";
  // the home page behind has its own <title> (as index.html): set ours after it
  useEffect(() => { document.title = title; }, [title]);
  return (
    <>
      <Head
        pageTitle={title}
        pageDesc="Share your answers with Rivira Technologies."
        pageKeywords=""
      />
      <Home />
      <SurveyPopup key={kind + id} publicId={id} publicKind={kind} />
    </>
  );
}
