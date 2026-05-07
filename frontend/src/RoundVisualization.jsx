import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { Trophy, Sparkles, Activity, Loader, Crown, History, Flag } from 'lucide-react'

const AGENT_COLORS = {
  advocate: '#818cf8',
  critic: '#f472b6',
  skeptic: '#f472b6',
  empiricist: '#22d3ee',
  devils_advocate: '#f87171',
  moderator: '#fbbf24',
  default: '#a78bfa',
}

const colorFor = (agent) => AGENT_COLORS[agent] || AGENT_COLORS.default

const prettyName = (agent) =>
  String(agent || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

// Per-round summary card (winner + scores chart only — no raw JSON)
export function RoundVisualization({ round }) {
  if (!round || !round.all_scores) return null

  const roundNum = round.round
  const winner = round.winner
  const summary = round.summary || ''
  const allScores = round.all_scores || {}

  const scoreData = Object.entries(allScores)
    .map(([agent, score]) => ({
      name: prettyName(agent),
      rawName: agent,
      score: typeof score === 'number' ? score : 0,
      isWinner: agent === winner,
    }))
    .sort((a, b) => b.score - a.score)

  const winnerScore = allScores[winner]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="round-visualization"
      style={{
        background:
          'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '16px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: '700',
            fontSize: '14px',
          }}
        >
          {roundNum}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>
            Round {roundNum}
          </div>
          {summary && (
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                marginTop: '2px',
                lineHeight: 1.4,
              }}
            >
              {summary.length > 160 ? summary.slice(0, 160) + '…' : summary}
            </div>
          )}
        </div>
        <div
          style={{
            background: `${colorFor(winner)}22`,
            border: `1px solid ${colorFor(winner)}`,
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Trophy size={14} style={{ color: '#fbbf24' }} />
          {prettyName(winner)}
          {typeof winnerScore === 'number' ? ` · ${winnerScore.toFixed(1)}` : ''}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={scoreData} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="rgba(255,255,255,0.4)" fontSize={11} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="rgba(255,255,255,0.6)"
            fontSize={12}
            width={90}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{
              background: 'rgba(20, 30, 50, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}/100`, 'Score']}
          />
          <Bar dataKey="score" radius={[0, 6, 6, 0]}>
            {scoreData.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={entry.isWinner ? '#fbbf24' : colorFor(entry.rawName)}
                opacity={entry.isWinner ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

// Multi-round performance: line chart of every agent's score across rounds
export function MultiRoundPerformance({ rounds }) {
  if (!rounds || rounds.length === 0) return null

  const agents = Array.from(
    new Set(rounds.flatMap((r) => Object.keys(r.all_scores || {})))
  )
  if (agents.length === 0) return null

  const data = rounds.map((r) => {
    const row = { round: `R${r.round}` }
    agents.forEach((agent) => {
      const v = r.all_scores?.[agent]
      row[agent] = typeof v === 'number' ? v : null
    })
    return row
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.55), rgba(15, 23, 42, 0.75))',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '16px',
        border: '1px solid rgba(99, 102, 241, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Activity size={18} style={{ color: '#6366f1' }} />
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>
          Agent Performance Across Rounds
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="round" stroke="rgba(255,255,255,0.5)" fontSize={12} />
          <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} fontSize={12} />
          <Tooltip
            contentStyle={{
              background: 'rgba(20, 30, 50, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value, name) => [`${Number(value).toFixed(1)}/100`, prettyName(name)]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                {prettyName(value)}
              </span>
            )}
          />
          {agents.map((agent) => (
            <Line
              key={agent}
              type="monotone"
              dataKey={agent}
              stroke={colorFor(agent)}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: colorFor(agent) }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

// Live progress strip while a debate is running. No raw text.
export function LiveProgressStrip({ rounds, currentRound, maxRounds, status }) {
  if (status !== 'running') return null

  const completed = rounds?.length ?? 0
  const total = Math.max(maxRounds || 0, currentRound || 0, completed + 1)
  const cells = Array.from({ length: total }, (_, i) => i + 1)
  const activeRound = currentRound || completed + 1

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(99, 102, 241, 0.08)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        style={{ color: '#6366f1', display: 'flex' }}
      >
        <Loader size={20} />
      </motion.div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
          Debating — Round {activeRound}
          {maxRounds ? ` of ${maxRounds}` : ''}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
          {completed} round{completed === 1 ? '' : 's'} completed
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {cells.map((n) => {
          const done = n <= completed
          const active = n === activeRound && !done
          return (
            <div
              key={n}
              title={`Round ${n}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: done
                  ? '#10b981'
                  : active
                  ? '#fbbf24'
                  : 'rgba(255,255,255,0.15)',
                boxShadow: active ? '0 0 8px #fbbf24' : 'none',
                transition: 'background 0.3s',
              }}
            />
          )
        })}
      </div>
    </motion.div>
  )
}

// Final winner display: grand champion + summary stats + averages chart
export function FinalWinnerDisplay({ rounds, finalAnswer, agreementScore }) {
  if (!rounds || rounds.length === 0) return null

  const cumulativeScores = {}
  rounds.forEach((round) => {
    Object.entries(round.all_scores || {}).forEach(([agent, score]) => {
      if (typeof score !== 'number') return
      if (!cumulativeScores[agent]) {
        cumulativeScores[agent] = { totalScore: 0, roundCount: 0, wins: 0 }
      }
      cumulativeScores[agent].totalScore += score
      cumulativeScores[agent].roundCount += 1
      if (round.winner === agent) cumulativeScores[agent].wins += 1
    })
  })

  const agentStats = Object.entries(cumulativeScores).map(([agent, data]) => ({
    agent,
    totalScore: data.totalScore,
    averageScore: data.roundCount ? data.totalScore / data.roundCount : 0,
    roundCount: data.roundCount,
    wins: data.wins,
  }))

  if (agentStats.length === 0) return null

  const sortedAgents = agentStats.sort((a, b) => b.totalScore - a.totalScore)
  const finalWinner = sortedAgents[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        background: `linear-gradient(135deg, ${colorFor(finalWinner.agent)}26 0%, rgba(15, 23, 42, 0.85) 100%)`,
        borderRadius: '16px',
        padding: '32px',
        marginTop: '24px',
        border: `2px solid ${colorFor(finalWinner.agent)}`,
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ marginBottom: '16px' }}
      >
        <Trophy size={48} style={{ color: '#fbbf24', margin: '0 auto 12px' }} />
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, letterSpacing: 1 }}>
          GRAND CHAMPION
        </div>
        <h2
          style={{
            margin: '4px 0 0',
            fontSize: '32px',
            fontWeight: '800',
            background: `linear-gradient(135deg, ${colorFor(finalWinner.agent)} 0%, #fbbf24 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {prettyName(finalWinner.agent)}
        </h2>
      </motion.div>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
        }}
      >
        {[
          { label: 'Avg Score', value: `${finalWinner.averageScore.toFixed(1)}`, color: '#fbbf24' },
          { label: 'Round Wins', value: `${finalWinner.wins}/${rounds.length}`, color: '#10b981' },
          { label: 'Rounds', value: rounds.length, color: '#fff' },
          {
            label: 'Consensus',
            value:
              typeof agreementScore === 'number'
                ? `${(agreementScore * 100).toFixed(0)}%`
                : '—',
            color: '#6366f1',
          },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: finalAnswer ? '24px' : 0 }}>
        <h3
          style={{
            margin: '0 0 12px',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          Average Score by Agent
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={sortedAgents.map((a) => ({
              name: prettyName(a.agent),
              rawName: a.agent,
              average: a.averageScore,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} fontSize={12} />
            <Tooltip
              contentStyle={{
                background: 'rgba(20, 30, 50, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => `${Number(value).toFixed(1)}/100`}
            />
            <Bar dataKey="average" radius={[8, 8, 0, 0]}>
              {sortedAgents.map((a, idx) => (
                <Cell key={idx} fill={colorFor(a.agent)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {finalAnswer && (
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Sparkles size={14} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              Final Consensus Answer
            </span>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.6 }}>
            {finalAnswer}
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Cross-run comparison: line chart of every agent across past runs + champion
// ---------------------------------------------------------------------------
export function RunHistoryChart({ history }) {
  if (!history || history.length === 0) return null

  // Build chart data: x = run index, one series per agent
  const agents = Array.from(
    new Set(history.flatMap((run) => Object.keys(run.agentAverages || {})))
  )
  if (agents.length === 0) return null

  const data = history.map((run, idx) => {
    const row = {
      run: `Run ${idx + 1}`,
      _question: run.question || '',
      _winner: run.winner || '',
    }
    agents.forEach((agent) => {
      const v = run.agentAverages?.[agent]
      row[agent] = typeof v === 'number' ? v : null
    })
    return row
  })

  // Tally championships across runs to find Champion of Champions
  const championship = {}
  let bestAvg = { agent: null, score: -Infinity }
  agents.forEach((agent) => {
    let total = 0
    let count = 0
    let wins = 0
    history.forEach((run) => {
      const v = run.agentAverages?.[agent]
      if (typeof v === 'number') {
        total += v
        count += 1
      }
      if (run.winner === agent) wins += 1
    })
    const avg = count ? total / count : 0
    championship[agent] = { avg, wins, count }
    if (avg > bestAvg.score) bestAvg = { agent, score: avg }
  })

  const champion = bestAvg.agent
  const championStats = championship[champion] || {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background:
          'linear-gradient(135deg, rgba(30, 41, 59, 0.55), rgba(15, 23, 42, 0.8))',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        border: '1px solid rgba(99, 102, 241, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <History size={20} style={{ color: '#6366f1' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
          Cross-Run Score Comparison
        </div>
        <div
          style={{
            marginLeft: 'auto',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12,
          }}
        >
          {history.length} run{history.length === 1 ? '' : 's'} tracked
        </div>
      </div>

      {/* Champion of Champions */}
      {champion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: `linear-gradient(135deg, ${colorFor(champion)}33, rgba(0,0,0,0.35))`,
            border: `1px solid ${colorFor(champion)}`,
            padding: '14px 18px',
            borderRadius: 12,
            marginBottom: 18,
          }}
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{ display: 'flex' }}
          >
            <Crown size={36} style={{ color: '#fbbf24' }} />
          </motion.div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 1 }}>
              CHAMPION OF CHAMPIONS
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${colorFor(champion)}, #fbbf24)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {prettyName(champion)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Avg</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>
              {championStats.avg?.toFixed(1) ?? '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Wins</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
              {championStats.wins ?? 0}/{history.length}
            </div>
          </div>
        </motion.div>
      )}

      {/* Line chart: x=runs, y=score, one line per agent */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="run" stroke="rgba(255,255,255,0.5)" fontSize={12} />
          <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} fontSize={12} />
          <Tooltip
            contentStyle={{
              background: 'rgba(20, 30, 50, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#fff',
            }}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload
              return p?._question
                ? `${label} · "${String(p._question).slice(0, 60)}"`
                : label
            }}
            formatter={(value, name) => [
              `${Number(value).toFixed(1)}/100`,
              prettyName(name),
            ]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                {prettyName(value)}
              </span>
            )}
          />
          {agents.map((agent) => (
            <Line
              key={agent}
              type="monotone"
              dataKey={agent}
              stroke={colorFor(agent)}
              strokeWidth={agent === champion ? 3.5 : 2.5}
              dot={{ r: 4, strokeWidth: 0, fill: colorFor(agent) }}
              activeDot={{ r: 7 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// RoundWinnersTimeline — visualizes who won each round, with a step strip and
// a per-agent win-count bar chart. Driven entirely by real round data.
// ---------------------------------------------------------------------------
export function RoundWinnersTimeline({ rounds }) {
  if (!rounds || rounds.length === 0) return null

  const winCounts = {}
  rounds.forEach((r) => {
    if (r.winner) winCounts[r.winner] = (winCounts[r.winner] || 0) + 1
  })

  const winData = Object.entries(winCounts)
    .map(([agent, wins]) => ({
      agent,
      name: prettyName(agent),
      wins,
    }))
    .sort((a, b) => b.wins - a.wins)

  const overallLeader = winData[0]?.agent

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        background:
          'linear-gradient(135deg, rgba(129,140,248,0.06), rgba(244,114,182,0.04))',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 22px',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Flag size={18} style={{ color: 'var(--accent)' }} />
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.3,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
          }}
        >
          Round-by-Round Winners
        </div>
        <div
          style={{
            marginLeft: 'auto',
            color: 'var(--ink-soft)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {rounds.length} round{rounds.length === 1 ? '' : 's'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(
            rounds.length,
            12
          )}, minmax(0, 1fr))`,
          gap: 10,
          marginBottom: 18,
        }}
      >
        {rounds.map((r, idx) => {
          const winner = r.winner
          const score = winner ? r.all_scores?.[winner] : null
          const c = colorFor(winner)
          return (
            <motion.div
              key={`rw-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              title={
                winner
                  ? `Round ${r.round} — ${prettyName(winner)}${
                      typeof score === 'number'
                        ? ` · ${score.toFixed(1)}/100`
                        : ''
                    }`
                  : `Round ${r.round}`
              }
              style={{
                position: 'relative',
                padding: '12px 8px',
                background: `linear-gradient(160deg, ${c}26, transparent 90%)`,
                border: `1px solid ${c}66`,
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: 'var(--ink-soft)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 4,
                }}
              >
                R{r.round}
              </div>
              <Trophy
                size={16}
                style={{ color: c, filter: `drop-shadow(0 0 6px ${c})` }}
              />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {prettyName(winner) || '—'}
              </div>
              {typeof score === 'number' && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-soft)',
                    fontFamily: 'var(--font-mono)',
                    marginTop: 2,
                  }}
                >
                  {score.toFixed(1)}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {winData.length > 0 && (
        <ResponsiveContainer
          width="100%"
          height={Math.max(160, winData.length * 38)}
        >
          <BarChart
            data={winData}
            layout="vertical"
            margin={{ left: 8, right: 24 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--grid-line)"
              horizontal={false}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              domain={[0, rounds.length]}
              stroke="var(--ink-soft)"
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--ink-muted)"
              fontSize={12}
              width={100}
            />
            <Tooltip
              cursor={{ fill: 'rgba(129,140,248,0.08)' }}
              contentStyle={{
                background: 'rgba(15, 17, 38, 0.95)',
                border: '1px solid rgba(129,140,248,0.4)',
                borderRadius: 10,
                color: '#fff',
              }}
              formatter={(value) => [`${value} round wins`, 'Wins']}
            />
            <Bar dataKey="wins" radius={[0, 8, 8, 0]}>
              {winData.map((entry, idx) => (
                <Cell
                  key={`win-${idx}`}
                  fill={colorFor(entry.agent)}
                  opacity={entry.agent === overallLeader ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  )
}
