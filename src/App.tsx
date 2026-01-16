
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Search, Plus, Upload, Moon, Sun, Menu,
  Trash2, Loader2, Cloud, CheckCircle2, AlertCircle,
  Pin, Settings, Lock, CloudCog, GripVertical, Save, CheckSquare, LogOut, ExternalLink, Link2,
  ChevronLeft, ChevronRight, ChevronDown, GitFork, SunMoon
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, WebDavConfig, AIConfig, SearchMode, ExternalSearchSource, SearchConfig, SiteSettings, buildCategoryTree, findCategoryByPath, getCategoryAncestors, CategoryTreeNode } from './types';
import Icon from './components/Icon';
import AutoFitText from './components/AutoFitText';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryManagerModal, { DeleteMode } from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchConfigModal from './components/SearchConfigModal';
import ContextMenu from './components/ContextMenu';
import QRCodeModal from './components/QRCodeModal';

// --- 分组树项组件 ---
interface CategoryTreeItemProps {
  node: CategoryTreeNode;
  selectedCategory: string;
  unlockedCategoryIds: Set<string>;
  expandedCategories: Set<string>;
  onToggleExpand: (catId: string) => void;
  onCategoryClick: (cat: Category) => void;
  getCategoryPath: (cat: Category) => string;
  setSidebarOpen: (open: boolean) => void;
  // 返回分类的锁定信息：none | direct（自定义密码） | inherited（继承自某祖先）
  getLockInfo: (catId: string) => { type: 'none' | 'direct' | 'inherited'; sourceName?: string };
  isCategoryLocked?: (catId: string) => boolean;
  isAuthenticated?: boolean;
}

