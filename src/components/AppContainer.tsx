import React, { useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { StickerDesigner } from '@/components/StickerDesigner';
import { Design } from '@/components/StickerDesigner';

type View = 'dashboard' | 'editor';

const AppContainer: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [currentDesign, setCurrentDesign] = useState<Design | undefined>();

  const handleNavigateToEditor = (design?: Design) => {
    setCurrentDesign(design);
    setCurrentView('editor');
  };

  const handleNavigateToDashboard = () => {
    setCurrentView('dashboard');
    setCurrentDesign(undefined);
  };

  return (
    <div className="w-full h-full">
      {currentView === 'dashboard' ? (
        <Dashboard onNavigateToEditor={handleNavigateToEditor} />
      ) : (
        <StickerDesigner 
          initialDesign={currentDesign}
          onNavigateBack={handleNavigateToDashboard}
        />
      )}
    </div>
  );
};

export default AppContainer;
