import { useEffect, useState } from 'react';

export default function EnergyTip() {
  const [tip, setTip] = useState('');

  useEffect(() => {
    fetch('http://localhost:8080/api/tips')
      .then((res) => res.json())
      .then((data: string[]) => {
        if (data.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.length);
          setTip(data[randomIndex]);
        }
      })
      .catch((err) => {
        console.error('Error fetching tips:', err);
      });
  }, []);

  return <span>{tip}</span>;
}
    