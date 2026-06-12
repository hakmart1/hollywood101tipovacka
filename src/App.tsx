import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import AdminCodesPage from "./AdminCodesPage";
import AdminContestsPage from "./AdminContestsPage";
import UserPage from "./UserPage";
import { availableTimeZones, browserTimeZone } from "./datetime";

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

type Route = "home" | "user" | "admin-codes" | "admin-contests";

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

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [loginState, setLoginState] = useState<LoginState>("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [output, setOutput] = useState("");
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
        <h1>Hollywood 101 Tipovacka</h1>

        <span className="status">
          Login status: <strong>{loginState}</strong>
        </span>

        {currentUser ? (
          <span className="status">
            {currentUser.nickname} ({currentUser.email})
          </span>
        ) : null}

        {currentUser?.role === "admin" ? (
          <span className="status">
            Time zone:{" "}
            <select
              className="timezone-select"
              value={currentUser.timezone || browserTimeZone()}
              onChange={(event) => void handleTimezoneChange(event.currentTarget.value)}
            >
              {availableTimeZones().map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </span>
        ) : null}

        <span className="spacer" />

        {loginState === "not-logged" ? (
          <>
            <button type="button" onClick={() => setSignupOpen(true)}>
              Sign up
            </button>
            <button type="button" onClick={() => setLoginOpen(true)}>
              Login
            </button>
          </>
        ) : null}

        {isLogged ? (
          <>
            {currentUser && currentUser.status !== "active" ? (
              <button type="button" onClick={() => setActivateOpen(true)}>
                Activate account
              </button>
            ) : null}
            {route !== "home" ? (
              <button type="button" onClick={() => (window.location.hash = "#/")}>
                Home
              </button>
            ) : null}
            {route !== "user" ? (
              <button type="button" onClick={() => (window.location.hash = "#/user")}>
                User page
              </button>
            ) : null}
            {currentUser?.role === "admin" && !ADMIN_ROUTES.includes(route) ? (
              <button type="button" onClick={() => (window.location.hash = "#/admin/codes")}>
                Admin
              </button>
            ) : null}
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : null}
      </header>

      {output ? <div className="app-output">{output}</div> : null}

      <main className="app-main">
        {ADMIN_ROUTES.includes(route) && currentUser?.role === "admin" ? (
          <section className="admin">
            <nav className="admin-nav">
              <a href="#/admin/codes" className={route === "admin-codes" ? "active" : ""}>
                Activation codes
              </a>
              <a href="#/admin/contests" className={route === "admin-contests" ? "active" : ""}>
                Contests
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
      </main>

      {signupOpen ? (
        <Modal title="Sign up" onClose={() => setSignupOpen(false)}>
          <form onSubmit={handleSignupSubmit}>
            <div className="form-field">
              <label htmlFor="signup-email">Email</label>
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
              <label htmlFor="signup-nickname">Nickname</label>
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
              <label htmlFor="signup-password">Password</label>
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
              <label htmlFor="signup-password-verify">Verify password</label>
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
                Cancel
              </button>
              <button type="submit" className="primary">
                Create user
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {activateOpen && currentUser ? (
        <Modal title="Activate account" onClose={() => setActivateOpen(false)}>
          <form onSubmit={handleActivateSubmit}>
            <p className="modal-note">
              Enter the activation code for <strong>{currentUser.email}</strong>. Codes are handed
              out by the admin — if you have not received one, you can remind him below.
            </p>
            <div className="form-field">
              <label htmlFor="activation-code">Activation code</label>
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
                Request code
              </button>
              <button type="button" onClick={() => setActivateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Activate
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {infoDialog ? (
        <Modal title="Activation code request" onClose={() => setInfoDialog(null)}>
          <p className="modal-note">{infoDialog}</p>
          <div className="form-actions">
            <button type="button" className="primary" onClick={() => setInfoDialog(null)}>
              OK
            </button>
          </div>
        </Modal>
      ) : null}

      {loginOpen ? (
        <Modal title="Login" onClose={() => setLoginOpen(false)}>
          <form onSubmit={handleLoginSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">Email</label>
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
              <label htmlFor="login-password">Password</label>
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
                Cancel
              </button>
              <button type="submit" className="primary">
                Login
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
