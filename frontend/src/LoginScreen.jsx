import { useState } from 'react'

function randomGuestUsername() {
  const a = ['Swift', 'Quiet', 'Bright', 'Curious', 'Bold', 'Calm', 'Keen']
  const b = ['Fox', 'Owl', 'Bear', 'Crane', 'Wren', 'Lynx', 'Jay']
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${100 + Math.floor(Math.random() * 900)}`
}

function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(120,120)">
        <line x1="0" y1="-72" x2="0" y2="-14" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        <circle cx="0" cy="-72" r="14" fill="#FFFFFF" />
        <line x1="62" y1="-36" x2="12" y2="-7" stroke="#F97362" strokeWidth="6" strokeLinecap="round" />
        <circle cx="62" cy="-36" r="14" fill="#F97362" />
        <line x1="62" y1="36" x2="12" y2="7" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        <circle cx="62" cy="36" r="14" fill="#FFFFFF" />
        <line x1="0" y1="72" x2="0" y2="14" stroke="#F97362" strokeWidth="6" strokeLinecap="round" />
        <circle cx="0" cy="72" r="14" fill="#F97362" />
        <line x1="-62" y1="36" x2="-12" y2="7" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        <circle cx="-62" cy="36" r="14" fill="#FFFFFF" />
        <line x1="-62" y1="-36" x2="-12" y2="-7" stroke="#F97362" strokeWidth="6" strokeLinecap="round" />
        <circle cx="-62" cy="-36" r="14" fill="#F97362" />
        <circle cx="0" cy="0" r="22" fill="#F4B942" />
      </g>
    </svg>
  )
}

function DebateIllustration() {
  return (
    <svg viewBox="0 0 480 440" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 480, height: 'auto', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.25))' }}>
      <defs>
        <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0FDFA" />
        </linearGradient>
        <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF7ED" />
        </linearGradient>
      </defs>
      <ellipse cx="240" cy="400" rx="180" ry="14" fill="rgba(0,0,0,0.18)" />
      <g fill="#FDE68A" opacity="0.9">
        <circle cx="80" cy="80" r="2.5" /><circle cx="420" cy="100" r="2" />
        <circle cx="60" cy="280" r="1.5" /><circle cx="430" cy="320" r="2.5" />
        <circle cx="120" cy="380" r="1.5" />
      </g>
      <circle cx="240" cy="220" r="100" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" className="login-ring-a" />
      <circle cx="240" cy="220" r="100" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" className="login-ring-b" />
      <g className="login-orbit">
        <circle cx="240" cy="220" r="160" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1" strokeDasharray="3 6" />
        <circle cx="400" cy="220" r="4" fill="#FBCFE8" />
        <circle cx="80" cy="220" r="3" fill="#A7F3D0" />
        <circle cx="240" cy="60" r="3" fill="#FECACA" />
      </g>
      <g className="login-float-a">
        <rect x="180" y="180" width="120" height="80" rx="16" fill="url(#cg1)" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
        <path d="M 230 260 L 240 280 L 250 260 Z" fill="#FFFFFF" />
        <rect x="195" y="200" width="80" height="6" rx="3" fill="#0D9488" />
        <rect x="195" y="214" width="60" height="6" rx="3" fill="#CBD5E1" />
        <rect x="195" y="228" width="70" height="6" rx="3" fill="#CBD5E1" />
        <circle cx="280" cy="195" r="14" fill="#F4B942" />
        <path d="M 274 195 L 278 199 L 286 191" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="login-float-a" style={{ animationDelay: '-1s' }}>
        <rect x="60" y="200" width="100" height="120" rx="14" fill="url(#cg1)" stroke="rgba(0,0,0,0.05)" />
        <circle cx="110" cy="180" r="28" fill="#5EEAD4" />
        <circle cx="100" cy="176" r="3" fill="#0F172A" /><circle cx="120" cy="176" r="3" fill="#0F172A" />
        <path d="M 100 188 Q 110 194 120 188" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
        <rect x="72" y="220" width="76" height="5" rx="2.5" fill="#0D9488" />
        <rect x="72" y="232" width="56" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="72" y="244" width="66" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="72" y="256" width="50" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="72" y="290" width="60" height="16" rx="8" fill="#CCFBF1" />
        <text x="102" y="301" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#0B7A6F">ADVOCATE</text>
      </g>
      <g className="login-float-b" style={{ animationDelay: '-2s' }}>
        <rect x="320" y="200" width="100" height="120" rx="14" fill="url(#cg2)" stroke="rgba(0,0,0,0.05)" />
        <circle cx="370" cy="180" r="28" fill="#F97362" />
        <circle cx="360" cy="176" r="3" fill="#0F172A" /><circle cx="380" cy="176" r="3" fill="#0F172A" />
        <path d="M 360 190 L 380 188" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
        <path d="M 376 168 L 384 165" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="332" y="220" width="76" height="5" rx="2.5" fill="#DC2626" />
        <rect x="332" y="232" width="60" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="332" y="244" width="68" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="332" y="256" width="48" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="332" y="290" width="60" height="16" rx="8" fill="#FEE2E2" />
        <text x="362" y="301" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#991B1B">SKEPTIC</text>
      </g>
      <g strokeDasharray="3 4" fill="none" opacity="0.7">
        <path d="M 160 220 Q 170 200 180 200" stroke="#5EEAD4" strokeWidth="2" />
        <path d="M 320 200 Q 310 200 300 200" stroke="#F97362" strokeWidth="2" />
      </g>
      <circle cx="170" cy="160" r="4" fill="#5EEAD4">
        <animate attributeName="cy" values="160;150;160" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="310" cy="155" r="4" fill="#F97362">
        <animate attributeName="cy" values="155;145;155" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="240" cy="120" r="3" fill="#F4B942">
        <animate attributeName="cy" values="120;112;120" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <g transform="translate(220,335)">
        <rect x="0" y="0" width="40" height="14" rx="7" fill="#FFFFFF" opacity="0.95" />
        <circle cx="10" cy="7" r="2" fill="#94A3B8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="20" cy="7" r="2" fill="#94A3B8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="30" cy="7" r="2" fill="#94A3B8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    onLogin({ username: username.trim() || randomGuestUsername() })
  }

  function handleSSO(provider) {
    onLogin({ username: `${provider}_user_${100 + Math.floor(Math.random() * 900)}` })
  }

  return (
    <div className="ls-shell">
      {/* LEFT: illustration */}
      <aside className="ls-illustration">
        <div className="ls-blob ls-blob-1" />
        <div className="ls-blob ls-blob-2" />
        <div className="ls-blob ls-blob-3" />
        <div className="ls-brand-row">
          <LogoMark size={36} />
          <span>ArgueNet</span>
        </div>
        <div className="ls-hero">
          <DebateIllustration />
        </div>
        <div className="ls-tagline">
          <h2>Where AI agents argue, so you don't have to.</h2>
          <p>Six specialized agents. One distributed channel. Better answers — through structured disagreement.</p>
          <div className="ls-dots">
            <span className="ls-dot-active" />
            <span />
            <span />
          </div>
        </div>
      </aside>

      {/* RIGHT: form */}
      <main className="ls-form-side">
        <div className="ls-form-wrap">
          <h1>Welcome back</h1>
          <p className="ls-lede">Sign in to open the debate orchestrator.</p>

          {/* SSO */}
          <div className="ls-sso-stack">
            <button className="ls-sso-btn" type="button" onClick={() => handleSSO('google')}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.32z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <button className="ls-sso-btn ls-sso-github" type="button" onClick={() => handleSSO('github')}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.04 11.04 0 015.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.12 3.05.73.8 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.79.56A11.51 11.51 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="ls-or-split">OR SIGN IN WITH EMAIL</div>

          <form onSubmit={handleSubmit}>
            <div className="ls-field">
              <label htmlFor="ls-user">Username</label>
              <div className="ls-input-wrap">
                <svg className="ls-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="ls-user"
                  className="ls-input"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. alice — or leave blank for random"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="ls-field">
              <label htmlFor="ls-pass">Password</label>
              <div className="ls-input-wrap">
                <svg className="ls-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="ls-pass"
                  className="ls-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="anything goes"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="ls-toggle-eye" onClick={() => setShowPw((p) => !p)} aria-label="Toggle password">
                  {showPw ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="ls-submit">Sign in to ArgueNet →</button>
          </form>

          <p className="ls-foot">By signing in you agree to our Terms and Privacy Policy.</p>
        </div>
      </main>
    </div>
  )
}
