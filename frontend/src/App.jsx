import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, AlertCircle, Activity, Lightbulb } from 'lucide-react'
import './App.css'
import LoginScreen from './LoginScreen.jsx'
import CreateAgentPage from './CreateAgentPage.jsx'
import {
  RoundVisualization,
  FinalWinnerDisplay,
  MultiRoundPerformance,
  LiveProgressStrip,
  RunHistoryChart,
  RoundWinnersTimeline,
} from './RoundVisualization.jsx'
import { getMockDebateDetail, mergePastRunSummaries, MOCK_LIVE_LOG_SNIPPET } from './mockPastRuns.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const SESSION_KEY = 'arguenet_demo_session'
const CUSTOM_AGENT_KEY = 'arguenet_custom_agent'
const THEME_KEY = 'arguenet_theme'
const RUN_HISTORY_KEY = 'arguenet_run_history'
const RUN_HISTORY_MAX = 20

function loadRunHistory() {
  try {
    const raw = localStorage.getItem(RUN_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveRunHistory(history) {
  try {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history.slice(-RUN_HISTORY_MAX)))
  } catch {}
}

function summarizeRoundsForHistory(rounds) {
  if (!rounds || rounds.length === 0) return null
  const totals = {}
  let topWinner = null
  let topWinnerCount = 0
  const winCounts = {}
  rounds.forEach((r) => {
    Object.entries(r.all_scores || {}).forEach(([agent, score]) => {
      if (typeof score !== 'number') return
      if (!totals[agent]) totals[agent] = { sum: 0, count: 0 }
      totals[agent].sum += score
      totals[agent].count += 1
    })
    if (r.winner) {
      winCounts[r.winner] = (winCounts[r.winner] || 0) + 1
      if (winCounts[r.winner] > topWinnerCount) {
        topWinnerCount = winCounts[r.winner]
        topWinner = r.winner
      }
    }
  })
  const agentAverages = {}
  Object.entries(totals).forEach(([agent, { sum, count }]) => {
    agentAverages[agent] = count ? sum / count : 0
  })
  // overall winner = highest average
  let overall = null
  let bestAvg = -Infinity
  Object.entries(agentAverages).forEach(([agent, avg]) => {
    if (avg > bestAvg) {
      bestAvg = avg
      overall = agent
    }
  })
  return { agentAverages, winner: overall ?? topWinner, roundsCount: rounds.length }
}

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

/**
 * Try to extract a clean prose consensus from whatever the backend returned.
 * Many runs put a fenced JSON debate-state blob in final_answer; we surface
 * the most useful field (claim / final_answer / answer / summary) and hide
 * the raw payload behind a toggle.
 *
 * @param {string} text - The raw final_answer text from the backend
 * @returns {{ clean: string, raw: string }} An object with the cleaned prose and the raw string if hidden.
 */
function extractCleanAnswer(text) {
  if (!text || typeof text !== 'string') return { clean: '', raw: '' }
  const raw = text.trim()

  // Strip ```json ... ``` fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw

  // Try to JSON-parse
  try {
    const parsed = JSON.parse(candidate)
    const pickFromObj = (obj) => {
      if (!obj || typeof obj !== 'object') return null
      const keys = ['final_answer', 'answer', 'claim', 'summary', 'conclusion']
      for (const k of keys) {
        const v = obj[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
      return null
    }
    let found = pickFromObj(parsed)
    if (!found && Array.isArray(parsed?.history)) {
      // Walk history for the latest entry with a claim/argument
      for (let i = parsed.history.length - 1; i >= 0 && !found; i--) {
        const item = parsed.history[i]
        const arg = item?.argument
        if (typeof arg === 'string') {
          // arg may itself be a JSON string
          try {
            const argObj = JSON.parse(arg)
            found = pickFromObj(argObj)
          } catch {
            if (arg.trim()) found = arg.trim()
          }
        }
      }
    }
    if (found) return { clean: found, raw }
  } catch {
    // not JSON
  }

  // Heuristic: if it starts with `{` or has many braces, treat it as a blob
  const looksLikeJson = /^[{\[]/.test(raw) || (raw.match(/[{}]/g) || []).length > 10
  if (looksLikeJson) {
    return {
      clean: 'No clear prose answer was produced. The full debate state is available below.',
      raw,
    }
  }

  return { clean: raw, raw: '' }
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
  const [roundVisualizations, setRoundVisualizations] = useState([])
  const [runHistory, setRunHistory] = useState(() => loadRunHistory())
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

  const displayPastRuns = useMemo(() => {
    const serverList = mergePastRunSummaries(pastRuns)
    const seen = new Set(serverList.map((r) => r.debate_id))
    const cachedOnly = runHistory
      .filter((r) => r.debate_id && !seen.has(r.debate_id))
      .map((r) => ({
        debate_id: r.debate_id,
        question: r.question ?? '',
        status: 'completed',
        round: r.roundsCount ?? 0,
        created_at: r.finished_at ?? '',
      }))
    return [...cachedOnly, ...serverList].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [pastRuns, runHistory])

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
    setRoundVisualizations([])
  }

  async function loadPastRun(debateId) {
    if (!debateId) {
      setError('Could not open that debate (missing id).')
      return
    }
    setError(null)
    setPastRunsError(null)
    const mockDetail = getMockDebateDetail(debateId)
    if (mockDetail) {
      setSelectedRunId(mockDetail.debate_id)
      setQuestion(mockDetail.question ?? '')
      setLiveRoundsLog(`${PAST_RUN_LIVE_NOTE}${MOCK_LIVE_LOG_SNIPPET}`)
      setRoundVisualizations(Array.isArray(mockDetail.round_scores) ? mockDetail.round_scores : [])
      applyDebatePayload(mockDetail)
      return
    }
    // Try server first
    try {
      const res = await fetch(`${API_BASE}/debate/${encodeURIComponent(debateId)}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedRunId(data.debate_id)
        setQuestion(data.question ?? '')
        setLiveRoundsLog(PAST_RUN_LIVE_NOTE)
        setRoundVisualizations(Array.isArray(data.round_scores) ? data.round_scores : [])
        applyDebatePayload(data)
        return
      }
    } catch {
      // network errors fall through to local cache below
    }
    // Fallback: local cache (survives orchestrator restarts)
    const cached = runHistory.find((r) => r.debate_id === debateId)
    if (cached?.debate) {
      setSelectedRunId(cached.debate_id)
      setQuestion(cached.question ?? cached.debate.question ?? '')
      setLiveRoundsLog(PAST_RUN_LIVE_NOTE)
      setRoundVisualizations(Array.isArray(cached.round_scores) ? cached.round_scores : [])
      applyDebatePayload(cached.debate)
      return
    }
    setError('Debate not found on server and no local cache available. Re-run the debate to view it.')
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
    setRoundVisualizations([])

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
            console.warn('[stream] non-JSON line:', line)
            continue
          }
          // Debug: log every stream event received from backend
          console.log('[stream]', ev.event, ev)
          if (ev.event === 'log' && typeof ev.text === 'string') {
            // Don't render raw text in UI — only use it to track current round.
            const roundMatch = ev.text.match(/ROUND (\d+)/)
            if (roundMatch) setCurrentRound(parseInt(roundMatch[1], 10))
          } else if ((ev.event === 'round' && ev.round_data) || ev.event === 'round_complete') {
            // Support both nested ({round_data: {...}}) and flat ({round, winner, ...}) shapes
            const roundData = ev.round_data ?? {
              round: ev.round,
              winner: ev.winner,
              winner_score: ev.winner_score,
              all_scores: ev.all_scores,
              all_arguments: ev.all_arguments,
              fact_checks: ev.fact_checks,
              summary: ev.summary,
              key_insights: ev.key_insights,
              feedback_for_agents: ev.feedback_for_agents,
            }
            console.log('[stream] round visualization data:', roundData)
            setRoundVisualizations((prev) => [...prev, roundData])
            if (roundData.round) setCurrentRound(roundData.round)
          } else if (ev.event === 'result' && ev.debate) {
            applyDebatePayload(ev.debate)
            if (ev.debate.debate_id) setSelectedRunId(ev.debate.debate_id)
            setRunStatus('completed')
            // Snapshot this completed run into history for cross-run comparison.
            setRoundVisualizations((roundsNow) => {
              const summary = summarizeRoundsForHistory(roundsNow)
              if (summary && Object.keys(summary.agentAverages).length > 0) {
                setRunHistory((prev) => {
                  const entry = {
                    debate_id: ev.debate.debate_id,
                    question: ev.debate.question ?? '',
                    finished_at: new Date().toISOString(),
                    debate: ev.debate,
                    round_scores: roundsNow,
                    ...summary,
                  }
                  // Avoid duplicate append if same debate_id already last
                  if (prev.length && prev[prev.length - 1]?.debate_id === entry.debate_id) {
                    const replaced = [...prev.slice(0, -1), entry]
                    saveRunHistory(replaced)
                    return replaced
                  }
                  const next = [...prev, entry]
                  saveRunHistory(next)
                  return next
                })
              }
              return roundsNow
            })
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
                    {displayPastRuns.map((run) => {
                      const runId = run.debate_id ?? run.id
                      const dateLabel = (() => {
                        const d = new Date(run.created_at)
                        return Number.isNaN(d.getTime()) ? String(run.created_at ?? '') : d.toLocaleString()
                      })()
                      return (
                        <motion.button
                          key={runId}
                          className={`run-card ${selectedRunId === runId ? 'active' : ''}`}
                          onClick={() => loadPastRun(runId)}
                          whileHover={{ x: 8 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <div className="run-date">{dateLabel}</div>
                          <div className="run-question">{run.question}</div>
                        </motion.button>
                      )
                    })}
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

                {/* Visualizations: round-by-round winners (real data) */}
                {roundVisualizations.length > 0 && (
                  <motion.div
                    className="visualizations-section"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <RoundWinnersTimeline rounds={roundVisualizations} />
                  </motion.div>
                )}

                {/* Cross-run history (line chart x=runs, y=scores) */}
                {runHistory.length > 0 && <RunHistoryChart history={runHistory} />}

                {/* Live progress strip while running */}
                <LiveProgressStrip
                  rounds={roundVisualizations}
                  currentRound={currentRound}
                  maxRounds={parseInt(String(maxRounds).trim(), 10) || undefined}
                  status={runStatus}
                />

                {/* Cross-round performance trend */}
                {roundVisualizations.length > 0 && (
                  <MultiRoundPerformance rounds={roundVisualizations} />
                )}

                {/* Round Visualizations */}
                {roundVisualizations.length > 0 && (
                  <motion.div className="rounds-visualizations" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {roundVisualizations.map((round, idx) => (
                      <RoundVisualization key={`round-${idx}`} round={round} />
                    ))}
                  </motion.div>
                )}

                {/* Final Answer */}
                {finalAnswer && (() => {
                  const { clean, raw } = extractCleanAnswer(finalAnswer)
                  return (
                    <motion.div
                      className="final-answer-box"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="answer-header">✨ Consensus Reached</div>
                      <p className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>{clean}</p>
                      {raw && (
                        <details style={{ marginTop: 12 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                            Show raw debate state
                          </summary>
                          <pre
                            style={{
                              marginTop: 8,
                              maxHeight: 240,
                              overflow: 'auto',
                              background: 'rgba(0,0,0,0.35)',
                              padding: 12,
                              borderRadius: 8,
                              fontSize: 11,
                              color: 'rgba(255,255,255,0.7)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {raw}
                          </pre>
                        </details>
                      )}
                    </motion.div>
                  )
                })()}

                {/* Final Winner Display */}
                {runStatus === 'completed' && roundVisualizations.length > 0 && (
                  <FinalWinnerDisplay 
                    rounds={roundVisualizations} 
                    finalAnswer={extractCleanAnswer(finalAnswer).clean}
                    agreementScore={agreementScore}
                    question={question}
                  />
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
