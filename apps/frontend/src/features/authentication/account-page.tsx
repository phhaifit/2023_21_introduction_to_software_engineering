import { useAuth } from "./authentication-context.tsx";
import { AccountPanel } from "./authentication-page.tsx";

export function AccountPage() {
  const { currentUser, status, signOut } = useAuth();

  return (
    <AccountPanel
      email={currentUser?.email ?? ""}
      displayName={currentUser?.displayName}
      isSigningOut={status === "submitting"}
      onSignOut={() => void signOut()}
    />
  );
}
