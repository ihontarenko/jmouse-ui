import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { ApiProblem } from "@jmouse/parallax";
import { DEFAULT_EMULATOR_APPEARANCE } from "@jmouse/parallax/circuit";
import { ParallaxNavigationProvider, ParallaxSettingsProvider, ParallaxTransportProvider, type ParallaxSettings } from "@jmouse/parallax-react";
import "./sample.css";
import { sampleTransport, signIn } from "./session";
import { addressOf, DEFAULT_CIRCUIT, DEFAULT_OBJECT, sampleNavigation, useSampleRoute } from "./navigation";
import { ObjectPage } from "./ObjectPage";
import { BenchPage } from "./BenchPage";

/** What this host chooses for the components: no workspace for queued runs, no frame-rate floor, the default bench look. */
const sampleSettings: ParallaxSettings = {
  computationOwner: null,
  minimumFrameRate: 0,
  emulatorAppearance: DEFAULT_EMULATOR_APPEARANCE,
};

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setProblem(null);
    try {
      await signIn(handle, password);
      onSignedIn();
    } catch (error) {
      setProblem(error instanceof ApiProblem && error.detail ? error.detail : "Signing in failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="sample-sign-in" onSubmit={submit} aria-describedby={problem ? "sample-sign-in-problem" : undefined}>
      <h2>Sign in</h2>
      <p>The backend's own account; the sample keeps the token in memory.</p>
      <label htmlFor="sample-handle">Handle</label>
      <input id="sample-handle" autoComplete="username" required value={handle} onChange={(event) => setHandle(event.target.value)} />
      <label htmlFor="sample-password">Password</label>
      <input id="sample-password" type="password" autoComplete="current-password" required value={password}
        onChange={(event) => setPassword(event.target.value)} />
      {problem ? <p id="sample-sign-in-problem" className="sample-problem" role="alert">{problem}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

function SampleHost() {
  const [signedIn, setSignedIn] = useState(false);
  const route = useSampleRoute();
  return (
    <div className="sample-shell">
      <header className="sample-header">
        <h1>Parallax, hosted elsewhere</h1>
        <nav aria-label="Pages">
          <a href={addressOf({ page: "object", slug: DEFAULT_OBJECT })} aria-current={route.page === "object" ? "page" : undefined}>Object</a>
          <a href={addressOf({ page: "bench", slug: DEFAULT_CIRCUIT })} aria-current={route.page === "bench" ? "page" : undefined}>Bench</a>
        </nav>
      </header>
      <main className="sample-main">
        {!signedIn ? <SignInForm onSignedIn={() => setSignedIn(true)} />
          : route.page === "object" ? <ObjectPage slug={route.slug} /> : <BenchPage slug={route.slug} />}
      </main>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("The page has no #root element.");
}

createRoot(container).render(
  <StrictMode>
    <ParallaxTransportProvider value={sampleTransport}>
      <ParallaxNavigationProvider value={sampleNavigation}>
        <ParallaxSettingsProvider value={sampleSettings}>
          <SampleHost />
        </ParallaxSettingsProvider>
      </ParallaxNavigationProvider>
    </ParallaxTransportProvider>
  </StrictMode>,
);
