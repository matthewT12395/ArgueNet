import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import LoginScreen from './LoginScreen.jsx'
import CreateAgentPage from './CreateAgentPage.jsx'
import FriendsPage from './FriendsPage.jsx'
import {
  getMockDebateDetail,
  mergePastRunSummaries,
  MOCK_LIVE_LOG_SNIPPET,
} from './mockPastRuns.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const SESSION_KEY = 'arguenet_demo_session'
const CUSTOM_AGENT_KEY = 'arguenet_custom_agent'
const FRIENDS_KEY = 'arguenet_friends'
const THEME_KEY = 'arguenet_theme'

const THEME_OPTIONS = [
  { value: 'indigo-dark', label: 'Dark Indigo' },
  { value: 'dark-slate', label: 'Dark Slate' },
  { value: 'light-blue-mint', label: 'Light Blue Mint' },
  { value: 'sunset-cream', label: 'Sunset Cream' },
]

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (typeof j?.username === 'string' && j.username.trim()) {
      return { username: j.username.trim() }
    }
  } catch {
    /* ignore */
  }
  return null
}

function saveSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (!raw) return 'indigo-dark'
    if (THEME_OPTIONS.some((t) => t.value === raw)) return raw
  } catch {
    /* ignore */
  }
  return 'indigo-dark'
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
}

function loadCustomAgent() {
  try {
    const raw = localStorage.getItem(CUSTOM_AGENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.name !== 'string' || !parsed.name.trim()) return null
    return {
      name: parsed.name.trim(),
      persona: typeof parsed.persona === 'string' ? parsed.persona.trim() : '',
      hobbies: typeof parsed.hobbies === 'string' ? parsed.hobbies.trim() : '',
      opinions: typeof parsed.opinions === 'string' ? parsed.opinions.trim() : '',
      communicationStyle:
        typeof parsed.communicationStyle === 'string' ? parsed.communicationStyle.trim() : '',
    }
  } catch {
    return null
  }
}

function saveCustomAgent(agent) {
  localStorage.setItem(CUSTOM_AGENT_KEY, JSON.stringify(agent))
}

function loadFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
  } catch {
    return []
  }
}

function saveFriends(friends) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends))
}

const ROLES = ['advocate', 'critic', 'moderator']
const DEFAULT_MAX_ROUNDS = 6
const MAX_ROUNDS_LIMIT = 20
const EXAMPLE_AGENT_OPTIONS = [
  { id: 'policy_hawk', label: 'Policy Hawk' },
  { id: 'startup_founder', label: 'Startup Founder' },
]

const PAST_RUN_LIVE_NOTE =
  '(Live log is only captured during a stream. This saved run shows the summary and timeline below.)\n\n'

