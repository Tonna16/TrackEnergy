// src/components/EnergyTip.tsx
import React, { useEffect, useState } from 'react';

const EnergyTip: React.FC = () => {
  const [tip, setTip] = useState<string>('');

  useEffect(() => {
    fetch('/api/energy-tips')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(setTip)
      .catch(err => {
        console.error('Failed to load tip:', err);
        setTip('Unable to load energy-saving tip right now.');
      });
  }, []);

  return (
    <p>{tip}</p>  // Just plain text
  );
};

export default EnergyTip;
