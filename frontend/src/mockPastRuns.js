/**
 * Demo-only mock debates for the Past runs strip (UI preview without waiting on real runs).
 * IDs use the `mock-` prefix so they never collide with orchestrator UUIDs.
 */

const ts = (iso) => iso

function msg(sender, position, content, confidence, round, timestamp) {
  return { sender, position, content, confidence, round, timestamp }
}

/** Full debate records matching GET /debate/{id} shape */
export const MOCK_DEBATES = [
  {
    debate_id: 'mock-aurora-01',
    question: 'Should cities prioritize buses or light rail for mass transit?',
    status: 'completed',
    round: 4,
    created_at: ts('2026-05-03T18:22:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Buses offer flexibility and lower capital cost; cities can reallocate routes as land use shifts.',
        0.84,
        4,
        ts('2026-05-03T18:22:00.000Z'),
      ),
      msg(
        'critic',
        'oppose',
        'Rail delivers higher capacity and reliability where corridor demand justifies fixed guideway investment.',
        0.79,
        4,
        ts('2026-05-03T18:22:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.81.',
        0.81,
        4,
        ts('2026-05-03T18:22:00.000Z'),
      ),
    ],
    final_answer:
      'Hybrid approach: trunk BRT or light rail on the densest corridor; feeder buses everywhere else, with integrated fares.',
    agreement_score: 0.81,
    quorum_met: true,
    failed_nodes: [],
  },
  {
    debate_id: 'mock-aurora-02',
    question: 'Is remote work net positive for software team productivity?',
    status: 'completed',
    round: 3,
    created_at: ts('2026-05-02T14:05:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Deep work blocks improve for many engineers; async practices reduce meeting tax.',
        0.88,
        3,
        ts('2026-05-02T14:05:00.000Z'),
      ),
      msg(
        'critic',
        'oppose',
        'Onboarding, design pairing, and spontaneous debugging suffer without shared physical context.',
        0.76,
        3,
        ts('2026-05-02T14:05:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.83.',
        0.83,
        3,
        ts('2026-05-02T14:05:00.000Z'),
      ),
    ],
    final_answer:
      'Default to hybrid: core collaboration days for teams that ship together; role-based remote flexibility elsewhere.',
    agreement_score: 0.83,
    quorum_met: true,
    failed_nodes: [],
  },
  {
    debate_id: 'mock-aurora-03',
    question: 'What is better: iPhone or Android for a first-time smartphone buyer?',
    status: 'completed',
    round: 5,
    created_at: ts('2026-05-01T09:40:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'iPhone offers longer OS updates and cohesive support—lower cognitive load for newcomers.',
        0.8,
        5,
        ts('2026-05-01T09:40:00.000Z'),
      ),
      msg(
        'critic',
        'oppose',
        'Android spans price points and hardware choice; Google ecosystem integrates tightly with web services.',
        0.77,
        5,
        ts('2026-05-01T09:40:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.78.',
        0.78,
        5,
        ts('2026-05-01T09:40:00.000Z'),
      ),
    ],
    final_answer:
      'Recommend based on budget and ecosystem fit: iPhone for simplicity and longevity; Android for price sensitivity and customization.',
    agreement_score: 0.78,
    quorum_met: true,
    failed_nodes: [],
  },
  {
    debate_id: 'mock-aurora-04',
    question: 'Should social platforms be liable for algorithmic amplification of harmful content?',
    status: 'failed',
    round: 2,
    created_at: ts('2026-04-28T21:15:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Publishers already face editorial responsibility; ranking is a form of editorial choice.',
        0.71,
        2,
        ts('2026-04-28T21:15:00.000Z'),
      ),
      msg(
        'critic',
        'oppose',
        'Blurring intermediary immunity with amplification liability risks over-removal and jurisdictional chaos.',
        0.68,
        2,
        ts('2026-04-28T21:15:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: stalemate. Consensus confidence: 0.52.',
        0.52,
        2,
        ts('2026-04-28T21:15:00.000Z'),
      ),
    ],
    final_answer:
      'No stable consensus—policy trade-offs depend on definitions of harm, jurisdiction, and notice regimes.',
    agreement_score: 0.52,
    quorum_met: false,
    failed_nodes: [],
  },
  {
    debate_id: 'mock-aurora-05',
    question: 'Cap-and-trade vs carbon tax for industrial emissions?',
    status: 'completed',
    round: 3,
    created_at: ts('2026-04-26T16:00:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Cap-and-trade guarantees quantity outcomes when political appetite for price floors is weak.',
        0.85,
        3,
        ts('2026-04-26T16:00:00.000Z'),
      ),
      msg(
        'critic',
        'oppose',
        'Carbon tax is administratively simpler and sends a predictable price signal to investors.',
        0.82,
        3,
        ts('2026-04-26T16:00:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.80.',
        0.8,
        3,
        ts('2026-04-26T16:00:00.000Z'),
      ),
    ],
    final_answer:
      'Use carbon tax where monitoring is cheap; cap-and-trade for sectors with heterogeneous abatement costs and measurable permits.',
    agreement_score: 0.8,
    quorum_met: true,
    failed_nodes: [],
  },
]

const MOCK_BY_ID = Object.fromEntries(MOCK_DEBATES.map((d) => [d.debate_id, d]))

/** Short fake console snippet for the live log when viewing a mock run */
export const MOCK_LIVE_LOG_SNIPPET = `max rounds  6

================================================================================
ROUND 2 (mock preview)
================================================================================
Running arguments...
Arguments completed
Scoring arguments...
Scoring completed
… (truncated — this is static demo text, not a stored stream)
`

export function getMockDebateDetail(debateId) {
  return MOCK_BY_ID[debateId] ?? null
}

const MOCK_ID_SET = new Set(MOCK_DEBATES.map((d) => d.debate_id))

/** Merge API summaries with mocks; mocks first in sort tie-breaker is arbitrary—sort by date */
export function mergePastRunSummaries(apiDebates) {
  const filteredApi = (apiDebates ?? []).filter((d) => !MOCK_ID_SET.has(d.debate_id))
  const mockSummaries = MOCK_DEBATES.map((d) => ({
    debate_id: d.debate_id,
    question: d.question,
    status: d.status,
    round: d.round,
    created_at: d.created_at,
  }))
  return [...mockSummaries, ...filteredApi].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}
