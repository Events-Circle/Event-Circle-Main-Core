import type { ReactNode } from 'react';
import './styles.css';
export const metadata = { title: 'Events Circle', description: 'Supplier growth, powered by Events Circle.' };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
