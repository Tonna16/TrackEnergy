import React, { useEffect, useState } from 'react'
import api from '../utils/api'
export default function EnergyTip() {
  const [tip, setTip] = useState('')

  useEffect(() => {
    api
      .get<string[]>('tips')      // → /api/tips proxied for you
      .then(res => {
        const tips = res.data
        if (tips.length > 0) {
          setTip(tips[Math.floor(Math.random() * tips.length)])
        }
      })
      .catch(console.error)
  }, [])

  return <span>{tip}</span>
}
