import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Hash,
  Lock,
  Info
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({ limit: 100 });
      if (res.logs) setLogs(res.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      setVerificationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    handleVerifyChain();
  }, []);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-forest tracking-tight">Audit Trail & SHA-256 Hash Chaining</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Immutable append-only cryptographic log verifying procurement, price revisions & payment transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchLogs}
          >
            Refresh Logs
          </Button>
          <Button
            size="sm"
            variant="forest"
            isLoading={verifying}
            icon={<ShieldCheck className="w-4 h-4" />}
            onClick={handleVerifyChain}
          >
            Verify SHA-256 Chain
          </Button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            verificationResult.verification?.isValid
              ? 'bg-success-bg border-success-border text-forest'
              : 'bg-error-bg border-error-border text-error'
          }`}
        >
          {verificationResult.verification?.isValid ? (
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider">
              {verificationResult.verification?.isValid
                ? `Cryptographic Integrity Verified (${verificationResult.verification.totalVerified} chained blocks)`
                : 'Cryptographic Hash Chain Broken'}
            </p>
            <p className="text-xs text-text-secondary">
              All transaction blocks are mathematically linked using deterministic SHA-256 hashing. Every block references the preceding block's hash.
            </p>
          </div>
        </div>
      )}

      {/* Architectural Limitation Notice */}
      <Card padding="md" className="bg-background border-border space-y-2">
        <div className="flex items-center gap-2 text-forest font-bold text-xs uppercase tracking-wider">
          <Lock className="w-4 h-4 text-primary" /> Architectural Integrity Notice
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong>Limitation Documentation:</strong> Client-generated timestamps and local device storage (IndexedDB) cannot be considered independently tamper-proof on a rooted or compromised operating device. To guarantee non-repudiation, KrishiSetu's central server recalculates mathematical weights and money, verifies idempotency keys, independently computes event hashes upon ingest, attaches serverReceivedTimestamp, and maintains an append-only chained audit log.
        </p>
      </Card>

      {/* Audit Logs Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-forest">Append-Only Event Ledger</h3>
            <p className="text-xs text-text-secondary">Cryptographic event sequence</p>
          </div>
          <Badge variant="sage" size="sm">{logs.length} Logged Events</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] tracking-wider bg-background/50">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Entity & Action</th>
                <th className="py-2.5 px-4">Target ID</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4 font-mono">Previous Hash</th>
                <th className="py-2.5 px-4 font-mono">Event Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    Loading cryptographic logs...
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-background/80 transition-colors">
                    <td className="py-2.5 px-4 text-center font-mono text-text-muted">{l.id}</td>
                    <td className="py-2.5 px-4 text-text-muted text-[11px]">
                      {new Date(l.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-forest">{l.entityType}</span>
                      <span className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded ml-1.5 font-bold">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium text-forest">{l.entityId}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{l.userName || 'System'}</td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-text-muted truncate max-w-[120px]" title={l.previousHash || ''}>
                      {l.previousHash ? `${l.previousHash.slice(0, 10)}...` : 'GENESIS'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-forest truncate max-w-[120px]" title={l.eventHash}>
                      {l.eventHash.slice(0, 10)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

