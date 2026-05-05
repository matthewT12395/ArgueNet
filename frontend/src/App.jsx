import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import LoginScreen from './LoginScreen.jsx'
import {
  getMockDebateDetail,
  mergePastRunSummaries,
  MOCK_LIVE_LOG_SNIPPET,
} from './mockPastRuns.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const SESSION_KEY = 'arguenet_demo_session'

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
const ROLES = ['advocate', 'critic', 'moderator']
const DEFAULT_MAX_ROUNDS = 6
const MAX_ROUNDS_LIMIT = 20

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

  useEffect(() => {
    const el = liveLogRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [liveRoundsLog])

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
    const rounds =
      Number.isFinite(n) && n >= 1 ? Math.min(MAX_ROUNDS_LIMIT, Math.max(1, n)) : DEFAULT_MAX_ROUNDS

    const body = {
      question: question.trim(),
      simulate_failure: failure !== 'none',
      failed_node: failure === 'none' ? null : failure,
      max_rounds: rounds,
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
              <span className="session-user" title={session.username}>
                {session.username}
              </span>
              <button type="button" className="session-logout" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </header>

        <nav className="past-runs-nav panel panel-subtle" aria-label="Past debates">
        <div className="past-runs-head">
          <span className="past-runs-title">Past runs</span>
          <button type="button" className="nav-refresh" onClick={() => fetchPastRuns()}>
            Refresh
          </button>
        </div>
        {pastRunsError ? <p className="past-runs-error">{pastRunsError}</p> : null}
        <div className="past-runs-scroll" role="list">
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
            {ROLES.map((role) => {
              const m = messageFor(messages, role)
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
    </div>
  )
}
