import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AnimatedDashboard from './components/AnimatedDashboard';
import CustomerList from './components/CustomerList';
import CustomerProfile from './components/CustomerProfile';
import SegmentBuilder from './components/SegmentBuilder';
import Navigation from './components/Navigation';
import './App.css';

type View = 'dashboard' | 'customers' | 'segments' | 'customer-profile';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedSegmentType, setSelectedSegmentType] = useState<string | null>(null);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentView('customer-profile');
  };

  const handleSegmentSelect = (segmentType: string) => {
    setSelectedSegmentType(segmentType);
    setCurrentView('segments');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <AnimatedDashboard 
          onCustomerSelect={handleCustomerSelect} 
          onSegmentSelect={handleSegmentSelect}
        />;
      case 'customers':
        return <CustomerList onCustomerSelect={handleCustomerSelect} />;
      case 'segments':
        return <SegmentBuilder initialSegmentType={selectedSegmentType} />;
      case 'customer-profile':
        return selectedCustomerId ? (
          <CustomerProfile 
            customerId={selectedCustomerId} 
            onBack={() => setCurrentView('customers')} 
          />
        ) : null;
      default:
        return <Dashboard onCustomerSelect={handleCustomerSelect} />;
    }
  };

  return (
    <div className="App">
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
