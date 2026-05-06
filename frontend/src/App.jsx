import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Heart, Brain, MessageSquare, TrendingUp, Zap, Trophy, AlertCircle } from 'lucide-react'
import './App.css'
import LoginScreen from './LoginScreen.jsx'
import CreateAgentPage from './CreateAgentPage.jsx'
import { getMockDebateDetail, mergePastRunSummaries, MOCK_LIVE_LOG_SNIPPET } from './mockPastRuns.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const SESSION_KEY = 'arguenet_demo_session'
const CUSTOM_AGENT_KEY = 'arguenet_custom_agent'
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
  } catch {}
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
  } catch {}
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
      communicationStyle: typeof parsed.communicationStyle === 'string' ? parsed.communicationStyle.trim() : '',
    }
  } catch {
    return null
  }
}

function saveCustomAgent(agent) {
  localStorage.setItem(CUSTOM_AGENT_KEY, JSON.stringify(agent))
}

const ROLES = ['advocate', 'critic', 'moderator']
const DEFAULT_MAX_ROUNDS = 6
const MAX_ROUNDS_LIMIT = 20
const PAST_RUN_LIVE_NOTE = '(Live log is only captured during a stream. This saved run shows the summary and timeline below.)\n\n'

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
  } catch {}
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
    const s = (data.status ?? '').toLowerCase()
    setRunStatus(s === 'completed' ? 'completed' : s === 'failed' ? 'failed' : 'completed')
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
    setLiveRoundsLog('')

    const n = parseInt(String(maxRounds).trim(), 10)
    const rounds = Number.isFinite(n) && n >= 1 ? Math.min(MAX_ROUNDS_LIMIT, Math.max(1, n)) : DEFAULT_MAX_ROUNDS

    const body = {
      question: question.trim(),
      simulate_failure: failure !== 'none',
      failed_node: failure === 'none' ? null : failure,
      max_rounds: rounds,
      custom_agent: customAgent && includeCustomAgent ? customAgent : null,
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

  const statusLabel = runStatus === 'ready' ? 'Ready' : runStatus === 'running' ? 'Running' : runStatus === 'completed' ? 'Completed' : runStatus === 'failed' ? 'Failed' : runStatus

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
        {/* Modern Header */}
        <motion.header className="header-modern" initial={{ y: -50 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <div className="header-content">
            <div className="brand-section">
              <motion.span className="brand-icon" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity }}>
                ◈
              </motion.span>
              <div>
                <h1 className="app-title">ArgueNet</h1>
                <p className="app-subtitle">AI-Powered Multi-Agent Debates</p>
              </div>
            </div>

            <div className="header-controls">
              <select className="theme-selector" value={theme} onChange={(e) => setTheme(e.target.value)}>
                {THEME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <motion.button 
                className="button secondary" 
                onClick={() => setActiveView(activeView === 'dashboard' ? 'create-agent' : 'dashboard')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {activeView === 'dashboard' ? '🤖 Create Agent' : '← Back'}
              </motion.button>
              <span className="user-info">{session.username}</span>
              <motion.button 
                className="button" 
                onClick={handleLogout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Log Out
              </motion.button>
            </div>
          </div>
        </motion.header>

        {activeView === 'create-agent' ? (
          <CreateAgentPage initialAgent={customAgent} onCancel={() => setActiveView('dashboard')} onSave={handleSaveAgent} />
        ) : (
          <div className="dashboard-grid">
            {/* Left Column - Form */}
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
              <div className="panel debate-form-card">
                <h2 className="form-title">🎯 Start a Debate</h2>
                <form className="debate-form" onSubmit={runDebate}>
                  <div className="form-group">
                    <label>Question</label>
                    <textarea
                      className="question-input textarea"
                      rows={4}
                      placeholder="Ask the agents something interesting..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={runStatus === 'running'}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Max Rounds</label>
                      <input
                        className="question-input"
                        type="number"
                        min={1}
                        max={MAX_ROUNDS_LIMIT}
                        value={maxRounds}
                        onChange={(e) => setMaxRounds(e.target.value)}
                        disabled={runStatus === 'running'}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Failure Mode</label>
                      <select className="question-input" value={failure} onChange={(e) => setFailure(e.target.value)} disabled={runStatus === 'running'}>
                        <option value="none">None</option>
                        <option value="advocate">Advocate</option>
                        <option value="critic">Critic</option>
                        <option value="moderator">Moderator</option>
                      </select>
                    </div>
                  </div>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeCustomAgent}
                      onChange={(e) => setIncludeCustomAgent(e.target.checked)}
                      disabled={!customAgent || runStatus === 'running'}
                    />
                    Include custom agent
                  </label>

                  <motion.button
                    className="submit primary"
                    type="submit"
                    disabled={runStatus === 'running'}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {runStatus === 'running' ? '⚡ Running...' : '▶ Start Debate'}
                  </motion.button>
                </form>
              </div>

              {/* Past Runs */}
              {displayPastRuns.length > 0 && (
                <motion.div className="panel past-runs-card" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <h3 className="section-title">📜 Past Debates</h3>
                  <div className="runs-list">
                    {displayPastRuns.map((run) => (
                      <motion.button
                        key={run.id}
                        className={`run-pill ${selectedRunId === run.id ? 'active' : ''}`}
                        onClick={() => loadPastRun(run.id)}
                        whileHover={{ x: 5 }}
                      >
                        <div className="run-time">{run.created_at}</div>
                        <div className="run-question">{run.question}</div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Right Column - Results & Visualizations */}
            <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
              <div className="panel results-card">
                <div className="results-header">
                  <h2 className="results-title">📊 Results</h2>
                  <motion.span className={`status-badge ${runStatus}`} animate={runStatus === 'running' ? { opacity: [1, 0.5, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
                    {statusLabel}
                  </motion.span>
                </div>

                {error && (
                  <motion.div className="error-box" initial={{ y: -10 }} animate={{ y: 0 }}>
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}

                {/* Key Metrics */}
                {(agreementScore !== null || finalAnswer) && (
                  <motion.div className="metrics-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    {agreementScore !== null && (
                      <motion.div className="metric-card" whileHover={{ y: -5 }}>
                        <Trophy size={20} />
                        <div className="metric-value">{(agreementScore * 100).toFixed(1)}%</div>
                        <div className="metric-label">Agreement</div>
                      </motion.div>
                    )}
                    {messages.length > 0 && (
                      <motion.div className="metric-card" whileHover={{ y: -5 }}>
                        <MessageSquare size={20} />
                        <div className="metric-value">{messages.length}</div>
                        <div className="metric-label">Messages</div>
                      </motion.div>
                    )}
                    <motion.div className="metric-card" whileHover={{ y: -5 }}>
                      <Zap size={20} />
                      <div className="metric-value">{maxRounds}</div>
                      <div className="metric-label">Max Rounds</div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Live Log */}
                {liveRoundsLog && (
                  <motion.div className="live-log-section" initial={{ height: 0 }} animate={{ height: 'auto' }} transition={{ duration: 0.3 }}>
                    <label className="log-label">🔴 Live Activity</label>
                    <div className="live-log" ref={liveLogRef}>
                      {liveRoundsLog}
                    </div>
                  </motion.div>
                )}

                {/* Timeline */}
                {messages.length > 0 && (
                  <motion.div className="timeline-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <h3 className="timeline-title">💬 Debate Timeline</h3>
                    <div className="timeline">
                      {timelineRoles.map((role, idx) => {
                        const m = messageFor(messages, role)
                        return (
                          <motion.div
                            key={role}
                            className="timeline-item"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <div className="timeline-marker">{idx + 1}</div>
                            <div className="timeline-content">
                              <h4>{role}</h4>
                              <p>{m ? m.content : 'No message'}</p>
                              {m && <span className="meta">Round {m.round} • Confidence: {m.confidence}</span>}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {finalAnswer && (
                  <motion.div className="final-answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    <h4>🎯 Final Answer</h4>
                    <p>{finalAnswer}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      <style jsx>{`
        .header-modern {
          margin-bottom: 40px;
          animation: slide-down 0.5s ease-out;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          font-size: 32px;
          color: var(--primary);
        }

        .app-title {
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .app-subtitle {
          font-size: 12px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 4px 0 0 0;
        }

        .header-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .user-info {
          font-size: 14px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        .debate-form-card {
          padding: 24px;
        }

        .form-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--text-primary);
        }

        .debate-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .past-runs-card {
          margin-top: 20px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .runs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .run-pill {
          padding: 12px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition);
          text-align: left;
        }

        .run-pill:hover {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.15);
        }

        .run-pill.active {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.2);
        }

        .run-time {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .run-question {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .results-card {
          padding: 24px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .results-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.ready {
          background: rgba(107, 114, 128, 0.2);
          color: #9ca3af;
        }

        .status-badge.running {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .status-badge.completed {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .status-badge.failed {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .error-box {
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #fca5a5;
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric-card {
          padding: 16px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid var(--primary);
          border-radius: 8px;
          text-align: center;
          transition: var(--transition);
        }

        .metric-card:hover {
          border-color: var(--secondary);
          background: rgba(236, 72, 153, 0.1);
        }

        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--primary);
          margin: 8px 0;
        }

        .metric-label {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
        }

        .live-log-section {
          margin-bottom: 20px;
          overflow: hidden;
        }

        .log-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 8px;
        }

        .live-log {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
          height: 200px;
          overflow-y: auto;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .timeline-section {
          margin-top: 20px;
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: rgba(99, 102, 241, 0.05);
          border-left: 3px solid var(--primary);
          border-radius: 4px;
        }

        .timeline-marker {
          min-width: 24px;
          height: 24px;
          background: var(--primary);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .timeline-content h4 {
          margin: 0 0 4px 0;
          font-size: 13px;
          text-transform: uppercase;
          color: var(--primary);
        }

        .timeline-content p {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .meta {
          font-size: 11px;
          color: var(--text-tertiary);
          display: block;
          margin-top: 4px;
        }

        .final-answer {
          margin-top: 20px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1));
          border: 1px solid var(--primary);
          border-radius: 8px;
        }

        .final-answer h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: var(--success);
        }

        .final-answer p {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
