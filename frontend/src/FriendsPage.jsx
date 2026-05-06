import { useState } from 'react'

function blankFriend() {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    background: '',
    hobbies: '',
    interests: '',
    beliefs: '',
  }
}

export default function FriendsPage({ friends, onSave, onBack }) {
  const [localFriends, setLocalFriends] = useState(() => friends.map((f) => ({ ...f })))
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})

  const editing = localFriends.find((f) => f.id === editingId) ?? null

  function updateField(key, value) {
    setLocalFriends((prev) => prev.map((f) => (f.id === editingId ? { ...f, [key]: value } : f)))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function startEdit(id) {
    setEditingId(id)
    setErrors({})
  }

  function addFriend() {
    const f = blankFriend()
    setLocalFriends((prev) => [...prev, f])
    setEditingId(f.id)
    setErrors({})
  }

  function deleteFriend(id) {
    const updated = localFriends.filter((f) => f.id !== id)
    setLocalFriends(updated)
    if (editingId === id) setEditingId(null)
    onSave(updated)
  }

  function handleSave() {
    if (!editing) return
    const nextErrors = {}
    if (!editing.name.trim()) nextErrors.name = 'Name is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const saved = localFriends.map((f) =>
      f.id === editingId
        ? {
            ...f,
            name: f.name.trim(),
            background: f.background.trim(),
            hobbies: f.hobbies.trim(),
            interests: f.interests.trim(),
            beliefs: f.beliefs.trim(),
          }
        : f,
    )
    setLocalFriends(saved)
    onSave(saved)
    setEditingId(null)
  }

  function handleCancel() {
    if (editing && !editing.name.trim()) {
      setLocalFriends((prev) => prev.filter((f) => f.id !== editingId))
    }
    setEditingId(null)
    setErrors({})
  }

  return (
    <div className="panel create-agent-page">
      <header className="create-agent-head">
        <h2 className="output-title">Friends</h2>
        <p className="create-agent-subtitle">
          Save friend profiles here. Select them from the debate form to include them as agents.
        </p>
      </header>

      {localFriends.length === 0 && editingId === null ? (
        <p className="field-hint" style={{ marginBottom: '1rem' }}>
          No friends saved yet. Use &ldquo;Add friend&rdquo; below to create a profile.
        </p>
      ) : (
        <ul className="friends-list">
          {localFriends.map((f) => (
            <li
              key={f.id}
              className={`friend-card${editingId === f.id ? ' friend-card--active' : ''}`}
            >
              <button type="button" className="friend-card-body" onClick={() => startEdit(f.id)}>
                <span className="friend-avatar">{(f.name || '?')[0].toUpperCase()}</span>
                <div className="friend-card-info">
                  <span className="friend-card-name">{f.name || <em>Unnamed</em>}</span>
                  {f.background ? (
                    <span className="friend-card-sub">
                      {f.background.length > 64
                        ? `${f.background.slice(0, 62)}…`
                        : f.background}
                    </span>
                  ) : null}
                </div>
              </button>
              <button
                type="button"
                className="session-logout"
                onClick={() => deleteFriend(f.id)}
                title="Remove friend"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="friend-edit-panel">
          <div className="card-head" style={{ marginBottom: '0.75rem' }}>
            Editing: {editing.name.trim() || 'New friend'}
          </div>
          <div className="controls">
            <label className="label">
              Name <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              className="question-input"
              type="text"
              value={editing.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Alex"
              maxLength={64}
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}

            <label className="label">Background</label>
            <textarea
              className="question-input"
              rows={2}
              value={editing.background}
              onChange={(e) => updateField('background', e.target.value)}
              placeholder="Occupation, experience, expertise…"
              maxLength={500}
            />

            <label className="label">Hobbies</label>
            <input
              className="question-input"
              type="text"
              value={editing.hobbies}
              onChange={(e) => updateField('hobbies', e.target.value)}
              placeholder="Sports, reading, side projects…"
              maxLength={300}
            />

            <label className="label">Interests</label>
            <input
              className="question-input"
              type="text"
              value={editing.interests}
              onChange={(e) => updateField('interests', e.target.value)}
              placeholder="Topics they care about…"
              maxLength={300}
            />

            <label className="label">Beliefs / Opinions</label>
            <textarea
              className="question-input"
              rows={2}
              value={editing.beliefs}
              onChange={(e) => updateField('beliefs', e.target.value)}
              placeholder="Their default stances and viewpoints…"
              maxLength={500}
            />

            <div className="create-agent-actions">
              <button type="button" className="session-logout" onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" className="submit" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="create-agent-actions"
        style={{ marginTop: '1.5rem', justifyContent: 'space-between' }}
      >
        <button type="button" className="session-logout" onClick={onBack}>
          ← Back to debate
        </button>
        <button type="button" className="submit" onClick={addFriend}>
          + Add friend
        </button>
      </div>
    </div>
  )
}
