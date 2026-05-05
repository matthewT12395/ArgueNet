import { useState } from 'react'

function randomGuestUsername() {
  const a = ['Swift', 'Quiet', 'Bright', 'Curious', 'Bold', 'Calm', 'Keen']
  const b = ['Fox', 'Owl', 'Bear', 'Crane', 'Wren', 'Lynx', 'Jay']
  const x = a[Math.floor(Math.random() * a.length)]
  const y = b[Math.floor(Math.random() * b.length)]
  return `${x}${y}${100 + Math.floor(Math.random() * 900)}`
}

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const name = username.trim() || randomGuestUsername()
    onLogin({ username: name })
  }

  return (
    <div className="login-screen">
      <div className="login-panel panel">
        <div className="login-brand">
          <span className="brand-mark login-brand-mark" aria-hidden="true">
            ◈
          </span>
          <div>
            <h1 className="login-title">ArgueNet</h1>
            <p className="login-subtitle">Sign in to open the orchestrator</p>
          </div>
        </div>
        <p className="login-demo-note">
          Demo mode: use any password. Leave username blank to get a random guest name.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="label" htmlFor="login-user">
            Username
          </label>
          <input
            id="login-user"
            className="question-input login-input"
            type="text"
            autoComplete="username"
            placeholder="e.g. alice — or leave blank for random"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="label" htmlFor="login-pass">
            Password
          </label>
          <input
            id="login-pass"
            className="question-input login-input"
            type="password"
            autoComplete="current-password"
            placeholder="anything goes"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="submit login-submit" type="submit">
            Enter ArgueNet
          </button>
        </form>
      </div>
    </div>
  )
}
