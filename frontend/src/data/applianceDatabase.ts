export  const applianceDatabase: Record<string, { defaultWattage: number, efficiencyTips: string[] }> = {
  'refrigerator': {
    defaultWattage: 150,
    efficiencyTips: [
      'Set the temperature to 37-40°F for the fridge and 0-5°F for the freezer',
      'Keep the coils clean to improve efficiency',
      'Check door seals regularly for leaks'
    ]
  },
  'air-conditioner': {
    defaultWattage: 1500,
    efficiencyTips: [
      'Set your thermostat to 78°F in summer when you\'re home',
      'Consider a programmable thermostat',
      'Clean or replace filters monthly'
    ]
  },
  'washing-machine': {
    defaultWattage: 500,
    efficiencyTips: [
      'Wash with cold water when possible',
      'Run full loads only',
      'Use high-efficiency detergent for HE machines'
    ]
  },
  'clothes-dryer': {
    defaultWattage: 3000,
    efficiencyTips: [
      'Clean the lint filter before each load',
      'Use the moisture sensor setting if available',
      'Consider air-drying clothes when possible'
    ]
  },
  'dishwasher': {
    defaultWattage: 1200,
    efficiencyTips: [
      'Run only full loads',
      'Use the economy setting when possible',
      'Air dry dishes instead of using the heat dry option'
    ]
  },
  'television': {
    defaultWattage: 100,
    efficiencyTips: [
      'Use the energy-saving mode',
      'Lower the brightness setting',
      'Turn off when not in use instead of using standby mode'
    ]
  },
  'computer': {
    defaultWattage: 200,
    efficiencyTips: [
      'Use sleep mode when away for short periods',
      'Turn off the monitor when not in use',
      'Unplug chargers when not in use'
    ]
  },
  'lighting': {
    defaultWattage: 60,
    efficiencyTips: [
      'Switch to LED bulbs',
      'Use natural light when possible',
      'Install dimmer switches or motion sensors'
    ]
  },
  'water-heater': {
    defaultWattage: 4000,
    efficiencyTips: [
      'Set temperature to 120°F',
      'Insulate the tank and hot water pipes',
      'Install a timer to heat water only when needed'
    ]
  },
  'microwave': {
    defaultWattage: 1000,
    efficiencyTips: [
      'Use microwave instead of oven for small items',
      'Keep the inside clean for better efficiency',
      'Use the appropriate power level for each task'
    ]
  },
  'other': {
    defaultWattage: 100,
    efficiencyTips: [
      'Look for ENERGY STAR rated appliances',
      'Unplug devices when not in use to avoid phantom energy usage',
      'Consider using smart plugs to control energy usage'
    ]
  }
};

export const applianceTypes = Object.keys(applianceDatabase).map(key => ({
  value: key,
  label: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}));

export const locationOptions = [
  'Kitchen',
  'Living Room',
  'Bedroom',
  'Bathroom',
  'Laundry Room',
  'Office',
  'Garage',
  'Basement',
  'Outdoors',
  'Other'
];

export const nationalAverages = {
  daily: 30, // kWh per day
  monthly: 900, // kWh per month
  by_household_size: {
    1: 20,
    2: 30,
    3: 40,
    4: 45,
    5: 50
  } as Record<number, number>, // <-- This fixes the typing issue
  by_appliance: {
    refrigerator: 1.5,
    'air-conditioner': 15,
    'washing-machine': 1,
    'clothes-dryer': 3,
    dishwasher: 1.5,
    television: 0.5,
    computer: 1,
    lighting: 2,
    'water-heater': 12,
    microwave: 0.3
  }
};

 