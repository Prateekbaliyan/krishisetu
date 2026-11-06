import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { MobileNav } from './components/layout/MobileNav';

// Screens
import { DashboardPage } from './pages/DashboardPage';
import { CollectionEntryPage } from './pages/CollectionEntryPage';
import { PurchaseSlipPage } from './pages/PurchaseSlipPage';
import { FarmerRegistryPage } from './pages/FarmerRegistryPage';
import { DailyPriceBoardPage } from './pages/DailyPriceBoardPage';
import { PaymentRunPage } from './pages/PaymentRunPage';
import { StockManagementPage } from './pages/StockManagementPage';
import { AnomalyReviewPage } from './pages/AnomalyReviewPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { Modal } from './components/ui/Modal';

export const App: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCentreId, setSelectedCentreId] = useState<string>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Loading KrishiSetu...
          </p>
        </div>
      </div>
    );
  }

  // If unauthenticated, show Login Screen
  if (!token || !user) {
    return <LoginPage />;
  }

  const isManager = user.role === 'MANAGER';

  // Render current screen
  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigateTab={setCurrentTab} selectedCentreId={selectedCentreId} />;
      case 'entry':
        return <CollectionEntryPage />;
      case 'purchases':
        return <PurchaseSlipPage onNavigateTab={setCurrentTab} selectedCentreId={selectedCentreId} />;
      case 'farmers':
        return <FarmerRegistryPage />;
      case 'prices':
        return <DailyPriceBoardPage />;
      case 'payments':
        return isManager ? <PaymentRunPage /> : <DashboardPage onNavigateTab={setCurrentTab} />;
      case 'stock':
        return <StockManagementPage />;
      case 'anomalies':
        return isManager ? <AnomalyReviewPage /> : <DashboardPage onNavigateTab={setCurrentTab} />;
      case 'audit':
        return isManager ? <AuditLogPage /> : <DashboardPage onNavigateTab={setCurrentTab} />;
      default:
        return <DashboardPage onNavigateTab={setCurrentTab} selectedCentreId={selectedCentreId} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col font-sans">
      {/* Desktop Fixed Left Sidebar */}
      <div className="hidden md:block">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
      </div>

      {/* Main App Container */}
      <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top Header */}
        <TopNav
          selectedCentreId={selectedCentreId}
          onSelectCentre={setSelectedCentreId}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      </div>

      {/* Mobile Drawer Menu Modal */}
      <Modal
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="KrishiSetu Menu"
        subtitle={`Signed in as ${user.fullName} (${user.role})`}
        maxWidth="sm"
      >
        <div className="space-y-1.5 text-sm">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'entry', label: 'Collection Entry (Weighment)' },
            { id: 'purchases', label: 'Purchases & Slips' },
            { id: 'farmers', label: 'Farmer Registry' },
            { id: 'prices', label: 'Daily Price Board' },
            ...(isManager ? [{ id: 'payments', label: 'Payment Runs' }] : []),
            { id: 'stock', label: 'Stock Management' },
            ...(isManager ? [{ id: 'anomalies', label: 'Anomaly Review Queue' }] : []),
            ...(isManager ? [{ id: 'audit', label: 'Audit Trail & Hash Chain' }] : [])
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-button transition-colors font-medium ${
                currentTab === item.id
                  ? 'bg-sage text-forest font-bold'
                  : 'text-text-main hover:bg-background'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

