import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Field } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await (mode === 'login' ? login(form) : register(form)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <div>
          <h1>💰 Expense &amp; Savings Tracker</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>All amounts in Pakistani Rupees (PKR)</p>
        </div>
        {mode === 'register' && <Field label="Name"><input value={form.name} onChange={set('name')} required autoComplete="name" /></Field>}
        <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></Field>
        <Field label={mode === 'register' ? 'Password (min 8 characters)' : 'Password'}>
          <input type="password" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {mode === 'login' && <p className="hint center" style={{ margin: 0 }}>Demo: demo@example.com / demo12345</p>}
      </form>
    </div>
  );
}
