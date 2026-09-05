export interface EnergyTipData {
  title: string;
  content: string;
  savings: string;
}

export const ENERGY_TIPS: EnergyTipData[] = [
  {
    title: 'Switch off idle devices',
    content: 'Turn off or unplug electronics that stay in standby when you are finished using them.',
    savings: 'Small daily savings can add up over a year.',
  },
  {
    title: 'Use full appliance loads',
    content: 'Run dishwashers and washing machines with full loads when practical.',
    savings: 'Fewer cycles reduce both electricity and water use.',
  },
  {
    title: 'Adjust heating and cooling',
    content: 'Use a modest thermostat setback while sleeping or away from home.',
    savings: 'Heating and cooling changes often have the largest household impact.',
  },
  {
    title: 'Choose efficient lighting',
    content: 'Replace frequently used incandescent bulbs with LEDs and switch lights off in empty rooms.',
    savings: 'LEDs use substantially less energy and last longer.',
  },
  {
    title: 'Check refrigerator settings',
    content: 'Keep the refrigerator near 37°F (3°C) and the freezer near 0°F (-18°C), and check door seals.',
    savings: 'Correct settings avoid unnecessary compressor runtime.',
  },
];
