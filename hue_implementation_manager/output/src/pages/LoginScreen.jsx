import { useState } from 'react';
import logo from '../assets/logo-39n.png';
import { api, ApiError } from '../api';
import { PasswordToggleInput } from '../components/fields';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await api.login(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src={logo} alt="" width="52" height="51" />
        <h1>39N Health</h1>
        <div className="muted">Sign in to the implementation portal</div>

        <div className="field-block">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="field-input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field-block">
          <label htmlFor="login-password">Password</label>
          <PasswordToggleInput
            id="login-password"
            className="field-input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="primary-button login-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
