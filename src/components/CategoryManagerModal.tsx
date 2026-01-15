import React, { useState, useMemo } from 'react';
import { X, Trash2, Edit2, Plus, Check, Lock, Palette, Link2, FolderTree, ChevronRight, GripVertical, AlertTriangle } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category, generateUri, buildCategoryTree, CategoryTreeNode, isReservedUri, RESERVED_URIS } from '../types';
import Icon from './Icon';
import IconSelector from './IconSelector';
import CategoryActionAuthModal from './CategoryActionAuthModal';

// 删除模式类型
export type DeleteMode = 'all' | 'folderOnly';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  onDeleteCategory: (id: string, mode: DeleteMode) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
}

// 可排序分类项组件
interface SortableCategoryItemProps {
  cat: Category;
  isEditing: boolean;
  isSystemCategory: boolean;
  editName: string;
  editUri: string;
  editPassword: string;
  editIcon: string;
  editParentId: string | undefined;
  editInheritPassword: boolean;
  setEditName: (name: string) => void;
  setEditUri: (uri: string) => void;
  setEditPassword: (password: string) => void;
  setEditParentId: (parentId: string | undefined) => void;
  setEditInheritPassword: (inherit: boolean) => void;
  openIconSelector: (target: 'edit' | 'new') => void;
  getAvailableParents: (excludeId?: string) => { id: string; name: string; level: number }[];
  editingId: string | null;
  saveEdit: () => void;
  handleStartEdit: (cat: Category) => void;
  handleDeleteClick: (cat: Category) => void;
}

