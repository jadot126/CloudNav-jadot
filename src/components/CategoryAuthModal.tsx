import React, { useState, useMemo } from 'react';
import { Lock, ArrowRight, Loader2, X, ChevronRight, Info } from 'lucide-react';
import { Category, getCategoryAncestors } from '../types';

interface CategoryAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  categories: Category[];  // 所有分组，用于查找父分组
  onUnlock: (categoryId: string, unlockedAncestorIds?: string[]) => void;
}

const CategoryAuthModal: React.FC<CategoryAuthModalProps> = ({
  isOpen,
  onClose,
  category,
  categories,
  onUnlock
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 获取当前分组的祖先链（用于密码继承验证）
  const ancestors = useMemo(() => {
    if (!category) return [];
    return getCategoryAncestors(categories, category.id);
  }, [category, categories]);

  // 获取有密码保护的祖先分组
  const protectedAncestors = useMemo(() => {
    return ancestors.filter(a => a.password);
  }, [ancestors]);

  // 检查是否启用了密码继承
  const hasPasswordInheritance = category?.inheritPassword && protectedAncestors.length > 0;

  if (!isOpen || !category) return null;

  // 验证密码（支持继承）
  const verifyPassword = (inputPassword: string): { success: boolean; unlockedIds: string[] } => {
    const unlockedIds: string[] = [];

    // 1. 首先检查当前分组密码
    if (category.password && inputPassword === category.password) {
      unlockedIds.push(category.id);
      return { success: true, unlockedIds };
    }

    // 2. 如果启用了密码继承，检查父分组密码
    if (category.inheritPassword) {
      // 从最近的父分组开始检查
      for (let i = protectedAncestors.length - 1; i >= 0; i--) {
        const ancestor = protectedAncestors[i];
        if (ancestor.password === inputPassword) {
          // 父分组密码正确，解锁当前分组和所有中间分组
          unlockedIds.push(category.id);
          // 同时解锁从该祖先到当前分组之间的所有分组
          for (let j = i; j < protectedAncestors.length; j++) {
            unlockedIds.push(protectedAncestors[j].id);
          }
          return { success: true, unlockedIds };
        }
      }
    }

    // 3. 如果当前分组没有密码但启用了继承，检查是否有父分组密码
    if (!category.password && category.inheritPassword && protectedAncestors.length > 0) {
      // 需要验证最近的有密码的父分组
      const nearestProtected = protectedAncestors[protectedAncestors.length - 1];
      if (nearestProtected.password === inputPassword) {
        unlockedIds.push(category.id);
        unlockedIds.push(nearestProtected.id);
        return { success: true, unlockedIds };
      }
    }

    return { success: false, unlockedIds: [] };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = verifyPassword(password);

      if (result.success) {
        onUnlock(category.id, result.unlockedIds);
        setPassword('');
        setError('');
        onClose();
      } else {
        setError('密码错误');
      }
    } catch (err) {
      setError('验证失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <X size={20} className="text-slate-400" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold dark:text-white">解锁 "{category.name}"</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
            该目录受密码保护，请输入密码访问
          </p>

          {/* 显示分组路径 */}
          {ancestors.length > 0 && (
            <div className="flex items-center gap-1 mt-3 text-xs text-slate-400 flex-wrap justify-center">
              {ancestors.map((a, idx) => (
                <React.Fragment key={a.id}>
                  <span className={a.password ? 'text-amber-500' : ''}>
                    {a.name}
                    {a.password && <Lock size={10} className="inline ml-0.5" />}
                  </span>
                  <ChevronRight size={12} />
                </React.Fragment>
              ))}
              <span className="text-amber-500 font-medium">
                {category.name}
                {category.password && <Lock size={10} className="inline ml-0.5" />}
              </span>
            </div>
          )}
        </div>

        {/* 密码继承提示 */}
        {hasPasswordInheritance && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-600 dark:text-blue-400">
                <p className="font-medium mb-1">支持密码继承</p>
                <p>您可以使用以下任一密码解锁：</p>
                <ul className="mt-1 space-y-0.5">
                  {category.password && (
                    <li>• 当前分组密码</li>
                  )}
                  {protectedAncestors.map(a => (
                    <li key={a.id}>• "{a.name}" 的密码</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all text-center tracking-widest"
              placeholder="输入密码"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-medium animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || isLoading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                验证中...
              </>
            ) : (
              <>
                解锁 <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CategoryAuthModal;
