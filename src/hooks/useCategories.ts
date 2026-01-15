import { useState, useMemo, useCallback } from 'react';
import { Category, CategoryTreeNode, buildCategoryTree, getCategoryAncestors, findCategoryByPath } from '../types';

interface UseCategoriesOptions {
  categories: Category[];
}

interface UseCategoriesReturn {
  categoryTree: CategoryTreeNode[];
  expandedCategories: Set<string>;
  unlockedCategoryIds: Set<string>;
  toggleCategoryExpand: (catId: string) => void;
  expandAncestors: (categoryId: string) => void;
  unlockCategory: (catId: string, additionalIds?: string[]) => void;
  isCategoryLocked: (catId: string) => boolean;
  getCategoryPath: (cat: Category) => string;
  findCategoryByUri: (path: string) => Category | undefined;
  getAncestors: (categoryId: string) => Category[];
}

export function useCategories({ categories }: UseCategoriesOptions): UseCategoriesReturn {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // 构建分组树
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // 切换分组展开/折叠
  const toggleCategoryExpand = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }, []);

  // 展开所有祖先分组
  const expandAncestors = useCallback((categoryId: string) => {
    const ancestors = getCategoryAncestors(categories, categoryId);
    setExpandedCategories(prev => {
      const next = new Set(prev);
      ancestors.forEach(a => next.add(a.id));
      return next;
    });
  }, [categories]);

  // 解锁分组
  const unlockCategory = useCallback((catId: string, additionalIds?: string[]) => {
    setUnlockedCategoryIds(prev => {
      const newSet = new Set(prev);
      newSet.add(catId);
      if (additionalIds) {
        additionalIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, []);

  // 检查分组是否锁定（支持链式密码继承）
  // 密码继承逻辑：
  // - 如果当前分组已解锁或管理员已登录，视为未锁定
  // - 如果当前分组有自己密码且未解锁，视为锁定
  // - 若启用 inheritPassword，则沿着父链逐级查找第一个带密码的祖先，若存在且未被解锁则视为锁定
  const isCategoryLocked = useCallback((catId: string): boolean => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;

    // 如果当前分组已解锁，直接返回 false
    if (unlockedCategoryIds.has(catId)) return false;

    // 当前分组有密码保护且未解锁
    if (cat.password) return true;

    // 如果没有启用继承，返回 false
    if (!cat.inheritPassword) return false;

    // 启用继承：沿祖先链逐级查找带密码的祖先，要求链路上的每一级都启用了 inheritPassword
    let current: Category | undefined = cat;
    while (current && current.parentId) {
      const parent = categories.find(c => c.id === current!.parentId);
      if (!parent) break;

      if (parent.password) {
        if (unlockedCategoryIds.has(parent.id)) return false;
        return true;
      }

      if (!parent.inheritPassword) break;
      current = parent;
    }

    return false;
  }, [categories, unlockedCategoryIds]);

  // 获取分组的完整路径
  const getCategoryPath = useCallback((cat: Category): string => {
    const ancestors = getCategoryAncestors(categories, cat.id);
    const parts = [...ancestors.map(a => a.uri), cat.uri];
    return '/' + parts.join('/');
  }, [categories]);

  // 根据 URI 路径查找分组
  const findCategoryByUri = useCallback((path: string): Category | undefined => {
    return findCategoryByPath(categories, path);
  }, [categories]);

  // 获取分组的所有祖先
  const getAncestors = useCallback((categoryId: string): Category[] => {
    return getCategoryAncestors(categories, categoryId);
  }, [categories]);

  return {
    categoryTree,
    expandedCategories,
    unlockedCategoryIds,
    toggleCategoryExpand,
    expandAncestors,
    unlockCategory,
    isCategoryLocked,
    getCategoryPath,
    findCategoryByUri,
    getAncestors
  };
}

export default useCategories;
