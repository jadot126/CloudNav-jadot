import { useMemo, useCallback } from 'react';
import { LinkItem } from '../types';

interface UseLinksOptions {
  links: LinkItem[];
  selectedCategory: string;
  searchQuery: string;
  isCategoryLocked: (catId: string) => boolean;
}

interface UseLinksReturn {
  pinnedLinks: LinkItem[];
  displayedLinks: LinkItem[];
  filterLinks: (categoryId: string, query: string) => LinkItem[];
}

export function useLinks({
  links,
  selectedCategory,
  searchQuery,
  isCategoryLocked
}: UseLinksOptions): UseLinksReturn {
  // 置顶链接（排除锁定分类的链接）
  const pinnedLinks = useMemo(() => {
    const filteredPinnedLinks = links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
    return filteredPinnedLinks.sort((a, b) => {
      if (a.pinnedOrder !== undefined && b.pinnedOrder !== undefined) {
        return a.pinnedOrder - b.pinnedOrder;
      }
      if (a.pinnedOrder !== undefined) return -1;
      if (b.pinnedOrder !== undefined) return 1;
      return a.createdAt - b.createdAt;
    });
  }, [links, isCategoryLocked]);

  // 显示的链接（根据分类和搜索过滤）
  const displayedLinks = useMemo(() => {
    let result = links;

    // 安全过滤：始终隐藏锁定分类的链接
    result = result.filter(l => !isCategoryLocked(l.categoryId));

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // 分类过滤
    if (selectedCategory !== 'all') {
      result = result.filter(l => l.categoryId === selectedCategory);
    }

    // 按照 order 字段排序
    return result.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      return aOrder - bOrder;
    });
  }, [links, selectedCategory, searchQuery, isCategoryLocked]);

  // 通用过滤函数
  const filterLinks = useCallback((categoryId: string, query: string): LinkItem[] => {
    let result = links.filter(l => !isCategoryLocked(l.categoryId));

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }

    if (categoryId !== 'all') {
      result = result.filter(l => l.categoryId === categoryId);
    }

    return result.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      return aOrder - bOrder;
    });
  }, [links, isCategoryLocked]);

  return {
    pinnedLinks,
    displayedLinks,
    filterLinks
  };
}

export default useLinks;
