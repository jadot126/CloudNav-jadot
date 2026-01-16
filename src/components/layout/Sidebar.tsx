import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, CloudCog, Settings, Loader2, CheckCircle2, AlertCircle, GitFork, ChevronLeft, ChevronRight, ChevronDown, Lock, Link2 } from 'lucide-react';
import Icon from '../Icon';
import { Category, CategoryTreeNode } from '../../types';

// 项目核心仓库地址
const GITHUB_REPO_URL = 'https://github.com/jadot126/CloudNav-jadot';

interface CategoryTreeItemProps {
  node: CategoryTreeNode;
  selectedCategory: string;
  unlockedCategoryIds: Set<string>;
  expandedCategories: Set<string>;
  onToggleExpand: (catId: string) => void;
  onCategoryClick: (cat: Category) => void;
  getCategoryPath: (cat: Category) => string;
  setSidebarOpen: (open: boolean) => void;
  // 可选的锁信息查询回调（由上层传入以支持继承锁的准确判断）
  getLockInfo?: (catId: string) => { type: 'none' | 'direct' | 'inherited'; sourceName?: string };
  // 可选：上层传入的实时锁定判断（优先用于决定是否隐藏分组）
  isCategoryLocked?: (catId: string) => boolean;
  isAuthenticated?: boolean;
}

export function CategoryTreeItem({
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
  // 优先使用上层提供的 getLockInfo（更准确）；否则根据 node 自身字段做保守判断（仅用于显示保护来源）
  const lockInfo = getLockInfo ? getLockInfo(node.id) : (node.password ? { type: 'direct' } : (node.inheritPassword ? { type: 'inherited' } : { type: 'none' }));
  // 当前是否仍然被锁定（由上层的 isCategoryLocked 回调优先判断），否则根据登录/已解锁集合作为回退判断
  const lockedNow = isCategoryLocked ? isCategoryLocked(node.id) : (!isAuthenticated && !unlockedCategoryIds.has(node.id) && (node.password || node.inheritPassword));
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedCategories.has(node.id);
  const isSelected = selectedCategory === node.id;

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
          title={lockInfo.type === 'inherited' ? '已锁定（继承自父分组）' : lockInfo.type === 'direct' ? '已锁定：需要输入密码' : undefined}
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
              <div className="relative" title="已锁定（继承自父分组）">
                <Lock size={14} className={lockedNow ? 'text-amber-500' : 'text-slate-400'} />
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center bg-transparent ${lockedNow ? 'border border-amber-500 text-amber-500' : 'border border-slate-400 text-slate-400'}`}><Link2 size={8} /></span>
              </div>
            )}
          </div>
          <span className="truncate flex-1 text-left text-sm">{node.name}</span>
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
        </button>
      </div>

      {/* 子分组 */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children.filter(child => (isCategoryLocked ? !isCategoryLocked(child.id) : (getLockInfo ? getLockInfo(child.id).type === 'none' : ((!child.password && !child.inheritPassword) || unlockedCategoryIds.has(child.id))))).map(child => (
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

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedCategory: string;
  categoryTree: CategoryTreeNode[];
  unlockedCategoryIds: Set<string>;
  expandedCategories: Set<string>;
  onToggleExpand: (catId: string) => void;
  onCategoryClick: (cat: Category) => void;
  getCategoryPath: (cat: Category) => string;
  onManageCategories: () => void;
  onImport: () => void;
  onBackup: () => void;
  onSettings: () => void;
  syncStatus: 'idle' | 'offline' | 'saving' | 'saved' | 'error';
  isAuthenticated: boolean;
  // 可选：上层传入以便在侧边栏做精确的锁定/继承判断
  getLockInfo?: (catId: string) => { type: 'none' | 'direct' | 'inherited'; sourceName?: string };
  isCategoryLocked?: (catId: string) => boolean;
  navTitle?: string;
}

export function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  selectedCategory,
  categoryTree,
  unlockedCategoryIds,
  expandedCategories,
  onToggleExpand,
  onCategoryClick,
  getCategoryPath,
  onManageCategories,
  onImport,
  onBackup,
  onSettings,
  syncStatus,
  isAuthenticated,
  getLockInfo,
  isCategoryLocked,
  navTitle = 'CloudNav'
}: SidebarProps) {
  // Helper: 是否应该在侧边栏展示该分组（优先使用 isCategoryLocked 回调）
  const nodeIsVisible = (node: CategoryTreeNode) => {
    if (isCategoryLocked) return !isCategoryLocked(node.id);
    if (getLockInfo) {
      const info = getLockInfo(node.id);
      if (info.type === 'none') return true;
      // 如果被标记为受保护，但已被解锁或管理员已登录，也应展示
      if (unlockedCategoryIds.has(node.id) || isAuthenticated) return true;
      return false;
    }
    return ((!node.password && !node.inheritPassword) || unlockedCategoryIds.has(node.id));
  };

  // 手动隐藏（仅对桌面宽度生效），持久化到 localStorage
  const [manualHidden, setManualHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('cloudnav_sidebar_hidden') === 'true'; } catch (e) { return false; }
  });
  const [isLarge, setIsLarge] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  useEffect(() => {
    const onResize = () => setIsLarge(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('cloudnav_sidebar_hidden', manualHidden ? 'true' : 'false'); } catch (e) { }
  }, [manualHidden]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cloudnav_sidebar_hidden') setManualHidden(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const showSidebar = isLarge ? !manualHidden : sidebarOpen;

  return (
    <>
      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
        bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'} ${isLarge && manualHidden ? 'lg:hidden' : ''}
      `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {navTitle}
          </span>
          {isLarge && !manualHidden && (
            <button
              onClick={() => setManualHidden(true)}
              className="ml-auto p-1 text-slate-400 hover:text-slate-700 rounded"
              title="隐藏侧边栏"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Categories List */}
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
            <span>置顶网站</span>
          </Link>

          <div className="flex items-center justify-between pt-4 pb-2 px-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
            {isAuthenticated && (
              <button
                onClick={onManageCategories}
                className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                title="管理分类"
              >
                <Settings size={14} />
              </button>
            )}
          </div>

          {/* 渲染嵌套分组树（基于实时锁定状态只显示可访问的分组） */}
          {categoryTree.filter(nodeIsVisible).map(node => (
            <CategoryTreeItem
              key={node.id}
              node={node}
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

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          {isAuthenticated ? (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                onClick={onImport}
                className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                title="导入书签"
              >
                <Upload size={14} />
                <span>导入</span>
              </button>

              <button
                onClick={onBackup}
                className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                title="备份与恢复"
              >
                <CloudCog size={14} />
                <span>备份</span>
              </button>

              <button
                onClick={onSettings}
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
              {isAuthenticated ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
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

      {isLarge && manualHidden && (
        <button
          onClick={() => setManualHidden(false)}
          title="显示侧边栏"
          className="fixed left-0 top-20 z-40 p-2 rounded-r-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );
}

export default Sidebar;
