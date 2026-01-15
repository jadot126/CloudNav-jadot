import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS } from '../types';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';

interface DataContextType {
  links: LinkItem[];
  categories: Category[];
  setLinks: React.Dispatch<React.SetStateAction<LinkItem[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  updateData: (newLinks: LinkItem[], newCategories: Category[]) => void;
  loadFromLocal: () => void;
  syncToCloud: (newLinks: LinkItem[], newCategories: Category[], token: string) => Promise<boolean>;
  syncStatus: 'idle' | 'offline' | 'saving' | 'saved' | 'error';
  setSyncStatus: React.Dispatch<React.SetStateAction<'idle' | 'offline' | 'saving' | 'saved' | 'error'>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
  authToken: string | null;
  onAuthRequired?: () => void;
}

export function DataProvider({ children, authToken, onAuthRequired }: DataProviderProps) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'offline' | 'saving' | 'saved' | 'error'>('idle');

  const loadFromLocal = useCallback(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;

        // 确保"CloudNav"分类始终存在，并确保它是第一个分类
        if (!loadedCategories.some((c: Category) => c.id === 'cloudnav')) {
          loadedCategories = [
            { id: 'cloudnav', name: 'CloudNav', icon: 'Globe', uri: 'cloudnav' },
            ...loadedCategories
          ];
        } else {
          const cloudnavIndex = loadedCategories.findIndex((c: Category) => c.id === 'cloudnav');
          if (cloudnavIndex > 0) {
            const cloudnavCategory = loadedCategories[cloudnavIndex];
            loadedCategories = [
              cloudnavCategory,
              ...loadedCategories.slice(0, cloudnavIndex),
              ...loadedCategories.slice(cloudnavIndex + 1)
            ];
          }
        }

        // 检查是否有链接的categoryId不存在于当前分类中
        const validCategoryIds = new Set(loadedCategories.map((c: Category) => c.id));
        let loadedLinks = parsed.links || INITIAL_LINKS;
        loadedLinks = loadedLinks.map((link: LinkItem) => {
          if (!validCategoryIds.has(link.categoryId)) {
            return { ...link, categoryId: 'cloudnav' };
          }
          return link;
        });

        setLinks(loadedLinks);
        setCategories(loadedCategories);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  }, []);

  const syncToCloud = useCallback(async (newLinks: LinkItem[], newCategories: Category[], token: string): Promise<boolean> => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': token
        },
        body: JSON.stringify({ links: newLinks, categories: newCategories })
      });

      if (response.status === 401) {
        try {
          const errorData = await response.json() as { error?: string };
          if (errorData.error && errorData.error.includes('过期')) {
            alert('您的密码已过期，请重新登录');
          }
        } catch (e) {
          console.error('Failed to parse error response', e);
        }
        onAuthRequired?.();
        setSyncStatus('error');
        return false;
      }

      if (!response.ok) throw new Error('Network response was not ok');

      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } catch (error) {
      console.error("Sync failed", error);
      setSyncStatus('error');
      return false;
    }
  }, [onAuthRequired]);

  const updateData = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    // 1. Optimistic UI Update
    setLinks(newLinks);
    setCategories(newCategories);

    // 2. Save to Local Cache
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

    // 3. Sync to Cloud (if authenticated)
    if (authToken) {
      syncToCloud(newLinks, newCategories, authToken);
    }
  }, [authToken, syncToCloud]);

  const value: DataContextType = {
    links,
    categories,
    setLinks,
    setCategories,
    updateData,
    loadFromLocal,
    syncToCloud,
    syncStatus,
    setSyncStatus
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
