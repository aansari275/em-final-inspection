import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { FinalInspectionForm } from './components/FinalInspectionForm';
import { InspectionList } from './components/InspectionList';
import { EmailSettings } from './components/EmailSettings';
import Login, { isAuthenticated, logout } from './components/Login';

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
  };

  // Show login page if not authenticated
  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<FinalInspectionForm />} />
            <Route path="/list" element={<InspectionList />} />
            <Route path="/settings" element={<EmailSettings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
