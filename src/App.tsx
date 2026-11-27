import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ContentProvider } from './context/ContentContext';
import { AuthProvider } from './context/AuthContext';
import { AdminBar } from './components/AdminBar';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { ResearchPage } from './pages/ResearchPage';
import { NewsPage } from './pages/NewsPage';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { ContactPage } from './pages/ContactPage';
import { AdminPage } from './pages/AdminPage';
import { DynamicPage } from './pages/DynamicPage';
import { NotFoundPage } from './pages/NotFoundPage';

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors dark:bg-[#050814] dark:text-slate-100">
      <AdminBar />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ContentProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/nosotros" element={<AboutPage />} />
                <Route path="/investigacion" element={<ResearchPage />} />
                <Route path="/noticias" element={<NewsPage />} />
                <Route path="/noticias/:slug" element={<NewsDetailPage />} />
                <Route path="/contacto" element={<ContactPage />} />
                <Route path="/:pageSlug" element={<DynamicPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ContentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
