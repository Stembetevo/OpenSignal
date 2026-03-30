import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

type PortalMetric = {
  period: string;
  requests: number;
};

const demoMetrics: PortalMetric[] = [
  { period: "Mon", requests: 152 },
  { period: "Tue", requests: 231 },
  { period: "Wed", requests: 198 },
  { period: "Thu", requests: 274 },
  { period: "Fri", requests: 316 },
  { period: "Sat", requests: 190 },
  { period: "Sun", requests: 168 },
];

function MainNav() {
  const location = useLocation();
  const links = useMemo(
    () => [
      { to: "/", label: "Home" },
      { to: "/docs", label: "Docs" },
      { to: "/portal", label: "Developer Portal" },
    ],
    [],
  );

  return (
    <header className="site-header">
      <Link to="/" className="brand-link">
        OpenSignal
      </Link>
      <nav className="site-nav" aria-label="Main">
        {links.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <Link key={item.to} to={item.to} className={isActive ? "nav-link nav-link-active" : "nav-link"}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function LandingPage() {
  return (
    <main className="page-shell">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Gas Sponsorship Infrastructure</p>
          <h1>Ship Sui dApps where users pay zero gas friction.</h1>
          <p className="subtitle">
            OpenSignal gives you Shinami-style sponsorship controls with your own policy engine, per-dapp keys, and
            developer analytics.
          </p>
          <div className="hero-actions">
            <Link to="/portal" className="button-primary">
              Launch Developer Portal
            </Link>
            <Link to="/docs" className="button-secondary">
              Read Quickstart
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <h2>Foundation Enabled</h2>
          <ul>
            <li>Prisma schema for users, dapps, keys, and usage events</li>
            <li>Portal auth routes with JWT + password hashing</li>
            <li>API key creation and revocation endpoints</li>
            <li>Usage summary endpoint for dashboard metrics</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function DocsPage() {
  return (
    <main className="page-shell docs-grid">
      <article className="doc-card">
        <h2>API Auth</h2>
        <p>Use x-api-key on all sponsorship endpoints.</p>
        <pre>{`POST /v1/sponsor/quote\nPOST /v1/sponsor/sign`}</pre>
      </article>
      <article className="doc-card">
        <h2>Portal Auth</h2>
        <p>Use Bearer token for developer portal management routes.</p>
        <pre>{`POST /v1/portal/auth/signup\nPOST /v1/portal/auth/login`}</pre>
      </article>
      <article className="doc-card">
        <h2>Portal Keys</h2>
        <p>Per-app API keys are hashed at rest and revealed once on creation.</p>
        <pre>{`POST /v1/portal/apps/:appId/api-keys\nPOST /v1/portal/api-keys/:keyId/revoke`}</pre>
      </article>
      <article className="doc-card">
        <h2>Usage Summary</h2>
        <p>Feed your dashboard from aggregated sponsor usage metrics.</p>
        <pre>{`GET /v1/portal/usage/summary?appId=...`}</pre>
      </article>
    </main>
  );
}

function PortalPage() {
  return (
    <main className="page-shell portal-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Weekly Request Volume</h2>
          <span className="badge">Demo Data</span>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={demoMetrics}>
              <defs>
                <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f7a8c" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#1f7a8c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e3" />
              <XAxis dataKey="period" stroke="#154351" />
              <YAxis stroke="#154351" />
              <Tooltip />
              <Area type="monotone" dataKey="requests" stroke="#1f7a8c" fillOpacity={1} fill="url(#requestsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel stack">
        <h2>Portal Actions</h2>
        <p>Use these routes from your frontend service layer to complete Portal v1.</p>
        <ul>
          <li>Create account: POST /v1/portal/auth/signup</li>
          <li>Create dapp: POST /v1/portal/apps</li>
          <li>Create API key: POST /v1/portal/apps/:appId/api-keys</li>
          <li>Usage summary: GET /v1/portal/usage/summary</li>
        </ul>
        <Link to="/portal/login" className="button-primary">
          Open Portal Login
        </Link>
      </section>
    </main>
  );
}

function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="page-shell auth-wrap">
      <form className="auth-card" onSubmit={(event) => event.preventDefault()}>
        <h2>Developer Portal Login</h2>
        <label>
          Email
          <input
            type="email"
            placeholder="dev@dapp.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="button-primary">
          Sign In
        </button>
        <p className="muted">Wire this form to POST /v1/portal/auth/login.</p>
      </form>
    </main>
  );
}

export default function App() {
  return (
    <div className="site-shell">
      <MainNav />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/portal" element={<PortalPage />} />
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
