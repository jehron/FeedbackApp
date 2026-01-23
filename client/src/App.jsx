import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Home from './pages/Home';
import Preview from './pages/Preview';
import Share from './pages/Share';
import Receive from './pages/Receive';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/share/:id" element={<Share />} />
        <Route path="/feedback/:id" element={<Receive />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
