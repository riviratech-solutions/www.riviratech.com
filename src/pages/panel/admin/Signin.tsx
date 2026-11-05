import { useEffect, useState, useRef } from "react";
import { setCachedUser } from "../../../utils/currentUser";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { Head, SERVER_URL } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import { Link } from "react-router-dom";
import { BarChart3, Check, Eye, EyeOff, House, KeyRound, Lock, LogIn, Mail, Rocket, Send, ShieldCheck, Users } from "lucide-react";
import BrainLoader from "../../../components/BrainLoader";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "../../../components/TurnstileWidget";
import { useAuthRateLimit, formatLockCountdown } from "../../../utils/useAuthRateLimit";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const seo = getSeoByPath("");

export default function Page() {

  const getSecurity = async () => {
    const res = await axios.get(
      SERVER_URL + "api/security/token",
      {
        withCredentials: true, // 🔥 REQUIRED
      }
    );

    return res.data;
  };
  const [webloading, setWebLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  /* Server-side sign-in block (api/login-guard.js): 3 wrong attempts block this
     IP and the account for 3 hours, or an admin added a block. `receivedAt`
     turns the server's "seconds remaining" into a live countdown. */
  type LoginBlock = { scope: "ip" | "account"; type: "temp" | "perm"; until: number; remaining: number; reason: string; label: string };
  const [blockInfo, setBlockInfo] = useState<{ blocks: LoginBlock[]; message: string; receivedAt: number } | null>(null);
  const [, setBlockTick] = useState(0);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Per-form client-side throttle (defense-in-depth / UX). Each form gets its own
  // key so a lockout on one doesn't block the others.
  useEffect(() => {
    if (!blockInfo) return;
    const t = setInterval(() => setBlockTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [blockInfo]);
  const blockLeft = (b: LoginBlock) =>
    b.type === "perm" ? Infinity : Math.max(0, b.remaining - Math.floor((Date.now() - (blockInfo?.receivedAt || 0)) / 1000));
  const blockActive = !!blockInfo && blockInfo.blocks.some((b) => blockLeft(b) > 0);
  useEffect(() => {
    if (blockInfo && !blockActive) setBlockInfo(null); // block ended — sign-in is open again
  });
  const fmtLeft = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + x + "s";
  };
  const fmtUntil = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const loginRL = useAuthRateLimit("login");
  const resetReqRL = useAuthRateLimit("reset-request");
  const verifyRL = useAuthRateLimit("verify-otp");
  const resetPwdRL = useAuthRateLimit("reset-password");

  // mode: login | resetnow | verify | reset
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    id: "",
    email: "",
    password: "",
    rpassword: "",
    otp: ["", "", "", "", "", ""],
  });

  const handleChange = (e: any) => {
    setForm(f => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  };

  /* ---------------- PASSWORD TOGGLE ---------------- */

  const [showPwd, setShowPwd] = useState(false);
  // "Remember this device": stay signed in for 30 days (else until the browser closes)
  const [remember, setRemember] = useState(true);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showRPwd, setShowRPwd] = useState(false);

  /* ---------------- OTP ---------------- */

  const handleOtp = (i: any, val: any) => {

    if (!/^\d?$/.test(val)) return;

    const otp = [...form.otp];
    otp[i] = val;

    setForm(f => ({ ...f, otp }));

    if (val && i < 5) {
      const el = document.getElementById(`otp-${i + 1}`);
      if (el instanceof HTMLElement) {
        el.focus();
      }
    }
  };

  // Backspace on an empty box jumps to the previous one (without clearing it);
  // a box with a value clears in place first, then the next Backspace jumps back.
  const handleOtpKeyDown = (i: number, e: any) => {
    if (e.key === "Backspace" && !form.otp[i] && i > 0) {
      e.preventDefault();
      const el = document.getElementById(`otp-${i - 1}`);
      if (el instanceof HTMLElement) el.focus();
    }
  };

  // Paste a full code (e.g. "123456") into any box and it fills all six.
  const handleOtpPaste = (e: any) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const otp = ["", "", "", "", "", ""];
    for (let j = 0; j < text.length; j++) otp[j] = text[j];
    setForm(f => ({ ...f, otp }));
    const focusIdx = Math.min(text.length, 6) - 1;
    const el = document.getElementById(`otp-${focusIdx}`);
    if (el instanceof HTMLElement) el.focus();
  };

  /* ---------------- HANDLERS ---------------- */

  const login = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    const locked = loginRL.check();
    if (locked > 0) {
      const msg = `Too many attempts. Please try again in ${formatLockCountdown(locked)}.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!form.email || !form.password) {
      setError("Email and Password are required");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(SERVER_URL + "api/signin", {
        email: form.email,
        password: form.password,
        captcha: captchaToken,
        remember,
        // device details for the sign-in session record (login_sessions.device)
        client: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          language: navigator.language || "",
          screen: `${window.screen.width}x${window.screen.height}`,
          platform: (navigator as any).userAgentData?.platform || navigator.platform || "",
        },
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
        {
          withCredentials: true, // 🔥 REQUIRED
        });

      // ✅ Reset ONLY if success
      if (res.data.success === true) {
        loginRL.reset();
        // the panel header shows this user (see utils/currentUser.ts)
        setCachedUser(res.data.data);
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setForm({
          id: "",
          email: "",
          password: "",
          rpassword: "",
          otp: ["", "", "", "", "", ""],
        });

        window.location.href = "/dashboard";
      } else if (res.data.redirect) {
        // Already logged in — the server sends us onward instead of a 302 it
        // can't (this is XHR). Not a failed attempt, so don't record/lock.

        window.location.href = res.data.redirect;
      } else if (res.data.blocked) {
        // the server decides blocks; show what is blocked and for how long
        setBlockInfo({ blocks: res.data.blocks || [], message: res.data.message, receivedAt: Date.now() });
        toast.error(res.data.message);
      } else {
        loginRL.recordFailure();
        toast.error(res.data.message);
        setError(res.data.message);
      }

    } catch (err) {

      console.log("err=" + err)
      loginRL.recordFailure();
      setError("You entered invalid log in details ❌");
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }

  };

  const resetRequest = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    const locked = resetReqRL.check();
    if (locked > 0) {
      const msg = `Too many attempts. Please try again in ${formatLockCountdown(locked)}.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!form.email) {
      setError("Please enter email address or phone number");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(SERVER_URL + "api/reset-request", {
        email: form.email,
        captcha: captchaToken,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
        {
          withCredentials: true, // 🔥 REQUIRED
        });

      // ✅ Reset ONLY if success
      if (res.data.success === true) {
        resetReqRL.reset();
        setSuccess(res.data.message);
        toast.success(res.data.message);

        setForm({
          id: "",
          email: form.email,
          password: "",
          rpassword: "",
          otp: ["", "", "", "", "", ""],
        });

        setMode("verify");
      } else {
        resetReqRL.recordFailure();
        toast.error(res.data.message);
        setError(res.data.message);
      }

    } catch (err) {
      resetReqRL.recordFailure();
      setError("You entered invalid details ❌");
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }

  };

  const verifyOtp = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    const locked = verifyRL.check();
    if (locked > 0) {
      const msg = `Too many attempts. Please try again in ${formatLockCountdown(locked)}.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    if (!form.email) {
      setError("Please enter email address or phone number");
      return;
    }
    const otpString = form.otp.join("");
    if (!otpString) {
      setError("Please enter otp");
      return;
    }
    if (otpString.length <= 5) {
      setError("Please enter valid otp");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const otpString = form.otp.join("");

      const res = await axios.post(SERVER_URL + "api/verify-otp", {
        email: form.email,
        otp: otpString,
        captcha: captchaToken,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
        {
          withCredentials: true, // 🔥 REQUIRED
        });

      // ✅ Reset ONLY if success
      if (res.data.success === true) {
        verifyRL.reset();
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setMode("reset");

        setForm((f) => ({
          ...f,
          id: res.data.id,
        }))

      } else {
        verifyRL.recordFailure();
        toast.error(res.data.message);
        setError(res.data.message);
      }

    } catch (err) {
      verifyRL.recordFailure();
      setError("You entered invalid details ❌");
    } finally {
      setLoading(false);
    }

  };

  const resetPassword = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    const locked = resetPwdRL.check();
    if (locked > 0) {
      const msg = `Too many attempts. Please try again in ${formatLockCountdown(locked)}.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    if (!form.email) {
      setError("Please enter email address or phone number");
      return;
    }

    const otpString = form.otp.join("");
    if (!otpString) {
      setError("Please enter otp");
      return;
    }
    if (otpString.length <= 5) {
      setError("Please enter valid otp");
      return;
    }
    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(SERVER_URL + "api/reset-password", {
        email: form.email,
        otp: otpString,
        id: form.id,
        captcha: captchaToken,
        password: form.password,
        rpassword: form.rpassword,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
        {
          withCredentials: true, // 🔥 REQUIRED
        });

      // ✅ Reset ONLY if success
      if (res.data.success === true) {
        resetPwdRL.reset();
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setMode("login");

        setForm({
          id: "",
          email: "",
          password: "",
          rpassword: "",
          otp: ["", "", "", "", "", ""],
        });

      } else {
        resetPwdRL.recordFailure();
        toast.error(res.data.message);
        setError(res.data.message);
      }

    } catch (err) {
      resetPwdRL.recordFailure();
      setError("You entered invalid details ❌");
    } finally {
      setLoading(false);
    }

  };

  const navigate = useNavigate();
  const location = useLocation();

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    if (loggedIn) {
      navigate("/"); // redirect home
    }
  };

  useEffect(() => {

    initchecklogin();

    const params = new URLSearchParams(location.search);

    const type = params.get("t"); // 👈 gets resetnow

    if (type === "resetnow") {
      setMode("resetnow");
    } else if (type === "verify") {
      setMode("verify");
    } else if (type === "reset") {
      setMode("reset");
    } else {
      setMode("login");
    }

    // Clear any captcha token so it can't carry over between forms
    setCaptchaToken(null);

    /* ---------- Signin CSS ---------- */

    /* ---------- Admin CSS ---------- */

    setTimeout(function () {
      setWebLoading(false);
    }, 1000);

    return () => {
      //document.body.removeChild(aosrun);
      if (location.pathname.indexOf("/signin") <= -1) { }
      /*    
          document.body.removeChild(link);
          document.body.removeChild(adminlink); */
    };
  }, [location]);

  // shared bits of the four forms — plain functions, NOT components: a component
  // declared in render would remount every keystroke and reset the captcha
  const alerts = (showError = true) => (<>
    {success && <div className="sgn-alert ok" role="status">{success}</div>}
    {error && showError && <div className="sgn-alert err" role="alert">{error}</div>}
  </>);
  const captcha = () => (
    <div className="sgn-captcha">
      <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} theme="light" />
    </div>
  );
  const lockout = (rl: { isLocked: boolean; secondsLeft: number }) => (
    rl.isLocked ? <div className="sgn-alert err">Too many attempts. Please try again in {formatLockCountdown(rl.secondsLeft)}.</div> : null
  );

  return (<>

    <Head
      pageTitle={seo.title}
      pageDesc={seo.description}
      pageKeywords={seo.keywords}
    />

    <ToastContainer position="top-right" autoClose={2500} />

    <div className="sgn-page">
      {webloading ? (
        <BrainLoader />
      ) : (

        <div className="sgn-card">

          {/* ---------- Left: brand panel ---------- */}
          <aside className="sgn-left" aria-hidden="true">
            <div className="sgn-brand">
              <img src="/images/logo_transparent.png" alt="Rivira Technologies" />
            </div>

            <h1 className="sgn-welcome">
              Welcome to
              <span>Rivira Technologies</span>
            </h1>
            <p className="sgn-tagline">AI-Powered Solutions for a Smarter World.</p>

            <div className="sgn-people">
              <img src="/images/signinpeoples.png" alt="" />
            </div>

            <div className="sgn-features">
              <div className="sgn-feature">
                <span className="ico purple"><Rocket size={22} /></span>
                <span><b>Learn</b><small>Build your skills</small></span>
              </div>
              <div className="sgn-feature">
                <span className="ico blue"><BarChart3 size={22} /></span>
                <span><b>Build</b><small>Work on real projects</small></span>
              </div>
              <div className="sgn-feature">
                <span className="ico green"><Users size={22} /></span>
                <span><b>Lead</b><small>Shape your AI future</small></span>
              </div>
            </div>
          </aside>

          {/* ---------- Right: forms ---------- */}
          <section className="sgn-right">
            <div className="sgn-top">
              <a className="sgn-home" href="/" aria-label="Back to Home"><House size={19} /> <span>Back to Home</span></a>
            </div>

            <div className="sgn-form">

              {/* ================= LOGIN ================= */}
              {mode === "login" && (
                <form onSubmit={login} noValidate={false}>

                  <h2 className="sgn-title">Sign in to <span>Your Account</span></h2>
                  <p className="sgn-sub">Access your admin portal to manage students, courses, and more.</p>

                  {alerts(!blockActive)}

                  {blockActive && blockInfo && (
                    <div className="signin-block" role="alert">
                      <div className="signin-block-head">
                        <i className="fa fa-lock" aria-hidden="true"></i>
                        <strong>Sign-in blocked</strong>
                      </div>
                      <ul>
                        {blockInfo.blocks.map((b) => {
                          const left = blockLeft(b);
                          return (
                            <li key={b.scope}>
                              <span className="what">
                                {b.scope === "account" ? <>Account <b>{b.label}</b></> : <>This network (IP <b>{b.label}</b>)</>}
                              </span>
                              {b.type === "perm" ? (
                                <span className="when perm">Blocked permanently</span>
                              ) : (
                                <span className="when">
                                  Until {fmtUntil(b.until)} · <b>{fmtLeft(left)}</b> left
                                </span>
                              )}
                              {b.reason && <span className="why">Reason: {b.reason}</span>}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="signin-block-note">
                        {blockInfo.blocks.some((b) => b.type === "perm")
                          ? "Please contact support to restore access."
                          : "You can try again when the timer ends. Forgot your password? Use Forgot Password after that."}
                        {" "}Devices where you're already signed in are not affected.
                      </p>
                    </div>
                  )}

                  <div className="sgn-field">
                    <label htmlFor="email">Email Address</label>
                    <div className="sgn-input">
                      <Mail size={20} aria-hidden="true" />
                      <input type="email" id="email" name="email" placeholder="Enter your email address"
                        value={form.email} onChange={handleChange} autoComplete="username" required />
                    </div>
                  </div>

                  <div className="sgn-field">
                    <label htmlFor="password">Password</label>
                    <div className="sgn-input">
                      <Lock size={20} aria-hidden="true" />
                      <input type={showPwd ? "text" : "password"} id="password" name="password" placeholder="Enter your password"
                        value={form.password} onChange={handleChange} autoComplete="current-password" required />
                      <button type="button" className="sgn-eye" onClick={() => setShowPwd(!showPwd)}
                        aria-label={showPwd ? "Hide password" : "Show password"}>
                        {showPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="sgn-row">
                    <label className="sgn-check" htmlFor="remember">
                      <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      <span className="box" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                      Remember this device
                    </label>
                    <Link to="/signin?t=resetnow" className="sgn-link">Forgot Password?</Link>
                  </div>

                  {captcha()}
                  {lockout(loginRL)}

                  <button className="sgn-btn" disabled={loading || loginRL.isLocked || blockActive}>
                    <LogIn size={21} />
                    {blockActive
                      ? "Sign-in blocked"
                      : loginRL.isLocked
                        ? `Locked — ${formatLockCountdown(loginRL.secondsLeft)}`
                        : loading ? "Signing in..." : "Sign In"}
                  </button>

                  <div className="sgn-or"><span>OR</span></div>
                  <p className="sgn-alt">New here? <Link to="/enroll" className="sgn-link">Explore programs &amp; enroll</Link></p>
                </form>
              )}

              {/* ================= RESET REQUEST ================= */}
              {mode === "resetnow" && (
                <form onSubmit={resetRequest}>
                  <h2 className="sgn-title">Reset Your <span>Password</span></h2>
                  <p className="sgn-sub">Enter your account email and we'll send you a one-time code.</p>

                  {alerts()}

                  <div className="sgn-field">
                    <label htmlFor="email">Email Address</label>
                    <div className="sgn-input">
                      <Mail size={20} aria-hidden="true" />
                      <input type="email" id="email" name="email" placeholder="Enter your email address"
                        value={form.email} onChange={handleChange} required />
                    </div>
                  </div>

                  {captcha()}
                  {lockout(resetReqRL)}

                  <button className="sgn-btn" disabled={loading || resetReqRL.isLocked}>
                    <Send size={20} />
                    {resetReqRL.isLocked
                      ? `Locked — ${formatLockCountdown(resetReqRL.secondsLeft)}`
                      : loading ? "Submitting..." : "Send Code"}
                  </button>

                  <p className="sgn-alt">I know my password. <Link to="/signin" className="sgn-link">Sign in</Link></p>
                </form>
              )}

              {/* ================= OTP ================= */}
              {mode === "verify" && (
                <form onSubmit={verifyOtp}>
                  <h2 className="sgn-title">Verify <span>OTP</span></h2>
                  <p className="sgn-sub">Enter the 6-digit code we sent to your email.</p>

                  {alerts()}

                  <div style={{ display: "none" }}>
                    <input value={form.email} name="email" type="text" id="email" readOnly />
                  </div>

                  <div className="otp-field sgn-otp">
                    {form.otp.map((v, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        value={v}
                        onChange={(e) => handleOtp(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={handleOtpPaste}
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>

                  {captcha()}
                  {lockout(verifyRL)}

                  <button className="sgn-btn" disabled={loading || verifyRL.isLocked}>
                    <ShieldCheck size={20} />
                    {verifyRL.isLocked
                      ? `Locked — ${formatLockCountdown(verifyRL.secondsLeft)}`
                      : loading ? "Verifying..." : "Verify"}
                  </button>

                  <p className="sgn-alt"><Link to="/signin" className="sgn-link">Back to sign in</Link></p>
                </form>
              )}

              {/* ================= RESET ================= */}
              {mode === "reset" && (
                <form onSubmit={resetPassword}>
                  <h2 className="sgn-title">Set a New <span>Password</span></h2>
                  <p className="sgn-sub">Choose a new password for your account.</p>

                  {alerts()}

                  <div style={{ display: "none" }}>
                    <input value={form.email} name="email" type="text" readOnly />
                    <input value={form.otp} name="otp" type="text" readOnly />
                    <input value={form.id} name="id" type="text" readOnly />
                  </div>

                  <div className="sgn-field">
                    <label htmlFor="newpwd">New Password</label>
                    <div className="sgn-input">
                      <Lock size={20} aria-hidden="true" />
                      <input id="newpwd" name="password" type={showNewPwd ? "text" : "password"} placeholder="New password"
                        value={form.password} onChange={handleChange} autoComplete="new-password" required />
                      <button type="button" className="sgn-eye" onClick={() => setShowNewPwd(!showNewPwd)}
                        aria-label={showNewPwd ? "Hide password" : "Show password"}>
                        {showNewPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="sgn-field">
                    <label htmlFor="rpwd">Confirm Password</label>
                    <div className="sgn-input">
                      <Lock size={20} aria-hidden="true" />
                      <input id="rpwd" name="rpassword" type={showRPwd ? "text" : "password"} placeholder="Confirm password"
                        value={form.rpassword} onChange={handleChange} autoComplete="new-password" required />
                      <button type="button" className="sgn-eye" onClick={() => setShowRPwd(!showRPwd)}
                        aria-label={showRPwd ? "Hide password" : "Show password"}>
                        {showRPwd ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  </div>

                  {captcha()}
                  {lockout(resetPwdRL)}

                  <button className="sgn-btn" disabled={loading || resetPwdRL.isLocked}>
                    <KeyRound size={20} />
                    {resetPwdRL.isLocked
                      ? `Locked — ${formatLockCountdown(resetPwdRL.secondsLeft)}`
                      : loading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>
              )}

            </div>
          </section>
        </div>

      )}
    </div>
    

  </>
  );

}
