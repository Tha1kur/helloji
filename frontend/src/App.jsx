import { lazy, Suspense } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';

// Split at the route level. The call page pulls in socket.io-client and the
// WebRTC logic, which nothing else needs - loading it up front made every
// visitor to the landing page download the whole call implementation.
const HomeComponent = lazy(() => import('./pages/home'));
const History = lazy(() => import('./pages/history'));
const VideoMeetComponent = lazy(() => import('./pages/VideoMeet'));

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path='/' element={<LandingPage />} />
              <Route path='/auth' element={<Authentication />} />
              <Route path='/home' element={<HomeComponent />} />
              <Route path='/history' element={<History />} />
              <Route path='/:url' element={<VideoMeetComponent />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
