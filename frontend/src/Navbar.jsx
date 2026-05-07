import { LayoutDashboard, UserPlus, Users, LogOut } from 'lucide-react'

const THEME_OPTIONS = [
  { value: 'indigo-dark',      label: 'Dark Indigo' },
  { value: 'dark-slate',      label: 'Dark Slate' },
  { value: 'emerald-forest',  label: 'Emerald Forest' },
  { value: 'light-blue-mint', label: 'Light Blue Mint' },
  { value: 'sunset-cream',    label: 'Sunset Cream' },
  { value: 'rose-gold',       label: 'Rose Gold' },
]

export default function Navbar({ session, theme, onThemeChange, activeView, onViewChange, onLogout }) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner">

        {/* Brand */}
        <button
          type="button"
          className="navbar-brand"
          onClick={() => onViewChange('dashboard')}
          aria-label="ArgueNet home"
        >
          <img src="/favicon.svg" className="navbar-logo" alt="" aria-hidden="true" />
          <span className="navbar-wordmark">ArgueNet</span>
        </button>

        {/* Nav links — only show when logged in */}
        {session && (
          <div className="navbar-links" role="menubar">
            <button
              type="button"
              role="menuitem"
              className={`nav-link${activeView === 'dashboard' ? ' nav-link--active' : ''}`}
              onClick={() => onViewChange('dashboard')}
            >
              <LayoutDashboard size={15} strokeWidth={2} />
              Dashboard
            </button>
            <button
              type="button"
              role="menuitem"
              className={`nav-link${activeView === 'create-agent' ? ' nav-link--active' : ''}`}
              onClick={() => onViewChange('create-agent')}
            >
              <UserPlus size={15} strokeWidth={2} />
              Create Agent
            </button>
            <button
              type="button"
              role="menuitem"
              className={`nav-link${activeView === 'friends' ? ' nav-link--active' : ''}`}
              onClick={() => onViewChange('friends')}
            >
              <Users size={15} strokeWidth={2} />
              Friends
            </button>
          </div>
        )}

        {/* Right-side actions */}
        <div className="navbar-actions">
          {/* Theme swatches */}
          <div className="theme-swatches" role="group" aria-label="Color theme">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`theme-swatch theme-swatch--${t.value}`}
                aria-label={t.label}
                aria-pressed={theme === t.value}
                title={t.label}
                onClick={() => onThemeChange(t.value)}
              />
            ))}
          </div>

          {session && (
            <>
              <span className="session-user" title={session.username}>
                {session.username}
              </span>
              <button type="button" className="session-logout" onClick={onLogout}>
                <LogOut size={14} strokeWidth={2} />
                Log out
              </button>
            </>
          )}
        </div>

      </div>
    </nav>
  )
}
