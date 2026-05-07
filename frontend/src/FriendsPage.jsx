import { useState, useMemo } from 'react'
import { Search, UserPlus, UserCheck, Pencil, X, Check, Sparkles } from 'lucide-react'

// ── Dummy network ────────────────────────────────────────────────
export const NETWORK = [
  {
    id: 'net_1',
    name: 'Dr. Sarah Chen',
    handle: 'sarahchen',
    role: 'AI Ethics Researcher',
    avatar: 'SC',
    color: '#6366f1',
    bio: 'Postdoc at Stanford HAI. Studies fairness, accountability, and transparency in large language models.',
    hobbies: 'Rock climbing, science fiction, espresso',
    beliefs: 'AI systems must be explainable and auditable. Regulation should lead deployment.',
    style: 'Measured and Socratic — asks clarifying questions before staking a position.',
    tags: ['AI ethics', 'policy', 'research'],
    mutuals: 4,
  },
  {
    id: 'net_2',
    name: 'Marcus Thompson',
    handle: 'mthompson',
    role: 'Climate Scientist',
    avatar: 'MT',
    color: '#10b981',
    bio: 'PhD in atmospheric science. Published 40+ papers on carbon feedback loops and tipping points.',
    hobbies: 'Sea kayaking, jazz piano, fermentation',
    beliefs: 'The data is unambiguous. We need aggressive emissions cuts, not carbon offsets.',
    style: 'Evidence-first, cite-heavy. Will not speculate beyond the literature.',
    tags: ['climate', 'data', 'science'],
    mutuals: 7,
  },
  {
    id: 'net_3',
    name: 'Priya Sharma',
    handle: 'priyasharma',
    role: 'Behavioral Economist',
    avatar: 'PS',
    color: '#f59e0b',
    bio: 'PhD, University of Chicago. Researches nudge theory and market incentives for public goods.',
    hobbies: 'Distance running, Indian classical music, cooking',
    beliefs: 'Markets are powerful tools. Incentives beat mandates — price the externality.',
    style: "Devil's advocate by nature. Challenges assumptions with counter-examples.",
    tags: ['economics', 'policy', 'markets'],
    mutuals: 2,
  },
  {
    id: 'net_4',
    name: "James O'Brien",
    handle: 'jobrienphil',
    role: 'Philosophy Professor',
    avatar: 'JO',
    color: '#8b5cf6',
    bio: 'Associate Professor at NYU. Specializes in epistemology, philosophy of mind, and applied ethics.',
    hobbies: 'Chess, vintage wine, hiking the Appalachian Trail',
    beliefs: 'We have an epistemic duty to follow evidence wherever it leads, even uncomfortable places.',
    style: 'Socratic and systematic. Breaks every claim into premises and tests each one.',
    tags: ['philosophy', 'ethics', 'logic'],
    mutuals: 5,
  },
  {
    id: 'net_5',
    name: 'Aaliya Hassan',
    handle: 'aaliyah',
    role: 'Tech Entrepreneur',
    avatar: 'AH',
    color: '#ec4899',
    bio: 'Founder of two YC-backed startups. Previously led product at Meta. Obsessed with scaling.',
    hobbies: 'Brazilian jiu-jitsu, sci-fi podcasts, early mornings',
    beliefs: 'Move fast. Regulation stifles innovation. Let the market pick winners.',
    style: 'Pragmatic and fast-paced. Grounds every debate in real-world execution constraints.',
    tags: ['startups', 'tech', 'product'],
    mutuals: 11,
  },
  {
    id: 'net_6',
    name: 'Leo Park',
    handle: 'leopark_hist',
    role: 'History Teacher',
    avatar: 'LP',
    color: '#f97316',
    bio: 'High school history teacher turned YouTube educator. 800K subs. Everything rhymes with the past.',
    hobbies: 'Board games, long-form reading, bonsai',
    beliefs: 'Contemporary crises all have historical analogues. Context is everything.',
    style: 'Calm and contextual. Grounds modern debates in precedent and historical pattern.',
    tags: ['history', 'context', 'education'],
    mutuals: 3,
  },
  {
    id: 'net_7',
    name: 'Fatima Al-Rashid',
    handle: 'fatima_policy',
    role: 'Policy Analyst',
    avatar: 'FA',
    color: '#06b6d4',
    bio: 'Senior analyst at Brookings. Focuses on health equity, urban housing, and social infrastructure.',
    hobbies: 'Calligraphy, documentary film, urban cycling',
    beliefs: 'Good policy design accounts for who gets left out. Equity is not a trade-off.',
    style: 'Centrist and coalition-minded. Looks for policy wins that bridge ideological divides.',
    tags: ['policy', 'equity', 'healthcare'],
    mutuals: 6,
  },
  {
    id: 'net_8',
    name: 'Dmitri Volkov',
    handle: 'dvolkov_ds',
    role: 'Data Scientist',
    avatar: 'DV',
    color: '#14b8a6',
    bio: 'Staff ML engineer at Stripe. Amateur statistician. Believes most public discourse is p-hacking.',
    hobbies: 'Powerlifting, Bayesian statistics, home automation',
    beliefs: 'Anecdotes are not data. Effect sizes matter more than p-values. Replicate or retract.',
    style: 'Extremely rigorous. Demands numerical estimates and confidence intervals for every claim.',
    tags: ['data', 'statistics', 'ML'],
    mutuals: 8,
  },
  {
    id: 'net_9',
    name: 'Ananya Iyer',
    handle: 'ananya_sjsu',
    role: 'SJSU MS — Software Engineering',
    avatar: 'AI',
    color: '#3b82f6',
    bio: 'MS Software Engineering @ SJSU. Researching distributed systems and consensus protocols. TA for CMPE 273.',
    hobbies: 'Competitive programming, hackathons, filter coffee',
    beliefs: 'Strong engineering culture beats clever architecture. Tests over diagrams.',
    style: 'Methodical and code-first. Wants to see the implementation, not just the idea.',
    tags: ['SJSU', 'distributed systems', 'engineering'],
    mutuals: 5,
  },
  {
    id: 'net_10',
    name: 'Rahul Deshpande',
    handle: 'rahul_d_sjsu',
    role: 'SJSU MS — Data Analytics',
    avatar: 'RD',
    color: '#22c55e',
    bio: 'MS Data Analytics @ SJSU. Building LLM evaluation pipelines for his thesis. Interned at Adobe.',
    hobbies: 'Cricket, Kaggle competitions, indie folk music',
    beliefs: 'Benchmarks lie until you read the methodology section. Trust no leaderboard.',
    style: 'Skeptical and data-driven. Always asks "what was the baseline?"',
    tags: ['SJSU', 'data analytics', 'LLM eval'],
    mutuals: 4,
  },
  {
    id: 'net_11',
    name: 'Mei Lin Zhao',
    handle: 'meilin_ai',
    role: 'SJSU MS — Artificial Intelligence',
    avatar: 'MZ',
    color: '#a855f7',
    bio: 'MS AI @ SJSU. Focus on multi-agent reinforcement learning and emergent communication. GTA for CMPE 257.',
    hobbies: 'Watercolor painting, badminton, K-dramas',
    beliefs: 'Emergence is overhyped. Most "agentic" behavior is prompt engineering in disguise.',
    style: 'Curious and probing. Loves picking apart claims about agent autonomy.',
    tags: ['SJSU', 'AI', 'multi-agent'],
    mutuals: 6,
  },
  {
    id: 'net_12',
    name: 'Diego Ramirez',
    handle: 'diego_cyber',
    role: 'SJSU MS — Cybersecurity',
    avatar: 'DR',
    color: '#ef4444',
    bio: 'MS Cybersecurity @ SJSU. Red team lead for the campus CTF club. Previously SOC analyst at PG&E.',
    hobbies: 'CTFs, lockpicking, mountain biking around Almaden',
    beliefs: 'If it ships without a threat model, it ships broken. Assume breach by default.',
    style: 'Adversarial-minded. Reframes every proposal as an attack surface.',
    tags: ['SJSU', 'security', 'red team'],
    mutuals: 3,
  },
]

