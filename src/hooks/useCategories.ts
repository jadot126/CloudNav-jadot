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

  // 检查分组是否锁定（支持密码继承）
  // 密码继承逻辑：
  // 1. 如果当前分组已解锁，返回 false
  // 2. 如果当前分组没有密码且没有启用继承，返回 false
  // 3. 如果启用了继承，检查祖先分组：
  //    - 如果有祖先分组有密码且已解锁，当前分组也视为已解锁
  //    - 如果有祖先分组有密码但未解锁，当前分组视为锁定
  // 4. 如果当前分组有密码但未解锁，返回 true
  const isCategoryLocked = useCallback((catId: string): boolean => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;

    // 如果当前分组已解锁，直接返回 false
    if (unlockedCategoryIds.has(catId)) return false;

    // 检查是否启用了密码继承
    if (cat.inheritPassword && cat.parentId) {
      const ancestors = getCategoryAncestors(categories, catId);
      // 从最近的祖先开始检查
      for (const ancestor of ancestors) {
        // 只有祖先有密码时才考虑继承
        if (ancestor.password) {
          // 如果有密码的祖先已解锁，当前分组也视为已解锁
          if (unlockedCategoryIds.has(ancestor.id)) {
            return false;
          }
          // 如果有密码的祖先未解锁，当前分组视为锁定
          return true;
        }
      }
    }

    // 如果当前分组没有密码保护，返回 false
    if (!cat.password) {
      return false;
    }

    // 当前分组有密码保护且未解锁
    return true;
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
