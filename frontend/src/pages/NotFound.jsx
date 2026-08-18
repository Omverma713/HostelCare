import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>404 - Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '440px' }}>
        The page you are looking for does not exist or has been relocated.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>
        Go to Homepage
      </button>
    </div>
  );
}
