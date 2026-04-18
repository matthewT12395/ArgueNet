import { useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const ROLES = ['advocate', 'critic', 'moderator']

function messageFor(messages, role) {
  return messages.find((m) => m.sender === role) ?? null
}

export default function App() {
  const [question, setQuestion] = useState('')
  const [failure, setFailure] = useState('none')
  const [runStatus, setRunStatus] = useState('ready')
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [agreementScore, setAgreementScore] = useState(null)
  const [failedNodes, setFailedNodes] = useState([])

  async function runDebate(e) {
    e.preventDefault()
    setError(null)
    setRunStatus('running')
    setMessages([])
    setFinalAnswer('')
    setAgreementScore(null)
    setFailedNodes([])

    const body = {
      question: question.trim(),
      simulate_failure: failure !== 'none',
      failed_node: failure === 'none' ? null : failure,
    }

    try {
      const res = await fetch(`${API_BASE}/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail ?? res.statusText ?? 'Request failed')
      }
      const data = await res.json()
      setMessages(data.messages ?? [])
      setFinalAnswer(data.final_answer ?? '')
      setAgreementScore(typeof data.agreement_score === 'number' ? data.agreement_score : null)
      setFailedNodes(data.failed_nodes ?? [])
      const s = (data.status ?? '').toLowerCase()
      setRunStatus(s === 'completed' ? 'completed' : s === 'failed' ? 'failed' : 'completed')
    } catch (err) {
      setError(err.message ?? String(err))
      setRunStatus('failed')
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

  return (
    <div className="dashboard">
      <header className="header">
        <h1 className="title">ArgueNet</h1>
        <p className="tagline">Multi-agent debate orchestrator</p>
      </header>

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
          Run Debate
        </button>
      </form>

      <section className="bottom" aria-label="Debate output">
        <p className="status-line">
          Status: <strong>{statusLabel}</strong>
        </p>
        {error ? <p className="error">{error}</p> : null}

        <h2 className="section-title">Debate timeline</h2>
        <ol className="timeline">
          {ROLES.map((role) => {
            const m = messageFor(messages, role)
            return (
              <li key={role} className="card">
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

        <div className="card final">
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
  )
}
