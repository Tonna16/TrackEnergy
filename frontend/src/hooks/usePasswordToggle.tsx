// src/hooks/usePasswordToggle.tsx
import { useState } from 'react';

export function usePasswordToggle() {
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible(v => !v);

  // You can replace these icons with SVG or font icons later
  const icon = visible ? '🙈' : '👁️';

  return {
    type: visible ? 'text' : 'password',
    icon,
    toggle,
    visible,
  };
}
