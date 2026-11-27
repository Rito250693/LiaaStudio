import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_CONTENT,
  type CustomBlock,
  type CustomPage,
  type HeroConfig,
  type HomeSectionConfig,
  type LabIdentity,
  type NavItem,
  type NewsArticle,
  type PageTextOverride,
  type ProjectItem,
  type ResearchLine,
  type SiteContent,
  type SiteImages,
  type SiteInfo,
  type SiteTypography,
} from '../data/siteData';
import { apiFetch } from '../utils/apiClient';
import { applyGlobalTypography, DEFAULT_TYPOGRAPHY } from '../utils/typography';

export class VersionConflictError extends Error {
  currentVersion: number;
  constructor(message: string, currentVersion: number) {
    super(message);
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}

interface ContentContextValue {
  content: SiteContent;
  contentVersion: number;
  loading: boolean;
  refreshContent: () => Promise<void>;
  setLocalContent: (next: SiteContent) => void;
  saveContentToServer: (next: SiteContent, expectedVersion?: number) => Promise<number>;
  saveDesignToServer: (
    payload: {
      hero?: HeroConfig;
      homeSections?: HomeSectionConfig[];
      customBlocks?: CustomBlock[];
      images?: Partial<SiteImages>;
      typography?: Partial<SiteTypography>;
      pageTexts?: Record<string, PageTextOverride>;
    },
    expectedVersion?: number,
  ) => Promise<number>;
  savePageText: (textKey: string, override: PageTextOverride) => Promise<number>;
  saveMenusToServer: (navItems: NavItem[], expectedVersion?: number) => Promise<number>;
  savePagesToServer: (
    payload: { customPages?: CustomPage[]; labIdentity?: LabIdentity },
    expectedVersion?: number,
  ) => Promise<number>;
  saveSettingsToServer: (siteInfo: SiteInfo, expectedVersion?: number) => Promise<number>;
  saveResearchToServer: (
    payload: { researchLines?: ResearchLine[]; projects?: ProjectItem[] },
    expectedVersion?: number,
  ) => Promise<number>;
  saveNewsToServer: (newsArticles: NewsArticle[], expectedVersion?: number) => Promise<number>;
}

const ContentContext = createContext<ContentContextValue | undefined>(undefined);

function mergeContent(raw: Partial<SiteContent>): SiteContent {
  return {
    siteInfo: {
      ...DEFAULT_CONTENT.siteInfo,
      ...(raw.siteInfo || {}),
      socials: {
        ...DEFAULT_CONTENT.siteInfo.socials,
        ...(raw.siteInfo?.socials || {}),
      },
      images: {
        ...DEFAULT_CONTENT.siteInfo.images,
        ...(raw.siteInfo?.images || {}),
      },
    },
    hero: {
      ...DEFAULT_CONTENT.hero,
      ...(raw.hero || {}),
      primaryCta: {
        ...DEFAULT_CONTENT.hero.primaryCta,
        ...(raw.hero?.primaryCta || {}),
      },
      secondaryCta: {
        ...DEFAULT_CONTENT.hero.secondaryCta,
        ...(raw.hero?.secondaryCta || {}),
      },
      card: {
        ...DEFAULT_CONTENT.hero.card,
        ...(raw.hero?.card || {}),
      },
      metrics: Array.isArray(raw.hero?.metrics) ? raw.hero.metrics : DEFAULT_CONTENT.hero.metrics,
    },
    labIdentity: {
      ...DEFAULT_CONTENT.labIdentity,
      ...(raw.labIdentity || {}),
    },
    researchLines: Array.isArray(raw.researchLines)
      ? raw.researchLines
      : DEFAULT_CONTENT.researchLines,
    projects: Array.isArray(raw.projects) ? raw.projects : DEFAULT_CONTENT.projects,
    newsArticles: Array.isArray(raw.newsArticles)
      ? raw.newsArticles
      : DEFAULT_CONTENT.newsArticles,
    homeSections:
      Array.isArray(raw.homeSections) && raw.homeSections.length > 0
        ? raw.homeSections
        : DEFAULT_CONTENT.homeSections,
    customBlocks: Array.isArray(raw.customBlocks)
      ? raw.customBlocks
      : DEFAULT_CONTENT.customBlocks,
    navItems:
      Array.isArray(raw.navItems) && raw.navItems.length > 0
        ? raw.navItems
        : DEFAULT_CONTENT.navItems,
    customPages: Array.isArray(raw.customPages)
      ? raw.customPages
      : DEFAULT_CONTENT.customPages,
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      ...(raw.typography || {}),
    },
    pageTexts:
      raw.pageTexts && typeof raw.pageTexts === 'object' && !Array.isArray(raw.pageTexts)
        ? raw.pageTexts
        : {},
  };
}

