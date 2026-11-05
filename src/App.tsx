import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Header, Footer } from './components/Includes';
import { useState, useEffect } from 'react'

import { AdminLayout } from './components/AdminMenu';

import ModalsController from "./modals/ModalsController";

import WebAIChatbot from "./components/WebAIChatbot";
import SurveyPopup from "./components/SurveyPopup";


import ScrollToTop from "./ScrollToTop";
import { ExportChoiceHost } from "./components/ExportChoice";
import GoogleAnalytics from "./components/GoogleAnalytics";

import Home from './pages/website/Home';
import About from './pages/website/About';
import Services from './pages/website/Services';
import Courses from './pages/website/Courses';
import Gallery from './pages/website/Gallery';
import AIForCoders from './pages/website/AIForCoders';
import GenAIForBusiness from './pages/website/GenAIForBusiness';
import AIForKids from './pages/website/AIForKids';
import AIForNonCoders from './pages/website/AIForNonCoders';
import AIStack from './pages/website/AIStack';
import CorporateTraining from './pages/website/CorporateTraining';
import CoursePlan from './pages/website/CoursePlan';
import ProgramGenAI from './pages/website/ProgramGenAI';
import Careers from './pages/website/Careers';

import Blogs from './pages/website/Blogs';
import BlogPost from './pages/website/BlogPost';
import Faq from './pages/website/Faq';
import Legal from './pages/website/Legal';
import Workshop from './pages/website/Workshop';
import Business from './pages/website/Business';

import Events from './pages/website/Events';

import Payment from './pages/website/Payment';

import Contact from './pages/website/Contact';
import Enroll from './pages/website/Enroll';
import CertificateRequest from './pages/website/CertificateRequest';
import CertificateDownload from './pages/website/CertificateDownload';


import Signin from './pages/panel/admin/Signin';
import Dashboard from './pages/panel/admin/Dashboard';
import MyProfile from './pages/panel/admin/MyProfile';
import Batches from './pages/panel/admin/Batches';
import StudentsInquiries from './pages/panel/admin/StudentsInquiries';
import Enrollees from './pages/panel/admin/Enrollees';
import Trainers from './pages/panel/admin/Trainers';
import Students from './pages/panel/admin/Students';
import AdminCourses from './pages/panel/admin/Courses';
import Certificates from './pages/panel/admin/Certificates';
import CertificateRequests from './pages/panel/admin/CertificateRequests';
import Assignments from './pages/panel/admin/Assignments';
import Trainercontacts from './pages/panel/admin/Trainercontacts';
import Webcontacts from './pages/panel/admin/Webcontacts';
import QASession from './pages/panel/admin/QASession';
import Feedbacks from './pages/panel/admin/Feedbacks';
import Referredfriends from './pages/panel/admin/Referredfriends';
import Subscriptions from './pages/panel/admin/Subscriptions';
import LiveClasses from './pages/panel/admin/LiveClasses';
import Classes from './pages/panel/admin/Classes';
import AdminEvents from './pages/panel/admin/Events';
import AdminWorkshops from './pages/panel/admin/Workshops';
import WorkshopRegistrations from './pages/panel/admin/WorkshopRegistrations';
import AdminGallery from './pages/panel/admin/Gallery';
import AdminBlogs from './pages/panel/admin/Blogs';
import BlogCategories from './pages/panel/admin/BlogCategories';
import AdminBackup from './pages/panel/admin/Backup';
import StripeCoupons from './pages/panel/admin/StripeCoupons';
import StripePromoCodes from './pages/panel/admin/StripePromoCodes';
import CustomForms from './pages/panel/admin/CustomForms';
import CustomPages from './pages/panel/admin/CustomPages';
import Surveys from './pages/panel/admin/Surveys';
import Adminers from './pages/panel/admin/Adminers';
import Activities from './pages/panel/admin/Activities';
import Newsletter from './pages/panel/admin/Newsletter';
import SiteFeedback from './pages/panel/admin/SiteFeedback';
import Raisedtickets from './pages/panel/admin/Raisedtickets';
import LoginBlocks from './pages/panel/admin/LoginBlocks';
import LoginSessions from './pages/panel/admin/LoginSessions';
import Jobs from './pages/panel/admin/Jobs';
import PublicForm from './pages/website/PublicForm';
import PublicSurvey from './pages/website/PublicSurvey';
import CustomPage from './pages/website/CustomPage';
import AdminTestimonials from './pages/panel/admin/Testimonials';
import AdminMarquees from './pages/panel/admin/Marquees';
import ServerLogs from './pages/panel/admin/ServerLogs';
import DashboardNotices from './pages/panel/admin/DashboardNotices';
import AdminYouTube from './pages/panel/admin/YouTube';
import AdminPartners from './pages/panel/admin/Partners';
import AdminClassSchedules from './pages/panel/admin/ClassSchedules';
import StudentClassSchedule from './pages/panel/student/ClassSchedule';
import StudentMyReferrals from './pages/panel/student/MyReferrals';
import AdminPlanSlides from './pages/panel/admin/PlanSlides';
import GoogleDriveAuth from './pages/panel/admin/GoogleDriveAuth';

