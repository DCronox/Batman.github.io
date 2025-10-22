import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';

function useSession() {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [id, setId] = useState(null);
  const STORAGE_KEY = 'myapp.sessionId';

  // Ensure session id in URL and localStorage
  useEffect(() => {
    let sid = paramId || localStorage.getItem(STORAGE_KEY);
    if (!sid) {
      sid = crypto.randomUUID ? crypto.randomUUID() : ('id-' + Date.now());
      localStorage.setItem(STORAGE_KEY, sid);
      navigate(`/${sid}`, { replace: true });
    } else {
      localStorage.setItem(STORAGE_KEY, sid);
      if (!paramId) navigate(`/${sid}`, { replace: true });
    }
    setId(sid);
  }, [paramId, navigate]);

  return id;
}

function Editor() {
  const id = useSession();
  const [items, setItems] = useState([]);

  // Load existing history from server
  useEffect(() => {
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.history) setItems(data.history); })
      .catch(()=>{ /* ignore fetch errors */ });
  }, [id]);

  // Save function (append)
  const saveItem = useCallback((item) => {
    setItems(prev => {
      const next = [...prev, item];
      // send to server
      fetch(`/api/sessions/${id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      }).catch(()=> {
        // si falla, puedes almacenar en localStorage para reintentar después
        const offline = JSON.parse(localStorage.getItem('offline') || '[]');
        offline.push({ id, item });
        localStorage.setItem('offline', JSON.stringify(offline));
      });
      return next;
    });
  }, [id]);

  // flush offline queue on load / focus
  useEffect(() => {
    async function flush() {
      const q = JSON.parse(localStorage.getItem('offline') || '[]');
      if (!q.length) return;
      const remaining = [];
      for (const entry of q) {
        try {
          const res = await fetch(`/api/sessions/${entry.id}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: entry.item })
          });
          if (!res.ok) remaining.push(entry);
        } catch (e) {
          remaining.push(entry);
        }
      }
      localStorage.setItem('offline', JSON.stringify(remaining));
    }
    window.addEventListener('focus', flush);
    flush();
    return () => window.removeEventListener('focus', flush);
  }, []);

  // Example UI
  return (
    <div>
      <h3>Session: {id}</h3>
      <button onClick={() => saveItem({ text: 'Nuevo evento ' + new Date().toISOString() })}>
        Guardar evento
      </button>
      <ul>
        {items.map((it, i) => <li key={i}>{JSON.stringify(it)}</li>)}
      </ul>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <Routes>
        <Route path="/:id" element={<Editor />} />
        <Route path="/" element={<Editor />} />
      </Routes>
    </Router>
  );
}