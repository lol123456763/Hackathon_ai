import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/i18n';
import { AppProvider, useApp } from '@/state/app';
import { FlowProvider } from '@/state/flow';
import Shell, { ROLE_TABS } from '@/components/Shell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui';
import GetHelp from '@/pages/neighbor/GetHelp';

const Questions = lazy(() => import('@/pages/neighbor/Questions'));
const MyPlan = lazy(() => import('@/pages/neighbor/MyPlan'));
const PostSurplus = lazy(() => import('@/pages/give/PostSurplus'));
const MyPosts = lazy(() => import('@/pages/give/MyPosts'));
const Missions = lazy(() => import('@/pages/volunteer/Missions'));
const MissionDetail = lazy(() => import('@/pages/volunteer/MissionDetail'));
const MyHours = lazy(() => import('@/pages/volunteer/MyHours'));
const HubToday = lazy(() => import('@/pages/hub/HubToday'));
const HubPulse = lazy(() => import('@/pages/hub/HubPulse'));
const HubEvents = lazy(() => import('@/pages/hub/HubEvents'));
const shared = () => import('@/pages/shared/SharedPages');
const MapPage = lazy(() => shared().then((m) => ({ default: m.MapPage })));
const ImpactPage = lazy(() => shared().then((m) => ({ default: m.ImpactPage })));
const AboutPage = lazy(() => shared().then((m) => ({ default: m.AboutPage })));
const TrustPage = lazy(() => shared().then((m) => ({ default: m.TrustPage })));
const NotFound = lazy(() => shared().then((m) => ({ default: m.NotFound })));

function RoleHome() {
  const { role } = useApp();
  return <Navigate to={ROLE_TABS[role][0][0]} replace />;
}

function MyPlanRedirect() {
  const { token } = useApp();
  return <Navigate to={token ? `/p/${token}` : '/help'} replace />;
}

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <FlowProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                <Routes>
                  <Route element={<Shell />}>
                    <Route index element={<RoleHome />} />
                    <Route path="help" element={<GetHelp />} />
                    <Route path="help/questions" element={<Questions />} />
                    <Route path="plan" element={<MyPlanRedirect />} />
                    <Route path="p/:token" element={<MyPlan />} />
                    <Route path="give" element={<PostSurplus />} />
                    <Route path="give/posts" element={<MyPosts />} />
                    <Route path="missions" element={<Missions />} />
                    <Route path="missions/:key" element={<MissionDetail />} />
                    <Route path="hours" element={<MyHours />} />
                    <Route path="hub" element={<HubToday />} />
                    <Route path="hub/pulse" element={<HubPulse />} />
                    <Route path="hub/events" element={<HubEvents />} />
                    <Route path="map" element={<MapPage />} />
                    <Route path="impact" element={<ImpactPage />} />
                    <Route path="about" element={<AboutPage />} />
                    <Route path="trust" element={<TrustPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </FlowProvider>
      </AppProvider>
    </LanguageProvider>
  );
}
