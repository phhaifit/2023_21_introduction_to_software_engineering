import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import type { AcceptInvitationResponse } from '@vcp/shared/contracts/index.ts';
import { WorkspaceUserManagementAPI, WorkspaceUserManagementApiError } from '../api';

const api = new WorkspaceUserManagementAPI('');

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const token = searchParams.get("token") ?? searchParams.get("code");

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedInvitation, setAcceptedInvitation] = useState<AcceptInvitationResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid invitation link. The invitation token is missing.');
      return;
    }

    let cancelled = false;
    let redirectTimer: number | undefined;

    const accept = async () => {
      try {
        const result = await api.acceptInvitation(token);
        if (cancelled) return;
        setAcceptedInvitation(result);
        setStatus('success');
        redirectTimer = window.setTimeout(() => {
          navigate(`/workspaces/${result.workspaceId}`, { replace: true });
        }, 900);
      } catch (err: any) {
        if (cancelled) return;
        if (err instanceof WorkspaceUserManagementApiError && err.code === "auth.unauthorized") {
          setStatus('redirecting');
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

    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [token, navigate, location.pathname, location.search]);

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
      <p>Redirecting you to the workspace...</p>
      <button 
        style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        onClick={() => acceptedInvitation ? navigate(`/workspaces/${acceptedInvitation.workspaceId}`) : navigate('/workspaces')}
      >
        Go to Workspace
      </button>
    </div>
  );
};