import MyIDCard from './pages/panel/student/MyIDCard';
import MyTickets from './pages/panel/student/MyTickets';
import MyFeedback from './pages/panel/student/MyFeedback';
import StudentTrainerContacts from './pages/panel/student/TrainerContacts';
import TrainerPanelContacts from './pages/panel/trainer/TrainerContacts';
import Logout from './pages/panel/Logout';
import { useAutoReveal } from './utils/autoReveal';

let hasShownLoader = false

// Old /blogs/<slug> links (emails, shares) → the article's /blog/<slug> URL.
function BlogSlugRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/blog/${slug}`} replace />;
}

// Adds (or removes) a route-scoped stylesheet <link> by id.
function toggleStylesheet(id: string, href: string, on: boolean) {
  const existing = document.getElementById(id);
  if (on && !existing) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  } else if (!on && existing) {
    existing.remove();
  }
}

function AppContent() {

  const location = useLocation()
  const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, '') || '/'

  const isPanel =
    normalizedPath === "/signin" ||
    normalizedPath === "/logout" ||
    normalizedPath === "/dashboard" ||
    normalizedPath.startsWith("/panel");

  // Website pages that bring their own chrome: /payment is a single-purpose
  // checkout page, /legal/* has its own top bar and footer. normalizedPath === "/payment" ||
 // const hideLayout = isPanel || normalizedPath === "/certificate/download" || normalizedPath === "/legal" || normalizedPath.startsWith("/legal/");
  const hideLayout = isPanel || normalizedPath === "/certificate/download";
  const hideMc = normalizedPath === "/payment";
  
  // Stylesheets are route-scoped. Website: css/website.css (linked in
  // index.html). Admin panel: css/panel-base.css (the previous site
  // stylesheet the panel was built on) + css/panel.css. index.html applies the
  // same switch before first paint; this keeps it right on client navigation.
  useEffect(() => {
    // website.css is removed (not just disabled) on panel pages, sign in
    // included, and comes back when navigating to a website page
    toggleStylesheet("website-css", "/css/website.css", !isPanel);
    toggleStylesheet("rivira-design-css", "/css/rivira-design.css", !isPanel);
    toggleStylesheet("panel-base-css", "/css/panel-base.css", isPanel);
    toggleStylesheet("panel-css-bundle", "/css/panel.css", isPanel);
  }, [isPanel]);
  // Initialise to true on the very first load so the loader paints immediately —
  // starting false let the page render for a frame before the effect flipped it on.
  const [showLoader, setShowLoader] = useState(!hasShownLoader)
  const [isLoaderExiting, setIsLoaderExiting] = useState(false)

  // Scroll-reveal engine (window.AOS === custom Wow plugin). once:false makes
  // elements replay in reverse when scrolled back up. The engine only hides
  // elements once it's active (html.wow-ready), so this init isn't load-bearing
  // for visibility — content stays visible even if it never runs.
  useEffect(() => {
    const AOS = (window as any).AOS
    if (AOS) AOS.init({ once: false, duration: 700 })
  }, [])

  useEffect(() => {
    const AOS = (window as any).AOS
    if (AOS) AOS.refreshHard()
  }, [location.pathname])

  // Professional scroll-reveal on every website page (not the panels): headings,
  // intro text, card grids and images rise in as they scroll into view.
  useAutoReveal(!isPanel, location.pathname)

  // The site loader is a plain-JS plugin (public/js/neuralbrain.js) that is on
  // screen from the first paint, before this bundle has even downloaded. Tell
  // it the app is ready; it fades out once it has been up for its minimum
  // time (data-min-ms on #rt-loader in index.html) while the page fades in.
  useEffect(() => {
    if (hasShownLoader) return
    hasShownLoader = true
    const loader = (window as any).RTLoader
    if (!loader) {
      setIsLoaderExiting(true)
      setShowLoader(false)
      return
    }
    loader.ready({
      onExit: () => setIsLoaderExiting(true),
      onHidden: () => setShowLoader(false),
    })
  }, [])

  const mainStyle: React.CSSProperties = {
    opacity: showLoader && !isLoaderExiting ? 0 : 1,
    // IMPORTANT: fall back to 'none' (not 'scale(1)') once the intro is done —
    // any transform on this wrapper makes it the containing block for every
    // position:fixed descendant (header .fixed-top, .whatsapp button, modals),
    // breaking their viewport positioning. 'none' keeps fixed working; the scale
    // is only applied during the loader intro/exit for the zoom animation.
    transform: showLoader
      ? (isLoaderExiting ? 'scale(1)' : 'scale(0.96)')
      : 'none',
    transition:
      'opacity 0.8s cubic-bezier(0.25,1,0.5,1), transform 0.8s cubic-bezier(0.25,1,0.5,1)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <>

      <div style={mainStyle}>
        <ScrollToTop />
        <GoogleAnalytics />
        {/* Emailed one-click survey link (/?r=<survey id>&u=member) opens the survey popup
            on any page, no login required. Renders nothing without those params. */}
        <SurveyPopup />
        {/* admin lists' Excel / CSV: "this page or all rows?" (components/ExportChoice) */}
        <ExportChoiceHost />
        {!hideLayout && <Header />}

        {/* rv-body: the page area between header and footer (its palette is scoped here, public/css/rivira-design.css "BODY THEME") */}
        <div className="rv-body">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/about-us" element={<Navigate to="/about" replace />} />
          <Route path="/services" element={<Services />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/course-plan" element={<CoursePlan />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/careers/:slug" element={<Careers />} />
          <Route path="/programs" element={<ProgramGenAI />} />
          <Route path="/program/generative-ai-engineer" element={<Navigate to="/programs" replace />} />
          <Route path="/gallery" element={<Gallery />} />

          <Route path="/ai-for-coders" element={<AIForCoders />} />
          <Route path="/ai-for-kids" element={<AIForKids />} />
          <Route path="/ai-for-non-coders" element={<AIForNonCoders />} />
          <Route path="/genai-for-business" element={<GenAIForBusiness />} />
          <Route path="/corporate-training" element={<CorporateTraining />} />
          <Route path="/ai-stack" element={<AIStack />} />

          {/* Projects & POC were merged into the Business page */}
          <Route path="/poc" element={<Navigate to="/business" replace />} />
          <Route path="/projects" element={<Navigate to="/business" replace />} />

          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/blogs/:slug" element={<BlogSlugRedirect />} />
          <Route path="/faq" element={<Faq />} />

          <Route path="/events" element={<Events />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/workshops" element={<Navigate to="/workshop" replace />} />
          <Route path="/business" element={<Business />} />

          <Route path="/enroll" element={<Enroll />} />
          <Route path="/form/:slug" element={<PublicForm />} />

          <Route path="/survey/:id" element={<PublicSurvey />} />
          <Route path="/feedback/:id" element={<PublicSurvey />} />
          
          <Route path="/contact" element={<Contact />} />
          
          <Route path="/certificate-request" element={<CertificateRequest />} />
          <Route path="/request-certificate" element={<Navigate to="/certificate-request" replace />} />

          <Route path="/certificate/download" element={<CertificateDownload />} />
          <Route path="/panel/certificate/download" element={<CertificateDownload isPanel={true} />} />

          {/* One Legal & Policies page, one sub-path per document */}
          <Route path="/legal" element={<Legal />} />
          <Route path="/legal/:doc" element={<Legal />} />
          <Route path="/privacy-policy" element={<Navigate to="/legal/privacy-policy" replace />} />
          <Route path="/terms-and-conditions" element={<Navigate to="/legal/terms-and-conditions" replace />} />
          <Route path="/refund-policy" element={<Navigate to="/legal/refund-policy" replace />} />
          <Route path="/accessibility" element={<Navigate to="/legal/accessibility" replace />} />
          <Route path="/security" element={<Navigate to="/legal/security" replace />} />

          <Route path="/payment" element={<Payment />} />

          <Route path="/signin" element={<Signin />} />
          <Route path="/logout" element={<Logout />} />

          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/panel/batches" element={<Batches />} />
            <Route path="/panel/trainers" element={<Trainers />} />
            <Route path="/panel/students-inquiries" element={<StudentsInquiries />} />
            <Route path="/panel/enrollees" element={<Enrollees />} />
            <Route path="/panel/students" element={<Students />} />
            <Route path="/panel/courses" element={<AdminCourses />} />
            <Route path="/panel/certificates" element={<Certificates />} />
            <Route path="/panel/certificate-requests" element={<CertificateRequests />} />
            <Route path="/panel/assignments" element={<Assignments />} />
            <Route path="/panel/trainer-contacts" element={<Trainercontacts />} />
            <Route path="/panel/web-contacts" element={<Webcontacts />} />
            <Route path="/panel/newsletter" element={<Newsletter />} />
            <Route path="/panel/site-feedback" element={<SiteFeedback />} />
            <Route path="/panel/raised-tickets" element={<Raisedtickets />} />
            <Route path="/panel/login-blocks" element={<LoginBlocks />} />
            <Route path="/panel/login-sessions" element={<LoginSessions />} />
            <Route path="/panel/my-sessions" element={<LoginSessions self />} />
            <Route path="/panel/jobs" element={<Jobs />} />
            {/* one page, three roles — see QASession.tsx */}
            <Route path="/panel/qa-session" element={<QASession />} />
            <Route path="/panel/feedbacks" element={<Feedbacks />} />
            <Route path="/panel/referred-friends" element={<Referredfriends />} />
            <Route path="/panel/subscriptions" element={<Subscriptions />} />
            <Route path="/panel/live-classes" element={<LiveClasses />} />
            {/* view only, every role — see Classes.tsx */}
            <Route path="/panel/classes" element={<Classes />} />
            <Route path="/panel/events" element={<AdminEvents />} />
            <Route path="/panel/workshops" element={<AdminWorkshops />} />
            <Route path="/panel/workshop-registrations" element={<WorkshopRegistrations />} />
            <Route path="/panel/gallery" element={<AdminGallery />} />
            <Route path="/panel/blogs" element={<AdminBlogs />} />
            <Route path="/panel/blog-categories" element={<BlogCategories />} />
            <Route path="/panel/backup" element={<AdminBackup />} />
            <Route path="/panel/coupons" element={<StripeCoupons />} />
            <Route path="/panel/promotion-codes" element={<StripePromoCodes />} />
            <Route path="/panel/forms" element={<CustomForms />} />
            <Route path="/panel/pages" element={<CustomPages />} />
            <Route path="/panel/surveys" element={<Surveys />} />            <Route path="/panel/adminers" element={<Adminers />} />
            <Route path="/panel/activities" element={<Activities />} />
            <Route path="/panel/testimonials" element={<AdminTestimonials />} />
            <Route path="/panel/marquees" element={<AdminMarquees />} />
            <Route path="/panel/server-logs" element={<ServerLogs />} />
            <Route path="/panel/dashboard-notices" element={<DashboardNotices />} />
            <Route path="/panel/youtube" element={<AdminYouTube />} />
            <Route path="/panel/partners" element={<AdminPartners />} />
            <Route path="/panel/class-schedules" element={<AdminClassSchedules />} />
            <Route path="/panel/class-schedule" element={<StudentClassSchedule />} />
            <Route path="/panel/my-referrals" element={<StudentMyReferrals />} />
            <Route path="/panel/plan-slides" element={<AdminPlanSlides />} />
            <Route path="/panel/google-drive" element={<GoogleDriveAuth />} />
            <Route path="/panel/drive-auth" element={<GoogleDriveAuth />} />

            <Route path="/panel/myidcard" element={<MyIDCard />} />
            <Route path="/panel/my-tickets" element={<MyTickets />} />
            <Route path="/panel/my-feedback" element={<MyFeedback />} />
            <Route path="/panel/student/trainer-contacts" element={<StudentTrainerContacts />} />
            <Route path="/panel/trainer/trainer-contacts" element={<TrainerPanelContacts />} />
            <Route path="/panel/myprofile" element={<MyProfile />} />
          </Route>

          {/* Any path no static route claimed → try to render an admin-built
              Custom Page (handles /slug and /slug/slug); falls back to 404. */}
          <Route path="/*" element={<CustomPage />} />

        </Routes>
        </div>

        {!hideLayout && <Footer />}

        {!hideLayout && <WebAIChatbot />}

        {!hideLayout && !hideMc && <ModalsController />}

      </div>
    </>
  );
}


export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}
