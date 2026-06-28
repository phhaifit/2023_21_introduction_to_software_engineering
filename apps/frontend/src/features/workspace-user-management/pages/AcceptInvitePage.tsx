import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { WorkspaceUserManagementAPI } from '../api';

const api = new WorkspaceUserManagementAPI('');

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const code = searchParams.get('code');
  const workspaceId = searchParams.get('workspaceId');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code || !workspaceId) {
      setStatus('error');
      setErrorMsg('Invalid invitation link (missing code or workspaceId).');
      return;
    }

    const accept = async () => {
      try {
        await api.acceptInvitation(code);
        setStatus('success');
        // Optionally redirect immediately:
        // setTimeout(() => navigate(`/workspace/${workspaceId}/members`), 2000);
      } catch (err: any) {
        // If the backend returns 401 Unauthorized, it means the user is not logged in.
        if (err.message.includes('auth.unauthorized') || err.message.includes('Authentication required') || err.message === 'API request failed') {
          setStatus('redirecting');
          // Redirect to authentication with the returnUrl query parameter so we come back here
          const returnUrl = encodeURIComponent(location.pathname + location.search);
          const msg = encodeURIComponent('You need to log in or register to accept this invitation.');
          navigate(`/authentication?redirect=${returnUrl}&message=${msg}`);
        } else {
          setStatus('error');
          setErrorMsg(err.message || 'Failed to accept invitation.');
        }
      }
    };

    accept();
  }, [code, workspaceId, navigate, location]);

  if (status === 'loading') {
    return <div style={{ padding: '20px' }}>Verifying invitation...</div>;
  }

  if (status === 'redirecting') {
    return <div style={{ padding: '20px' }}>Redirecting to login...</div>;
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Invitation Error</h2>
        <p>{errorMsg}</p>
        <button onClick={() => navigate('/')}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', color: 'green' }}>
      <h2>Invitation Accepted!</h2>
      <p>You have successfully joined the workspace.</p>
      <button 
        style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        onClick={() => navigate(`/workspace/${workspaceId}/members`)}
      >
        Go to Workspace
      </button>
    </div>
  );
};
