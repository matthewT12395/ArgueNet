import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Heart, Brain, MessageSquare, TrendingUp, Zap, Trophy, AlertCircle, Activity, Lightbulb } from 'lucide-react'
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
const DEFAULT_MAX_ROUNDS = 5
const MAX_ROUNDS_LIMIT = 20
const PAST_RUN_LIVE_NOTE = '(Live log captured during debate stream)\n\n'

function messageFor(messages, role) {
  return messages.find((m) => m.sender === role) ?? null
}

function generateDebateVisualizationData(round) {
  const data = []
  for (let i = 1; i <= Math.max(3, round || 3); i++) {
    data.push({
      round: i,
      engagement: 20 + i * 15,
      confidence: 50 + i * 8,
      consensus: 30 + i * 12,
    })
  }
  return data
}

function generateAgentPerformance() {
  return [
    { name: 'Advocate', score: 78, color: '#6366f1' },
    { name: 'Critic', score: 82, color: '#ec4899' },
    { name: 'Moderator', score: 88, color: '#f59e0b' },
  ]
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
  const [currentRound, setCurrentRound] = useState(0)
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
    setCurrentRound(0)
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
    setCurrentRound(0)

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
            if (ev.text.includes('ROUND')) {
              const roundMatch = ev.text.match(/ROUND (\d+)/)
              if (roundMatch) setCurrentRound(parseInt(roundMatch[1]))
            }
          } else if (ev.event === 'result' && ev.debate) {
            applyDebatePayload(ev.debate)
            if (ev.debate.debate_id) setSelectedRunId(ev.debate.debate_id)
            setRunStatus('completed')
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
      setLiveRoundsLog((prev) => prev + `\n\n(Error: ${err.message ?? err})`)
    }
  }

  const statusLabel = 
    runStatus === 'ready' ? 'Ready' : 
    runStatus === 'running' ? 'Running' : 
    runStatus === 'completed' ? 'Completed' : 
    runStatus === 'failed' ? 'Failed' : 
    runStatus

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

  const visualizationData = generateDebateVisualizationData(currentRound)
  const agentPerformance = generateAgentPerformance()

  if (!session) {
    return (
      <div className="app-shell">
        <LoginScreen onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Premium Header */}
      <motion.header className="premium-header" initial={{ y: -60 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}>
        <div className="header-wrapper">
          <div className="brand-premium">
            <motion.span className="brand-icon-premium" animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
              ◈
            </motion.span>
            <div className="brand-info">
              <h1>ArgueNet</h1>
              <p>🚀 AI-Powered Multi-Agent Debate Platform</p>
            </div>
          </div>

          <div className="header-actions">
            <select className="theme-selector-premium" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <motion.button 
              className="btn-secondary" 
              onClick={() => setActiveView(activeView === 'dashboard' ? 'create-agent' : 'dashboard')}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              {activeView === 'dashboard' ? '🤖 Create Agent' : '← Back'}
            </motion.button>
            <div className="user-badge">
              <span className="user-avatar">👤</span>
              <span className="user-name">{session.username}</span>
            </div>
            <motion.button 
              className="btn-logout" 
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Log Out
            </motion.button>
          </div>
        </div>
      </motion.header>

      <div className="dashboard">
        {activeView === 'create-agent' ? (
          <CreateAgentPage initialAgent={customAgent} onCancel={() => setActiveView('dashboard')} onSave={handleSaveAgent} />
        ) : (
          <div className="main-container">
            {/* Left Column */}
            <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
              {/* Debate Form */}
              <div className="card">
                <div className="card-header">
                  <Lightbulb size={20} />
                  <h2>Start a Debate</h2>
                </div>
                <form className="form-debate" onSubmit={runDebate}>
                  <div className="form-field">
                    <label>Your Question</label>
                    <textarea
                      className="input-large textarea"
                      placeholder="Ask something thought-provoking..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={runStatus === 'running'}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label>Max Rounds</label>
                      <input
                        className="input-md"
                        type="number"
                        min={1}
                        max={MAX_ROUNDS_LIMIT}
                        value={maxRounds}
                        onChange={(e) => setMaxRounds(e.target.value)}
                        disabled={runStatus === 'running'}
                      />
                    </div>
                    <div className="form-field">
                      <label>Failure Mode</label>
                      <select className="input-md" value={failure} onChange={(e) => setFailure(e.target.value)} disabled={runStatus === 'running'}>
                        <option value="none">None</option>
                        <option value="advocate">Advocate</option>
                        <option value="critic">Critic</option>
                        <option value="moderator">Moderator</option>
                      </select>
                    </div>
                  </div>

                  <label className="checkbox-wrapper">
                    <input type="checkbox" checked={includeCustomAgent} onChange={(e) => setIncludeCustomAgent(e.target.checked)} disabled={!customAgent || runStatus === 'running'} />
                    <span>Include my custom agent</span>
                  </label>

                  <motion.button className="btn-primary btn-large" type="submit" disabled={runStatus === 'running'} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    {runStatus === 'running' ? '⚡ Running Debate...' : '▶ Start Debate'}
                  </motion.button>
                </form>
              </div>

              {/* Past Debates */}
              {displayPastRuns.length > 0 && (
                <motion.div className="card" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <div className="card-header">
                    <Trophy size={18} />
                    <h3>Past Debates</h3>
                  </div>
                  <div className="runs-scroll">
                    {displayPastRuns.map((run) => (
                      <motion.button
                        key={run.id}
                        className={`run-card ${selectedRunId === run.id ? 'active' : ''}`}
                        onClick={() => loadPastRun(run.id)}
                        whileHover={{ x: 8 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <div className="run-date">{run.created_at}</div>
                        <div className="run-question">{run.question}</div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Right Column - Results */}
            <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
              <div className="card">
                <div className="results-header">
                  <div className="header-left">
                    <Activity size={20} />
                    <h2>Debate Results</h2>
                  </div>
                  <motion.span 
                    className={`status-badge status-${runStatus}`} 
                    animate={runStatus === 'running' ? { opacity: [1, 0.6, 1] } : {}} 
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {statusLabel}
                  </motion.span>
                </div>

                {error && (
                  <motion.div className="alert-error" initial={{ y: -10 }} animate={{ y: 0 }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Metrics */}
                {(agreementScore !== null || finalAnswer || messages.length > 0) && (
                  <motion.div className="metrics-showcase" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    {agreementScore !== null && (
                      <motion.div className="metric-box" whileHover={{ y: -8 }}>
                        <div className="metric-icon">🎯</div>
                        <div className="metric-label">Agreement</div>
                        <div className="metric-value">{(agreementScore * 100).toFixed(1)}%</div>
                      </motion.div>
                    )}
                    {messages.length > 0 && (
                      <motion.div className="metric-box" whileHover={{ y: -8 }}>
                        <div className="metric-icon">💬</div>
                        <div className="metric-label">Messages</div>
                        <div className="metric-value">{messages.length}</div>
                      </motion.div>
                    )}
                    <motion.div className="metric-box" whileHover={{ y: -8 }}>
                      <div className="metric-icon">🔄</div>
                      <div className="metric-label">Rounds</div>
                      <div className="metric-value">{currentRound || maxRounds}</div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Visualizations */}
                {(runStatus === 'completed' || runStatus === 'failed') && messages.length > 0 && (
                  <motion.div className="visualizations-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    {/* Debate Progress Chart */}
                    <div className="chart-container">
                      <h4 className="chart-title">📈 Debate Progression</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={visualizationData}>
                          <defs>
                            <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                          <XAxis dataKey="round" stroke="rgba(100, 116, 139, 0.6)" />
                          <YAxis stroke="rgba(100, 116, 139, 0.6)" />
                          <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="engagement" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                          <Line type="monotone" dataKey="consensus" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Agent Performance */}
                    <div className="chart-container">
                      <h4 className="chart-title">🏆 Agent Performance</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={agentPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.1)" />
                          <XAxis dataKey="name" stroke="rgba(100, 116, 139, 0.6)" />
                          <YAxis stroke="rgba(100, 116, 139, 0.6)" />
                          <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }} />
                          <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]}>
                            {agentPerformance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {/* Live Activity */}
                {liveRoundsLog && (
                  <motion.div className="live-section" initial={{ height: 0 }} animate={{ height: 'auto' }}>
                    <h4 className="log-title">🔴 Live Activity Stream</h4>
                    <div className="live-log" ref={liveLogRef}>
                      {liveRoundsLog}
                    </div>
                  </motion.div>
                )}

                {/* Final Answer */}
                {finalAnswer && (
                  <motion.div className="final-answer-box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <div className="answer-header">✨ Consensus Reached</div>
                    <p className="answer-text">{finalAnswer}</p>
                  </motion.div>
                )}

                {/* Timeline */}
                {messages.length > 0 && (
                  <motion.div className="timeline-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                    <h4 className="timeline-title">💭 Debate Timeline</h4>
                    <div className="timeline-list">
                      {timelineRoles.map((role, idx) => {
                        const m = messageFor(messages, role)
                        return (
                          <motion.div key={role} className="timeline-entry" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.1 }}>
                            <div className="timeline-dot">{idx + 1}</div>
                            <div className="timeline-content">
                              <div className="timeline-role">{role}</div>
                              <p className="timeline-text">{m ? m.content.substring(0, 150) + '...' : 'No statement'}</p>
                              {m && <span className="timeline-meta">Round {m.round}</span>}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
