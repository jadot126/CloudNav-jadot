import { Link } from 'react-router-dom';
import { Upload, CloudCog, Settings, Loader2, CheckCircle2, AlertCircle, GitFork, ChevronRight, ChevronDown, Lock } from 'lucide-react';
import Icon from '../Icon';
import { Category, CategoryTreeNode } from '../../types';

// 项目核心仓库地址
const GITHUB_REPO_URL = 'https://github.com/aabacada/CloudNav-abcd';

interface CategoryTreeItemProps {
  node: CategoryTreeNode;
  selectedCategory: string;
  unlockedCategoryIds: Set<string>;
  expandedCategories: Set<string>;
  onToggleExpand: (catId: string) => void;
  onCategoryClick: (cat: Category) => void;
  getCategoryPath: (cat: Category) => string;
  setSidebarOpen: (open: boolean) => void;
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
}: CategoryTreeItemProps) {
  const isLocked = node.password && !unlockedCategoryIds.has(node.id);
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
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl transition-all group ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
          <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${isSelected ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {isLocked ? <Lock size={14} className="text-amber-500" /> : <Icon name={node.icon} size={14} />}
          </div>
          <span className="truncate flex-1 text-left text-sm">{node.name}</span>
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
        </button>
      </div>

      {/* 子分组 */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children.map(child => (
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
  navTitle = 'CloudNav'
}: SidebarProps) {
  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
        bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          {navTitle}
        </span>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
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
          <button
            onClick={onManageCategories}
            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="管理分类"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* 渲染嵌套分组树 */}
        {categoryTree.map(node => (
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
          />
        ))}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
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
  );
}

export default Sidebar;
