import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  message: string;
}

export function useNotifications() {
  const [tips, setTips] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        // Fetch the dynamic energy-saving tip
        const tipRes = await fetch(
          'http://localhost:8080/generate-energy-saving-tip?householdData=2%20people&userPreferences=appliance'
        );
        const tipText = tipRes.ok
          ? await tipRes.text()
          : `Error ${tipRes.status}: ${tipRes.statusText}`;

        // Fetch real alerts
        const alertRes = await fetch('http://localhost:8080/alerts');
        const alertJson: Notification[] = alertRes.ok
          ? await alertRes.json()
          : [];

        setTips([tipText]);
        setAlerts(alertJson);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setTips(['Unable to load tips.']);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { tips, alerts, loading };
}
