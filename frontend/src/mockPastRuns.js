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
    round: 2,
    created_at: ts('2026-05-03T18:22:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Buses offer flexibility and lower capital cost; cities can reallocate routes as land use shifts.',
        0.84,
        2,
        ts('2026-05-03T18:22:00.000Z'),
      ),
      msg(
        'skeptic',
        'oppose',
        'Rail delivers higher capacity and reliability where corridor demand justifies fixed guideway investment.',
        0.79,
        2,
        ts('2026-05-03T18:22:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.81.',
        0.81,
        2,
        ts('2026-05-03T18:22:00.000Z'),
      ),
      msg(
        'Dr. Sarah Chen',
        'neutral',
        'No statement',
        0.0,
        2,
        ts('2026-05-03T18:22:00.000Z'),
      ),
    ],
    final_answer:
      'Hybrid approach: trunk BRT or light rail on the densest corridor; feeder buses everywhere else, with integrated fares.',
    agreement_score: 0.81,
    quorum_met: true,
    failed_nodes: [],
    round_scores: [
      {
        round: 1,
        winner: 'empiricist',
        winner_score: 0.88,
        all_scores: { advocate: 0.76, skeptic: 0.71, devils_advocate: 0.69, empiricist: 0.88 },
        all_arguments: {
          advocate: 'Buses provide immediate route flexibility with lower upfront capital expenditure.',
          skeptic: 'Infrastructure lock-in is overstated; ridership data consistently favours rail in dense corridors.',
          devils_advocate: 'Neither mode dominates—operational costs and land-use zoning matter more than vehicle type.',
          empiricist: 'Meta-analyses show BRT achieves 70–85 % of rail ridership at 20–40 % of the capital cost in comparable corridors.',
        },
        fact_checks: {
          advocate: 'Bus capital costs are typically 4–20× lower per km than light rail. Verified.',
          skeptic: 'Ridership advantage for rail holds in corridors above ~5 000 pphpd. Partially verified.',
          devils_advocate: 'Land-use impacts are documented but hard to isolate. Plausible.',
          empiricist: 'ITDP and Victoria Transport Policy Institute data support the range cited. Verified.',
        },
        summary: 'Round 1 focused on capital cost vs ridership capacity trade-offs. Empiricist dominated with cited meta-analyses.',
        key_insights: [
          'BRT costs 20–40 % of equivalent light rail investment.',
          'Rail ridership advantage materialises above ~5 000 passengers per hour per direction.',
          'Land-use upzoning around stations may be the decisive long-run factor.',
        ],
        feedback_for_agents: {
          advocate: 'Strong on cost framing; add ridership projections next round.',
          skeptic: 'Cite corridor density thresholds to sharpen the rail case.',
          devils_advocate: 'Useful provocation; needs a concrete policy recommendation.',
          empiricist: 'Excellent use of comparative data; consider addressing equity impacts.',
        },
      },
      {
        round: 2,
        winner: 'advocate',
        winner_score: 0.84,
        all_scores: { advocate: 0.84, skeptic: 0.79, devils_advocate: 0.73, empiricist: 0.81 },
        all_arguments: {
          advocate: 'Cities can deploy BRT rapidly on existing ROW; new rail requires 8–12 years of permitting.',
          skeptic: 'Political will and timelines aside, rail drives 30 % higher property-value uplift, funding long-term expansion.',
          devils_advocate: 'Hybrid networks—BRT feeders to a rail spine—outperform either mode alone in most modelling.',
          empiricist: 'Evidence now favours a corridor-specific decision tree: BRT if density < 15 k pax/day, rail above.',
        },
        fact_checks: {
          advocate: 'BRT implementation timelines of 2–4 years vs rail 8–15 years are well-documented. Verified.',
          skeptic: 'Property-value uplifts near rail stations average 10–25 % in US studies; 30 % is at the high end. Partially verified.',
          devils_advocate: 'Hybrid network modelling results are context-dependent. Plausible.',
          empiricist: 'The 15 k pax/day threshold aligns with TCRP Report 90 findings. Verified.',
        },
        summary: 'Consensus emerged around a hybrid model—BRT feeders into rail spines for high-density corridors.',
        key_insights: [
          'BRT delivers in 2–4 years vs 8–15 for rail.',
          'Rail generates stronger land-value uplift, improving long-term fiscal returns.',
          'Hybrid feeder–trunk networks optimise both speed and coverage.',
        ],
        feedback_for_agents: {
          advocate: 'Timeline argument was decisive this round.',
          skeptic: 'Property value angle was compelling; verify the 30 % claim.',
          devils_advocate: 'Hybrid framing helped break the binary and move toward consensus.',
          empiricist: 'Decision-tree framing was the clearest synthesis of evidence.',
        },
      },
    ],
  },
  {
    debate_id: 'mock-aurora-02',
    question: 'Is remote work net positive for software team productivity?',
    status: 'completed',
    round: 2,
    created_at: ts('2026-05-02T14:05:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Deep work blocks improve for many engineers; async practices reduce meeting tax.',
        0.88,
        2,
        ts('2026-05-02T14:05:00.000Z'),
      ),
      msg(
        'skeptic',
        'oppose',
        'Onboarding, design pairing, and spontaneous debugging suffer without shared physical context.',
        0.76,
        2,
        ts('2026-05-02T14:05:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.83.',
        0.83,
        2,
        ts('2026-05-02T14:05:00.000Z'),
      ),
    ],
    final_answer:
      'Default to hybrid: core collaboration days for teams that ship together; role-based remote flexibility elsewhere.',
    agreement_score: 0.83,
    quorum_met: true,
    failed_nodes: [],
    round_scores: [
      {
        round: 1,
        winner: 'empiricist',
        winner_score: 0.85,
        all_scores: { advocate: 0.78, skeptic: 0.72, devils_advocate: 0.67, empiricist: 0.85 },
        all_arguments: {
          advocate: 'Remote work eliminates commute time and enables deep, uninterrupted focus blocks that correlate with output quality.',
          skeptic: 'GitHub commit data shows collaboration graph fragmentation in fully remote teams after 18 months.',
          devils_advocate: 'Productivity is role-dependent; blanket policies ignore variance across seniority and function.',
          empiricist: 'Stanford and Stanford-adjacent studies show 13 % individual output gains but 10–18 % slower team coordination on novel problems.',
        },
        fact_checks: {
          advocate: 'Commute elimination saves 40–60 min/day on average in US metro areas. Verified.',
          skeptic: 'Microsoft 2021 research documented collaboration graph shrinkage. Verified.',
          devils_advocate: 'Role variance in remote productivity is well established. Verified.',
          empiricist: 'Bloom et al. (2015) found 13 % productivity gain in call-centre context; generalisation to engineering is contested.',
        },
        summary: 'Round 1 surfaced individual vs team productivity tension. Empiricist led by quantifying the trade-off.',
        key_insights: [
          'Individual output rises ~13 % remote; team coordination costs offset gains on novel tasks.',
          'Collaboration network data shows measurable fragmentation after 18 months fully remote.',
          'Role and seniority moderate remote productivity significantly.',
        ],
        feedback_for_agents: {
          advocate: 'Strong on individual benefits; address team coordination cost next round.',
          skeptic: 'Collaboration graph point is compelling; connect it to ship rate or incident count.',
          devils_advocate: 'Nuance was valuable; propose a concrete segmentation model.',
          empiricist: 'Best use of evidence; consider Zoom fatigue data to round out the picture.',
        },
      },
      {
        round: 2,
        winner: 'advocate',
        winner_score: 0.88,
        all_scores: { advocate: 0.88, skeptic: 0.76, devils_advocate: 0.74, empiricist: 0.82 },
        all_arguments: {
          advocate: 'Async-first documentation practices and structured check-ins mitigate coordination loss while preserving focus-time gains.',
          skeptic: 'Junior engineers lose mentorship surface area; pair-programming frequency drops 40 % in fully remote settings.',
          devils_advocate: 'Hybrid models—2 days in-person for coordination, 3 remote for execution—capture best of both with manageable overhead.',
          empiricist: 'NBER working papers post-2022 show hybrid schedules recover 85–90 % of in-person collaboration quality.',
        },
        fact_checks: {
          advocate: 'Async documentation ROI is well-supported in engineering retrospectives. Plausible.',
          skeptic: '40 % drop in pair-programming is from internal survey data, not peer-reviewed. Partially verified.',
          devils_advocate: 'Hybrid model outcomes align with multiple corporate case studies. Verified.',
          empiricist: 'NBER hybrid collaboration recovery figures are directionally supported. Verified.',
        },
        summary: 'Consensus converged on structured hybrid as the dominant strategy, with async tooling as the key enabler.',
        key_insights: [
          'Async documentation recovers most coordination cost without sacrificing focus time.',
          'Junior engineers need minimum in-person surface area for mentorship.',
          'Hybrid schedules recover 85–90 % of in-person collaboration quality per NBER data.',
        ],
        feedback_for_agents: {
          advocate: 'Async tooling framing carried the round—well argued.',
          skeptic: 'Junior engineer mentorship concern is real and underweighted in policy discussions.',
          devils_advocate: 'Hybrid model landed as the consensus anchor—good synthesis.',
          empiricist: 'NBER citation closed the loop nicely; update with 2024 data if available.',
        },
      },
    ],
  },
  {
    debate_id: 'mock-aurora-03',
    question: 'What is better: iPhone or Android for a first-time smartphone buyer?',
    status: 'completed',
    round: 2,
    created_at: ts('2026-05-01T09:40:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'iPhone offers longer OS updates and cohesive support—lower cognitive load for newcomers.',
        0.8,
        2,
        ts('2026-05-01T09:40:00.000Z'),
      ),
      msg(
        'skeptic',
        'oppose',
        'Android spans price points and hardware choice; Google ecosystem integrates tightly with web services.',
        0.77,
        2,
        ts('2026-05-01T09:40:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.78.',
        0.78,
        2,
        ts('2026-05-01T09:40:00.000Z'),
      ),
    ],
    final_answer:
      'Recommend based on budget and ecosystem fit: iPhone for simplicity and longevity; Android for price sensitivity and customization.',
    agreement_score: 0.78,
    quorum_met: true,
    failed_nodes: [],
    round_scores: [
      {
        round: 1,
        winner: 'empiricist',
        winner_score: 0.82,
        all_scores: { advocate: 0.77, skeptic: 0.73, devils_advocate: 0.68, empiricist: 0.82 },
        all_arguments: {
          advocate: 'iOS provides 6+ years of software updates; beginners benefit from frictionless onboarding and integrated ecosystem.',
          skeptic: 'Android mid-range phones at $200–$350 outperform equivalently priced iOS devices on raw hardware; entry cost is a real barrier.',
          devils_advocate: 'Platform choice matters less than app availability; both ecosystems cover 95 %+ of use cases for first-time buyers.',
          empiricist: 'JD Power 2023 satisfaction surveys show iPhone leading overall for users under 30; Android leads 55+ demographics tied to Google services familiarity.',
        },
        fact_checks: {
          advocate: 'Apple guarantees 6 years of iOS updates for current models. Verified.',
          skeptic: 'Mid-range Android pricing band is accurate per Q1 2024 market data. Verified.',
          devils_advocate: 'Top-100 app parity between stores is >97 %. Verified.',
          empiricist: 'JD Power data directionally supports age-cohort differences. Partially verified.',
        },
        summary: 'Round 1 established cost and longevity as the key axes. Empiricist won by grounding the comparison in user-segment data.',
        key_insights: [
          'Apple provides 6+ years of updates vs 2–4 for most Android OEMs.',
          'Entry-level Android starts at $150 vs $429 for base iPhone.',
          'Satisfaction drivers differ by age cohort—no single winner for all users.',
        ],
        feedback_for_agents: {
          advocate: 'Longevity argument is strong; add total cost of ownership calculation.',
          skeptic: 'Price point framing effective; specify which Android OEMs deliver best value.',
          devils_advocate: 'App parity point correct but understates ecosystem lock-in effects.',
          empiricist: 'Segmentation approach was decisive; extend to budget vs premium tiers.',
        },
      },
      {
        round: 2,
        winner: 'advocate',
        winner_score: 0.80,
        all_scores: { advocate: 0.80, skeptic: 0.77, devils_advocate: 0.71, empiricist: 0.79 },
        all_arguments: {
          advocate: 'For a first-time buyer with no existing ecosystem, iPhone\'s consistent UX and long update window minimise regret.',
          skeptic: 'Pixel 7a at $499 matches iPhone SE on longevity while offering Android openness; budget Android is a legitimate path.',
          devils_advocate: 'The right answer is always "it depends on your use case"—but framing it that way paralyses first-time buyers.',
          empiricist: 'Consumer Reports recommends iPhone for first-time buyers prioritising support; Android for users already in Google ecosystem.',
        },
        fact_checks: {
          advocate: 'iPhone\'s UX consistency claim is well-supported by usability research. Verified.',
          skeptic: 'Pixel 7a longevity commitment (5 years OS updates) matches or exceeds iPhone SE. Verified.',
          devils_advocate: 'Analysis paralysis is a documented consumer behaviour effect. Verified.',
          empiricist: 'Consumer Reports buyer guides align with this framing. Verified.',
        },
        summary: 'Consensus: iPhone for budget-agnostic first-timers; Android for Google ecosystem users or tight budgets. Both paths are defensible.',
        key_insights: [
          'No universal winner—budget and existing ecosystem are the deciding factors.',
          'Pixel 7a closes the longevity gap with iPhone SE.',
          'First-time buyers benefit most from whichever ecosystem their social circle uses for iMessage/photos.',
        ],
        feedback_for_agents: {
          advocate: 'UX consistency argument won the round cleanly.',
          skeptic: 'Pixel 7a comparison was the strongest Android counter-argument.',
          devils_advocate: 'Paralysis framing was astute—pushed the debate toward actionable consensus.',
          empiricist: 'Consumer Reports reference grounded the synthesis well.',
        },
      },
    ],
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
        'skeptic',
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
    round_scores: [
      {
        round: 1,
        winner: 'advocate',
        winner_score: 0.74,
        all_scores: { advocate: 0.74, skeptic: 0.69, devils_advocate: 0.62, empiricist: 0.71 },
        all_arguments: {
          advocate: 'When an algorithm actively selects and amplifies content, the platform exercises editorial judgment akin to a publisher.',
          skeptic: 'Section 230 immunity exists precisely to enable platforms to moderate without assuming publisher liability—removing it collapses the model.',
          devils_advocate: 'Amplification liability would accelerate a shift to subscription models, worsening access inequality.',
          empiricist: 'The EU Digital Services Act imposes risk-assessment obligations without requiring platform liability—a middle path.',
        },
        fact_checks: {
          advocate: 'Publisher analogy is contested in US courts; several rulings have rejected it. Partially verified.',
          skeptic: 'Section 230 rationale is accurately characterised. Verified.',
          devils_advocate: 'Subscription shift is speculative but economically plausible. Unverified.',
          empiricist: 'DSA risk-assessment provisions are accurately described. Verified.',
        },
        summary: 'Round 1 polarised on the publisher analogy. Empiricist\'s DSA reference offered the most actionable framing.',
        key_insights: [
          'Publisher vs conduit distinction is legally unsettled in the US.',
          'EU DSA offers a risk-assessment framework without full liability.',
          'Amplification liability could drive platform consolidation or paywall shifts.',
        ],
        feedback_for_agents: {
          advocate: 'Publisher analogy is your strongest card but needs legal grounding.',
          skeptic: 'Section 230 defence is accurate; address the DSA counter-model.',
          devils_advocate: 'Access inequality angle adds important equity dimension.',
          empiricist: 'DSA framing was the most constructive contribution—push it further.',
        },
      },
      {
        round: 2,
        winner: 'skeptic',
        winner_score: 0.68,
        all_scores: { advocate: 0.65, skeptic: 0.68, devils_advocate: 0.60, empiricist: 0.66 },
        all_arguments: {
          advocate: 'Targeted liability for demonstrably harmful amplification—radicalisation funnels, eating-disorder content—is proportionate and precedented.',
          skeptic: 'Proportionality is appealing but "demonstrably harmful" requires a content arbiter; regulators and platforms disagree on the taxonomy.',
          devils_advocate: 'Any liability regime will be gamed; platforms will suppress borderline content, chilling legitimate speech.',
          empiricist: 'Studies show notification regimes (notice-and-action) reduce harmful content spread without triggering over-removal at scale.',
        },
        fact_checks: {
          advocate: 'Radicalisation funnel research is well-documented (YouTube, 2019). Verified.',
          skeptic: 'Taxonomy disagreement between regulators is well-documented post-DSA rollout. Verified.',
          devils_advocate: 'Over-removal effects under liability regimes are plausible but empirically mixed. Partially verified.',
          empiricist: 'Notice-and-action effectiveness data exists but is mostly platform self-reported. Partially verified.',
        },
        summary: 'No consensus—scores converged below quorum threshold. Key sticking point: who defines "harmful" at scale.',
        key_insights: [
          'Definitional ambiguity around "harmful" is the central unresolved issue.',
          'Notice-and-action is the most evidence-supported intermediate mechanism.',
          'Chilling-speech and over-removal are credible risks under broad liability.',
        ],
        feedback_for_agents: {
          advocate: 'Specific harm categories strengthened your case but didn\'t resolve the taxonomy problem.',
          skeptic: 'Taxonomy critique was decisive this round—well executed.',
          devils_advocate: 'Chilling-speech argument is important; support with empirical examples.',
          empiricist: 'Notice-and-action data was valuable but self-reported sourcing weakened it.',
        },
      },
    ],
  },
  {
    debate_id: 'mock-aurora-05',
    question: 'Cap-and-trade vs carbon tax for industrial emissions?',
    status: 'completed',
    round: 2,
    created_at: ts('2026-04-26T16:00:00.000Z'),
    messages: [
      msg(
        'advocate',
        'support',
        'Cap-and-trade guarantees quantity outcomes when political appetite for price floors is weak.',
        0.85,
        2,
        ts('2026-04-26T16:00:00.000Z'),
      ),
      msg(
        'skeptic',
        'oppose',
        'Carbon tax is administratively simpler and sends a predictable price signal to investors.',
        0.82,
        2,
        ts('2026-04-26T16:00:00.000Z'),
      ),
      msg(
        'moderator',
        'neutral',
        'Termination reason: convergence. Consensus confidence: 0.80.',
        0.8,
        2,
        ts('2026-04-26T16:00:00.000Z'),
      ),
    ],
    final_answer:
      'Use carbon tax where monitoring is cheap; cap-and-trade for sectors with heterogeneous abatement costs and measurable permits.',
    agreement_score: 0.8,
    quorum_met: true,
    failed_nodes: [],
    round_scores: [
      {
        round: 1,
        winner: 'empiricist',
        winner_score: 0.87,
        all_scores: { advocate: 0.79, skeptic: 0.76, devils_advocate: 0.71, empiricist: 0.87 },
        all_arguments: {
          advocate: 'A cap guarantees the environmental outcome regardless of abatement cost uncertainty; price volatility is manageable via banking and borrowing.',
          skeptic: 'Carbon taxes generate stable revenue, reduce administrative complexity, and avoid permit-market manipulation seen in early EU ETS.',
          devils_advocate: 'Both instruments underperform in the absence of complementary R&D subsidies; instrument choice is secondary to ambition level.',
          empiricist: 'IMF cross-country analysis shows carbon taxes reduced emissions 14 % faster per dollar than equivalent cap-and-trade schemes in comparable economies.',
        },
        fact_checks: {
          advocate: 'Banking and borrowing flexibility in cap-and-trade is standard ETS design. Verified.',
          skeptic: 'Early EU ETS permit over-allocation is well-documented. Verified.',
          devils_advocate: 'R&D complementarity is supported by macro models. Partially verified.',
          empiricist: 'IMF working paper WP/19/55 supports directional claim; 14 % figure is approximate. Partially verified.',
        },
        summary: 'Round 1 contrasted environmental certainty vs price predictability. Empiricist\'s cross-country data was decisive.',
        key_insights: [
          'Cap guarantees quantity; tax guarantees price—fundamental policy trade-off.',
          'Early EU ETS failure was a calibration error, not a design flaw.',
          'R&D subsidies may matter more than instrument choice for deep decarbonisation.',
        ],
        feedback_for_agents: {
          advocate: 'Banking/borrowing flexibility is underappreciated—develop it further.',
          skeptic: 'Revenue stability argument is strong for fiscal conservatives.',
          devils_advocate: 'Ambition-level framing is correct; link to NDC sufficiency gap.',
          empiricist: 'IMF data was the strongest contribution; add sector-specific analysis.',
        },
      },
      {
        round: 2,
        winner: 'advocate',
        winner_score: 0.85,
        all_scores: { advocate: 0.85, skeptic: 0.82, devils_advocate: 0.75, empiricist: 0.83 },
        all_arguments: {
          advocate: 'For heavy industry with variable abatement costs—steel, cement, chemicals—tradeable permits allow least-cost compliance across firms.',
          skeptic: 'In the power sector, where abatement costs are converging, a uniform carbon price outperforms permit markets on investment signalling.',
          devils_advocate: 'Hybrid instruments—a carbon tax with a price floor and ceiling—capture benefits of both while bounding volatility.',
          empiricist: 'Sector-specific modelling by Resources for the Future confirms: ETS for industry, carbon tax for transport and buildings, hybrid for power.',
        },
        fact_checks: {
          advocate: 'Variable abatement cost argument for heavy industry is textbook environmental economics. Verified.',
          skeptic: 'Power sector convergence is supported by falling renewable LCOE data. Verified.',
          devils_advocate: 'Price collar hybrids are used in California and RGGI. Verified.',
          empiricist: 'RFF sector-specific policy recommendations align with stated conclusions. Verified.',
        },
        summary: 'Consensus: sector-differentiated instrument mix—ETS for heavy industry, carbon tax for transport/buildings, hybrid for power.',
        key_insights: [
          'No single instrument dominates across all sectors.',
          'Heavy industry favours ETS; transport and buildings favour carbon tax.',
          'Price collars (hybrid) are already operational in California and RGGI.',
        ],
        feedback_for_agents: {
          advocate: 'Sector-specific framing was the winning move—broke the binary.',
          skeptic: 'Power sector price convergence argument was well-evidenced.',
          devils_advocate: 'Hybrid instrument reference to real-world examples was effective.',
          empiricist: 'RFF citation clinched the consensus—strong finish.',
        },
      },
    ],
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
