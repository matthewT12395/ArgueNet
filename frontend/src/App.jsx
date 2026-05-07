import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, AlertCircle, Activity, Lightbulb, Bot, User, Users } from 'lucide-react'
import './App.css'
import LoginScreen from './LoginScreen.jsx'
import CreateAgentPage from './CreateAgentPage.jsx'
import FriendsPage, { NETWORK as FRIENDS_NETWORK } from './FriendsPage.jsx'
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
const CUSTOM_AGENT_KEY = 'arguenet_custom_agent' // legacy single-agent slot (migrated)
const CUSTOM_AGENTS_KEY = 'arguenet_custom_agents'
const FRIENDS_KEY = 'arguenet_friends'
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

function loadFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveFriends(friends) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends))
}

function loadCustomAgents() {
  // New: list of custom agents (each {id,name,persona,hobbies,opinions,communicationStyle}).
  try {
    const raw = localStorage.getItem(CUSTOM_AGENTS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        return arr
          .filter((a) => a && typeof a.name === 'string' && a.name.trim())
          .map((a) => ({
            id: a.id || `custom_${Math.random().toString(36).slice(2, 9)}`,
            name: a.name.trim(),
            persona: typeof a.persona === 'string' ? a.persona.trim() : '',
            hobbies: typeof a.hobbies === 'string' ? a.hobbies.trim() : '',
            opinions: typeof a.opinions === 'string' ? a.opinions.trim() : '',
            communicationStyle:
              typeof a.communicationStyle === 'string' ? a.communicationStyle.trim() : '',
          }))
      }
    }
  } catch {}
  // Migration: legacy single agent under CUSTOM_AGENT_KEY → first item in new list.
  try {
    const raw = localStorage.getItem(CUSTOM_AGENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (typeof parsed?.name !== 'string' || !parsed.name.trim()) return []
    const migrated = [{
      id: `custom_${Math.random().toString(36).slice(2, 9)}`,
      name: parsed.name.trim(),
      persona: typeof parsed.persona === 'string' ? parsed.persona.trim() : '',
      hobbies: typeof parsed.hobbies === 'string' ? parsed.hobbies.trim() : '',
      opinions: typeof parsed.opinions === 'string' ? parsed.opinions.trim() : '',
      communicationStyle:
        typeof parsed.communicationStyle === 'string' ? parsed.communicationStyle.trim() : '',
    }]
    try { localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(migrated)) } catch {}
    return migrated
  } catch {
    return []
  }
}

function saveCustomAgents(list) {
  localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(list))
}

const ROLES = ['advocate', 'critic', 'moderator']
const DEFAULT_MAX_ROUNDS = 5
const MAX_ROUNDS_LIMIT = 20
const PAST_RUN_LIVE_NOTE = '(Live log captured during debate stream)\n\n'

function messageFor(messages, role) {
  return messages.find((m) => m.sender === role) ?? null
}