function blankFriend() {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    handle: '',
    role: '',
    avatar: '?',
    color: '#6366f1',
    bio: '',
    hobbies: '',
    beliefs: '',
    style: '',
    tags: [],
    mutuals: 0,
    custom: true,
  }
}

function avatarInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function TagChip({ tag }) {
  return <span className="friend-tag">{tag}</span>
}

function EditModal({ person, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...person })
  const [tagInput, setTagInput] = useState((person.tags || []).join(', '))

  function field(key, value) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function handleSave() {
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    onSave({ ...draft, tags, avatar: avatarInitials(draft.name || '?') || '?' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{person.custom ? 'New agent' : 'Edit bio'}</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="label">Name *</label>
          <input className="question-input" value={draft.name} onChange={(e) => field('name', e.target.value)} placeholder="Full name" maxLength={64} />
          <label className="label">Role / Title</label>
          <input className="question-input" value={draft.role} onChange={(e) => field('role', e.target.value)} placeholder="e.g. Climate Scientist" maxLength={80} />
          <label className="label">Bio</label>
          <textarea className="question-input" rows={3} value={draft.bio} onChange={(e) => field('bio', e.target.value)} placeholder="Short background..." maxLength={500} />
          <label className="label">Hobbies</label>
          <input className="question-input" value={draft.hobbies} onChange={(e) => field('hobbies', e.target.value)} placeholder="e.g. Chess, hiking, espresso" maxLength={200} />
          <label className="label">Beliefs / Opinions</label>
          <textarea className="question-input" rows={2} value={draft.beliefs} onChange={(e) => field('beliefs', e.target.value)} placeholder="Their default stances..." maxLength={400} />
          <label className="label">Debate Style</label>
          <input className="question-input" value={draft.style} onChange={(e) => field('style', e.target.value)} placeholder="e.g. Evidence-first, cite-heavy" maxLength={200} />
          <label className="label">Tags (comma-separated)</label>
          <input className="question-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. policy, data, ethics" maxLength={200} />
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!draft.name.trim()}>
            <Check size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}

function FriendCard({ person, isAdded, onAdd, onEdit, onRemove }) {
  return (
    <div className="fcard">
      <div className="fcard-top" style={{ background: `linear-gradient(135deg, ${person.color}44, ${person.color}18)` }}>
        <div className="fcard-avatar" style={{ background: person.color }}>
          {person.avatar || avatarInitials(person.name)}
        </div>
        <div className="fcard-identity">
          <span className="fcard-name">{person.name}</span>
          {person.role && <span className="fcard-role">{person.role}</span>}
        </div>
      </div>
      <div className="fcard-body">
        {person.bio && <p className="fcard-bio">{person.bio.length > 110 ? person.bio.slice(0, 108) + '...' : person.bio}</p>}
        {(person.tags || []).length > 0 && (
          <div className="fcard-tags">
            {person.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}
          </div>
        )}
      </div>
      <div className="fcard-actions">
        <button
          className={`fcard-btn-primary${isAdded ? ' fcard-btn-added' : ''}`}
          onClick={onAdd}
          title={isAdded ? 'Added to session' : 'Add agent to debate session'}
        >
          {isAdded ? <><UserCheck size={13} /> In Session</> : <><UserPlus size={13} /> Add to Session</>}
        </button>
        <button className="fcard-btn-icon" onClick={onEdit} title="Edit bio">
          <Pencil size={13} />
        </button>
        {onRemove && (
          <button className="fcard-btn-icon fcard-btn-danger" onClick={onRemove} title="Remove">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function FriendsPage({ friends, onSave, onAddToSession, isInSession }) {
  const [tab, setTab] = useState('discover')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [localFriends, setLocalFriends] = useState(() => friends.map((f) => ({ ...f })))

  function commitFriends(updated) {
    setLocalFriends(updated)
    onSave(updated)
  }

  const allDiscover = useMemo(() => {
    const savedIds = new Set(localFriends.map((f) => f.id))
    return NETWORK.filter((p) => !savedIds.has(p.id))
  }, [localFriends])

  function filterList(list) {
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.role || '').toLowerCase().includes(q) ||
        (p.bio || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q)),
    )
  }

  const discoverList = filterList(allDiscover)
  const savedList = filterList(localFriends)

  function handleSaveEdit(updated) {
    const exists = localFriends.find((f) => f.id === updated.id)
    const next = exists
      ? localFriends.map((f) => (f.id === updated.id ? updated : f))
      : [...localFriends, updated]
    commitFriends(next)
    setEditing(null)
    if (tab === 'discover') setTab('saved')
  }

  function handleRemoveFriend(id) {
    commitFriends(localFriends.filter((f) => f.id !== id))
  }

  const isAdded = (person) => (typeof isInSession === 'function' ? isInSession(person) : false)

  return (
    <div className="friends-page">
      <div className="friends-hero">
        <div className="friends-hero-text">
          <h2 className="friends-title">
            <Sparkles size={18} /> Agent Network
          </h2>
          <p className="friends-subtitle">
            Discover debate agents, add them to your session, or craft your own.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(blankFriend())}>
          <UserPlus size={14} /> New Agent
        </button>
      </div>

      <div className="friends-controls">
        <div className="friends-searchbar">
          <Search size={14} className="friends-search-icon" />
          <input
            className="friends-search-input"
            type="search"
            placeholder="Search by name, role, or topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="friends-tabs">
          <button
            className={`friends-tab${tab === 'discover' ? ' friends-tab--active' : ''}`}
            onClick={() => setTab('discover')}
          >
            Friends
            {discoverList.length > 0 && <span className="friends-tab-badge">{discoverList.length}</span>}
          </button>
          <button
            className={`friends-tab${tab === 'saved' ? ' friends-tab--active' : ''}`}
            onClick={() => setTab('saved')}
          >
            My Agents
            {localFriends.length > 0 && <span className="friends-tab-badge">{localFriends.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'discover' && (
        discoverList.length === 0
          ? <p className="friends-empty">No agents match your search.</p>
          : (
            <div className="friends-grid">
              {discoverList.map((p) => (
                <FriendCard
                  key={p.id}
                  person={p}
                  isAdded={isAdded(p)}
                  onAdd={() => onAddToSession(p)}
                  onEdit={() => setEditing({ ...p })}
                />
              ))}
            </div>
          )
      )}

      {tab === 'saved' && (
        savedList.length === 0
          ? (
            <p className="friends-empty">
              {query ? 'No agents match your search.' : 'No saved agents yet — explore Friends or create one.'}
            </p>
          )
          : (
            <div className="friends-grid">
              {savedList.map((p) => (
                <FriendCard
                  key={p.id}
                  person={p}
                  isAdded={isAdded(p)}
                  onAdd={() => onAddToSession(p)}
                  onEdit={() => setEditing({ ...p })}
                  onRemove={() => handleRemoveFriend(p.id)}
                />
              ))}
            </div>
          )
      )}

      {editing && (
        <EditModal
          person={editing}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
