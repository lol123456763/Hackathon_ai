import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/i18n';
import { FlowProvider } from '@/state/flow';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui';
import Home from '@/pages/Home';

const Start = lazy(() => import('@/pages/Start'));
const Plan = lazy(() => import('@/pages/Plan'));
const Browse = lazy(() => import('@/pages/Browse'));
const Admin = lazy(() => import('@/pages/Admin'));
const About = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.About })));
const Privacy = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.Privacy })));
const NotFound = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.NotFound })));

function PageFallback() {
  return (
    <div className="container-page py-16">
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <FlowProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="start" element={<Start />} />
                  <Route path="plan/:token" element={<Plan />} />
                  <Route path="browse" element={<Browse />} />
                  <Route path="about" element={<About />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="admin" element={<Admin />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </FlowProvider>
    </LanguageProvider>
  );
}
