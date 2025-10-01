import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ArtifactChat } from './pages/ArtifactChat';
import { ArtifactsDashboard } from './pages/ArtifactsDashboard';
import { KnowledgeGraphView } from './pages/KnowledgeGraphView';
import { NotFound } from './pages/NotFound';

export const routes = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <ArtifactsDashboard /> },
      { path: 'chat', element: <ArtifactChat /> },
      { path: 'graph', element: <KnowledgeGraphView /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
