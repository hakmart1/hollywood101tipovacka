import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type UserStatus = "pending_activation" | "active" | "suspended";

interface User {
  id: string;
  nickname: string;
  email: string;
  role: string;
  status: UserStatus;
  imf_coins_balance: number;
}

interface ApiErrorResponse {
  error?: string;
}

interface SignupResponse extends ApiErrorResponse {
  ok?: boolean;
  message?: string;
  debugActivationCode?: string;
}

interface LoginResponse extends ApiErrorResponse {
  ok?: boolean;
  user?: User;
}

type LoginState = "loading" | "not-logged" | "logged but unactive user" | "logged and active user";

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

export default function App() {
  const [loginState, setLoginState] = useState<LoginState>("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [output, setOutput] = useState("");
  const [activationCodeOutput, setActivationCodeOutput] = useState("");
  const [signupOpen, setSignupOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupForm, setSignupForm] = useState(defaultSignupForm);
  const [loginForm, setLoginForm] = useState(defaultLoginForm);

  useEffect(() => {
    void refreshSession();
  }, []);

  async function refreshSession() {
    try {
      const response = await fetch("/api/me", {
        headers: {
          Accept: "application/json"
        }
      });

      if (response.status === 401) {
        setCurrentUser(null);
        setLoginState("not-logged");
        return;
      }

      const payload = (await response.json()) as { user?: User; error?: string };

      if (!response.ok || !payload.user) {
        setOutput(payload.error || "Could not load session.");
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

    if (!response.ok) {
      setOutput(payload.error || "Sign up failed.");
      setActivationCodeOutput("");
      return;
    }

    setOutput(payload.message || "User created.");
    setActivationCodeOutput(
      payload.debugActivationCode ? `Debug activation code: ${payload.debugActivationCode}` : ""
    );
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

    if (!response.ok) {
      setOutput(payload.error || "Login failed.");
      return;
    }

    setOutput("Login successful.");
    setLoginOpen(false);
    setLoginForm(defaultLoginForm);
    await refreshSession();
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    setOutput("Logged out.");
    await refreshSession();
  }

  return (
    <main>
      <h1>Hollywood 101 Tipovacka</h1>

      <p>
        Login status: <strong>{loginState}</strong>
      </p>

      <p>
        {currentUser
          ? `User: ${currentUser.nickname} | Email: ${currentUser.email} | DB status: ${currentUser.status}`
          : ""}
      </p>

      <p>{output}</p>
      <p>{activationCodeOutput}</p>

      {loginState === "not-logged" ? (
        <p>
          <button type="button" onClick={() => setSignupOpen(true)}>
            Sign up
          </button>{" "}
          <button type="button" onClick={() => setLoginOpen(true)}>
            Login
          </button>
        </p>
      ) : (
        <p>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </p>
      )}

      {signupOpen ? (
        <dialog open>
          <form onSubmit={handleSignupSubmit}>
            <p>
              <strong>Sign up</strong>
            </p>
            <p>
              <label>
                Email
                <br />
                <input
                  type="email"
                  required
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, email: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <label>
                Nickname
                <br />
                <input
                  required
                  value={signupForm.nickname}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, nickname: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <label>
                Password
                <br />
                <input
                  type="password"
                  required
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, password: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <label>
                Verify password
                <br />
                <input
                  type="password"
                  required
                  value={signupForm.passwordVerify}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, passwordVerify: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <button type="submit">Create user</button>{" "}
              <button type="button" onClick={() => setSignupOpen(false)}>
                Cancel
              </button>
            </p>
          </form>
        </dialog>
      ) : null}

      {loginOpen ? (
        <dialog open>
          <form onSubmit={handleLoginSubmit}>
            <p>
              <strong>Login</strong>
            </p>
            <p>
              <label>
                Email
                <br />
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <label>
                Password
                <br />
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.currentTarget.value }))
                  }
                />
              </label>
            </p>
            <p>
              <button type="submit">Login</button>{" "}
              <button type="button" onClick={() => setLoginOpen(false)}>
                Cancel
              </button>
            </p>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
