import React from 'react';
import { useNavigate } from 'react-router-dom';

export const InvitationInvalidPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: '40px 20px',
      maxWidth: '600px',
      margin: '60px auto',
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif',
      backgroundColor: 'var(--panel, #ffffff)',
      borderRadius: '12px',
      border: '1px solid var(--line, #dfe5ef)',
      boxShadow: 'var(--shadow, 0 4px 20px rgba(0, 0, 0, 0.05))'
    }}>
      <h2 style={{
        color: 'var(--danger, #b91c1c)',
        fontSize: '26px',
        fontWeight: '800',
        marginBottom: '20px',
        letterSpacing: '-0.02em'
      }}>
        Invitation Invalid
      </h2>
      <p style={{
        fontSize: '15px',
        lineHeight: '1.6',
        color: 'var(--muted, #697386)',
        marginBottom: '30px'
      }}>
        This link has expired or your role has been updated. Please check your inbox and use the latest email invitation link to access the system properly.
      </p>
      <button
        style={{
          padding: '12px 24px',
          backgroundColor: 'var(--accent, #6366f1)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          transition: 'opacity 0.2s'
        }}
        onClick={() => navigate('/')}
        onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Return to Dashboard
      </button>
    </div>
  );
};
