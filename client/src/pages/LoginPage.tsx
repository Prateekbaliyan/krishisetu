import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sprout, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('operator.c07@krishisetu.in');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (role: 'operator' | 'manager') => {
    if (role === 'operator') {
      setEmail('operator.c07@krishisetu.in');
      setPassword('password123');
    } else {
      setEmail('manager@krishisetu.in');
      setPassword('password123');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-forest text-sage shadow-card mb-3">
          <Sprout className="w-8 h-8 text-sage" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-forest tracking-tight">
          KrishiSetu
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">
          Farmer Procurement & Payment Management System
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">
          Farmer Producer Company • Latur, Maharashtra
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card padding="lg" className="space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-base font-bold text-forest">Sign in to your account</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Access collection intake, registry & bank payment runs
            </p>
          </div>

          {error && (
            <div className="p-3 bg-error-bg border border-error-border rounded-button text-xs text-error font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@krishisetu.in"
                required
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              variant="forest"
              size="lg"
              className="w-full mt-2"
              isLoading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Demo Account Switcher Cards */}
          <div className="pt-4 border-t border-border space-y-2.5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider text-center">
              Quick Demo Accounts (Instant Fill)
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDemo('operator')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email.includes('operator')
                    ? 'border-forest bg-sage/60 ring-1 ring-forest'
                    : 'border-border bg-background hover:bg-sage/30'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-forest">Centre Operator</span>
                  {email.includes('operator') && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-[10px] text-text-secondary truncate">Ausa Centre C07</p>
                <p className="text-[9px] text-text-muted font-mono mt-0.5">operator.c07@krishisetu.in</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo('manager')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email.includes('manager')
                    ? 'border-forest bg-sage/60 ring-1 ring-forest'
                    : 'border-border bg-background hover:bg-sage/30'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-forest">Office Manager</span>
                  {email.includes('manager') && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-[10px] text-text-secondary truncate">Central Office (All 22 Centres)</p>
                <p className="text-[9px] text-text-muted font-mono mt-0.5">manager@krishisetu.in</p>
              </button>
            </div>
          </div>
        </Card>

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-[11px] text-text-muted flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>AES-256 encrypted session • SHA-256 chained transaction logs</span>
        </div>
      </div>
    </div>
  );
};