const SortableCategoryItem: React.FC<SortableCategoryItemProps> = ({
  cat,
  isEditing,
  isSystemCategory,
  editName,
  editUri,
  editPassword,
  editIcon,
  editParentId,
  editInheritPassword,
  setEditName,
  setEditUri,
  setEditPassword,
  setEditParentId,
  setEditInheritPassword,
  openIconSelector,
  getAvailableParents,
  editingId,
  saveEdit,
  handleStartEdit,
  handleDeleteClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg group gap-2 ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-2">
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <GripVertical size={16} />
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              {/* 名称和图标 */}
              <div className="flex items-center gap-2">
                <Icon name={editIcon} size={16} />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                  placeholder="分类名称"
                  autoFocus
                />
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  onClick={() => openIconSelector('edit')}
                  title="选择图标"
                >
                  <Palette size={16} />
                </button>
              </div>

              {/* URI - 系统分类不可修改 */}
              {!isSystemCategory && (
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-slate-400" />
                  <input
                    type="text"
                    value={editUri}
                    onChange={(e) => setEditUri(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 p-1.5 px-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none"
                    placeholder="访问路径（自动生成）"
                  />
                </div>
              )}

              {/* 父分组 - 系统分类不可修改 */}
              {!isSystemCategory && (
                <div className="flex items-center gap-2">
                  <FolderTree size={14} className="text-slate-400" />
                  <select
                    value={editParentId || ''}
                    onChange={(e) => setEditParentId(e.target.value || undefined)}
                    className="flex-1 p-1.5 px-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none"
                  >
                    <option value="">无父分组（顶级）</option>
                    {getAvailableParents(editingId || undefined).map(p => (
                      <option key={p.id} value={p.id}>
                        {'　'.repeat(p.level)}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 密码 - 系统分类不可修改 */}
              {!isSystemCategory && (
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-slate-400" />
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="flex-1 p-1.5 px-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none"
                    placeholder="密码（可选）"
                  />
                </div>
              )}

              {/* 密码继承 - 系统分类不可修改 */}
              {!isSystemCategory && editParentId && (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={editInheritPassword}
                    onChange={(e) => setEditInheritPassword(e.target.checked)}
                    className="rounded"
                  />
                  继承父分组密码
                </label>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Icon name={cat.icon} size={16} />
              <span className="font-medium dark:text-slate-200 truncate">
                {cat.name}
                {isSystemCategory && (
                  <span className="ml-2 text-xs text-slate-400">(系统分类)</span>
                )}
              </span>
              {cat.password && <Lock size={12} className="text-amber-500" />}
              {cat.inheritPassword && <ChevronRight size={12} className="text-slate-400" />}
              {cat.uri && (
                <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                  /{cat.uri}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <button onClick={saveEdit} className="text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-1.5 rounded bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600">
              <Check size={16}/>
            </button>
          ) : (
            <>
              <button onClick={() => handleStartEdit(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                <Edit2 size={14} />
              </button>
              {!isSystemCategory && (
                <button
                  onClick={() => handleDeleteClick(cat)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                >
                  <Trash2 size={14} />
                </button>
              )}
              {isSystemCategory && (
                <div className="p-1.5 text-slate-300" title="系统分类不能被删除">
                  <Lock size={14} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdateCategories,
  onDeleteCategory,
  onVerifyPassword
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUri, setEditUri] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editParentId, setEditParentId] = useState<string | undefined>(undefined);
  const [editInheritPassword, setEditInheritPassword] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatUri, setNewCatUri] = useState('');
  const [newCatPassword, setNewCatPassword] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatParentId, setNewCatParentId] = useState<string | undefined>(undefined);
  const [newCatInheritPassword, setNewCatInheritPassword] = useState(false);

  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorTarget, setIconSelectorTarget] = useState<'edit' | 'new' | null>(null);

  // 分类操作验证相关状态
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'edit' | 'delete';
    categoryId: string;
    categoryName: string;
  } | null>(null);

  // 删除确认弹窗状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // 拖拽排序传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 构建分组树用于显示层级
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // 扁平化树结构用于选择父分组
  const flattenTree = (nodes: CategoryTreeNode[], result: { id: string; name: string; level: number }[] = []): { id: string; name: string; level: number }[] => {
    nodes.forEach(node => {
      result.push({ id: node.id, name: node.name, level: node.level });
      if (node.children.length > 0) {
        flattenTree(node.children, result);
      }
    });
    return result;
  };

  const flatCategories = useMemo(() => flattenTree(categoryTree), [categoryTree]);

  // 检查 URI 是否唯一（在同一父级下）
  const isUriUnique = (uri: string, parentId: string | undefined, excludeId?: string): boolean => {
    return !categories.some(c =>
      c.uri === uri &&
      c.parentId === parentId &&
      c.id !== excludeId
    );
  };

  // 获取可选的父分组（排除自己和自己的子孙）
  const getAvailableParents = (excludeId?: string): { id: string; name: string; level: number }[] => {
    if (!excludeId) return flatCategories;

    // 获取所有子孙 ID
    const getDescendantIds = (catId: string): Set<string> => {
      const ids = new Set<string>();
      const queue = [catId];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        categories.filter(c => c.parentId === currentId).forEach(c => {
          ids.add(c.id);
          queue.push(c.id);
        });
      }
      return ids;
    };

    const descendantIds = getDescendantIds(excludeId);
    return flatCategories.filter(c => c.id !== excludeId && !descendantIds.has(c.id));
  };

  if (!isOpen) return null;

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(cat => cat.id === active.id);
      const newIndex = categories.findIndex(cat => cat.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newCats = arrayMove(categories, oldIndex, newIndex);
        // 更新 order 字段
        newCats.forEach((cat, i) => {
          cat.order = i;
        });
        onUpdateCategories(newCats);
      }
    }
  };

  // 处理密码验证
  const handlePasswordVerification = async (password: string): Promise<boolean> => {
    if (!onVerifyPassword) return true;
    try {
      return await onVerifyPassword(password);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  };

  // 处理编辑分类前的验证
  const handleStartEdit = (cat: Category) => {
    if (!onVerifyPassword) {
      startEdit(cat);
      return;
    }
    setPendingAction({ type: 'edit', categoryId: cat.id, categoryName: cat.name });
    setIsAuthModalOpen(true);
  };

  // 处理删除分类前的验证
  const handleDeleteClick = (cat: Category) => {
    if (!onVerifyPassword) {
      // 直接显示删除确认弹窗
      setCategoryToDelete(cat);
      setDeleteModalOpen(true);
      return;
    }
    setPendingAction({ type: 'delete', categoryId: cat.id, categoryName: cat.name });
    setIsAuthModalOpen(true);
  };

  // 处理验证成功后的操作
  const handleAuthSuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'edit') {
      const cat = categories.find(c => c.id === pendingAction.categoryId);
      if (cat) startEdit(cat);
    } else if (pendingAction.type === 'delete') {
      const cat = categories.find(c => c.id === pendingAction.categoryId);
      if (cat) {
        // 显示删除确认弹窗
        setCategoryToDelete(cat);
        setDeleteModalOpen(true);
      }
    }
    setPendingAction(null);
  };

  // 处理删除确认
  const handleDeleteConfirm = (mode: DeleteMode) => {
    if (categoryToDelete) {
      onDeleteCategory(categoryToDelete.id, mode);
    }
    setDeleteModalOpen(false);
    setCategoryToDelete(null);
  };

  // 获取分类下的子分类数量
  const getChildCategoriesCount = (catId: string): number => {
    return categories.filter(c => c.parentId === catId).length;
  };

  const handleAuthModalClose = () => {
    setIsAuthModalOpen(false);
    setPendingAction(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditUri(cat.uri || '');
    setEditPassword(cat.password || '');
    setEditIcon(cat.icon);
    setEditParentId(cat.parentId);
    setEditInheritPassword(cat.inheritPassword || false);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;

    const editingCategory = categories.find(c => c.id === editingId);
    const isSystemCategory = editingId === 'cloudnav';

    // 系统分类只能修改名称和图标
    if (isSystemCategory) {
      const newCats = categories.map(c => c.id === editingId ? {
        ...c,
        name: editName.trim(),
        icon: editIcon,
      } : c);
      onUpdateCategories(newCats);
      setEditingId(null);
      return;
    }

    const uri = editUri.trim() || generateUri(editName);

    // 验证 URI 是否为系统保留
    if (isReservedUri(uri)) {
      alert(`URI "${uri}" 是系统保留的，不能使用。保留的 URI 包括：${RESERVED_URIS.join(', ')}`);
      return;
    }

    // 验证 URI 唯一性
    if (!isUriUnique(uri, editParentId, editingId)) {
      alert('该 URI 在同一父分组下已存在，请使用其他 URI');
      return;
    }

    const newCats = categories.map(c => c.id === editingId ? {
      ...c,
      name: editName.trim(),
      uri: uri,
      icon: editIcon,
      password: editPassword.trim() || undefined,
      parentId: editParentId,
      inheritPassword: editInheritPassword,
    } : c);
    onUpdateCategories(newCats);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;

    const uri = newCatUri.trim() || generateUri(newCatName);

    // 验证 URI 是否为系统保留
    if (isReservedUri(uri)) {
      alert(`URI "${uri}" 是系统保留的，不能使用。保留的 URI 包括：${RESERVED_URIS.join(', ')}`);
      return;
    }

    // 验证 URI 唯一性
    if (!isUriUnique(uri, newCatParentId)) {
      alert('该 URI 在同一父分组下已存在，请使用其他 URI');
      return;
    }

    const newCat: Category = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      uri: uri,
      icon: newCatIcon,
      password: newCatPassword.trim() || undefined,
      parentId: newCatParentId,
      inheritPassword: newCatInheritPassword,
      order: categories.length,
      createdAt: Date.now(),
    };
    onUpdateCategories([...categories, newCat]);
    resetNewCatForm();
  };

  const resetNewCatForm = () => {
    setNewCatName('');
    setNewCatUri('');
    setNewCatPassword('');
    setNewCatIcon('Folder');
    setNewCatParentId(undefined);
    setNewCatInheritPassword(false);
  };

  const openIconSelector = (target: 'edit' | 'new') => {
    setIconSelectorTarget(target);
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName: string) => {
    if (iconSelectorTarget === 'edit') {
      setEditIcon(iconName);
    } else if (iconSelectorTarget === 'new') {
      setNewCatIcon(iconName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold dark:text-white">分类管理</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map(cat => cat.id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((cat) => (
                <SortableCategoryItem
                  key={cat.id}
                  cat={cat}
                  isEditing={editingId === cat.id}
                  isSystemCategory={cat.id === 'cloudnav'}
                  editName={editName}
                  editUri={editUri}
                  editPassword={editPassword}
                  editIcon={editIcon}
                  editParentId={editParentId}
                  editInheritPassword={editInheritPassword}
                  setEditName={setEditName}
                  setEditUri={setEditUri}
                  setEditPassword={setEditPassword}
                  setEditParentId={setEditParentId}
                  setEditInheritPassword={setEditInheritPassword}
                  openIconSelector={openIconSelector}
                  getAvailableParents={getAvailableParents}
                  editingId={editingId}
                  saveEdit={saveEdit}
                  handleStartEdit={handleStartEdit}
                  handleDeleteClick={handleDeleteClick}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">添加新分类</label>
          <div className="flex flex-col gap-2">
            {/* 名称和图标 */}
            <div className="flex items-center gap-2">
              <Icon name={newCatIcon} size={16} />
              <input
                type="text"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  if (!newCatUri) {
                    // 自动生成 URI
                  }
                }}
                placeholder="分类名称"
                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                onClick={() => openIconSelector('new')}
                title="选择图标"
              >
                <Palette size={16} />
              </button>
            </div>

            {/* URI */}
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-slate-400 ml-1" />
              <input
                type="text"
                value={newCatUri}
                onChange={(e) => setNewCatUri(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="访问路径（留空自动生成）"
                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 父分组 */}
            <div className="flex items-center gap-2">
              <FolderTree size={14} className="text-slate-400 ml-1" />
              <select
                value={newCatParentId || ''}
                onChange={(e) => setNewCatParentId(e.target.value || undefined)}
                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">无父分组（顶级）</option>
                {flatCategories.map(p => (
                  <option key={p.id} value={p.id}>
                    {'　'.repeat(p.level)}{p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 密码 */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={newCatPassword}
                  onChange={(e) => setNewCatPassword(e.target.value)}
                  placeholder="密码 (可选)"
                  className="w-full pl-8 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!newCatName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* 密码继承 */}
            {newCatParentId && (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 ml-1">
                <input
                  type="checkbox"
                  checked={newCatInheritPassword}
                  onChange={(e) => setNewCatInheritPassword(e.target.checked)}
                  className="rounded"
                />
                继承父分组密码
              </label>
            )}
          </div>

          {/* 图标选择器弹窗 */}
          {isIconSelectorOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">选择图标</h3>
                  <button
                    type="button"
                    onClick={() => { setIsIconSelectorOpen(false); setIconSelectorTarget(null); }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <IconSelector
                    onSelectIcon={(iconName) => {
                      handleIconSelect(iconName);
                      setIsIconSelectorOpen(false);
                      setIconSelectorTarget(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 分类操作密码验证弹窗 */}
          {isAuthModalOpen && pendingAction && (
            <CategoryActionAuthModal
              isOpen={isAuthModalOpen}
              onClose={handleAuthModalClose}
              onVerify={handlePasswordVerification}
              onVerified={handleAuthSuccess}
              actionType={pendingAction.type}
              categoryName={pendingAction.categoryName}
            />
          )}

          {/* 删除确认弹窗 */}
          {deleteModalOpen && categoryToDelete && (
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      删除分类
                    </h3>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    确定要删除分类 "<span className="font-medium text-slate-900 dark:text-white">{categoryToDelete.name}</span>" 吗？
                  </p>

                  {getChildCategoriesCount(categoryToDelete.id) > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                      该分类下有 {getChildCategoriesCount(categoryToDelete.id)} 个子分类
                    </p>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={() => handleDeleteConfirm('all')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                      <span>删除所有数据</span>
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center -mt-1">
                      删除该分类、所有书签、所有子分类及其书签
                    </p>

                    <button
                      onClick={() => handleDeleteConfirm('folderOnly')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                    >
                      <FolderTree size={18} />
                      <span>仅删除文件夹</span>
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center -mt-1">
                      删除该分类和直属书签，子分类移动到父级
                    </p>

                    <button
                      onClick={() => {
                        setDeleteModalOpen(false);
                        setCategoryToDelete(null);
                      }}
                      className="w-full px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