// Try to extract a clean prose consensus from whatever the backend returned.
// Many runs put a fenced JSON debate-state blob in final_answer; we surface
// the most useful field (claim / final_answer / answer / summary) and hide
// the raw payload behind a toggle.
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
  const [customAgents, setCustomAgents] = useState(() => loadCustomAgents())
  const [friends, setFriends] = useState(() => loadFriends())
  const [selectedAgentIds, setSelectedAgentIds] = useState([])
  const [agentSearch, setAgentSearch] = useState('')

  // Unified roster: custom agents (created via Create Agent) + saved friends.
  // Each entry has the same shape so the search/selector treats them identically.
  const selectableAgents = useMemo(() => {
    const customs = customAgents.map((a) => ({
      id: a.id,
      kind: 'custom',
      name: a.name,
      role: 'Custom agent',
      avatar: (a.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?',
      color: '#a855f7',
      bio: a.persona,
      hobbies: a.hobbies,
      beliefs: a.opinions,
      style: a.communicationStyle,
      tags: ['custom'],
    }))
    const fr = friends.map((f) => ({
      id: f.id,
      kind: 'friend',
      name: f.name,
      role: f.role,
      avatar: f.avatar,
      color: f.color,
      bio: f.bio,
      hobbies: f.hobbies,
      beliefs: f.beliefs,
      style: f.style,
      tags: f.tags || [],
    }))
    // Also surface friends from the Friends directory that haven't been added yet,
    // so the main-page search can find and select them directly.
    const savedIds = new Set(friends.map((f) => f.id))
    const directory = FRIENDS_NETWORK
      .filter((f) => !savedIds.has(f.id))
      .map((f) => ({
        id: f.id,
        kind: 'friend',
        isDirectory: true,
        name: f.name,
        role: f.role,
        avatar: f.avatar,
        color: f.color,
        bio: f.bio,
        hobbies: f.hobbies,
        beliefs: f.beliefs,
        style: f.style,
        tags: f.tags || [],
      }))
    return [...customs, ...fr, ...directory]
  }, [customAgents, friends])

  const selectedAgents = useMemo(
    () => selectableAgents.filter((a) => selectedAgentIds.includes(a.id)),
    [selectableAgents, selectedAgentIds],
  )

  const timelineRoles = useMemo(() => {
    const extras = []
    selectedAgents.forEach((a) => {
      if (a.name && !extras.includes(a.name)) extras.push(a.name)
    })
    return [...ROLES, ...extras]
  }, [selectedAgents])

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

    const friendAgents = selectedAgents.map((a) => ({
      name: a.name,
      background: a.bio ?? '',
      hobbies: a.hobbies ?? '',
      beliefs: a.beliefs ?? '',
      communication_style: a.style ?? '',
    }))

    const body = {
      question: question.trim(),
      simulate_failure: failure !== 'none',
      failed_node: failure === 'none' ? null : failure,
      max_rounds: rounds,
      personal_agent: null,
      personal_agents: friendAgents,
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
    // Append new custom agent (or update if same name) and auto-select it
    // for the next debate run.
    setCustomAgents((prev) => {
      const existingIdx = prev.findIndex((a) => a.name.toLowerCase() === agent.name.toLowerCase())
      let next
      let id
      if (existingIdx >= 0) {
        id = prev[existingIdx].id
        next = prev.map((a, i) => (i === existingIdx ? { ...a, ...agent, id } : a))
      } else {
        id = `custom_${Math.random().toString(36).slice(2, 9)}`
        next = [...prev, { id, ...agent }]
      }
      saveCustomAgents(next)
      setSelectedAgentIds((sel) => (sel.includes(id) ? sel : [...sel, id]))
      return next
    })
    setActiveView('dashboard')
  }

  function handleSaveFriends(updated) {
    setFriends(updated)
    saveFriends(updated)
  }

  function handleAddFriendToSession(friend) {
    // Add to friends list (if new) and auto-select for the next debate run.
    setFriends((prev) => {
      const existing = prev.find((f) => f.id === friend.id || f.name === friend.name)
      if (existing) {
        setSelectedAgentIds((sel) => (sel.includes(existing.id) ? sel : [...sel, existing.id]))
        return prev
      }
      const next = [...prev, friend]
      saveFriends(next)
      setSelectedAgentIds((sel) => (sel.includes(friend.id) ? sel : [...sel, friend.id]))
      return next
    })
    setActiveView('dashboard')
  }

  function isFriendInSession(friend) {
    const f = friends.find((x) => x.id === friend.id || x.name === friend.name)
    return !!f && selectedAgentIds.includes(f.id)
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
            <motion.span className="brand-icon-premium" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
              <svg width="28" height="28" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(120,120)">
                  <line x1="0" y1="-72" x2="0" y2="-14" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="0" cy="-72" r="14" fill="#FFFFFF" />
                  <line x1="62" y1="-36" x2="12" y2="-7" stroke="#F97362" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="62" cy="-36" r="14" fill="#F97362" />
                  <line x1="62" y1="36" x2="12" y2="7" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="62" cy="36" r="14" fill="#FFFFFF" />
                  <line x1="0" y1="72" x2="0" y2="14" stroke="#F97362" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="0" cy="72" r="14" fill="#F97362" />
                  <line x1="-62" y1="36" x2="-12" y2="7" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="-62" cy="36" r="14" fill="#FFFFFF" />
                  <line x1="-62" y1="-36" x2="-12" y2="-7" stroke="#F97362" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="-62" cy="-36" r="14" fill="#F97362" />
                  <circle cx="0" cy="0" r="22" fill="#F4B942" />
                </g>
              </svg>
            </motion.span>
            <div className="brand-info">
              <h1>ArgueNet</h1>
              <p>AI-Powered Multi-Agent Debate Platform</p>
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
              {activeView === 'create-agent' ? '← Back' : <><Bot size={15} style={{ marginRight: 5 }} />Create Agent</>}
            </motion.button>
            <motion.button
              className={`btn-secondary${activeView === 'friends' ? ' btn-secondary--active' : ''}`}
              onClick={() => setActiveView(activeView === 'friends' ? 'dashboard' : 'friends')}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Users size={15} style={{ marginRight: 5 }} />
              {activeView === 'friends' ? '← Back' : 'Friends'}
            </motion.button>
            <div className="user-badge">
              <span className="user-avatar"><User size={13} /></span>
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
          <CreateAgentPage onCancel={() => setActiveView('dashboard')} onSave={handleSaveAgent} />
        ) : activeView === 'friends' ? (
          <FriendsPage friends={friends} onSave={handleSaveFriends} onAddToSession={handleAddFriendToSession} isInSession={isFriendInSession} onBack={() => setActiveView('dashboard')} />
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

                  {selectableAgents.length > 0 && (() => {
                    const q = agentSearch.trim().toLowerCase()
                    // Default view hides directory-only friends; they appear once the user searches
                    // (or once they've been selected, so the chip stays visible).
                    const baseList = q
                      ? selectableAgents
                      : selectableAgents.filter((a) => !a.isDirectory || selectedAgentIds.includes(a.id))
                    const filtered = q
                      ? baseList.filter((a) =>
                          [a.name, a.role, a.bio, a.style, a.beliefs, ...(a.tags || [])]
                            .filter(Boolean)
                            .some((s) => String(s).toLowerCase().includes(q)),
                        )
                      : baseList
                    return (
                    <div className="form-field" style={{ marginTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Add agents to this debate</span>
                        {selectedAgentIds.length > 0 && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => setSelectedAgentIds([])}
                            disabled={runStatus === 'running'}
                          >
                            Clear ({selectedAgentIds.length})
                          </button>
                        )}
                      </label>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <input
                          type="search"
                          className="question-input"
                          placeholder="Search custom agents and friends by name, role, or topic..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          disabled={runStatus === 'running'}
                          style={{ width: '100%', fontSize: 12, padding: '6px 28px 6px 10px' }}
                        />
                        {agentSearch && (
                          <button
                            type="button"
                            onClick={() => setAgentSearch('')}
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255,255,255,0.55)',
                              cursor: 'pointer',
                              fontSize: 14,
                              lineHeight: 1,
                              padding: '2px 6px',
                            }}
                            title="Clear search"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                          gap: 6,
                          maxHeight: 180,
                          overflowY: 'auto',
                          padding: 6,
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          background: 'rgba(0,0,0,0.15)',
                        }}
                      >
                        {filtered.length === 0 && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '6px 4px', gridColumn: '1 / -1' }}>
                            No agents match “{agentSearch}”.
                          </p>
                        )}
                        {filtered.map((a) => {
                          const checked = selectedAgentIds.includes(a.id)
                          return (
                            <label
                              key={a.id}
                              className="checkbox-wrapper"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 6px',
                                margin: 0,
                                borderRadius: 6,
                                background: checked ? 'rgba(99,102,241,0.15)' : 'transparent',
                                cursor: runStatus === 'running' ? 'not-allowed' : 'pointer',
                                opacity: runStatus === 'running' ? 0.6 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={runStatus === 'running'}
                                onChange={(e) => {
                                  setSelectedAgentIds((prev) =>
                                    e.target.checked
                                      ? [...prev, a.id]
                                      : prev.filter((id) => id !== a.id),
                                  )
                                }}
                              />
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: a.color || '#6366f1',
                                  color: '#fff',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  textAlign: 'center',
                                  lineHeight: '18px',
                                  flexShrink: 0,
                                }}
                              >
                                {a.avatar || (a.name || '?').slice(0, 2).toUpperCase()}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                                title={a.name}
                              >
                                {a.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  letterSpacing: 0.3,
                                  flexShrink: 0,
                                  background: a.kind === 'custom' ? 'rgba(168,85,247,0.22)' : 'rgba(16,185,129,0.22)',
                                  color: a.kind === 'custom' ? '#d8b4fe' : '#6ee7b7',
                                }}
                              >
                                {a.kind === 'custom' ? 'CUSTOM' : 'FRIEND'}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      {selectedAgentIds.length > 0 && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                          {selectedAgentIds.length} agent{selectedAgentIds.length === 1 ? '' : 's'} will join the debate as additional speakers.
                        </p>
                      )}
                    </div>
                    )
                  })()}

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