function formatRunPillLabel(createdAt, question) {
  let time = createdAt
  try {
    const d = new Date(createdAt)
    if (!Number.isNaN(d.getTime())) {
      time = d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {
    /* keep raw */
  }
  const q = question.length > 44 ? `${question.slice(0, 42)}…` : question
  return `${time} — ${q}`
}

function messageFor(messages, role) {
  return messages.find((m) => m.sender === role) ?? null
}

export default function App() {
  const [session, setSession] = useState(() => loadSession())
  const [theme, setTheme] = useState(() => loadTheme())
  const [activeView, setActiveView] = useState('dashboard')
  const [question, setQuestion] = useState('')
  const [maxRounds, setMaxRounds] = useState(String(DEFAULT_MAX_ROUNDS))
  const [failure, setFailure] = useState('none')
  const [runStatus, setRunStatus] = useState('ready')
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [agreementScore, setAgreementScore] = useState(null)
  const [failedNodes, setFailedNodes] = useState([])
  const [participants, setParticipants] = useState([])
  const [selectedExampleAgents, setSelectedExampleAgents] = useState([])
  const [friends, setFriends] = useState(() => loadFriends())
  const [selectedFriendIds, setSelectedFriendIds] = useState(new Set())
  const [liveRoundsLog, setLiveRoundsLog] = useState('')
  const liveLogRef = useRef(null)
  const [pastRuns, setPastRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [pastRunsError, setPastRunsError] = useState(null)
  const [customAgent, setCustomAgent] = useState(() => loadCustomAgent())
  const [includeCustomAgent, setIncludeCustomAgent] = useState(true)

  const timelineRoles = useMemo(() => {
    if (!customAgent || !includeCustomAgent) return ROLES
    return [...ROLES, customAgent.name]
  }, [customAgent, includeCustomAgent])

  useEffect(() => {
    const el = liveLogRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [liveRoundsLog])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    saveTheme(theme)
  }, [theme])

  async function fetchPastRuns() {
    setPastRunsError(null)
    try {
      const res = await fetch(`${API_BASE}/debates`)
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
      }
      const data = await res.json()
      setPastRuns(Array.isArray(data.debates) ? data.debates : [])
    } catch (err) {
      setPastRunsError(err.message ?? String(err))
    }
  }

  useEffect(() => {
    if (!session) return
    fetchPastRuns()
  }, [session])

  const displayPastRuns = useMemo(() => mergePastRunSummaries(pastRuns), [pastRuns])

  function selectNewDraft() {
    setSelectedRunId(null)
    setRunStatus('ready')
    setError(null)
    setMessages([])
    setFinalAnswer('')
    setAgreementScore(null)
    setFailedNodes([])
    setParticipants([])
    setSelectedFriendIds(new Set())
    setLiveRoundsLog('')
  }

  async function loadPastRun(debateId) {
    setError(null)
    setPastRunsError(null)
    const mockDetail = getMockDebateDetail(debateId)
    if (mockDetail) {
      setSelectedRunId(mockDetail.debate_id)
      setQuestion(mockDetail.question ?? '')
      setLiveRoundsLog(`${PAST_RUN_LIVE_NOTE}${MOCK_LIVE_LOG_SNIPPET}`)
      applyDebatePayload(mockDetail)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/debate/${encodeURIComponent(debateId)}`)
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail ?? res.statusText ?? 'Not found')
      }
      const data = await res.json()
      setSelectedRunId(data.debate_id)
      setQuestion(data.question ?? '')
      setLiveRoundsLog(PAST_RUN_LIVE_NOTE)
      applyDebatePayload(data)
    } catch (err) {
      setError(err.message ?? String(err))
    }
  }

  function applyDebatePayload(data) {
    setMessages(data.messages ?? [])
    setFinalAnswer(data.final_answer ?? '')
    setAgreementScore(typeof data.agreement_score === 'number' ? data.agreement_score : null)
    setFailedNodes(data.failed_nodes ?? [])
    if (Array.isArray(data.participants) && data.participants.length) {
      setParticipants(data.participants)
    } else {
      setParticipants(data.messages ?? [])
    }
    const s = (data.status ?? '').toLowerCase()
    setRunStatus(s === 'completed' ? 'completed' : s === 'failed' ? 'failed' : 'completed')
  }

  function toggleFriendSelection(id) {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaveFriends(updatedFriends) {
    setFriends(updatedFriends)
    saveFriends(updatedFriends)
    setSelectedFriendIds((prev) => {
      const validIds = new Set(updatedFriends.map((f) => f.id))
      return new Set([...prev].filter((id) => validIds.has(id)))
    })
  }

  function toggleExampleAgent(id) {
    setSelectedExampleAgents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function runDebate(e) {
    e.preventDefault()
    setError(null)
    setSelectedRunId(null)
    setRunStatus('running')
    setMessages([])
    setFinalAnswer('')
    setAgreementScore(null)
    setFailedNodes([])
    setParticipants([])
    setLiveRoundsLog('')

    const n = parseInt(String(maxRounds).trim(), 10)
    const rounds =
      Number.isFinite(n) && n >= 1 ? Math.min(MAX_ROUNDS_LIMIT, Math.max(1, n)) : DEFAULT_MAX_ROUNDS

    const personalAgents = friends
      .filter((f) => selectedFriendIds.has(f.id))
      .map((f) => ({
        name: f.name.trim(),
        background: f.background.trim(),
        hobbies: f.hobbies.trim(),
        interests: f.interests.trim(),
        beliefs: f.beliefs.trim(),
      }))

    const personalAgent =
      customAgent && includeCustomAgent
        ? {
            name: customAgent.name.trim(),
            background: customAgent.persona.trim(),
            hobbies: customAgent.hobbies.trim(),
            interests: '',
            beliefs: customAgent.opinions.trim(),
            communication_style: customAgent.communicationStyle.trim(),
          }
        : null

    const body = {
      question: question.trim(),
      simulate_failure: failure !== 'none',
      failed_node: failure === 'none' ? null : failure,
      max_rounds: rounds,
      personal_agent: personalAgent,
      personal_agents: personalAgents,
      selected_example_agents: selectedExampleAgents,
    }

    try {
      const res = await fetch(`${API_BASE}/debate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail ?? res.statusText ?? 'Request failed')
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let ev
          try {
            ev = JSON.parse(line)
          } catch {
            continue
          }
          if (ev.event === 'log' && typeof ev.text === 'string') {
            setLiveRoundsLog((prev) => prev + ev.text)
          } else if (ev.event === 'result' && ev.debate) {
            applyDebatePayload(ev.debate)
            if (ev.debate.debate_id) setSelectedRunId(ev.debate.debate_id)
            fetchPastRuns()
          } else if (ev.event === 'error') {
            setError(ev.detail ?? 'Debate failed')
            if (ev.debate) {
              applyDebatePayload(ev.debate)
              if (ev.debate.debate_id) setSelectedRunId(ev.debate.debate_id)
            }
            setRunStatus('failed')
            fetchPastRuns()
          }
        }
      }
    } catch (err) {
      setError(err.message ?? String(err))
      setRunStatus('failed')
      setLiveRoundsLog((prev) => prev + `\n\n(stream error: ${err.message ?? err})`)
    }
  }

  const statusLabel =
    runStatus === 'ready'
      ? 'Ready'
      : runStatus === 'running'
        ? 'Running'
        : runStatus === 'completed'
          ? 'Completed'
          : runStatus === 'failed'
            ? 'Failed'
            : runStatus

  function handleLogin(user) {
    saveSession(user)
    setSession(user)
  }

  function handleLogout() {
    clearSession()
    setSession(null)
  }

  function handleSaveAgent(agent) {
    setCustomAgent(agent)
    setIncludeCustomAgent(true)
    saveCustomAgent(agent)
    setActiveView('dashboard')
  }

  if (!session) {
    return (
      <div className="app-shell">
        <LoginScreen onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="dashboard">
        <header className="header">
          <div className="header-row">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                ◈
              </span>
              <div className="brand-text">
                <h1 className="title">ArgueNet</h1>
                <p className="tagline">Multi-agent debate orchestrator</p>
              </div>
            </div>
            <div className="session-bar">
              <label className="theme-picker" htmlFor="theme-picker">
                Theme
              </label>
              <select
                id="theme-picker"
                className="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {activeView !== 'dashboard' ? (
                <button
                  type="button"
                  className="session-logout"
                  onClick={() => setActiveView('dashboard')}
                >
                  ← Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="session-logout"
                    onClick={() => setActiveView('create-agent')}
                  >
                    Create agent
                  </button>
                  <button
                    type="button"
                    className="session-logout"
                    onClick={() => setActiveView('friends')}
                  >
                    Friends
                  </button>
                </>
              )}
              <span className="session-user" title={session.username}>
                {session.username}
              </span>
              <button type="button" className="session-logout" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </header>

        {activeView === 'create-agent' ? (
          <CreateAgentPage
            initialAgent={customAgent}
            onCancel={() => setActiveView('dashboard')}
            onSave={handleSaveAgent}
          />
        ) : activeView === 'friends' ? (
          <FriendsPage
            friends={friends}
            onSave={handleSaveFriends}
            onBack={() => setActiveView('dashboard')}
          />
        ) : (
          <div className="dashboard-layout">
            <div className="dashboard-main">
              <div className="panel panel-compose">
                <form className="controls" onSubmit={runDebate}>
            <label className="label" htmlFor="question">
              Question
            </label>
            <textarea
              id="question"
              className="question-input"
              rows={3}
              placeholder="Ask the agents something…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={runStatus === 'running'}
              required
            />
            <label className="label" htmlFor="max-rounds">
              Max debate rounds
            </label>
            <input
              id="max-rounds"
              className="number-input"
              type="number"
              min={1}
              max={MAX_ROUNDS_LIMIT}
              step={1}
              value={maxRounds}
              onChange={(e) => setMaxRounds(e.target.value)}
              disabled={runStatus === 'running'}
              aria-describedby="max-rounds-hint"
            />
            <p id="max-rounds-hint" className="field-hint">
              1–{MAX_ROUNDS_LIMIT} (default {DEFAULT_MAX_ROUNDS}). Passed to the orchestrator as{' '}
              <code className="inline-code">ARGUENET_MAX_ROUNDS</code> for this run.
            </p>
            <label className="label checkbox-row" htmlFor="include-custom-agent">
              <input
                id="include-custom-agent"
                className="checkbox-input"
                type="checkbox"
                checked={includeCustomAgent}
                onChange={(e) => setIncludeCustomAgent(e.target.checked)}
                disabled={!customAgent || runStatus === 'running'}
              />
              Include custom agent in this run
            </label>
            {customAgent ? (
              <div className="custom-agent-chip" title={customAgent.persona}>
                <span className="custom-agent-chip-title">Custom agent:</span> {customAgent.name}
              </div>
            ) : (
              <p className="field-hint">
                No custom agent yet. Use <code className="inline-code">Create agent</code> above.
              </p>
            )}
            <label className="label" htmlFor="failure">
              Optional failure (demo)
            </label>
            <select
              id="failure"
              className="select"
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
              disabled={runStatus === 'running'}
            >
              <option value="none">none</option>
              <option value="advocate">advocate</option>
              <option value="critic">critic</option>
              <option value="moderator">moderator</option>
            </select>

            <label className="label">Example agents (optional)</label>
            <div className="meta" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
              {EXAMPLE_AGENT_OPTIONS.map((opt) => (
                <label key={opt.id} className="meta">
                  <input
                    type="checkbox"
                    checked={selectedExampleAgents.includes(opt.id)}
                    onChange={() => toggleExampleAgent(opt.id)}
                    disabled={runStatus === 'running'}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <label className="label">Friends (optional)</label>
            {friends.length === 0 ? (
              <p className="field-hint">
                No friends saved.{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setActiveView('friends')}
                  disabled={runStatus === 'running'}
                >
                  Manage friends →
                </button>
              </p>
            ) : (
              <div className="friend-chips">
                {friends.map((f) => (
                  <label
                    key={f.id}
                    className={`friend-chip${selectedFriendIds.has(f.id) ? ' friend-chip--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriendIds.has(f.id)}
                      onChange={() => toggleFriendSelection(f.id)}
                      disabled={runStatus === 'running'}
                    />
                    <span className="friend-chip-avatar">{f.name[0].toUpperCase()}</span>
                    {f.name}
                  </label>
                ))}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setActiveView('friends')}
                  disabled={runStatus === 'running'}
                  style={{ alignSelf: 'center', marginLeft: 'auto' }}
                >
                  Edit →
                </button>
              </div>
            )}

            <button className="submit" type="submit" disabled={runStatus === 'running'}>
              {runStatus === 'running' ? 'Running debate…' : 'Run debate'}
            </button>
          </form>
        </div>

        <section className="bottom panel panel-output" aria-label="Debate output">
          <div className="output-head">
            <h2 className="output-title">Results</h2>
            <span className={`status-pill status-pill--${runStatus}`}>{statusLabel}</span>
          </div>
          {error ? <p className="error">{error}</p> : null}

          <label className="label" htmlFor="live-rounds">
            Live rounds
          </label>
          <textarea
            id="live-rounds"
            ref={liveLogRef}
            className="live-rounds-log"
            readOnly
            rows={10}
            value={liveRoundsLog}
            placeholder="Same live text as `python -m arguenet.main` (round headers, phases, rankings, summaries)."
            aria-live="polite"
          />

          <h2 className="section-title">Debate timeline</h2>
          <ol className="timeline">
            {timelineRoles.map((role) => {
              const m = messageFor(messages, role) ?? (
                customAgent && role === customAgent.name
                  ? participants.find(
                      (p) =>
                        p.sender ===
                        'friend_' +
                          role
                            .trim()
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '_')
                            .replace(/_+/g, '_')
                            .replace(/^_|_$/, ''),
                    ) ?? null
                  : null
              )
              return (
                <li key={role} className="card card-role">
                <div className="card-head">{role}</div>
                {m ? (
                  <>
                    <p className="card-body">{m.content}</p>
                    <div className="meta">
                      round {m.round} · confidence {m.confidence}
                    </div>
                  </>
                ) : (
                  <p className="card-muted">No message (skipped or fault injection)</p>
                )}
              </li>
              )
            })}
          </ol>

          <h2 className="section-title">Participants (Dynamic)</h2>
          <ol className="timeline">
            {participants.map((p, idx) => (
              <li key={`${p.sender}-${idx}`} className="card card-role">
                <div className="card-head">{p.sender}</div>
                <p className="card-body">{p.content}</p>
                <div className="meta">
                  round {p.round} · confidence {p.confidence}
                </div>
              </li>
            ))}
          </ol>

          <div className="card final card-highlight">
            <div className="card-head">Final answer</div>
            <p className="card-body">{finalAnswer || '—'}</p>
          </div>

                <div className="metrics">
                  <div className="card metric">
                    <div className="card-head">Agreement score</div>
                    <p className="card-body mono">
                      {agreementScore !== null ? agreementScore.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div className="card metric">
                    <div className="card-head">Failed nodes</div>
                    <p className="card-body mono">
                      {failedNodes.length ? failedNodes.join(', ') : '—'}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="dashboard-side">
              <nav className="past-runs-nav panel panel-subtle" aria-label="Past debates">
                <div className="past-runs-head">
                  <span className="past-runs-title">Past runs</span>
                  <button type="button" className="nav-refresh" onClick={() => fetchPastRuns()}>
                    Refresh
                  </button>
                </div>
                {pastRunsError ? <p className="past-runs-error">{pastRunsError}</p> : null}
                <div className="past-runs-scroll past-runs-scroll-side" role="list">
                  <button
                    type="button"
                    className={`nav-pill${selectedRunId === null ? ' nav-pill-active' : ''}`}
                    onClick={() => selectNewDraft()}
                    disabled={runStatus === 'running'}
                  >
                    New draft
                  </button>
                  {displayPastRuns.map((run) => {
                    const st = (run.status || '').toLowerCase()
                    const badge =
                      st === 'failed' ? 'failed' : st === 'completed' ? 'completed' : 'other'
                    const isMock = String(run.debate_id).startsWith('mock-')
                    return (
                      <button
                        key={run.debate_id}
                        type="button"
                        role="listitem"
                        className={`nav-pill${selectedRunId === run.debate_id ? ' nav-pill-active' : ''}${
                          isMock ? ' nav-pill-mock' : ''
                        }`}
                        title={isMock ? `${run.question ?? ''} (demo mock)` : run.question ?? ''}
                        onClick={() => loadPastRun(run.debate_id)}
                        disabled={runStatus === 'running'}
                      >
                        {isMock ? <span className="nav-pill-demo-badge">Demo</span> : null}
                        <span className={`nav-pill-status nav-pill-status-${badge}`}>{run.status}</span>
                        {formatRunPillLabel(run.created_at, run.question ?? '')}
                      </button>
                    )
                  })}
                </div>
                {displayPastRuns.length === 0 && !pastRunsError ? (
                  <p className="past-runs-empty">No saved runs yet — run a debate to populate this list.</p>
                ) : null}
              </nav>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
