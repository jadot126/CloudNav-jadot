import { Search, Plus, Moon, Sun, Menu, Cloud, LogOut, ExternalLink, Settings } from 'lucide-react';
import Icon from '../Icon';
import { SearchMode, ExternalSearchSource } from '../../types';

interface HeaderProps {
  // Sidebar
  onMenuClick: () => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  onExternalSearch: () => void;
  onSearchConfigClick: () => void;
  externalSearchSources: ExternalSearchSource[];
  selectedSearchSource: ExternalSearchSource | null;
  hoveredSearchSource: ExternalSearchSource | null;
  showSearchSourcePopup: boolean;
  onSearchSourceSelect: (source: ExternalSearchSource) => void;
  onIconHover: (hovered: boolean) => void;
  onPopupHover: (hovered: boolean) => void;
  onHoveredSourceChange: (source: ExternalSearchSource | null) => void;
  isMobileSearchOpen: boolean;
  onMobileSearchToggle: () => void;

  // View Mode
  cardStyle: 'detailed' | 'simple';
  onViewModeChange: (style: 'detailed' | 'simple') => void;

  // Theme
  darkMode: boolean;
  onThemeToggle: () => void;

  // Auth
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;

  // Add
  onAddClick: () => void;
}

export function Header({
  onMenuClick,
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  onExternalSearch,
  onSearchConfigClick,
  externalSearchSources,
  selectedSearchSource,
  hoveredSearchSource,
  showSearchSourcePopup,
  onSearchSourceSelect,
  onIconHover,
  onPopupHover,
  onHoveredSourceChange,
  isMobileSearchOpen,
  onMobileSearchToggle,
  cardStyle,
  onViewModeChange,
  darkMode,
  onThemeToggle,
  isAuthenticated,
  onLogin,
  onLogout,
  onAddClick
}: HeaderProps) {
  return (
    <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
          <Menu size={24} />
        </button>

        {/* 搜索模式切换 + 搜索框 */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 移动端搜索图标 */}
          <button
            onClick={() => {
              onMobileSearchToggle();
              if (searchMode !== 'external') {
                onSearchModeChange('external');
              }
            }}
            className="sm:flex md:hidden lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            title="搜索"
          >
            <Search size={20} />
          </button>

          {/* 搜索模式切换 - 平板端和桌面端显示 */}
          <div className="hidden sm:hidden md:flex lg:flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1">
              <button
                onClick={() => onSearchModeChange('internal')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center justify-center min-h-[24px] min-w-[40px] ${searchMode === 'internal'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                title="站内搜索"
              >
                站内
              </button>
              <button
                onClick={() => onSearchModeChange('external')}
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
                onClick={onSearchConfigClick}
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
                onMouseEnter={() => onPopupHover(true)}
                onMouseLeave={() => onPopupHover(false)}
              >
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                  {externalSearchSources
                    .filter(source => source.enabled)
                    .map((source, index) => (
                      <button
                        key={index}
                        onClick={() => onSearchSourceSelect(source)}
                        onMouseEnter={() => onHoveredSourceChange(source)}
                        onMouseLeave={() => onHoveredSourceChange(null)}
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
              onMouseEnter={() => searchMode === 'external' && onIconHover(true)}
              onMouseLeave={() => onIconHover(false)}
              onClick={() => {
                if (searchMode === 'external') {
                  // 切换搜索源选择窗口
                }
              }}
            >
              {searchMode === 'internal' ? (
                <Search size={16} />
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
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchMode === 'external') {
                  onExternalSearch();
                }
              }}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700/50 border-none text-sm focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-slate-400 outline-none transition-all"
              style={{ fontSize: '16px' }}
              inputMode="search"
              enterKeyHint="search"
            />

            {searchMode === 'external' && searchQuery.trim() && (
              <button
                onClick={onExternalSearch}
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
        {/* 视图切换控制器 */}
        <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1`}>
          <button
            onClick={() => onViewModeChange('simple')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${cardStyle === 'simple'
              ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
              }`}
            title="简约版视图"
          >
            简约
          </button>
          <button
            onClick={() => onViewModeChange('detailed')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${cardStyle === 'detailed'
              ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
              }`}
            title="详情版视图"
          >
            详情
          </button>
        </div>

        {/* 主题切换按钮 */}
        <button onClick={onThemeToggle} className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* 登录/退出按钮 */}
        <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
          {!isAuthenticated ? (
            <button onClick={onLogin} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <Cloud size={14} /> <span className="hidden sm:inline">登录</span>
            </button>
          ) : (
            <button onClick={onLogout} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <LogOut size={14} /> <span className="hidden sm:inline">退出</span>
            </button>
          )}
        </div>

        {/* 添加按钮 */}
        <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
          >
            <Plus size={16} /> <span className="hidden sm:inline">添加</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
