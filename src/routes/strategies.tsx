import { createFileRoute, Outlet } from '@tanstack/react-router';
import '../styles/app.css';

/**
 * `/strategies` layout. Renders the matched child (catalog index or strategy
 * detail) — each child provides its own header/footer chrome.
 */
export const Route = createFileRoute('/strategies')({
  component: () => <Outlet />,
});