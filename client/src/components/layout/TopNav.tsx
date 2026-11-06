import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { api } from '../../services/api';
import { CollectionCentre } from '../../types';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Building2,
  ChevronDown,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface TopNavProps {
  selectedCentreId?: string;
  onSelectCentre?: (centreId: string) => void;
  onOpenMobileMenu?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  selectedCentreId,
  onSelectCentre,
  onOpenMobileMenu
}) => {
  const { user, switchDemoRole } = useAuth();
  const { isOnline, isSyncing, queueCount, triggerSync, lastSyncMessage } = useSync();

  const [centres, setCentres] = useState<CollectionCentre[]>([]);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showSyncToast, setShowSyncToast] = useState(false);

  useEffect(() => {
    api.getCentres().then(res => {
      if (res.centres) setCentres(res.centres);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (lastSyncMessage) {
      setShowSyncToast(true);
      const timer = setTimeout(() => setShowSyncToast(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncMessage]);

  const isManager = user?.role === 'MANAGER';

  return (
    <header className="h-16 bg-card border-b border-border sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between shadow-subtle">
      {/* Left: Mobile hamburger & Active Scope */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-background"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Collection Centre Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          {isManager ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-xs font-semibold text-text-secondary">Centre:</span>
              <select
                value={selectedCentreId || 'ALL'}
                onChange={(e) => onSelectCentre && onSelectCentre(e.target.value)}
                className="text-xs sm:text-sm font-semibold bg-background border border-border rounded-button px-2.5 py-1.5 text-forest focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="ALL">All 22 Village Centres</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} – {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs sm:text-sm font-semibold text-forest">
              <span className="text-text-secondary font-normal mr-1">Assigned Centre:</span>
              <span className="bg-sage text-forest px-2 py-0.5 rounded font-bold">
                {user?.centre?.code || 'C07'} – {user?.centre?.name || 'Ausa Central'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Connectivity indicator, Sync Button & Demo Role Switcher */}
      <div className="flex items-center gap-3">
        {/* Sync message mini banner / toast */}
        {showSyncToast && lastSyncMessage && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs bg-sage text-forest px-3 py-1 rounded-full border border-border animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <span>{lastSyncMessage}</span>
          </div>
        )}

        {/* Connectivity status pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-success-bg text-success border-success-border'
              : 'bg-warning-bg text-warning border-warning-border'
          }`}
          title={isOnline ? 'Online: Central server connected' : 'Offline: Local IndexedDB active'}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Manual Sync Button */}
        <button
          onClick={triggerSync}
          disabled={isSyncing || !isOnline}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold border transition-colors ${
            queueCount > 0
              ? 'bg-primary text-white border-primary hover:bg-primary-hover shadow-sm'
              : 'bg-background text-text-secondary border-border hover:bg-sage hover:text-forest'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Manually trigger background sync with central office"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          {queueCount > 0 && (
            <span className="bg-white text-forest text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
              {queueCount}
            </span>
          )}
        </button>

        {/* Demo Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-sage text-forest rounded-button border border-border text-xs font-semibold transition-colors"
          >
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="hidden md:inline">{user?.role === 'OPERATOR' ? 'Centre Operator' : 'Office Manager'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>

          {showRoleSwitcher && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-elevated py-2 z-50">
              <div className="px-3 py-1.5 border-b border-border mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Instant Demo Switcher</p>
              </div>

              <button
                onClick={() => {
                  switchDemoRole('OPERATOR');
                  setShowRoleSwitcher(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-background transition-colors ${
                  user?.role === 'OPERATOR' ? 'font-bold text-forest bg-sage/50' : 'text-text-main'
                }`}
              >
                <div>
                  <p className="font-semibold">Centre Operator</p>
                  <p className="text-[10px] text-text-muted">Ausa Centre C07</p>
                </div>
                {user?.role === 'OPERATOR' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>

              <button
                onClick={() => {
                  switchDemoRole('MANAGER');
                  setShowRoleSwitcher(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-background transition-colors ${
                  user?.role === 'MANAGER' ? 'font-bold text-forest bg-sage/50' : 'text-text-main'
                }`}
              >
                <div>
                  <p className="font-semibold">Office Manager</p>
                  <p className="text-[10px] text-text-muted">Central Office – All 22 Centres</p>
                </div>
                {user?.role === 'MANAGER' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

