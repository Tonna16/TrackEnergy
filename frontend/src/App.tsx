// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ApplianceForm from './pages/ApplianceForm';
import Compare from './pages/Compare';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage'; // Ensure the file exists at this path or adjust the path accordingly
import SignupPage from './pages/SignupPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProfilePage from './pages/ProfilePage'; 

function App() {
    return (
      <>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="add-appliance" element={<ApplianceForm />} />
            <Route path="edit-appliance/:id" element={<ApplianceForm />} />
            <Route path="compare" element={<Compare />} />
            <Route path="insights" element={<Insights />} />
            <Route path="settings" element={<Settings />} />
          </Route>
  
          {/* Authentication */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
  
        <ToastContainer position="top-right" />
      </>
    );
  }
  

export default App;
