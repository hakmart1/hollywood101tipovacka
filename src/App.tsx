import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import AdminCodesPage from "./AdminCodesPage";
import AdminContestsPage from "./AdminContestsPage";
import HomeContests from "./HomeContests";
import HomeResults from "./HomeResults";
import ResultsArchivePage from "./ResultsArchivePage";
import RulesPage from "./RulesPage";
import UserPage from "./UserPage";
import { availableTimeZones, browserTimeZone, timeZoneLabel } from "./datetime";

type UserStatus = "pending_activation" | "active" | "suspended" | "deactivated";

export interface User {
  id: number;
  nickname: string;
  email: string;
  role: string;
  status: UserStatus;
  imf_coins_balance: number;
  timezone: string | null;
}

interface ApiErrorResponse {
  error: string | null;
  message?: string;
}

interface SignupResponse extends ApiErrorResponse {
}

interface LoginResponse extends ApiErrorResponse {
  user?: User | null;
}

interface LogoutResponse extends ApiErrorResponse {
}

type LoginState = "loading" | "not-logged" | "logged but unactive user" | "logged and active user";

type Route = "home" | "user" | "rules" | "history" | "admin-codes" | "admin-contests";

const ADMIN_ROUTES: Route[] = ["admin-codes", "admin-contests"];

const defaultSignupForm = {
  email: "",
  nickname: "",
  password: "",
  passwordVerify: ""
};

const defaultLoginForm = {
  email: "",
  password: ""
};

