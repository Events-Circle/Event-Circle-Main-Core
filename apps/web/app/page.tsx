import { tokens } from '@events-circle/design-system';
import { PlatformStatus } from './platform-status';
export default function Home() {
  return (
    <main style={{ borderTop: `6px solid ${tokens.colors.accent}` }}>
      <p>EVENTS CIRCLE</p>
      <h1>Your growth starts here.</h1>
      <p>The supplier and public web application is being built on the shared Events Circle platform.</p>
      <PlatformStatus />
      <p>
        Presence and Leads are the first connected backend modules. Supplier screens are still in development.
      </p>
    </main>
  );
}
