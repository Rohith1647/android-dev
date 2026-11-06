import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { Button, ErrorMessage, Field, inputClass } from '../components/ui';

export function LoginPage() {
  const { signIn, expiredNotice } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate('/chats', { replace: true });
    } catch (err) {
      // 401 -> { error: "Invalid email or password" }. Fields are left as typed.
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src="/setu - Vertical.webp"
            alt="Setu Logo"
            className="mx-auto h-16 w-auto mb-4 object-contain"
          />
          <h1 className="font-display text-3xl font-bold tracking-tight text-parchment">
            CS Setu
          </h1>
          <p className="mt-1.5 text-sm text-parchment/60">Internal team chat</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-lg">
          <h2 className="font-display text-lg font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-soft">Use the account your admin set up for you.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {expiredNotice && !error && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {expiredNotice}
              </p>
            )}

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder="you@cs-setu.io"
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder="••••••••"
              />
            </Field>

            <ErrorMessage>{error}</ErrorMessage>

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
            Accounts are created by an admin or HR — there&apos;s no self-signup.
          </p>
        </div>
      </div>
    </div>
  );
}
