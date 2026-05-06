import { useMemo, useState } from 'react'

function buildStarterAgent() {
  return {
    name: '',
    persona: '',
    hobbies: '',
    opinions: '',
    communicationStyle: '',
  }
}

export default function CreateAgentPage({ initialAgent, onCancel, onSave }) {
  const [form, setForm] = useState(() => initialAgent ?? buildStarterAgent())
  const [errors, setErrors] = useState({})

  const preview = useMemo(
    () => ({
      name: form.name.trim() || 'Your custom agent',
      persona: form.persona.trim() || 'No personality details yet.',
      hobbies: form.hobbies.trim() || 'No hobbies listed yet.',
      opinions: form.opinions.trim() || 'No opinion statement yet.',
      communicationStyle: form.communicationStyle.trim() || 'No style preference yet.',
    }),
    [form],
  )

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.persona.trim()) nextErrors.persona = 'Personality details are required.'
    if (!form.opinions.trim()) nextErrors.opinions = 'At least one opinion is required.'
    if (!form.communicationStyle.trim()) nextErrors.communicationStyle = 'Communication style is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave({
      name: form.name.trim(),
      persona: form.persona.trim(),
      hobbies: form.hobbies.trim(),
      opinions: form.opinions.trim(),
      communicationStyle: form.communicationStyle.trim(),
    })
  }

  return (
    <div className="panel create-agent-page">
      <header className="create-agent-head">
        <h2 className="output-title">Create custom agent</h2>
        <p className="create-agent-subtitle">
          Define a mini-you agent profile. It will be sent with debate runs so it can join advocate,
          critic, and moderator once backend support is enabled.
        </p>
      </header>

      <form className="controls" onSubmit={handleSubmit}>
        <label className="label" htmlFor="agent-name">
          Agent name
        </label>
        <input
          id="agent-name"
          className="question-input"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="e.g. MattVoice"
          maxLength={48}
        />
        {errors.name ? <p className="field-error">{errors.name}</p> : null}

        <label className="label" htmlFor="agent-persona">
          Personality details
        </label>
        <textarea
          id="agent-persona"
          className="question-input"
          rows={3}
          value={form.persona}
          onChange={(e) => updateField('persona', e.target.value)}
          placeholder="How this agent thinks, what it values, and how it reasons."
          maxLength={500}
        />
        {errors.persona ? <p className="field-error">{errors.persona}</p> : null}

        <label className="label" htmlFor="agent-hobbies">
          Hobbies / background (optional)
        </label>
        <textarea
          id="agent-hobbies"
          className="question-input"
          rows={2}
          value={form.hobbies}
          onChange={(e) => updateField('hobbies', e.target.value)}
          placeholder="Sports, side projects, interests, experiences..."
          maxLength={300}
        />

        <label className="label" htmlFor="agent-opinions">
          Opinions / stances
        </label>
        <textarea
          id="agent-opinions"
          className="question-input"
          rows={3}
          value={form.opinions}
          onChange={(e) => updateField('opinions', e.target.value)}
          placeholder="Beliefs or default viewpoints this agent should bring into debates."
          maxLength={500}
        />
        {errors.opinions ? <p className="field-error">{errors.opinions}</p> : null}

        <label className="label" htmlFor="agent-style">
          Communication style
        </label>
        <textarea
          id="agent-style"
          className="question-input"
          rows={2}
          value={form.communicationStyle}
          onChange={(e) => updateField('communicationStyle', e.target.value)}
          placeholder="Short and direct? Formal? Friendly? Evidence-first?"
          maxLength={300}
        />
        {errors.communicationStyle ? <p className="field-error">{errors.communicationStyle}</p> : null}

        <div className="create-agent-actions">
          <button type="button" className="session-logout" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="submit">
            Save agent
          </button>
        </div>
      </form>

      <section className="agent-preview card">
        <div className="card-head">Preview</div>
        <p className="card-body">
          <strong>Name:</strong> {preview.name}
        </p>
        <p className="card-body">
          <strong>Personality:</strong> {preview.persona}
        </p>
        <p className="card-body">
          <strong>Hobbies:</strong> {preview.hobbies}
        </p>
        <p className="card-body">
          <strong>Opinions:</strong> {preview.opinions}
        </p>
        <p className="card-body">
          <strong>Style:</strong> {preview.communicationStyle}
        </p>
      </section>
    </div>
  )
}
