import React from 'react';
import { LayoutDashboard, Scale, Receipt, Users, Menu } from 'lucide-react';
import { useSync } from '../../context/SyncContext';

interface MobileNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMenu: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMenu
}) => {
  const { queueCount } = useSync();

  const items = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'entry', label: 'Procure', icon: <Scale className="w-5 h-5" />, isPrimary: true },
    { id: 'purchases', label: 'Slips', icon: <Receipt className="w-5 h-5" /> },
    { id: 'farmers', label: 'Farmers', icon: <Users className="w-5 h-5" /> },
    { id: 'menu', label: 'Menu', icon: <Menu className="w-5 h-5" />, isAction: true }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 px-2 py-1.5 shadow-elevated">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = currentTab === item.id;
          if (item.isAction) {
            return (
              <button
                key={item.id}
                onClick={onOpenMenu}
                className="flex flex-col items-center justify-center p-1.5 text-text-secondary hover:text-forest"
              >
                {item.icon}
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </button>
            );
          }

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className="relative -top-3 flex flex-col items-center justify-center bg-forest text-white w-12 h-12 rounded-full shadow-elevated border-2 border-white hover:bg-forest/90"
              >
                {item.icon}
                {queueCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-warning text-white text-[9px] font-bold px-1 rounded-full border border-white">
                    {queueCount}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 transition-colors ${
                isActive ? 'text-forest font-bold' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