function CategoryTreeItem({
  node,
  selectedCategory,
  unlockedCategoryIds,
  expandedCategories,
  onToggleExpand,
  onCategoryClick,
  getCategoryPath,
  setSidebarOpen,
  getLockInfo,
  isCategoryLocked,
  isAuthenticated,
}: CategoryTreeItemProps) {
  // 支持三种状态：none / direct / inherited（getLockInfo 表示保护来源，lockedNow 表示当前是否仍被锁住）
  const lockInfo = getLockInfo(node.id);
  const isLocked = lockInfo.type !== 'none';
  const lockedNow = isCategoryLocked ? isCategoryLocked(node.id) : (!isAuthenticated && !unlockedCategoryIds.has(node.id) && (node.password || node.inheritPassword));
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedCategories.has(node.id);
  const isSelected = selectedCategory === node.id;
  const path = getCategoryPath(node);

  return (
    <div style={{ paddingLeft: node.level * 12 }}>
      <div className="flex items-center">
        {/* 展开/折叠按钮 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* 分组按钮 */}
        <button
          onClick={() => onCategoryClick(node)}
          title={lockInfo.type === 'inherited' ? `已锁定（继承自：${lockInfo.sourceName}）` : lockInfo.type === 'direct' ? '已锁定：需要输入密码' : undefined}
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl transition-all group ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
          <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${isSelected ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {lockInfo.type === 'none' && <Icon name={node.icon} size={14} />}
            {lockInfo.type === 'direct' && (
              <span title="受保护（需要密码）">
                <Lock size={14} className={lockedNow ? 'text-amber-500' : 'text-slate-400'} />
              </span>
            )}
            {lockInfo.type === 'inherited' && (
              <div className="relative" title={`受保护（继承自：${lockInfo.sourceName}）`}>
                <Lock size={14} className={lockedNow ? 'text-amber-500' : 'text-slate-400'} />
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center bg-transparent ${lockedNow ? 'border border-amber-500 text-amber-500' : 'border border-slate-400 text-slate-400'}`}><Link2 size={8} /></span>
              </div>
            )}
          </div>
          <span className="truncate flex-1 text-left text-sm">{node.name}</span>
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
        </button>
      </div>

      {/* 子分组（仅展示当前可访问的子分组） */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children.filter(child => (isCategoryLocked ? !isCategoryLocked(child.id) : getLockInfo(child.id).type === 'none')).map(child => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              selectedCategory={selectedCategory}
              unlockedCategoryIds={unlockedCategoryIds}
              expandedCategories={expandedCategories}
              onToggleExpand={onToggleExpand}
              onCategoryClick={onCategoryClick}
              getCategoryPath={getCategoryPath}
              setSidebarOpen={setSidebarOpen}
              getLockInfo={getLockInfo}
              isCategoryLocked={isCategoryLocked}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- 配置项 ---
// 项目核心仓库地址
const GITHUB_REPO_URL = 'https://github.com/jadot126/CloudNav-jadot';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SEARCH_CONFIG_KEY = 'cloudnav_search_config';

function App() {
  // --- Router Hooks ---
  const location = useLocation();
  const navigate = useNavigate();

  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('auto'); // 主题模式：亮色、暗色、自动
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 手动隐藏侧边栏（仅对桌面宽度生效），持久化到 localStorage
  const [sidebarManualHidden, setSidebarManualHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('cloudnav_sidebar_hidden') === 'true'; } catch (e) { return false; }
  });
  // 监听当前是否为 lg 及以上尺寸（Tailwind 默认 lg = 1024px）
  const [isLarge, setIsLarge] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 监听窗口大小以决定手动隐藏是否生效
  useEffect(() => {
    const onResize = () => setIsLarge(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 将手动隐藏状态持久化到 localStorage，并响应其他标签页的变化
  useEffect(() => {
    try { localStorage.setItem('cloudnav_sidebar_hidden', sidebarManualHidden ? 'true' : 'false'); } catch (e) { }
  }, [sidebarManualHidden]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cloudnav_sidebar_hidden') {
        setSidebarManualHidden(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Search Mode State
  const [searchMode, setSearchMode] = useState<SearchMode>('external');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>([]);
  const [isLoadingSearchConfig, setIsLoadingSearchConfig] = useState(true);

  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // WebDAV Config State
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
    url: '',
    username: '',
    password: '',
    enabled: false
  });

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem(AI_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return {
      provider: 'gemini',
      apiKey: process.env.API_KEY || '',
      baseUrl: '',
      model: 'gemini-2.5-flash'
    };
  });

  // Site Settings State
  const [siteSettings, setSiteSettings] = useState(() => {
    const saved = localStorage.getItem('cloudnav_site_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return {
      title: 'CloudNav - 我的导航',
      navTitle: 'CloudNav',
      favicon: '',
      cardStyle: 'detailed' as const,
      passwordExpiryDays: 7,

      // 新增默认展示设置
      tagTitleFontSize: 16,
      titleIconSize: 32,
      tagDisplayMode: 'inline',
      tagCardWidth: 'medium',
      tagCardMinWidth: 120
    };
  });

  // Helper: grid column mapping based on card style and selected width
  const getGridCols = (cardStyle: 'detailed' | 'simple', width: 'small' | 'medium' | 'large' = 'medium') => {
    if (cardStyle === 'detailed') {
      if (width === 'small') return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';
      if (width === 'large') return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    }

    if (width === 'small') return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';
    if (width === 'large') return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6';
    return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8';
  };
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);

  // Pending modal (opened while unauthenticated) - reopen after successful login
  const [pendingModal, setPendingModal] = useState<null | 'manage' | 'import' | 'backup' | 'settings' | 'searchConfig'>(null);
  const [suppressAuthOverlay, setSuppressAuthOverlay] = useState(false);

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  // State for data pre-filled from Bookmarklet
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'offline' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string | null>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null); // null表示未检查，true表示需要认证，false表示不需要
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Modal-level protection effect: if any protected modal is opened while unauthenticated,
  // remember the requested modal, close it, and prompt authentication
  useEffect(() => {
    if (authToken) return;
    if (isCatManagerOpen || isImportModalOpen || isBackupModalOpen || isSettingsModalOpen || isSearchConfigModalOpen) {
      // remember which modal was requested (pick the first)
      if (isCatManagerOpen) setPendingModal('manage');
      else if (isImportModalOpen) setPendingModal('import');
      else if (isBackupModalOpen) setPendingModal('backup');
      else if (isSettingsModalOpen) setPendingModal('settings');
      else if (isSearchConfigModalOpen) setPendingModal('searchConfig');

      // close all protected modals
      setIsCatManagerOpen(false);
      setIsImportModalOpen(false);
      setIsBackupModalOpen(false);
      setIsSettingsModalOpen(false);
      setIsSearchConfigModalOpen(false);

      // prompt auth
      setIsAuthOpen(true);
    }
  }, [authToken, isCatManagerOpen, isImportModalOpen, isBackupModalOpen, isSettingsModalOpen, isSearchConfigModalOpen]);

  // Sort State
  const [isSortingMode, setIsSortingMode] = useState<string | null>(null); // 存储正在排序的分类ID，null表示不在排序模式
  const [isSortingPinned, setIsSortingPinned] = useState(false); // 是否正在排序置顶链接

  // Batch Edit State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false); // 是否处于批量编辑模式
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set()); // 选中的链接ID集合

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    link: null
  });

  // QR Code Modal State
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Mobile Search State
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Category Action Auth State
  const [categoryActionAuth, setCategoryActionAuth] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
    categoryId: string;
    categoryName: string;
  }>({
    isOpen: false,
    action: 'edit',
    categoryId: '',
    categoryName: ''
  });

  // --- Helpers & Sync Logic ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;

        // 确保"CloudNav"分类始终存在，并确保它是第一个分类
        if (!loadedCategories.some(c => c.id === 'cloudnav')) {
          loadedCategories = [
            { id: 'cloudnav', name: 'CloudNav', icon: 'Globe', uri: 'cloudnav' },
            ...loadedCategories
          ];
        } else {
          // 如果"CloudNav"分类已存在，确保它是第一个分类
          const cloudnavIndex = loadedCategories.findIndex(c => c.id === 'cloudnav');
          if (cloudnavIndex > 0) {
            const cloudnavCategory = loadedCategories[cloudnavIndex];
            loadedCategories = [
              cloudnavCategory,
              ...loadedCategories.slice(0, cloudnavIndex),
              ...loadedCategories.slice(cloudnavIndex + 1)
            ];
          }
        }

        // 检查是否有链接的categoryId不存在于当前分类中，将这些链接移动到"CloudNav"
        const validCategoryIds = new Set(loadedCategories.map(c => c.id));
        let loadedLinks = parsed.links || INITIAL_LINKS;
        loadedLinks = loadedLinks.map(link => {
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
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
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
        // 检查是否是密码过期
        try {
          const errorData = await response.json() as { error?: string };
          if (errorData.error && errorData.error.includes('过期')) {
            alert('您的密码已过期，请重新登录');
          }
        } catch (e) {
          // 如果无法解析错误信息，使用默认提示
          console.error('Failed to parse error response', e);
        }

        setAuthToken('');
        localStorage.removeItem(AUTH_KEY);
        setIsAuthOpen(true);
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
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
    // 1. Optimistic UI Update
    setLinks(newLinks);
    setCategories(newCategories);

    // 2. Save to Local Cache
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

    // 3. Sync to Cloud (if authenticated)
    if (authToken) {
      syncToCloud(newLinks, newCategories, authToken);
    }
  };

  // --- Context Menu Functions ---
  const handleContextMenu = (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();

    // 在批量编辑模式下禁用右键菜单
    if (isBatchEditMode) return;

    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link: link
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      link: null
    });
  };

  const copyLinkToClipboard = () => {
    if (!contextMenu.link) return;

    navigator.clipboard.writeText(contextMenu.link.url)
      .then(() => {
        // 可以添加一个短暂的提示
        console.log('链接已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制链接失败:', err);
      });

    closeContextMenu();
  };

  const showQRCode = () => {
    if (!contextMenu.link) return;

    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title
    });

    closeContextMenu();
  };

  const editLinkFromContextMenu = () => {
    if (!contextMenu.link) return;

    setEditingLink(contextMenu.link);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const deleteLinkFromContextMenu = () => {
    if (!contextMenu.link) return;

    if (window.confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      const newLinks = links.filter(link => link.id !== contextMenu.link!.id);
      updateData(newLinks, categories);
    }

    closeContextMenu();
  };

  const togglePinFromContextMenu = () => {
    if (!contextMenu.link) return;

    const linkToToggle = links.find(l => l.id === contextMenu.link!.id);
    if (!linkToToggle) return;

    // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
    // 如果是取消置顶，则清除pinnedOrder
    const updated = links.map(l => {
      if (l.id === contextMenu.link!.id) {
        const isPinned = !l.pinned;
        return {
          ...l,
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
        };
      }
      return l;
    });

    updateData(updated, categories);
    closeContextMenu();
  };

  // 加载链接图标缓存
  const loadLinkIcons = async (linksToLoad: LinkItem[]) => {
    if (!authToken) return; // 只有在已登录状态下才加载图标缓存

    const updatedLinks = [...linksToLoad];
    const domainsToFetch: string[] = [];

    // 收集所有链接的域名（包括已有图标的链接）
    for (const link of updatedLinks) {
      if (link.url) {
        try {
          let domain = link.url;
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            domain = 'https://' + link.url;
          }

          if (domain.startsWith('http://') || domain.startsWith('https://')) {
            const urlObj = new URL(domain);
            domain = urlObj.hostname;
            domainsToFetch.push(domain);
          }
        } catch (e) {
          console.error("Failed to parse URL for icon loading", e);
        }
      }
    }

    // 批量获取图标
    if (domainsToFetch.length > 0) {
      const iconPromises = domainsToFetch.map(async (domain) => {
        try {
          const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
          if (response.ok) {
            const data = await response.json() as { cached?: boolean; icon?: string };
            if (data.cached && data.icon) {
              return { domain, icon: data.icon };
            }
          }
        } catch (error) {
          console.log(`Failed to fetch cached icon for ${domain}`, error);
        }
        return null;
      });

      const iconResults = await Promise.all(iconPromises);

      // 更新链接的图标
      iconResults.forEach(result => {
        if (result && result.icon) {
          const linkToUpdate = updatedLinks.find(link => {
            if (!link.url) return false;
            try {
              let domain = link.url;
              if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                domain = 'https://' + link.url;
              }

              if (domain.startsWith('http://') || domain.startsWith('https://')) {
                const urlObj = new URL(domain);
                return urlObj.hostname === result.domain;
              }
            } catch (e) {
              return false;
            }
            return false;
          });

          if (linkToUpdate) {
            // 只有当链接没有图标，或者当前图标是faviconextractor.com生成的，或者缓存中的图标是自定义图标时才更新
            if (!linkToUpdate.icon ||
              linkToUpdate.icon.includes('faviconextractor.com') ||
              !result.icon.includes('faviconextractor.com')) {
              linkToUpdate.icon = result.icon;
            }
          }
        }
      });

      // 更新状态
      setLinks(updatedLinks);
    }
  };

  // --- Effects ---

  // 路由同步：根据 URL 路径选择分组
  useEffect(() => {
    if (categories.length === 0) return;

    const path = location.pathname.slice(1); // 移除开头的 /
    if (!path || path === 'setup') {
      // 首页或设置页，显示网站直达
      setSelectedCategory('all');
      return;
    }

    // 处理置顶收藏页面
    if (path === 'top') {
      setSelectedCategory('pinned');
      return;
    }

    // 根据路径查找分组
    const category = findCategoryByPath(categories, path);
    if (category) {
      setSelectedCategory(category.id);
      // 展开所有祖先分组
      const ancestors = getCategoryAncestors(categories, category.id);
      setExpandedCategories(prev => {
        const next = new Set(prev);
        ancestors.forEach(a => next.add(a.id));
        return next;
      });
    } else {
      // 路径无效，重定向到首页
      navigate('/', { replace: true });
    }
  }, [location.pathname, categories, navigate]);

  // 如果直接访问了受保护的分组且未认证，自动打开分组访问密码弹窗（优先于全局管理员认证遮罩）
  useEffect(() => {
    if (!selectedCategory) return;
    const cat = categories.find(c => c.id === selectedCategory);
    if (!cat) return;

    if (isCategoryLocked(selectedCategory) && !authToken && !catAuthModalData) {
      setCatAuthModalData(cat);
    }
  }, [selectedCategory, categories, authToken, unlockedCategoryIds, catAuthModalData]);

  // 构建分组树（用于嵌套显示）
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  useEffect(() => {
    // Theme init - 根据用户设置、系统偏好或时间自动切换
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null;

    // 设置主题模式状态
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
      setThemeMode(savedTheme);
    } else {
      setThemeMode('auto');
    }

    // 判断是否应该使用暗黑模式
    const shouldUseDarkMode = (): boolean => {
      // 1. 如果用户明确设置了主题，使用用户设置
      if (savedTheme === 'dark') return true;
      if (savedTheme === 'light') return false;

      // 2. 如果用户设置为 'auto' 或没有设置，根据时间和系统偏好判断
      // 检查系统偏好
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }

      // 3. 根据时间判断（18:00 - 06:00 为暗黑模式）
      const hour = new Date().getHours();
      return hour >= 18 || hour < 6;
    };

    if (shouldUseDarkMode()) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load Token and check expiry
    const savedToken = localStorage.getItem(AUTH_KEY);
    const lastLoginTime = localStorage.getItem('lastLoginTime');

    if (savedToken) {
      const currentTime = Date.now();

      if (lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime);
        const timeDiff = currentTime - lastLogin;

        const expiryDays = siteSettings.passwordExpiryDays || 7;
        const expiryTimeMs = expiryDays > 0 ? expiryDays * 24 * 60 * 60 * 1000 : 0;

        if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem('lastLoginTime');
          setAuthToken(null);
        } else {
          setAuthToken(savedToken);
        }
      } else {
        setAuthToken(savedToken);
      }
    }

    // Load WebDAV Config
    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
      try {
        setWebDavConfig(JSON.parse(savedWebDav));
      } catch (e) { }
    }

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      // Clean URL params to avoid re-triggering on refresh
      window.history.replaceState({}, '', window.location.pathname);

      setPrefillLink({
        title: addTitle,
        url: addUrl,
        categoryId: 'common' // Default, Modal will handle selection
      });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }

    // Initial Data Fetch
    const initData = async () => {
      // 首先检查是否需要认证
      try {
        const authRes = await fetch('/api/storage?checkAuth=true');
        if (authRes.ok) {
          const authData = await authRes.json() as { requiresAuth?: boolean };
          setRequiresAuth(authData.requiresAuth ?? false);
          // 不在初始化阶段强制弹出认证窗口，允许用户浏览公开目录
        }
      } catch (e) {
        console.warn("Failed to check auth requirement.", e);
      }

      // 获取数据
      let hasCloudData = false;
      try {
        const res = await fetch('/api/storage', {
          headers: authToken ? { 'x-auth-password': authToken } : {}
        });
        if (res.ok) {
          const data = await res.json() as { links?: LinkItem[]; categories?: Category[] };
          if (data.links && data.links.length > 0) {
            setLinks(data.links);
            setCategories(data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

            // 加载链接图标缓存
            loadLinkIcons(data.links);
            hasCloudData = true;
          }
        } else if (res.status === 401) {
          // 如果返回401，可能是密码过期，清除本地token并要求重新登录
          const errorData = await res.json() as { error?: string };
          if (errorData.error && errorData.error.includes('过期')) {
            setAuthToken(null);
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setIsCheckingAuth(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch from cloud, falling back to local.", e);
      }

      // 无论是否有云端数据，都尝试从KV空间加载搜索配置和网站配置
      try {
        const searchConfigRes = await fetch('/api/storage?getConfig=search');
        if (searchConfigRes.ok) {
          const searchConfigData = await searchConfigRes.json() as SearchConfig | null;
          // 检查搜索配置是否有效（包含必要的字段）
          if (searchConfigData && (searchConfigData.mode || searchConfigData.externalSources || searchConfigData.selectedSource)) {
            setSearchMode(searchConfigData.mode || 'external');
            setExternalSearchSources(searchConfigData.externalSources || []);
            // 加载已保存的选中搜索源
            if (searchConfigData.selectedSource) {
              setSelectedSearchSource(searchConfigData.selectedSource);
            }
          }
        }

        // 获取网站配置（包括密码过期时间设置）
        const websiteConfigRes = await fetch('/api/storage?getConfig=website');
        if (websiteConfigRes.ok) {
          const websiteConfigData = await websiteConfigRes.json() as SiteSettings | null;
          if (websiteConfigData) {
            setSiteSettings((prev: SiteSettings) => ({
              ...prev,
              title: websiteConfigData.title || prev.title,
              navTitle: websiteConfigData.navTitle || prev.navTitle,
              favicon: websiteConfigData.favicon || prev.favicon,
              cardStyle: websiteConfigData.cardStyle || prev.cardStyle,
              passwordExpiryDays: websiteConfigData.passwordExpiryDays !== undefined ? websiteConfigData.passwordExpiryDays : prev.passwordExpiryDays
            }));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch configs from KV.", e);
      }

      // 如果有云端数据，则不需要加载本地数据
      if (hasCloudData) {
        setIsCheckingAuth(false);
        return;
      }

      // 如果没有云端数据，则加载本地数据
      loadFromLocal();

      // 如果从KV空间加载搜索配置失败，直接使用默认配置（不使用localStorage回退）
      setSearchMode('external');
      setExternalSearchSources([
        {
          id: 'bing',
          name: '必应',
          url: 'https://www.bing.com/search?q={query}',
          icon: 'Search',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'google',
          name: 'Google',
          url: 'https://www.google.com/search?q={query}',
          icon: 'Search',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'baidu',
          name: '百度',
          url: 'https://www.baidu.com/s?wd={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'sogou',
          name: '搜狗',
          url: 'https://www.sogou.com/web?query={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'yandex',
          name: 'Yandex',
          url: 'https://yandex.com/search/?text={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'github',
          name: 'GitHub',
          url: 'https://github.com/search?q={query}',
          icon: 'Github',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'linuxdo',
          name: 'Linux.do',
          url: 'https://linux.do/search?q={query}',
          icon: 'Terminal',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'bilibili',
          name: 'B站',
          url: 'https://search.bilibili.com/all?keyword={query}',
          icon: 'Play',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'youtube',
          name: 'YouTube',
          url: 'https://www.youtube.com/results?search_query={query}',
          icon: 'Video',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'wikipedia',
          name: '维基',
          url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
          icon: 'BookOpen',
          enabled: true,
          createdAt: Date.now()
        }
      ]);

      setIsLoadingSearchConfig(false);
      setIsCheckingAuth(false);
    };

    initData();
  }, []);

  // Update page title and favicon when site settings change
  useEffect(() => {
    if (siteSettings.title) {
      document.title = siteSettings.title;
    }

    if (siteSettings.favicon) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());

      // Add new favicon
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = siteSettings.favicon;
      document.head.appendChild(favicon);
    }
  }, [siteSettings.title, siteSettings.favicon]);

  // 主题切换：亮色 -> 暗色 -> 自动 -> 亮色 循环
  const toggleTheme = () => {
    // 计算自动模式下应该使用的主题
    const getAutoDarkMode = (): boolean => {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
      const hour = new Date().getHours();
      return hour >= 18 || hour < 6;
    };

    let newThemeMode: 'light' | 'dark' | 'auto';
    let newDarkMode: boolean;

    // 循环切换：亮色 -> 暗色 -> 自动
    if (themeMode === 'light') {
      newThemeMode = 'dark';
      newDarkMode = true;
    } else if (themeMode === 'dark') {
      newThemeMode = 'auto';
      newDarkMode = getAutoDarkMode();
    } else {
      newThemeMode = 'light';
      newDarkMode = false;
    }

    setThemeMode(newThemeMode);
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newThemeMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // 视图模式切换处理函数
  const handleViewModeChange = (cardStyle: 'detailed' | 'simple') => {
    const newSiteSettings = { ...siteSettings, cardStyle };
    setSiteSettings(newSiteSettings);
    localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
  };

  // --- Batch Edit Functions ---
  const toggleBatchEditMode = () => {
    setIsBatchEditMode(!isBatchEditMode);
    setSelectedLinks(new Set()); // 退出批量编辑模式时清空选中项
  };

  const toggleLinkSelection = (linkId: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) {
        newSet.delete(linkId);
      } else {
        newSet.add(linkId);
      }
      return newSet;
    });
  };

  const handleBatchDelete = () => {
    // 如果任何被选中的链接属于有密码保护的分组，则要求管理员登录
    const anyLocked = Array.from(selectedLinks).some(id => {
      const l = links.find(link => link.id === id);
      return l && isCategoryLocked(l.categoryId);
    });
    if (anyLocked && !authToken) { setIsAuthOpen(true); return; }

    if (selectedLinks.size === 0) {
      alert('请先选择要删除的链接');
      return;
    }

    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      const newLinks = links.filter(link => !selectedLinks.has(link.id));
      updateData(newLinks, categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  };

  const handleBatchMove = (targetCategoryId: string) => {
    // 如果任何被选中的链接属于有密码保护的分组，或目标分组为有密码保护的分组，则要求管理员登录
    const anySourceLocked = Array.from(selectedLinks).some(id => {
      const l = links.find(link => link.id === id);
      return l && isCategoryLocked(l.categoryId);
    });
    const targetLocked = isCategoryLocked(targetCategoryId);
    if ((anySourceLocked || targetLocked) && !authToken) { setIsAuthOpen(true); return; }

    if (selectedLinks.size === 0) {
      alert('请先选择要移动的链接');
      return;
    }

    const newLinks = links.map(link =>
      selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link
    );
    updateData(newLinks, categories);
    setSelectedLinks(new Set());
    setIsBatchEditMode(false);
  };

  const handleSelectAll = () => {
    // 获取当前显示的所有链接ID
    const currentLinkIds = displayedLinks.map(link => link.id);

    // 如果已选中的链接数量等于当前显示的链接数量，则取消全选
    if (selectedLinks.size === currentLinkIds.length && currentLinkIds.every(id => selectedLinks.has(id))) {
      setSelectedLinks(new Set());
    } else {
      // 否则全选当前显示的所有链接
      setSelectedLinks(new Set(currentLinkIds));
    }
  };

  // --- Actions ---

  const handleLogin = async (password: string): Promise<boolean> => {
    try {
      // 首先验证密码
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true }) // 只用于验证密码，不更新数据
      });

      if (authResponse.ok) {
        setAuthToken(password);
        localStorage.setItem(AUTH_KEY, password);
        setIsAuthOpen(false);
        setSyncStatus('saved');

        // 登录成功后，获取网站配置（包括密码过期时间设置）
        try {
          const websiteConfigRes = await fetch('/api/storage?getConfig=website');
          if (websiteConfigRes.ok) {
            const websiteConfigData = await websiteConfigRes.json() as SiteSettings | null;
            if (websiteConfigData) {
              setSiteSettings((prev: SiteSettings) => ({
                ...prev,
                title: websiteConfigData.title || prev.title,
                navTitle: websiteConfigData.navTitle || prev.navTitle,
                favicon: websiteConfigData.favicon || prev.favicon,
                cardStyle: websiteConfigData.cardStyle || prev.cardStyle,
                passwordExpiryDays: websiteConfigData.passwordExpiryDays !== undefined ? websiteConfigData.passwordExpiryDays : prev.passwordExpiryDays
              }));
            }
          }
        } catch (e) {
          console.warn("Failed to fetch website config after login.", e);
        }

        // 检查密码是否过期
        const lastLoginTime = localStorage.getItem('lastLoginTime');
        const currentTime = Date.now();

        if (lastLoginTime) {
          const lastLogin = parseInt(lastLoginTime);
          const timeDiff = currentTime - lastLogin;

          const expiryTimeMs = (siteSettings.passwordExpiryDays || 7) > 0 ? (siteSettings.passwordExpiryDays || 7) * 24 * 60 * 60 * 1000 : 0;

          if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
            setAuthToken(null);
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            alert('您的密码已过期，请重新登录');
            return false;
          }
        }

        localStorage.setItem('lastLoginTime', currentTime.toString());

        // 登录成功后，从服务器获取数据
        try {
          const res = await fetch('/api/storage');
          if (res.ok) {
            const data = await res.json() as { links?: LinkItem[]; categories?: Category[] };
            // 如果服务器有数据，使用服务器数据
            if (data.links && data.links.length > 0) {
              setLinks(data.links);
              setCategories(data.categories || DEFAULT_CATEGORIES);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

              // 加载链接图标缓存
              loadLinkIcons(data.links);
            } else {
              // 如果服务器没有数据，使用本地数据
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
              // 并将本地数据同步到服务器
              syncToCloud(links, categories, password);

              // 加载链接图标缓存
              loadLinkIcons(links);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch data after login.", e);
          loadFromLocal();
          // 尝试将本地数据同步到服务器
          syncToCloud(links, categories, password);
        }

        // 登录成功后，从KV空间加载AI配置
        try {
          const aiConfigRes = await fetch('/api/storage?getConfig=ai');
          if (aiConfigRes.ok) {
            const aiConfigData = await aiConfigRes.json() as AIConfig | null;
            if (aiConfigData && Object.keys(aiConfigData).length > 0) {
              setAiConfig(aiConfigData);
              localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfigData));
            }
          }
        } catch (e) {
          console.warn("Failed to fetch AI config after login.", e);
        }

        // 登录成功后，如果之前尝试打开某个受保护的弹窗，自动打开它
        if (pendingModal) {
          if (pendingModal === 'manage') setIsCatManagerOpen(true);
          else if (pendingModal === 'import') setIsImportModalOpen(true);
          else if (pendingModal === 'backup') setIsBackupModalOpen(true);
          else if (pendingModal === 'settings') setIsSettingsModalOpen(true);
          else if (pendingModal === 'searchConfig') setIsSearchConfigModalOpen(true);
          setPendingModal(null);
        }

        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem(AUTH_KEY);
    setSyncStatus('offline');
    // 退出后重新加载本地数据
    loadFromLocal();
  };

  // 关闭全局认证浮层：关闭弹窗并跳转到首页，避免留在受保护目录
  const closeAuthOverlay = () => {
    setIsAuthOpen(false);
    navigate('/', { replace: true });
    setSelectedCategory('all');
  };

  // 打开登录弹窗的统一方法：默认跳转到首页以避免受保护目录遮罩阻挡，并清理 pendingModal
  const openLoginModal = (opts?: { keepCategory?: boolean }) => {
    setPendingModal(null);
    if (!opts?.keepCategory) {
      setSelectedCategory('all');
    }
    setIsAuthOpen(true);
    if (!opts?.keepCategory) {
      // navigate after opening modal to avoid the protected-category overlay blocking
      navigate('/', { replace: true });
    }
  };

  // Close handler for CategoryAuthModal: navigate away to nearest accessible ancestor (or home)
  // and briefly suppress the global auth overlay to avoid a flash.
  const handleCategoryAuthClose = () => {
    // If current selected category is locked and user not authenticated, navigate away first
    if (!authToken && requiresAuthForCategory(selectedCategory)) {
      const ancestors = getCategoryAncestors(categories, selectedCategory);
      let foundAncestor: Category | null = null;
      for (let i = ancestors.length - 1; i >= 0; i--) {
        if (!isCategoryLocked(ancestors[i].id)) {
          foundAncestor = ancestors[i];
          break;
        }
      }

      setSuppressAuthOverlay(true);

      if (foundAncestor) {
        const path = getCategoryPath(foundAncestor);
        navigate(path, { replace: true });
        setSelectedCategory(foundAncestor.id);
      } else {
        navigate('/', { replace: true });
        setSelectedCategory('all');
      }

      // Clear modal after short delay to avoid race with overlay condition
      setTimeout(() => {
        setCatAuthModalData(null);
        setSuppressAuthOverlay(false);
      }, 120);
      return;
    }

    // Otherwise just close modal
    setCatAuthModalData(null);
  };

  // 分类操作密码验证处理函数
  const handleCategoryActionAuth = async (password: string): Promise<boolean> => {
    try {
      // 验证密码
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true })
      });

      return authResponse.ok;
    } catch (error) {
      console.error('Category action auth error:', error);
      return false;
    }
  };

  // 打开分类操作验证弹窗
  const openCategoryActionAuth = (action: 'edit' | 'delete', categoryId: string, categoryName: string) => {
    setCategoryActionAuth({
      isOpen: true,
      action,
      categoryId,
      categoryName
    });
  };

  // 关闭分类操作验证弹窗
  const closeCategoryActionAuth = () => {
    setCategoryActionAuth({
      isOpen: false,
      action: 'edit',
      categoryId: '',
      categoryName: ''
    });
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
    // Merge categories: Avoid duplicate names/IDs
    const mergedCategories = [...categories];

    // 确保"CloudNav"分类始终存在
    if (!mergedCategories.some(c => c.id === 'cloudnav')) {
      mergedCategories.push({ id: 'cloudnav', name: 'CloudNav', icon: 'Globe', uri: 'cloudnav' });
    }

    newCategories.forEach(nc => {
      if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) {
        mergedCategories.push(nc);
      }
    });

    const mergedLinks = [...links, ...newLinks];
    updateData(mergedLinks, mergedCategories);
    setIsImportModalOpen(false);
    alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    // 如果目标分类需要密码验证，则要求管理员登录
    const targetCatId = data.categoryId && data.categoryId !== 'all' ? data.categoryId : undefined;
    if (targetCatId && isCategoryLocked(targetCatId) && !authToken) { setIsAuthOpen(true); return; }

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    // 获取当前分类下的所有链接（不包括置顶链接）
    const categoryLinks = links.filter(link =>
      !link.pinned && (data.categoryId === 'all' || link.categoryId === data.categoryId)
    );

    // 计算新链接的order值，使其排在分类最后
    const maxOrder = categoryLinks.length > 0
      ? Math.max(...categoryLinks.map(link => link.order || 0))
      : -1;

    const newLink: LinkItem = {
      ...data,
      url: processedUrl, // 使用处理后的URL
      id: Date.now().toString(),
      createdAt: Date.now(),
      order: maxOrder + 1, // 设置为当前分类的最大order值+1，确保排在最后
      // 如果是置顶链接，设置pinnedOrder为当前置顶链接数量
      pinnedOrder: data.pinned ? links.filter(l => l.pinned).length : undefined
    };

    // 将新链接插入到合适的位置，而不是直接放在开头
    // 如果是置顶链接，放在置顶链接区域的最后
    if (newLink.pinned) {
      const firstNonPinnedIndex = links.findIndex(link => !link.pinned);
      if (firstNonPinnedIndex === -1) {
        // 如果没有非置顶链接，直接添加到末尾
        updateData([...links, newLink], categories);
      } else {
        // 插入到非置顶链接之前
        const updatedLinks = [...links];
        updatedLinks.splice(firstNonPinnedIndex, 0, newLink);
        updateData(updatedLinks, categories);
      }
    } else {
      // 非置顶链接，按照order字段排序后插入
      const updatedLinks = [...links, newLink].sort((a, b) => {
        // 置顶链接始终排在前面
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // 同类型链接按照order排序
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
      updateData(updatedLinks, categories);
    }

    // Clear prefill if any
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!editingLink) return;
    // 如果目标分类需要密码验证，则要求管理员登录
    if (isCategoryLocked(editingLink.categoryId) && !authToken) { setIsAuthOpen(true); return; }

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  // 拖拽结束事件处理函数
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取当前分类下的所有链接
      const categoryLinks = links.filter(link =>
        selectedCategory === 'all' || link.categoryId === selectedCategory
      );

      // 找到被拖拽元素和目标元素的索引
      const activeIndex = categoryLinks.findIndex(link => link.id === active.id);
      const overIndex = categoryLinks.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序当前分类的链接
        const reorderedCategoryLinks = arrayMove(categoryLinks, activeIndex, overIndex);

        // 更新所有链接的顺序
        const updatedLinks = links.map(link => {
          const reorderedIndex = reorderedCategoryLinks.findIndex(l => l.id === link.id);
          if (reorderedIndex !== -1) {
            return { ...link, order: reorderedIndex };
          }
          return link;
        });

        // 按照order字段重新排序
        updatedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

        updateData(updatedLinks, categories);
      }
    }
  };

  // 置顶链接拖拽结束事件处理函数
  const handlePinnedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取所有置顶链接
      const pinnedLinksList = links.filter(link => link.pinned);

      // 找到被拖拽元素和目标元素的索引
      const activeIndex = pinnedLinksList.findIndex(link => link.id === active.id);
      const overIndex = pinnedLinksList.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序置顶链接
        const reorderedPinnedLinks = arrayMove(pinnedLinksList, activeIndex, overIndex);

        // 创建一个映射，存储每个置顶链接的新pinnedOrder
        const pinnedOrderMap = new Map<string, number>();
        reorderedPinnedLinks.forEach((link, index) => {
          pinnedOrderMap.set(link.id, index);
        });

        // 只更新置顶链接的pinnedOrder，不改变任何链接的顺序
        const updatedLinks = links.map(link => {
          if (link.pinned) {
            return {
              ...link,
              pinnedOrder: pinnedOrderMap.get(link.id)
            };
          }
          return link;
        });

        // 按照pinnedOrder重新排序整个链接数组，确保置顶链接的顺序正确
        // 同时保持非置顶链接的相对顺序不变
        updatedLinks.sort((a, b) => {
          // 如果都是置顶链接，按照pinnedOrder排序
          if (a.pinned && b.pinned) {
            return (a.pinnedOrder || 0) - (b.pinnedOrder || 0);
          }
          // 如果只有一个是置顶链接，置顶链接排在前面
          if (a.pinned) return -1;
          if (b.pinned) return 1;
          // 如果都不是置顶链接，保持原位置不变（按照order或createdAt排序）
          const aOrder = a.order !== undefined ? a.order : a.createdAt;
          const bOrder = b.order !== undefined ? b.order : b.createdAt;
          return bOrder - aOrder;
        });

        updateData(updatedLinks, categories);
      }
    }
  };

  // 开始排序
  const startSorting = (categoryId: string) => {
    setIsSortingMode(categoryId);
  };

  // 保存排序
  const saveSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingMode(null);
  };

  // 取消排序
  const cancelSorting = () => {
    setIsSortingMode(null);
  };

  // 保存置顶链接排序
  const savePinnedSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingPinned(false);
  };

  // 取消置顶链接排序
  const cancelPinnedSorting = () => {
    setIsSortingPinned(false);
  };

  // 设置dnd-kit的传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteLink = (id: string) => {
    const linkToDelete = links.find(l => l.id === id);
    if (linkToDelete && isCategoryLocked(linkToDelete.categoryId) && !authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const linkToToggle = links.find(l => l.id === id);
    if (!linkToToggle) return;

    if (isCategoryLocked(linkToToggle.categoryId) && !authToken) { setIsAuthOpen(true); return; }

    // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
    // 如果是取消置顶，则清除pinnedOrder
    const updated = links.map(l => {
      if (l.id === id) {
        const isPinned = !l.pinned;
        return {
          ...l,
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
        };
      }
      return l;
    });

    updateData(updated, categories);
  };

  const handleSaveAIConfig = async (config: AIConfig, newSiteSettings?: any) => {
    setAiConfig(config);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));

    if (newSiteSettings) {
      setSiteSettings(newSiteSettings);
      localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
    }

    if (authToken) {
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'ai',
            config: config
          })
        });

        if (!response.ok) {
          console.error('Failed to save AI config to KV:', response.statusText);
        }
      } catch (error) {
        console.error('Error saving AI config to KV:', error);
      }

      if (newSiteSettings) {
        try {
          const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-password': authToken
            },
            body: JSON.stringify({
              saveConfig: 'website',
              config: newSiteSettings
            })
          });

          if (!response.ok) {
            console.error('Failed to save website config to KV:', response.statusText);
          }
        } catch (error) {
          console.error('Error saving website config to KV:', error);
        }
      }
    }
  };

  const handleRestoreAIConfig = async (config: AIConfig) => {
    setAiConfig(config);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));

    // 同时保存到KV空间
    if (authToken) {
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'ai',
            config: config
          })
        });

        if (!response.ok) {
          console.error('Failed to restore AI config to KV:', response.statusText);
        }
      } catch (error) {
        console.error('Error restoring AI config to KV:', error);
      }
    }
  };

  // --- Category Management & Security ---

  // 获取分组的完整路径
  const getCategoryPath = (cat: Category): string => {
    const ancestors = getCategoryAncestors(categories, cat.id);
    const parts = [...ancestors.map(a => a.uri), cat.uri];
    return '/' + parts.join('/');
  };

  // 切换分组展开/折叠
  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  // 计算分类的锁定信息（用于显示不同的锁图标）-- 返回“保护来源”信息（基于 inheritPassword 链式继承规则）
  const getLockInfo = (catId?: string | null): { type: 'none' | 'direct' | 'inherited'; sourceName?: string } => {
    if (!catId || catId === 'all') return { type: 'none' };

    const cat = categories.find(c => c.id === catId);
    if (!cat) return { type: 'none' };

    // 如果当前分组有自己的密码，视为直接保护
    if (cat.password) return { type: 'direct' };

    // 仅当当前分组启用了 inheritPassword 时，沿祖先链按“逐级继承”规则查找带密码的祖先
    if (!cat.inheritPassword) return { type: 'none' };

    let current: Category | undefined = cat;
    while (current && current.parentId) {
      const parent = categories.find(c => c.id === current!.parentId);
      if (!parent) break;

      if (parent.password) return { type: 'inherited', sourceName: parent.name };

      // 如果父级未设置 inheritPassword，则继承链在此终止
      if (!parent.inheritPassword) break;

      current = parent;
    }

    return { type: 'none' };
  };

  const handleCategoryClick = (cat: Category) => {
    // 管理员已登录时，跳过密码验证
    if (authToken) {
      const path = getCategoryPath(cat);
      navigate(path);
      setSidebarOpen(false);
      return;
    }
    // If category has password and is NOT unlocked
    if (cat.password && !unlockedCategoryIds.has(cat.id)) {
      setCatAuthModalData(cat);
      setSidebarOpen(false);
      return;
    }
    // 使用路由导航
    const path = getCategoryPath(cat);
    navigate(path);
    setSidebarOpen(false);
  };

  const handleUnlockCategory = (catId: string, unlockedAncestorIds?: string[]) => {
    setUnlockedCategoryIds(prev => {
      const newSet = new Set(prev);
      newSet.add(catId);
      // 如果有批量解锁的祖先分组，也一并解锁
      if (unlockedAncestorIds) {
        unlockedAncestorIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
    // 解锁后导航到该分组
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      const path = getCategoryPath(cat);
      navigate(path);
    }
  };

  const handleUpdateCategories = (newCats: Category[]) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    updateData(links, newCats);
  };

  const handleDeleteCategory = (catId: string, mode: DeleteMode) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    // 防止删除"CloudNav"系统分类
    if (catId === 'cloudnav') {
      alert('"CloudNav"系统分类不能被删除');
      return;
    }

    const categoryToDelete = categories.find(c => c.id === catId);
    if (!categoryToDelete) return;

    let newCats: Category[];
    let newLinks: LinkItem[];

    if (mode === 'all') {
      // 删除所有数据：递归删除分类、所有子分类及其书签
      const getDescendantIds = (parentId: string): string[] => {
        const childIds = categories.filter(c => c.parentId === parentId).map(c => c.id);
        const descendantIds: string[] = [...childIds];
        childIds.forEach(childId => {
          descendantIds.push(...getDescendantIds(childId));
        });
        return descendantIds;
      };

      const idsToDelete = new Set([catId, ...getDescendantIds(catId)]);
      newCats = categories.filter(c => !idsToDelete.has(c.id));
      newLinks = links.filter(l => !idsToDelete.has(l.categoryId));
    } else {
      // 仅删除文件夹：删除分类和直属书签，子分类移动到父级
      const parentId = categoryToDelete.parentId;

      // 移动子分类到被删除分类的父级
      newCats = categories.map(c => {
        if (c.parentId === catId) {
          return { ...c, parentId: parentId };
        }
        return c;
      }).filter(c => c.id !== catId);

      // 删除该分类下的直属书签
      newLinks = links.filter(l => l.categoryId !== catId);
    }

    // 检查是否存在"CloudNav"分类，如果不存在则创建它
    if (!newCats.some(c => c.id === 'cloudnav')) {
      newCats = [
        { id: 'cloudnav', name: 'CloudNav', icon: 'Globe', uri: 'cloudnav' },
        ...newCats
      ];
    }

    updateData(newLinks, newCats);
  };

  // --- WebDAV Config ---
  const handleSaveWebDavConfig = (config: WebDavConfig) => {
    setWebDavConfig(config);
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  // 搜索源选择弹出窗口状态
  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理弹出窗口显示/隐藏逻辑
  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      // 如果图标或弹出窗口被悬停，清除隐藏定时器并显示弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      // 如果图标和弹出窗口都没有被悬停，设置一个延迟隐藏弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }

    // 清理函数
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  // 处理搜索源选择
  const handleSearchSourceSelect = async (source: ExternalSearchSource) => {
    // 更新选中的搜索源
    setSelectedSearchSource(source);

    // 保存选中的搜索源到KV空间
    await handleSaveSearchConfig(externalSearchSources, searchMode, source);

    if (searchQuery.trim()) {
      const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
      window.open(searchUrl, '_blank');
    }
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  };

  // --- Search Config ---
  const handleSaveSearchConfig = async (sources: ExternalSearchSource[], mode: SearchMode, selectedSource?: ExternalSearchSource | null) => {
    const searchConfig: SearchConfig = {
      mode,
      externalSources: sources,
      selectedSource: selectedSource !== undefined ? selectedSource : selectedSearchSource
    };

    setExternalSearchSources(sources);
    setSearchMode(mode);
    if (selectedSource !== undefined) {
      setSelectedSearchSource(selectedSource);
    }

    // 只保存到KV空间（搜索配置允许无密码访问）
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // 如果有认证令牌，添加认证头
      if (authToken) {
        headers['x-auth-password'] = authToken;
      }

      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          saveConfig: 'search',
          config: searchConfig
        })
      });

      if (!response.ok) {
        console.error('Failed to save search config to KV:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving search config to KV:', error);
    }
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);

    // 如果切换到外部搜索模式且搜索源列表为空，自动加载默认搜索源
    if (mode === 'external' && externalSearchSources.length === 0) {
      const defaultSources: ExternalSearchSource[] = [
        {
          id: 'bing',
          name: '必应',
          url: 'https://www.bing.com/search?q={query}',
          icon: 'Search',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'google',
          name: 'Google',
          url: 'https://www.google.com/search?q={query}',
          icon: 'Search',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'baidu',
          name: '百度',
          url: 'https://www.baidu.com/s?wd={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'sogou',
          name: '搜狗',
          url: 'https://www.sogou.com/web?query={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'yandex',
          name: 'Yandex',
          url: 'https://yandex.com/search/?text={query}',
          icon: 'Globe',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'github',
          name: 'GitHub',
          url: 'https://github.com/search?q={query}',
          icon: 'Github',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'linuxdo',
          name: 'Linux.do',
          url: 'https://linux.do/search?q={query}',
          icon: 'Terminal',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'bilibili',
          name: 'B站',
          url: 'https://search.bilibili.com/all?keyword={query}',
          icon: 'Play',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'youtube',
          name: 'YouTube',
          url: 'https://www.youtube.com/results?search_query={query}',
          icon: 'Video',
          enabled: true,
          createdAt: Date.now()
        },
        {
          id: 'wikipedia',
          name: '维基',
          url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
          icon: 'BookOpen',
          enabled: true,
          createdAt: Date.now()
        }
      ];

      // 保存默认搜索源到状态和KV空间
      handleSaveSearchConfig(defaultSources, mode);
    } else {
      handleSaveSearchConfig(externalSearchSources, mode);
    }
  };

  const handleExternalSearch = () => {
    if (searchQuery.trim() && searchMode === 'external') {
      // 如果搜索源列表为空，自动加载默认搜索源
      if (externalSearchSources.length === 0) {
        const defaultSources: ExternalSearchSource[] = [
          {
            id: 'bing',
            name: '必应',
            url: 'https://www.bing.com/search?q={query}',
            icon: 'Search',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'google',
            name: 'Google',
            url: 'https://www.google.com/search?q={query}',
            icon: 'Search',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'baidu',
            name: '百度',
            url: 'https://www.baidu.com/s?wd={query}',
            icon: 'Globe',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'sogou',
            name: '搜狗',
            url: 'https://www.sogou.com/web?query={query}',
            icon: 'Globe',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'yandex',
            name: 'Yandex',
            url: 'https://yandex.com/search/?text={query}',
            icon: 'Globe',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'github',
            name: 'GitHub',
            url: 'https://github.com/search?q={query}',
            icon: 'Github',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'linuxdo',
            name: 'Linux.do',
            url: 'https://linux.do/search?q={query}',
            icon: 'Terminal',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'bilibili',
            name: 'B站',
            url: 'https://search.bilibili.com/all?keyword={query}',
            icon: 'Play',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'youtube',
            name: 'YouTube',
            url: 'https://www.youtube.com/results?search_query={query}',
            icon: 'Video',
            enabled: true,
            createdAt: Date.now()
          },
          {
            id: 'wikipedia',
            name: '维基',
            url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
            icon: 'BookOpen',
            enabled: true,
            createdAt: Date.now()
          }
        ];

        // 保存默认搜索源到状态和KV空间
        handleSaveSearchConfig(defaultSources, 'external');

        // 使用第一个默认搜索源立即执行搜索
        const searchUrl = defaultSources[0].url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
        return;
      }

      // 如果有选中的搜索源，使用选中的搜索源；否则使用第一个启用的搜索源
      let source = selectedSearchSource;
      if (!source) {
        const enabledSources = externalSearchSources.filter(s => s.enabled);
        if (enabledSources.length > 0) {
          source = enabledSources[0];
        }
      }

      if (source) {
        const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
      }
    }
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
    updateData(restoredLinks, restoredCategories);
    setIsBackupModalOpen(false);
  };

  const handleRestoreSearchConfig = (restoredSearchConfig: SearchConfig) => {
    handleSaveSearchConfig(restoredSearchConfig.externalSources, restoredSearchConfig.mode);
  };

  // --- Filtering & Memo ---

  // Helper to check if a category is "Locked" (Has password AND not unlocked)
  // Password inheritance: only inherit if current category enables inheritPassword and the inheritance chain is continuous
  const isCategoryLocked = (catId: string): boolean => {
    // 管理员已登录时，所有分组都视为已解锁
    if (authToken) return false;

    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;

    // 如果当前分组已解锁，直接返回 false
    if (unlockedCategoryIds.has(catId)) return false;

    // 如果当前分组设置了密码，则视为锁定
    if (cat.password) return true;

    // 仅当当前分组启用了 inheritPassword 时，沿祖先链按“逐级继承”规则查找带密码的祖先
    if (!cat.inheritPassword) return false;

    let current: Category | undefined = cat;
    while (current && current.parentId) {
      const parent = categories.find(c => c.id === current!.parentId);
      if (!parent) break;

      if (parent.password) {
        // 如果祖先已被解锁，则视为未被锁定
        if (unlockedCategoryIds.has(parent.id)) return false;
        return true;
      }

      // 如果父级未设置 inheritPassword，则继承链在此终止
      if (!parent.inheritPassword) break;

      current = parent;
    }

    return false;
  };

  // 检查某个分类是否需要管理员认证（考虑继承规则）
  const requiresAuthForCategory = (catId?: string | null): boolean => {
    if (!catId || catId === 'all') return false;
    return isCategoryLocked(catId);
  };

  const pinnedLinks = useMemo(() => {
    // Don't show pinned links if they belong to a locked category
    const filteredPinnedLinks = links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
    // 按照pinnedOrder字段排序，如果没有pinnedOrder字段则按创建时间排序
    return filteredPinnedLinks.sort((a, b) => {
      // 如果有pinnedOrder字段，则使用pinnedOrder排序
      if (a.pinnedOrder !== undefined && b.pinnedOrder !== undefined) {
        return a.pinnedOrder - b.pinnedOrder;
      }
      // 如果只有一个有pinnedOrder字段，有pinnedOrder的排在前面
      if (a.pinnedOrder !== undefined) return -1;
      if (b.pinnedOrder !== undefined) return 1;
      // 如果都没有pinnedOrder字段，则按创建时间排序
      return a.createdAt - b.createdAt;
    });
  }, [links, categories, unlockedCategoryIds]);

  const displayedLinks = useMemo(() => {
    let result = links;

    // Security Filter: Always hide links from locked categories
    result = result.filter(l => !isCategoryLocked(l.categoryId));

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter(l => l.categoryId === selectedCategory);
    }

    // 按照order字段排序，如果没有order字段则按创建时间排序
    // 修改排序逻辑：order值越大排在越前面，新增的卡片order值最大，会排在最前面
    // 我们需要反转这个排序，让新增的卡片(order值最大)排在最后面
    return result.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      // 改为升序排序，这样order值小(旧卡片)的排在前面，order值大(新卡片)的排在后面
      return aOrder - bOrder;
    });
  }, [links, selectedCategory, searchQuery, categories, unlockedCategoryIds]);


  // --- Render Components ---

  // 创建可排序的链接卡片组件
  const SortableLinkCard = ({ link }: { link: LinkItem }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: link.id });

    // 根据视图模式决定卡片样式
    const isDetailedView = siteSettings.cardStyle === 'detailed';

    // 可调节的展示设置（来自 SiteSettings）
    const titleFontSize = siteSettings.tagTitleFontSize ?? 16;
    const iconSize = siteSettings.titleIconSize ?? 32;
    const iconInnerSize = Math.max(12, Math.round(iconSize * 0.6));
    const isStacked = siteSettings.tagDisplayMode === 'stacked';

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 'auto',
      minWidth: siteSettings.tagCardMinWidth ? `${siteSettings.tagCardMinWidth}px` : undefined,
    };

    return (
      <div
        ref={setNodeRef}
        data-link-id={link.id}
        data-autofit-id={link.id === 'autofit_test_long' ? 'autofit_test_long' : undefined}
        style={style}
        className={`group relative transition-all duration-200 cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden hover:shadow-lg hover:shadow-green-100/50 dark:hover:shadow-green-900/20 ${isSortingMode || isSortingPinned
          ? 'bg-green-20 dark:bg-green-900/30 border-green-200 dark:border-green-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          } ${isDragging ? 'shadow-2xl scale-105' : ''} ${isDetailedView
            ? 'flex flex-col rounded-2xl border shadow-sm p-4 min-h-[100px] hover:border-green-400 dark:hover:border-green-500'
            : 'flex items-center rounded-xl border shadow-sm hover:border-green-300 dark:hover:border-green-600'
          }`}
        {...attributes}
        {...listeners}
      >
        {/* 链接内容 - 移除a标签，改为div防止点击跳转 */}
        <div className={`flex flex-1 min-w-0 overflow-hidden ${isDetailedView ? 'flex-col' : (isStacked ? 'flex-col' : 'items-center gap-3')}`}>

          {/* 第一行 / 或 堆叠模式：图标和标题 */}
          <div className={`${isStacked ? 'flex flex-col items-center gap-1 mb-2' : `flex items-center gap-3 mb-2 ${isDetailedView ? '' : 'w-full'}`}`}>
            {/* Icon */}
            <div
              className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${isDetailedView ? 'rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800' : 'rounded-lg bg-slate-50 dark:bg-slate-700'}`}
              style={{ width: iconSize, height: iconSize, minWidth: iconSize, minHeight: iconSize }}
            >
              {link.icon ? (
                <img src={link.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(12, Math.round(iconInnerSize * 0.9)) }}>{link.title.charAt(0)}</span>
              )}
            </div>

            {/* 标题 */}
            <h3 className={`flex-1 text-slate-900 dark:text-slate-100 ${isDetailedView ? '' : 'text-sm font-medium text-slate-800 dark:text-slate-200'}`} title={link.title}>
              <AutoFitText maxFontSize={titleFontSize} minFontSize={12} className="truncate overflow-hidden text-ellipsis">
                {link.title}
              </AutoFitText>
            </h3>
          </div>

          {/* 第二行：描述文字 */}
          {isDetailedView && link.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
              {link.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderLinkCard = (link: LinkItem) => {
    const isSelected = selectedLinks.has(link.id);

    // 根据视图模式决定卡片样式
    const isDetailedView = siteSettings.cardStyle === 'detailed';

    // 可调节的展示设置（来自 SiteSettings）
    const titleFontSize = siteSettings.tagTitleFontSize ?? 16;
    const iconSize = siteSettings.titleIconSize ?? 32;
    const iconInnerSize = Math.max(12, Math.round(iconSize * 0.6));
    const isStacked = siteSettings.tagDisplayMode === 'stacked';

    return (
      <div
        key={link.id}
        data-link-id={link.id}
        data-autofit-id={link.id === 'autofit_test_long' ? 'autofit_test_long' : undefined}
        style={{ minWidth: siteSettings.tagCardMinWidth ? `${siteSettings.tagCardMinWidth}px` : undefined }}
        className={`group relative transition-all duration-200 hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 ${isSelected
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-slate-200 dark:border-slate-700'
          } ${isBatchEditMode ? 'cursor-pointer' : ''} ${isDetailedView
            ? 'flex flex-col rounded-2xl border shadow-sm p-1 min-h-[100px] hover:border-blue-400 dark:hover:border-blue-500'
            : 'flex items-center justify-between rounded-xl border shadow-sm p-1 hover:border-blue-300 dark:hover:border-blue-600'
          }`}
        onClick={() => isBatchEditMode && toggleLinkSelection(link.id)}
        onContextMenu={(e) => handleContextMenu(e, link)}
      >
        {/* 链接内容 - 在批量编辑模式下不使用a标签 */}
        {isBatchEditMode ? (
          <div className={`flex flex-1 min-w-0 overflow-hidden h-full ${isDetailedView ? 'flex-col' : 'items-center'
            }`}>
            {/* 第一行 / 或 堆叠模式：图标和标题 */}
            <div className={`${isStacked ? 'flex flex-col items-center gap-1 w-full' : 'flex items-center gap-3 w-full'}`}>
              {/* Icon */}
              <div
                className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${isDetailedView ? 'rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800' : 'rounded-lg bg-slate-50 dark:bg-slate-700'}`}
                style={{ width: iconSize, height: iconSize, minWidth: iconSize, minHeight: iconSize }}
              >
                {link.icon ? (
                  <img src={link.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(12, Math.round(iconInnerSize * 0.9)) }}>{link.title.charAt(0)}</span>
                )}
              </div>

              {/* 标题 */}
              <h3 className={`flex-1 text-slate-900 dark:text-slate-100 ${isDetailedView ? '' : 'text-sm font-medium text-slate-800 dark:text-slate-200'}`} title={link.title}>
                <AutoFitText maxFontSize={titleFontSize} minFontSize={12} className="truncate overflow-hidden text-ellipsis">
                  {link.title}
                </AutoFitText>
              </h3>
            </div>

            {/* 第二行：描述文字 */}
            {isDetailedView && link.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                {link.description}
              </p>
            )}
          </div>
        ) : (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-1 min-w-0 overflow-hidden h-full ${isDetailedView ? 'flex-col' : 'items-center'
              }`}
            title={isDetailedView ? link.url : (link.description || link.url)} // 详情版视图只显示URL作为tooltip
          >
            {/* 第一行 / 或 堆叠模式：图标和标题 */}
            <div className={`${isStacked ? 'flex flex-col items-center gap-1 w-full' : 'flex items-center gap-3 w-full'}`}>
              {/* Icon */}
              <div
                className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${isDetailedView ? 'rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800' : 'rounded-lg bg-slate-50 dark:bg-slate-700'}`}
                style={{ width: iconSize, height: iconSize, minWidth: iconSize, minHeight: iconSize }}
              >
                {link.icon ? (
                  <img src={link.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(12, Math.round(iconInnerSize * 0.9)) }}>{link.title.charAt(0)}</span>
                )}
              </div>

              {/* 标题 */}
              <h3 className={`flex-1 text-slate-800 dark:text-slate-200 ${isDetailedView ? '' : 'text-sm font-medium'}`} title={link.title}>
                <AutoFitText maxFontSize={titleFontSize} minFontSize={6} className="truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {link.title}
                </AutoFitText>
              </h3>
            </div>

            {/* 第二行：描述文字 */}
            {isDetailedView && link.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                {link.description}
              </p>
            )}
            {!isDetailedView && link.description && (
              <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[200px] bg-black text-white text-xs p-2 rounded opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all z-20 pointer-events-none truncate">
                {link.description}
              </div>
            )}
          </a>
        )}

        {/* Hover Actions (Absolute Right) - 在批量编辑模式下隐藏 */}
        {!isBatchEditMode && (
          <div className={`flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 dark:bg-blue-900/20 backdrop-blur-sm rounded-md p-1 absolute ${isDetailedView ? 'top-3 right-3' : 'top-1/2 -translate-y-1/2 right-2'
            }`}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLink(link); setIsModalOpen(true); }}
              className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              title="编辑"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.65-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.32-.07.64-.07.97c0 .33.03.65.07.97l-2.11 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.63Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  const showSidebar = isLarge ? !sidebarManualHidden : sidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {/* 认证遮罩层 - 仅在当前视图需要认证时显示（允许访问首页与公开目录） */}
      {requiresAuth && !authToken && requiresAuthForCategory(selectedCategory) && !catAuthModalData && !suppressAuthOverlay && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                需要身份验证
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                此目录受保护，请输入管理员密码以继续
              </p>
            </div>
            <AuthModal isOpen={true} onLogin={handleLogin} onClose={closeAuthOverlay} />
          </div>
        </div>
      )}

      {/* 主要内容 - 允许访问公开目录与首页（即使站点包含受保护的内容） */}
      <>
        <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} onClose={() => setIsAuthOpen(false)} />
        <CategoryAuthModal
          isOpen={!!catAuthModalData}
          category={catAuthModalData}
          categories={categories}
          onClose={handleCategoryAuthClose}
          onUnlock={handleUnlockCategory}
          onRequestAdminLogin={() => { handleCategoryAuthClose(); openLoginModal({ keepCategory: true }); }}
        />

        <CategoryManagerModal
          isOpen={isCatManagerOpen}
          onClose={() => setIsCatManagerOpen(false)}
          categories={categories}
          onUpdateCategories={handleUpdateCategories}
          onDeleteCategory={handleDeleteCategory}
          onVerifyPassword={authToken ? undefined : handleCategoryActionAuth}
        />

        <BackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          links={links}
          categories={categories}
          onRestore={handleRestoreBackup}
          webDavConfig={webDavConfig}
          onSaveWebDavConfig={handleSaveWebDavConfig}
          searchConfig={{ mode: searchMode, externalSources: externalSearchSources }}
          onRestoreSearchConfig={handleRestoreSearchConfig}
          aiConfig={aiConfig}
          onRestoreAIConfig={handleRestoreAIConfig}
        />

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingLinks={links}
          categories={categories}
          onImport={handleImportConfirm}
          onImportSearchConfig={handleRestoreSearchConfig}
          onImportAIConfig={handleRestoreAIConfig}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          config={aiConfig}
          siteSettings={siteSettings}
          onSave={handleSaveAIConfig}
          links={links}
          categories={categories}
          onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
          authToken={authToken}
        />

        <SearchConfigModal
          isOpen={isSearchConfigModalOpen}
          onClose={() => setIsSearchConfigModalOpen(false)}
          sources={externalSearchSources}
          onSave={(sources) => handleSaveSearchConfig(sources, searchMode)}
        />

        {/* 是否显示侧边栏（桌面受 sidebarManualHidden 控制，移动受 sidebarOpen 控制） */}
        {(() => {
          // 仅在渲染时计算，避免重复代码
          // 当为 lg 及以上时：根据手动隐藏决定；当为移动时：根据 sidebarOpen 决定
          const showSidebar = isLarge ? !sidebarManualHidden : sidebarOpen;
          return null; // 这里只是占位，真正使用 showSidebar 在后续 JSX 中
        })()}

        {/* Sidebar Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'} ${isLarge && sidebarManualHidden ? 'lg:hidden' : ''}
        `}
        >
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              {siteSettings.navTitle || 'CloudNav'}
            </span>
            {isLarge && !sidebarManualHidden && (
              <button
                onClick={() => setSidebarManualHidden(true)}
                className="ml-auto p-1 text-slate-400 hover:text-slate-700 rounded"
                title="隐藏侧边栏"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide flex flex-col">
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedCategory === 'all'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>网站直达</span>
            </Link>

            <Link
              to="/top"
              onClick={() => setSidebarOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedCategory === 'pinned'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <div className="p-1"><Pin size={18} /></div>
              <span>置顶收藏</span>
            </Link>

            <div className="flex items-center justify-between pt-4 pb-2 px-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
              {authToken ? (
                <button
                  onClick={() => setIsCatManagerOpen(true)}
                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="管理分类"
                >
                  <Settings size={14} />
                </button>
              ) : null}
            </div>

            {/* 渲染嵌套分组树（仅显示当前可访问的分组） */}
            {categoryTree.filter(node => !isCategoryLocked(node.id)).map(node => (
              <CategoryTreeItem
                key={node.id}
                node={node}
                selectedCategory={selectedCategory}
                unlockedCategoryIds={unlockedCategoryIds}
                expandedCategories={expandedCategories}
                onToggleExpand={toggleCategoryExpand}
                onCategoryClick={handleCategoryClick}
                getCategoryPath={getCategoryPath}
                setSidebarOpen={setSidebarOpen}
                getLockInfo={getLockInfo}
                isCategoryLocked={isCategoryLocked}
                isAuthenticated={!!authToken}
              />
            ))}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">

            {authToken ? (
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                  className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                  title="导入书签"
                >
                  <Upload size={14} />
                  <span>导入</span>
                </button>

                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }}
                  className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                  title="备份与恢复"
                >
                  <CloudCog size={14} />
                  <span>备份</span>
                </button>

                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsSettingsModalOpen(true); }}
                  className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                  title="AI 设置"
                >
                  <Settings size={14} />
                  <span>设置</span>
                </button>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs px-2 mt-2">
              <div className="flex items-center gap-1 text-slate-400">
                {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                {authToken ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
              </div>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Fork this project on GitHub"
              >
                <GitFork size={14} />
                <span>Fork 项目 v1.7</span>
              </a>
            </div>
          </div>
        </aside>

        {isLarge && sidebarManualHidden && (
          <button
            onClick={() => setSidebarManualHidden(false)}
            title="显示侧边栏"
            className="fixed left-0 top-20 z-40 p-2 rounded-r-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">

          {/* Header */}
          <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-4 flex-1">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
                <Menu size={24} />
              </button>

              {/* 搜索模式切换 + 搜索框 */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* 移动端搜索图标 - 仅在手机端显示，平板端隐藏 */}
                <button
                  onClick={() => {
                    setIsMobileSearchOpen(!isMobileSearchOpen);
                    // 手机端点击搜索图标时默认使用站外搜索
                    if (searchMode !== 'external') {
                      handleSearchModeChange('external');
                    }
                  }}
                  className="sm:flex md:hidden lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                  title="搜索"
                >
                  <Search size={20} />
                </button>

                {/* 搜索模式切换 - 平板端和桌面端显示，手机端隐藏 */}
                <div className="hidden sm:hidden md:flex lg:flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1">
                    <button
                      onClick={() => handleSearchModeChange('internal')}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center justify-center min-h-[24px] min-w-[40px] ${searchMode === 'internal'
                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                      title="站内搜索"
                    >
                      站内
                    </button>
                    <button
                      onClick={() => handleSearchModeChange('external')}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center justify-center min-h-[24px] min-w-[40px] ${searchMode === 'external'
                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                      title="站外搜索"
                    >
                      站外
                    </button>
                  </div>

                  {/* 搜索配置管理按钮 */}
                  {searchMode === 'external' && (
                    <button
                      onClick={() => setIsSearchConfigModalOpen(true)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                      title="管理搜索源"
                    >
                      <Settings size={14} />
                    </button>
                  )}
                </div>

                {/* 搜索框 */}
                <div className={`relative w-full max-w-lg ${isMobileSearchOpen ? 'block' : 'hidden'} sm:block`}>
                  {/* 搜索源选择弹出窗口 */}
                  {searchMode === 'external' && showSearchSourcePopup && (
                    <div
                      className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3 z-50"
                      onMouseEnter={() => setIsPopupHovered(true)}
                      onMouseLeave={() => setIsPopupHovered(false)}
                    >
                      <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                        {externalSearchSources
                          .filter(source => source.enabled)
                          .map((source, index) => (
                            <button
                              key={index}
                              onClick={() => handleSearchSourceSelect(source)}
                              onMouseEnter={() => setHoveredSearchSource(source)}
                              onMouseLeave={() => setHoveredSearchSource(null)}
                              className="px-2 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1 justify-center"
                            >
                              <img
                                src={`https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`}
                                alt={source.name}
                                className="w-4 h-4"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg==';
                                }}
                              />
                              <span className="truncate hidden sm:inline">{source.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 搜索图标 */}
                  <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                    onMouseEnter={() => searchMode === 'external' && setIsIconHovered(true)}
                    onMouseLeave={() => setIsIconHovered(false)}
                    onClick={() => {
                      // 移动端点击事件：显示搜索源选择窗口
                      if (searchMode === 'external') {
                        setShowSearchSourcePopup(!showSearchSourcePopup);
                      }
                    }}
                  >
                    {searchMode === 'internal' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search">
                        <path d="m21 21-4.35-4.35"></path>
                        <circle cx="11" cy="11" r="8"></circle>
                      </svg>
                    ) : (hoveredSearchSource || selectedSearchSource) ? (
                      <img
                        src={`https://www.faviconextractor.com/favicon/${new URL((hoveredSearchSource || selectedSearchSource)!.url).hostname}?larger=true`}
                        alt={(hoveredSearchSource || selectedSearchSource)!.name}
                        className="w-4 h-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <Search size={16} />
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={
                      searchMode === 'internal'
                        ? "搜索站内内容..."
                        : selectedSearchSource
                          ? `在${selectedSearchSource.name}搜索内容`
                          : "搜索站外内容..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchMode === 'external') {
                        handleExternalSearch();
                      }
                    }}
                    className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700/50 border-none text-sm focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-slate-400 outline-none transition-all"
                    // 移动端优化：防止页面缩放
                    style={{ fontSize: '16px' }}
                    inputMode="search"
                    enterKeyHint="search"
                  />

                  {searchMode === 'external' && searchQuery.trim() && (
                    <button
                      onClick={handleExternalSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-500"
                      title="执行站外搜索"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 视图切换控制器 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
              <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1`}>
                <button
                  onClick={() => handleViewModeChange('simple')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${siteSettings.cardStyle === 'simple'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                  title="简约版视图"
                >
                  简约
                </button>
                <button
                  onClick={() => handleViewModeChange('detailed')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${siteSettings.cardStyle === 'detailed'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                  title="详情版视图"
                >
                  详情
                </button>
              </div>

              {/* 主题切换按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
              <button
                onClick={toggleTheme}
                className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}
                title={themeMode === 'light' ? '亮色模式（点击切换到暗色）' : themeMode === 'dark' ? '暗色模式（点击切换到自动）' : '自动模式（点击切换到亮色）'}
              >
                {themeMode === 'light' ? <Sun size={18} /> : themeMode === 'dark' ? <Moon size={18} /> : <SunMoon size={18} />}
              </button>

              {/* 登录/退出按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
              <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
                {!authToken ? (
                  <button onClick={() => openLoginModal()} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <Cloud size={14} /> <span className="hidden sm:inline">登录</span>
                  </button>
                ) : (
                  <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <LogOut size={14} /> <span className="hidden sm:inline">退出</span>
                  </button>
                )}
              </div>

              {/* 添加按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
              <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
                <button
                  onClick={() => { setEditingLink(undefined); setIsModalOpen(true); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
                >
                  <Plus size={16} /> <span className="hidden sm:inline">添加</span>
                </button>
              </div>
            </div>
          </header>

          {/* Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">

            {/* 1. 置顶收藏页面 /top */}
            {selectedCategory === 'pinned' && !searchQuery && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Pin size={16} className="text-blue-500 fill-blue-500" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      置顶收藏
                    </h2>
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                      {pinnedLinks.length}
                    </span>
                  </div>
                  {isSortingPinned ? (
                    <div className="flex gap-2">
                      <button
                        onClick={savePinnedSorting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                        title="保存顺序"
                      >
                        <Save size={14} />
                        <span>保存顺序</span>
                      </button>
                      <button
                        onClick={cancelPinnedSorting}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                        title="取消排序"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSortingPinned(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors"
                      title="排序"
                    >
                      <GripVertical size={14} />
                      <span>排序</span>
                    </button>
                  )}
                </div>
                {pinnedLinks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <Pin size={40} className="opacity-30 mb-4" />
                    <p>暂无置顶收藏</p>
                    <p className="text-sm mt-2">右键点击任意链接可将其置顶</p>
                  </div>
                ) : isSortingPinned ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragEnd={handlePinnedDragEnd}
                  >
                    <SortableContext
                      items={pinnedLinks.map(link => link.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                        {pinnedLinks.map(link => (
                          <SortableLinkCard key={link.id} link={link} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                    {pinnedLinks.map(link => renderLinkCard(link))}
                  </div>
                )}
              </section>
            )}

            {/* 2. 网站直达首页 - 按分组展示所有有访问权限的标签 */}
            {selectedCategory === 'all' && !searchQuery && (
              <>
                {categories
                  .filter(cat => !isCategoryLocked(cat.id))
                  .map(cat => {
                    const categoryLinks = links.filter(l =>
                      l.categoryId === cat.id && !isCategoryLocked(l.categoryId)
                    );
                    if (categoryLinks.length === 0) return null;
                    return (
                      <section key={cat.id}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Icon name={cat.icon} size={16} className="text-blue-500" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {cat.name}
                            </h2>
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                              {categoryLinks.length}
                            </span>
                          </div>
                          <Link
                            to={getCategoryPath(cat)}
                            className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                          >
                            查看全部
                          </Link>
                        </div>
                        <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                          {categoryLinks.slice(0, 12).map(link => renderLinkCard(link))}
                        </div>
                      </section>
                    );
                  })}
                {categories.filter(cat => !isCategoryLocked(cat.id)).every(cat =>
                  links.filter(l => l.categoryId === cat.id).length === 0
                ) && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      <Icon name="LayoutGrid" size={40} className="opacity-30 mb-4" />
                      <p>暂无可访问的链接</p>
                      <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-500 hover:underline">添加一个?</button>
                    </div>
                  )}
              </>
            )}

            {/* 3. Main Grid - 分类页面和搜索结果 */}
            {(selectedCategory !== 'all' && selectedCategory !== 'pinned') || searchQuery ? (
              <section>
                {(!pinnedLinks.length && !searchQuery && selectedCategory === 'all') && (
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-bold">早安 👋</h1>
                      <p className="text-sm opacity-90 mt-1">
                        {links.length} 个链接 · {categories.length} 个分类
                      </p>
                    </div>
                    <Icon name="Compass" size={48} className="opacity-20" />
                  </div>
                )}

                {/* 搜索结果显示 */}
                {searchQuery ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        搜索结果
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                          {displayedLinks.length}
                        </span>
                      </h2>
                    </div>
                    {displayedLinks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <Search size={40} className="opacity-30 mb-4" />
                        <p>没有找到相关内容</p>
                      </div>
                    ) : (
                      <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                        {displayedLinks.map(link => renderLinkCard(link))}
                      </div>
                    )}
                  </>
                ) : (
                  /* 分类页面显示 - 类似首页布局 */
                  (() => {
                    const currentCat = categories.find(c => c.id === selectedCategory);
                    const childCategories = categories.filter(c => c.parentId === selectedCategory && !isCategoryLocked(c.id));
                    const directLinks = links.filter(l => l.categoryId === selectedCategory && !isCategoryLocked(l.categoryId));
                    const hasChildContent = childCategories.length > 0 || directLinks.length > 0;

                    // 如果分类被锁定
                    if (isCategoryLocked(selectedCategory)) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                          <Lock size={40} className="text-amber-400 mb-4" />
                          <p>该目录已锁定</p>
                          <button onClick={() => setCatAuthModalData(categories.find(c => c.id === selectedCategory) || null)} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg">输入密码解锁</button>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* 当前分类标题和操作按钮 */}
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            {currentCat?.name}
                            {(() => {
                              const lock = getLockInfo(selectedCategory);
                              const lockedNow = isCategoryLocked(selectedCategory);
                              if (lock.type === 'direct') return <span title="受保护（需要密码）"><Lock size={14} className={lockedNow ? 'text-amber-500 ml-2' : 'text-slate-400 ml-2'} /></span>;
                              if (lock.type === 'inherited') return (
                                <span className="ml-2 inline-flex items-center gap-1" title={`受保护（继承自：${lock.sourceName}）`}>
                                  <Lock size={14} className={lockedNow ? 'text-amber-500' : 'text-slate-400'} />
                                  <span className={`inline-flex items-center justify-center rounded-full w-4 h-4 ${lockedNow ? 'border border-amber-500 text-amber-500' : 'border border-slate-400 text-slate-400'} bg-transparent`}><Link2 size={8} /></span>
                                </span>
                              );
                              return null;
                            })()}
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                              {directLinks.length + childCategories.reduce((acc, cat) => acc + links.filter(l => l.categoryId === cat.id).length, 0)}
                            </span>
                          </h2>
                          {!isCategoryLocked(selectedCategory) && (
                            isSortingMode === selectedCategory ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={saveSorting}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                                  title="保存顺序"
                                >
                                  <Save size={14} />
                                  <span>保存顺序</span>
                                </button>
                                <button
                                  onClick={cancelSorting}
                                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                                  title="取消排序"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={toggleBatchEditMode}
                                  className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-medium rounded-full transition-colors ${isBatchEditMode
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                  title={isBatchEditMode ? "退出批量编辑" : "批量编辑"}
                                >
                                  {isBatchEditMode ? '取消' : '批量编辑'}
                                </button>
                                {isBatchEditMode ? (
                                  <>
                                    <button
                                      onClick={handleBatchDelete}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-full transition-colors"
                                      title="批量删除"
                                    >
                                      <Trash2 size={14} />
                                      <span>批量删除</span>
                                    </button>
                                    <button
                                      onClick={handleSelectAll}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                                      title="全选/取消全选"
                                    >
                                      <CheckSquare size={14} />
                                      <span>{selectedLinks.size === displayedLinks.length ? '取消全选' : '全选'}</span>
                                    </button>
                                    <div className="relative group">
                                      <button
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors"
                                        title="批量移动"
                                      >
                                        <Upload size={14} />
                                        <span>批量移动</span>
                                      </button>
                                      <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                        {categories.filter(cat => cat.id !== selectedCategory).map(cat => (
                                          <button
                                            key={cat.id}
                                            onClick={() => handleBatchMove(cat.id)}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg"
                                          >
                                            {cat.name}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => startSorting(selectedCategory)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors"
                                    title="排序"
                                  >
                                    <GripVertical size={14} />
                                    <span>排序</span>
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </div>

                        {/* 子文件夹展示 */}
                        {childCategories.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                              <Icon name="FolderOpen" size={16} className="text-amber-500" />
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                子文件夹
                              </h3>
                              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 rounded-full">
                                {childCategories.length}
                              </span>
                            </div>
                            <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                              {childCategories.map(cat => {
                                const catLinkCount = links.filter(l => l.categoryId === cat.id).length;
                                const subCatCount = categories.filter(c => c.parentId === cat.id).length;
                                return (
                                  <Link
                                    key={cat.id}
                                    to={getCategoryPath(cat)}
                                    className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all ${siteSettings.cardStyle === 'detailed' ? 'min-h-[120px]' : 'min-h-[80px]'
                                      }`}
                                  >
                                    <Icon name={cat.icon || 'Folder'} size={siteSettings.cardStyle === 'detailed' ? 32 : 24} className="text-amber-500 mb-2" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center truncate w-full">
                                      {cat.name}
                                    </span>
                                    <span className="text-xs text-slate-400 mt-1">
                                      {catLinkCount} 链接{subCatCount > 0 ? ` · ${subCatCount} 子文件夹` : ''}
                                    </span>
                                    {cat.password && <Lock size={12} className="absolute top-2 right-2 text-amber-500" />}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 当前分类的直接链接 */}
                        {directLinks.length > 0 && (
                          <div className="mb-6">
                            {childCategories.length > 0 && (
                              <div className="flex items-center gap-2 mb-3">
                                <Icon name="Link" size={16} className="text-blue-500" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                  当前文件夹链接
                                </h3>
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                                  {directLinks.length}
                                </span>
                              </div>
                            )}
                            {isSortingMode === selectedCategory ? (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCorners}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext
                                  items={directLinks.map(link => link.id)}
                                  strategy={rectSortingStrategy}
                                >
                                  <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                                    {directLinks.sort((a, b) => (a.order || 0) - (b.order || 0)).map(link => (
                                      <SortableLinkCard key={link.id} link={link} />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                                {directLinks.sort((a, b) => (a.order || 0) - (b.order || 0)).map(link => renderLinkCard(link))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 子分类的链接（类似首页展示） */}
                        {childCategories.map(cat => {
                          const categoryLinks = links.filter(l => l.categoryId === cat.id && !isCategoryLocked(l.categoryId));
                          if (categoryLinks.length === 0) return null;
                          return (
                            <div key={cat.id} className="mb-6">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Icon name={cat.icon || 'Folder'} size={16} className="text-blue-500" />
                                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    {cat.name}
                                  </h3>
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                                    {categoryLinks.length}
                                  </span>
                                  {cat.password && <Lock size={12} className="text-amber-500" />}
                                </div>
                                <Link
                                  to={getCategoryPath(cat)}
                                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                                >
                                  查看全部
                                </Link>
                              </div>
                              <div className={'grid gap-3 ' + getGridCols(siteSettings.cardStyle, siteSettings.tagCardWidth || 'medium')}>
                                {categoryLinks.slice(0, 12).sort((a, b) => (a.order || 0) - (b.order || 0)).map(link => renderLinkCard(link))}
                              </div>
                            </div>
                          );
                        })}

                        {/* 空状态 */}
                        {!hasChildContent && (
                          <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <Search size={40} className="opacity-30 mb-4" />
                            <p>该文件夹为空</p>
                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-500 hover:underline">添加一个链接?</button>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </section>
            ) : null}
          </div>
        </main>

        <LinkModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
          onSave={editingLink ? handleEditLink : handleAddLink}
          onDelete={editingLink ? handleDeleteLink : undefined}
          categories={categories}
          initialData={editingLink || (prefillLink as LinkItem)}
          aiConfig={aiConfig}
          defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
        />

        {/* 右键菜单 */}
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onCopyLink={copyLinkToClipboard}
          onShowQRCode={showQRCode}
          onEditLink={editLinkFromContextMenu}
          onDeleteLink={deleteLinkFromContextMenu}
          onTogglePin={togglePinFromContextMenu}
        />

        {/* 二维码模态框 */}
        <QRCodeModal
          isOpen={qrCodeModal.isOpen}
          url={qrCodeModal.url || ''}
          title={qrCodeModal.title || ''}
          onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })}
        />
      </>
    </div>
  );
}

export default App;