async function parseApiResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && data.code === 'VERSION_CONFLICT') {
      throw new VersionConflictError(
        data.error || 'Conflicto de edición: el contenido fue modificado por otro usuario.',
        Number(data.currentVersion || 1),
      );
    }
    throw new Error(data.error || `Error del servidor (${res.status}).`);
  }
  return data;
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [contentVersion, setContentVersion] = useState<number>(1);
  const versionRef = useRef<number>(1);
  const [loading, setLoading] = useState(true);

  const updateVersion = useCallback((v: number) => {
    versionRef.current = v;
    setContentVersion(v);
  }, []);

  const refreshContent = useCallback(async () => {
    try {
      let res = await fetch(`/api/content?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch(`/content.json?t=${Date.now()}`, { cache: 'no-store' });
      }
      if (res.ok) {
        const json = (await res.json()) as Partial<SiteContent> & { _version?: number };
        if (typeof json._version === 'number') {
          updateVersion(json._version);
        }
        setContent(mergeContent(json));
      }
    } catch {
      // Fall back silently to bundled defaults
    } finally {
      setLoading(false);
    }
  }, [updateVersion]);

  const saveContentToServer = useCallback(
    async (next: SiteContent, expectedVersion?: number) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ ...next, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent(next);
      return nextVer;
    },
    [updateVersion],
  );

  const saveDesignToServer = useCallback(
    async (
      payload: {
        hero?: HeroConfig;
        homeSections?: HomeSectionConfig[];
        customBlocks?: CustomBlock[];
        images?: Partial<SiteImages>;
        typography?: Partial<SiteTypography>;
        pageTexts?: Record<string, PageTextOverride>;
      },
      expectedVersion?: number,
    ) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/site/design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ ...payload, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({
        ...prev,
        hero: payload.hero ?? prev.hero,
        homeSections: payload.homeSections ?? prev.homeSections,
        customBlocks: payload.customBlocks ?? prev.customBlocks,
        typography: payload.typography
          ? { ...DEFAULT_TYPOGRAPHY, ...(prev.typography || {}), ...payload.typography }
          : prev.typography,
        pageTexts: payload.pageTexts
          ? { ...(prev.pageTexts || {}), ...payload.pageTexts }
          : prev.pageTexts,
        siteInfo: payload.images
          ? { ...prev.siteInfo, images: { ...prev.siteInfo.images, ...payload.images } }
          : prev.siteInfo,
      }));
      return nextVer;
    },
    [updateVersion],
  );

  const savePageText = useCallback(
    async (textKey: string, override: PageTextOverride) => {
      return saveDesignToServer({ pageTexts: { [textKey]: override } });
    },
    [saveDesignToServer],
  );

  const saveMenusToServer = useCallback(
    async (navItems: NavItem[], expectedVersion?: number) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/site/menus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ navItems, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({ ...prev, navItems }));
      return nextVer;
    },
    [updateVersion],
  );

  const savePagesToServer = useCallback(
    async (
      payload: { customPages?: CustomPage[]; labIdentity?: LabIdentity },
      expectedVersion?: number,
    ) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/site/pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ ...payload, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({
        ...prev,
        customPages: payload.customPages ?? prev.customPages,
        labIdentity: payload.labIdentity ?? prev.labIdentity,
      }));
      return nextVer;
    },
    [updateVersion],
  );

  const saveSettingsToServer = useCallback(
    async (siteInfo: SiteInfo, expectedVersion?: number) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/site/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ siteInfo, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({ ...prev, siteInfo }));
      return nextVer;
    },
    [updateVersion],
  );

  const saveResearchToServer = useCallback(
    async (
      payload: { researchLines?: ResearchLine[]; projects?: ProjectItem[] },
      expectedVersion?: number,
    ) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/research', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ ...payload, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({
        ...prev,
        researchLines: payload.researchLines ?? prev.researchLines,
        projects: payload.projects ?? prev.projects,
      }));
      return nextVer;
    },
    [updateVersion],
  );

  const saveNewsToServer = useCallback(
    async (newsArticles: NewsArticle[], expectedVersion?: number) => {
      const ver = expectedVersion ?? versionRef.current;
      const res = await apiFetch('/api/news', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${ver}"` },
        body: JSON.stringify({ newsArticles, expectedVersion: ver }),
      });
      const data = await parseApiResponse(res);
      const nextVer = Number(data.version || ver + 1);
      updateVersion(nextVer);
      setContent((prev) => ({
        ...prev,
        newsArticles: Array.isArray(data.newsArticles) ? data.newsArticles : newsArticles,
      }));
      return nextVer;
    },
    [updateVersion],
  );

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  useEffect(() => {
    applyGlobalTypography(content.typography);
  }, [content.typography]);

  return (
    <ContentContext.Provider
      value={{
        content,
        contentVersion,
        loading,
        refreshContent,
        setLocalContent: setContent,
        saveContentToServer,
        saveDesignToServer,
        savePageText,
        saveMenusToServer,
        savePagesToServer,
        saveSettingsToServer,
        saveResearchToServer,
        saveNewsToServer,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return ctx;
}
