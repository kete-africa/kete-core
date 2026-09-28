import { createFileRoute, redirect } from '@tanstack/react-router';
import { fetchViewer } from '@/features/identity/functions';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const viewer = await fetchViewer();
    throw redirect({ to: viewer ? '/espace' : '/connexion' });
  },
});