function readRoute(): Route {
  const hash = window.location.hash;
  if (hash === "#/user") {
    return "user";
  }
  if (hash === "#/admin" || hash === "#/admin/codes") {
    return "admin-codes";
  }
  if (hash === "#/admin/contests") {
    return "admin-contests";
  }
  if (hash === "#/rules") {
    return "rules";
  }
  if (hash === "#/results") {
    return "history";
  }
  return "home";
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressStartedOutside = useRef(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function isOutsideBox(clientX: number, clientY: number): boolean {
    const dialog = dialogRef.current;
    if (!dialog) {
      return false;
    }
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={onClose}
      onMouseDown={(event) => {
        pressStartedOutside.current =
          event.target === dialogRef.current && isOutsideBox(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        // Backdrop clicks target the <dialog> element, but so do clicks on its
        // padding, and a drag released outside reports the release position.
        // Close only when the full click (press AND release) happened outside.
        if (
          pressStartedOutside.current &&
          event.target === dialogRef.current &&
          isOutsideBox(event.clientX, event.clientY)
        ) {
          onClose();
        }
        pressStartedOutside.current = false;
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

function BrandLogo({ className }: { className?: string }) {
  // Director's chair logo (black chair on a yellow tile).
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="48" rx="8" fill="#f0c419" />
      <rect x="13" y="12.5" width="22" height="5" rx="1.5" fill="#1b1b1b" />
      <rect x="11.5" y="24.5" width="25" height="4.5" rx="1.5" fill="#1b1b1b" />
      <g stroke="#1b1b1b" strokeWidth="2.6" strokeLinecap="round">
        <line x1="15.5" y1="17.5" x2="16.5" y2="25" />
        <line x1="32.5" y1="17.5" x2="31.5" y2="25" />
        <line x1="16" y1="29" x2="32" y2="42" />
        <line x1="32" y1="29" x2="16" y2="42" />
        <line x1="13.5" y1="42" x2="18.5" y2="42" />
        <line x1="29.5" y1="42" x2="34.5" y2="42" />
      </g>
    </svg>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [loginState, setLoginState] = useState<LoginState>("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setOutput] = useState("");
  const [signupOpen, setSignupOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [signupForm, setSignupForm] = useState(defaultSignupForm);
  const [loginForm, setLoginForm] = useState(defaultLoginForm);
  const [activationCode, setActivationCode] = useState("");
  const [infoDialog, setInfoDialog] = useState<string | null>(null);

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (loginState === "loading") {
      return;
    }
    if (route === "user" && loginState === "not-logged") {
      window.location.hash = "#/";
    }
    if (ADMIN_ROUTES.includes(route) && currentUser?.role !== "admin") {
      window.location.hash = "#/";
    }
  }, [route, loginState, currentUser]);

  async function refreshSession() {
    try {
      const response = await fetch("/api/me", {
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json()) as { user?: User | null; error: string | null };

      if (!response.ok) {
        setOutput(payload.error || "Could not load session.");
        setCurrentUser(null);
        setLoginState("not-logged");
        return;
      }

      if (payload.error) {
        setOutput(payload.error);
        setCurrentUser(null);
        setLoginState("not-logged");
        return;
      }

      if (!payload.user) {
        setCurrentUser(null);
        setLoginState("not-logged");
        return;
      }

      setCurrentUser(payload.user);
      setLoginState(payload.user.status === "active" ? "logged and active user" : "logged but unactive user");
    } catch {
      setOutput("Could not reach the backend functions.");
      setCurrentUser(null);
      setLoginState("not-logged");
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (signupForm.password !== signupForm.passwordVerify) {
      setOutput("Passwords do not match.");
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        email: signupForm.email,
        nickname: signupForm.nickname,
        password: signupForm.password
      })
    });

    const payload = (await response.json()) as SignupResponse;

    if (!response.ok || payload.error) {
      setOutput(payload.error || "Sign up failed.");
      return;
    }

    setOutput(payload.message || "User created.");
    setSignupOpen(false);
    setSignupForm(defaultSignupForm);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        email: loginForm.email,
        password: loginForm.password
      })
    });

    const payload = (await response.json()) as LoginResponse;

    if (!response.ok || payload.error) {
      setOutput(payload.error || "Login failed.");
      return;
    }

    setOutput(payload.message || "Login successful.");
    setLoginOpen(false);
    setLoginForm(defaultLoginForm);
    await refreshSession();
  }

  async function handleActivateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    const response = await fetch("/api/auth/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        email: currentUser.email,
        code: activationCode
      })
    });

    const payload = (await response.json()) as ApiErrorResponse;

    if (!response.ok || payload.error) {
      setOutput(payload.error || "Activation failed.");
      return;
    }

    setOutput(payload.message || "Account activated.");
    setActivateOpen(false);
    setActivationCode("");
    await refreshSession();
  }

  async function handleRequestCode() {
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { Accept: "application/json" }
    });

    const payload = (await response.json()) as ApiErrorResponse;
    setActivateOpen(false);
    setInfoDialog(payload.error || payload.message || "Activation code requested.");
  }

  async function handleTimezoneChange(timezone: string) {
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ timezone })
    });

    const payload = (await response.json()) as ApiErrorResponse;
    setOutput(payload.error || payload.message || "Time zone updated.");
    await refreshSession();
  }

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    const payload = (await response.json()) as LogoutResponse;
    setOutput(payload.error || payload.message || "Logged out.");
    window.location.hash = "#/";
    await refreshSession();
  }

  const isLogged = loginState === "logged but unactive user" || loginState === "logged and active user";

  return (
    <>
      <header className="app-header">
        <a className="brand" href="#/">
          <BrandLogo className="brand-logo" />
          <span className="brand-name">
            Hollywood&nbsp;101 <strong>Tipovačka</strong>
          </span>
        </a>

        <div className="auth">
          {loginState === "not-logged" ? (
            <>
              <button type="button" className="ghost" onClick={() => setSignupOpen(true)}>
                Registrace
              </button>
              <button type="button" className="primary" onClick={() => setLoginOpen(true)}>
                Přihlásit
              </button>
            </>
          ) : null}

          {isLogged && currentUser ? (
            <>
              {currentUser.status !== "active" ? (
                <button type="button" className="ghost" onClick={() => setActivateOpen(true)}>
                  Aktivovat
                </button>
              ) : null}
              <span className="user-chip">
                {currentUser.nickname}
                {currentUser.status !== "active" ? (
                  <span className="user-badge">neaktivní</span>
                ) : null}
              </span>
              <button type="button" className="ghost" onClick={handleLogout}>
                Odhlásit
              </button>
            </>
          ) : null}
        </div>
      </header>

      <nav className="app-nav">
        <a href="#/" className={route === "home" ? "active" : ""}>
          Domů
        </a>
        <a href="#/results" className={route === "history" ? "active" : ""}>
          Výsledky
        </a>
        <a href="#/rules" className={route === "rules" ? "active" : ""}>
          Pravidla
        </a>
        {isLogged ? (
          <a href="#/user" className={route === "user" ? "active" : ""}>
            Můj účet
          </a>
        ) : null}
        {currentUser?.role === "admin" ? (
          <a href="#/admin/contests" className={ADMIN_ROUTES.includes(route) ? "active" : ""}>
            Administrace
          </a>
        ) : null}
      </nav>

      <main className="app-main">
        {ADMIN_ROUTES.includes(route) && currentUser?.role === "admin" ? (
          <section className="admin">
            <div className="admin-toolbar">
              <label>
                Časové pásmo:{" "}
                <select
                  className="timezone-select"
                  value={currentUser.timezone || ""}
                  onChange={(event) => void handleTimezoneChange(event.currentTarget.value)}
                >
                  <option value="">Místní — {timeZoneLabel(browserTimeZone())}</option>
                  {(currentUser.timezone && !availableTimeZones().includes(currentUser.timezone)
                    ? [currentUser.timezone, ...availableTimeZones()]
                    : availableTimeZones()
                  ).map((zone) => (
                    <option key={zone} value={zone}>
                      {timeZoneLabel(zone)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <nav className="admin-nav">
              <a href="#/admin/contests" className={route === "admin-contests" ? "active" : ""}>
                Tipovačky
              </a>
              <a href="#/admin/codes" className={route === "admin-codes" ? "active" : ""}>
                Aktivační kódy
              </a>
            </nav>
            {route === "admin-codes" ? (
              <AdminCodesPage onMessage={setOutput} timezone={currentUser.timezone} />
            ) : null}
            {route === "admin-contests" ? (
              <AdminContestsPage onMessage={setOutput} timezone={currentUser.timezone} />
            ) : null}
          </section>
        ) : null}

        {route === "user" && currentUser ? (
          <UserPage user={currentUser} onMessage={setOutput} onSessionRefresh={refreshSession} />
        ) : null}

        {route === "home" ? (
          <>
            <section className="hero">
              <BrandLogo className="hero-logo" />
              <div className="hero-text">
                <h1>Hollywood 101 Tipovačka</h1>
                <p>Tipni si víkendové tržby filmů, trefuj se co nejpřesněji a sbírej IMF coiny.</p>
              </div>
            </section>
            <HomeContests user={currentUser} onMessage={setOutput} onSessionRefresh={refreshSession} />
            <HomeResults onMessage={setOutput} />
          </>
        ) : null}

        {route === "rules" ? <RulesPage /> : null}

        {route === "history" ? <ResultsArchivePage onMessage={setOutput} /> : null}
      </main>

      {signupOpen ? (
        <Modal title="Registrace" onClose={() => setSignupOpen(false)}>
          <form onSubmit={handleSignupSubmit}>
            <div className="form-field">
              <label htmlFor="signup-email">E-mail</label>
              <input
                id="signup-email"
                type="email"
                required
                autoFocus
                value={signupForm.email}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSignupForm((current) => ({ ...current, email: value }));
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="signup-nickname">Přezdívka</label>
              <input
                id="signup-nickname"
                required
                value={signupForm.nickname}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSignupForm((current) => ({ ...current, nickname: value }));
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="signup-password">Heslo</label>
              <input
                id="signup-password"
                type="password"
                required
                value={signupForm.password}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSignupForm((current) => ({ ...current, password: value }));
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="signup-password-verify">Heslo znovu</label>
              <input
                id="signup-password-verify"
                type="password"
                required
                value={signupForm.passwordVerify}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setSignupForm((current) => ({ ...current, passwordVerify: value }));
                }}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setSignupOpen(false)}>
                Zrušit
              </button>
              <button type="submit" className="primary">
                Vytvořit účet
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {activateOpen && currentUser ? (
        <Modal title="Aktivace účtu" onClose={() => setActivateOpen(false)}>
          <form onSubmit={handleActivateSubmit}>
            <p className="modal-note">
              Zadejte aktivační kód pro <strong>{currentUser.email}</strong>. Kódy rozdává
              administrátor — pokud jste žádný nedostali, můžete mu níže poslat připomenutí.
            </p>
            <div className="form-field">
              <label htmlFor="activation-code">Aktivační kód</label>
              <input
                id="activation-code"
                required
                autoFocus
                value={activationCode}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setActivationCode(value);
                }}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => void handleRequestCode()}>
                Požádat o kód
              </button>
              <button type="button" onClick={() => setActivateOpen(false)}>
                Zrušit
              </button>
              <button type="submit" className="primary">
                Aktivovat
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {infoDialog ? (
        <Modal title="Žádost o aktivační kód" onClose={() => setInfoDialog(null)}>
          <p className="modal-note">{infoDialog}</p>
          <div className="form-actions">
            <button type="button" className="primary" onClick={() => setInfoDialog(null)}>
              OK
            </button>
          </div>
        </Modal>
      ) : null}

      {loginOpen ? (
        <Modal title="Přihlášení" onClose={() => setLoginOpen(false)}>
          <form onSubmit={handleLoginSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                value={loginForm.email}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setLoginForm((current) => ({ ...current, email: value }));
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Heslo</label>
              <input
                id="login-password"
                type="password"
                required
                value={loginForm.password}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setLoginForm((current) => ({ ...current, password: value }));
                }}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setLoginOpen(false)}>
                Zrušit
              </button>
              <button type="submit" className="primary">
                Přihlásit
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
