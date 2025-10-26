
import React from 'react';
import { Disc3Icon } from './Icons';

const Header: React.FC = () => {
  return (
    <header className="border-b border-border p-4">
      <div className="container mx-auto flex items-center gap-4">
        <Disc3Icon className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">
          Auto DJ Mixer
        </h1>
      </div>
    </header>
  );
};

export default Header;
