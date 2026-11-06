import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import {
  LayoutDashboard,
  Scale,
  Users,
  Receipt,
  TrendingUp,
  CreditCard,
  Warehouse,
  ShieldAlert,
  History,
  LogOut,
  RefreshCw,
  Sprout
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();
  const { queueCount, isOnline } = useSync();

  const isOperator = user?.role === 'OPERATOR';
  const isManager = user?.role === 'MANAGER';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      visible: true
    },
    {
      id: 'entry',
      label: 'Collection Entry',
      icon: <Scale className="w-5 h-5" />,
      badge: isOperator ? 'Daily Task' : undefined,
      visible: true
    },
    {
      id: 'purchases',
      label: 'Purchases & Slips',
      icon: <Receipt className="w-5 h-5" />,
      visible: true
    },
    {
      id: 'farmers',
      label: 'Farmer Registry',
      icon: <Users className="w-5 h-5" />,
      visible: true
    },
    {
      id: 'prices',
      label: 'Daily Price Board',
      icon: <TrendingUp className="w-5 h-5" />,
      visible: true
    },
    {
      id: 'payments',
      label: 'Payment Runs',
      icon: <CreditCard className="w-5 h-5" />,
      visible: isManager
    },
    {
      id: 'stock',
      label: 'Stock Management',
      icon: <Warehouse className="w-5 h-5" />,
      visible: true
    },
    {
      id: 'anomalies',
      label: 'Anomaly Review',
      icon: <ShieldAlert className="w-5 h-5" />,
      visible: isManager
    },
    {
      id: 'audit',
      label: 'Audit & Hash Chain',
      icon: <History className="w-5 h-5" />,
      visible: isManager
    }
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-forest flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Sprout className="w-6 h-6 text-sage" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-forest leading-tight tracking-tight">KrishiSetu</h1>
          <p className="text-[11px] text-text-secondary font-medium">Farmer Procurement System</p>
        </div>
      </div>

      {/* Role & Centre Status Badge */}
      <div className="p-3 mx-4 my-3 bg-background rounded-xl border border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Active Role</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isManager ? 'bg-forest text-white' : 'bg-primary text-white'}`}>
            {user?.role}
          </span>
        </div>
        <p className="text-xs font-semibold text-forest truncate">
          {user?.fullName}
        </p>
        {isOperator && user?.centre && (
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            {user.centre.code} – {user.centre.village}
          </p>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => item.visible)
          .map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-button text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sage text-forest font-semibold shadow-sm'
                    : 'text-text-secondary hover:bg-background hover:text-forest'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-forest' : 'text-text-muted'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Offline Queue Badge in Sidebar */}
      {queueCount > 0 && (
        <div className="mx-4 mb-3 p-2.5 bg-warning-bg border border-warning-border rounded-xl flex items-center justify-between text-xs text-warning font-medium">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-warning" />
            <span>{queueCount} Queued Offline</span>
          </div>
        </div>
      )}

      {/* Footer / Sign Out */}
      <div className="p-4 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-button text-xs font-semibold text-error hover:bg-error-bg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Session</span>
        </button>
      </div>
    </aside>
  );
};

