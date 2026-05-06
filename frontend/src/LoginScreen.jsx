import { useState } from 'react'
import { motion } from 'framer-motion'

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
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      const name = username.trim() || randomGuestUsername()
      onLogin({ username: name })
    }, 300)
  }

  return (
    <div className="login-screen">
      <div className="login-screen-bg" />
      
      <motion.div 
        className="login-panel panel"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <div className="login-brand">
            <span className="brand-mark">◈</span>
            <div>
              <h1 className="login-title">ArgueNet</h1>
              <p className="login-subtitle">Multi-Agent Debate Platform</p>
            </div>
          </div>
        </motion.div>

        <motion.p 
          className="login-demo-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Demo mode: use any password. Leave username blank for a random guest name.
        </motion.p>

        <form className="login-form" onSubmit={handleSubmit}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
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
              disabled={isLoading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
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
              disabled={isLoading}
            />
          </motion.div>

          <motion.button 
            className="submit login-submit" 
            type="submit"
            disabled={isLoading}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? 'Signing in...' : 'Enter ArgueNet'}
          </motion.button>
        </form>

        <motion.div
          className="login-features"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="feature-badge">💬 Live Debates</div>
          <div className="feature-badge">📊 Real-time Analytics</div>
          <div className="feature-badge">🤖 Multi-Agent AI</div>
        </motion.div>
      </motion.div>

      <style jsx>{`
        .login-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-darker) 0%, #1a1f3a 50%, var(--bg-dark) 100%);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .login-screen-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.05) 0%, transparent 50%);
          animation: float 8s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(20px); }
        }

        .login-panel {
          position: relative;
          z-index: 10;
          max-width: 400px;
          width: 100%;
          background: rgba(30, 41, 59, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: var(--radius-lg);
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .brand-mark {
          font-size: 40px;
          color: var(--primary);
          animation: rotate-mark 3s linear infinite;
        }

        @keyframes rotate-mark {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .login-title {
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .login-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 4px 0 0 0;
        }

        .login-demo-note {
          color: var(--text-tertiary);
          font-size: 13px;
          margin-bottom: 24px;
          padding: 12px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 8px;
          border-left: 3px solid var(--primary);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: var(--transition);
        }

        .login-input:hover {
          border-color: var(--primary);
          background: rgba(15, 23, 42, 0.8);
        }

        .login-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .login-input::placeholder {
          color: var(--text-tertiary);
        }

        .login-submit {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          margin-top: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.4);
        }

        .login-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-features {
          display: flex;
          gap: 8px;
          margin-top: 24px;
          flex-wrap: wrap;
        }

        .feature-badge {
          font-size: 12px;
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 20px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
