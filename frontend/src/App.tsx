import  { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ApplianceForm from './pages/ApplianceForm';
import Compare from './pages/Compare';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import EnergyTip from './components/EnergyTip';


function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add-appliance" element={<ApplianceForm />} />
        <Route path="edit-appliance/:id" element={<ApplianceForm />} />
        <Route path="compare" element={<Compare />} />
        <Route path="insights" element={<Insights />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
 