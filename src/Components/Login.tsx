import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  MdPerson,
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
} from 'react-icons/md'
import loginBanner from '../assets/login-banner.png'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('at_auth', 'true')
      onLogin()
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Left Panel: Branding & Features Illustration (as Background) */}
        <div
          className="login-left"
          style={{
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.4)), url(${loginBanner})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="login-brand">
            <div className="login-brand-icon">
              <MdCheckCircle size={24} style={{ color: '#fff' }} />
            </div>
            <span>Attendance Management System</span>
          </div>

          <div className="login-left-content">
            <h1>Manage Your Workforce Seamlessly.</h1>
            <p className="subtitle">
              A comprehensive, real-time employee attendance tracking and leave management platform designed for efficiency.
            </p>
          </div>

          <div className="login-left-footer">
            &copy; {new Date().getFullYear()} Attendance Management System. All rights reserved.
          </div>
        </div>

        {/* Right Panel: Direct Sign In Form */}
        <div className="login-right">
          <div className="login-container">
            <div className="login-header">
              <h2>New Day With New Start</h2>
              <p>Please enter your credentials to authenticate</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username Id</label>
                <div className="input-with-icon">
                  <span className="input-field-icon"><MdPerson /></span>
                  <input
                    type="text"
                    placeholder="Enter Your Username Id"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError('') }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password for Your Account</label>
                <div className="input-with-icon">
                  <span className="input-field-icon"><MdLockOutline /></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter Your Password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
              </div>

              <div className="login-submit-container">
                <button type="submit" className="btn-primary">Sign In</button>
              </div>

              {error && <p className="error-msg">{error}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
