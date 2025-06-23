import React from 'react';
import { LayoutDashboard, Users, Target, Settings } from 'lucide-react';
import './Navigation.css';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: any) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'segments', label: 'Segments', icon: Target },
  ];

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h1>CDP Lite</h1>
        <span className="nav-tagline">Customer Intelligence Platform</span>
      </div>
      
      <div className="nav-items">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      
      <div className="nav-footer">
        <div className="nav-company">
          <div className="company-logo">GB</div>
          <div>
            <div className="company-name">GlowBeauty</div>
            <div className="company-plan">10,312 customers</div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;