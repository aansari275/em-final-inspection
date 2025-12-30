import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { FinalInspectionForm } from './components/FinalInspectionForm';
import { InspectionList } from './components/InspectionList';
import { EmailSettings } from './components/EmailSettings';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
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
