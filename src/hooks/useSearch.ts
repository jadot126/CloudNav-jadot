import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchMode, ExternalSearchSource, SearchConfig } from '../types';

interface UseSearchOptions {
  authToken: string | null;
  onSaveConfig?: (config: SearchConfig) => Promise<void>;
}

interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  externalSearchSources: ExternalSearchSource[];
  setExternalSearchSources: (sources: ExternalSearchSource[]) => void;
  selectedSearchSource: ExternalSearchSource | null;
  setSelectedSearchSource: (source: ExternalSearchSource | null) => void;
  showSearchSourcePopup: boolean;
  setShowSearchSourcePopup: (show: boolean) => void;
  hoveredSearchSource: ExternalSearchSource | null;
  setHoveredSearchSource: (source: ExternalSearchSource | null) => void;
  isIconHovered: boolean;
  setIsIconHovered: (hovered: boolean) => void;
  isPopupHovered: boolean;
  setIsPopupHovered: (hovered: boolean) => void;
  handleExternalSearch: () => void;
  handleSearchSourceSelect: (source: ExternalSearchSource) => void;
  handleSearchModeChange: (mode: SearchMode) => void;
  saveSearchConfig: (sources: ExternalSearchSource[], mode: SearchMode, selectedSource?: ExternalSearchSource | null) => Promise<void>;
}

const DEFAULT_SEARCH_SOURCES: ExternalSearchSource[] = [
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}', icon: 'Search', enabled: true, createdAt: Date.now() },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'Search', enabled: true, createdAt: Date.now() },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}', icon: 'Globe', enabled: true, createdAt: Date.now() },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'Github', enabled: true, createdAt: Date.now() },
  { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}', icon: 'Play', enabled: true, createdAt: Date.now() },
];

export function useSearch({ authToken, onSaveConfig }: UseSearchOptions): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('external');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>(DEFAULT_SEARCH_SOURCES);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);
  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理弹出窗口显示/隐藏逻辑
  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  // 保存搜索配置
  const saveSearchConfig = useCallback(async (
    sources: ExternalSearchSource[],
    mode: SearchMode,
    selectedSource?: ExternalSearchSource | null
  ) => {
    const config: SearchConfig = {
      mode,
      externalSources: sources,
      selectedSource: selectedSource !== undefined ? selectedSource : selectedSearchSource
    };

    setExternalSearchSources(sources);
    setSearchMode(mode);
    if (selectedSource !== undefined) {
      setSelectedSearchSource(selectedSource);
    }

    if (onSaveConfig) {
      await onSaveConfig(config);
    }
  }, [selectedSearchSource, onSaveConfig]);

  // 处理搜索源选择
  const handleSearchSourceSelect = useCallback(async (source: ExternalSearchSource) => {
    setSelectedSearchSource(source);
    await saveSearchConfig(externalSearchSources, searchMode, source);

    if (searchQuery.trim()) {
      const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
      window.open(searchUrl, '_blank');
    }
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  }, [searchQuery, externalSearchSources, searchMode, saveSearchConfig]);

  // 处理搜索模式切换
  const handleSearchModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);

    if (mode === 'external' && externalSearchSources.length === 0) {
      saveSearchConfig(DEFAULT_SEARCH_SOURCES, mode);
    } else {
      saveSearchConfig(externalSearchSources, mode);
    }
  }, [externalSearchSources, saveSearchConfig]);

  // 执行外部搜索
  const handleExternalSearch = useCallback(() => {
    if (searchQuery.trim() && searchMode === 'external') {
      let sources = externalSearchSources;
      if (sources.length === 0) {
        sources = DEFAULT_SEARCH_SOURCES;
        saveSearchConfig(sources, 'external');
      }

      let source = selectedSearchSource;
      if (!source) {
        const enabledSources = sources.filter(s => s.enabled);
        if (enabledSources.length > 0) {
          source = enabledSources[0];
        }
      }

      if (source) {
        const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
      }
    }
  }, [searchQuery, searchMode, externalSearchSources, selectedSearchSource, saveSearchConfig]);

  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    externalSearchSources,
    setExternalSearchSources,
    selectedSearchSource,
    setSelectedSearchSource,
    showSearchSourcePopup,
    setShowSearchSourcePopup,
    hoveredSearchSource,
    setHoveredSearchSource,
    isIconHovered,
    setIsIconHovered,
    isPopupHovered,
    setIsPopupHovered,
    handleExternalSearch,
    handleSearchSourceSelect,
    handleSearchModeChange,
    saveSearchConfig
  };
}

export default useSearch;
