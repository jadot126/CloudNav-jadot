export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  createdAt: number;
  pinned?: boolean;
  order?: number;
  pinnedOrder?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  uri: string;                // 访问路径，如 "tools", "dev"
  parentId?: string;          // 父分组ID，支持嵌套
  password?: string;          // 分组密码
  inheritPassword?: boolean;  // 是否继承父分组密码
  order?: number;             // 排序
  createdAt?: number;         // 创建时间
}

// 管理员配置
export interface AdminConfig {
  password: string;           // 管理员密码（哈希存储）
  initialized: boolean;       // 是否已初始化
  createdAt: number;          // 创建时间
}

export interface SiteSettings {
  title: string;
  navTitle: string;
  favicon: string;
  cardStyle: 'detailed' | 'simple';
  passwordExpiryDays: number;

  // 新增：标签/标题展示相关设置
  // 标签标题字体大小（像素）
  tagTitleFontSize?: number;
  // 标题图标大小（像素）
  titleIconSize?: number;
  // 标签展示方式：'inline' 一行展示（图标+标题），'stacked' 两行展示（图标在上，标题在下）
  tagDisplayMode?: 'inline' | 'stacked';
  // 页签整体宽度选项（单选）
  tagCardWidth?: 'small' | 'medium' | 'large';
  // 标签卡片最小宽度（像素）
  tagCardMinWidth?: number;
}

export interface AppState {
  links: LinkItem[];
  categories: Category[];
  darkMode: boolean;
  settings?: SiteSettings;
}

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  websiteTitle?: string;
  faviconUrl?: string;
  navigationName?: string;
}

export type SearchMode = 'internal' | 'external';

export interface ExternalSearchSource {
  id: string;
  name: string;
  url: string;
  icon?: string;
  enabled: boolean;
  createdAt: number;
}

export interface SearchConfig {
  mode: SearchMode;
  externalSources: ExternalSearchSource[];
  selectedSource?: ExternalSearchSource | null;
}

// 生成 URI 的辅助函数
export function generateUri(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\u4e00-\u9fa5]+/g, '-')  // 空格和中文替换为连字符
    .replace(/[^a-z0-9-]/g, '')            // 移除非法字符
    .replace(/-+/g, '-')                   // 多个连字符合并
    .replace(/^-|-$/g, '');                // 移除首尾连字符
}

// 系统保留的 URI，不能被用户占用
export const RESERVED_URIS = ['setup', 'api', 'admin', 'login', 'logout', 'auth', 'settings', 'config', 'top'];

// 检查 URI 是否为系统保留
export function isReservedUri(uri: string): boolean {
  return RESERVED_URIS.includes(uri.toLowerCase());
}

// 默认分类（带 URI）
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cloudnav', name: 'CloudNav', icon: 'Globe', uri: 'cloudnav', order: 0 },
];

export const INITIAL_LINKS: LinkItem[] = [
  { id: '1', title: 'Example', url: 'https://example.com', categoryId: 'cloudnav', createdAt: Date.now(), description: '示例链接' },
];

// 分组树节点类型（用于嵌套展示）
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  level: number;
  path: string;  // 完整路径，如 "tools/dev/frontend"
}

// 构建分组树
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // 初始化所有节点
  categories.forEach(cat => {
    map.set(cat.id, {
      ...cat,
      children: [],
      level: 0,
      path: cat.uri,
    });
  });

  // 构建树结构
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      const parent = map.get(cat.parentId)!;
      node.level = parent.level + 1;
      node.path = `${parent.path}/${cat.uri}`;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按 order 排序
  const sortByOrder = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
    nodes.forEach(node => sortByOrder(node.children));
  };
  sortByOrder(roots);

  return roots;
}

// 根据 URI 路径查找分组
export function findCategoryByPath(categories: Category[], path: string): Category | undefined {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;

  let current: Category | undefined;
  let parentId: string | undefined;

  for (const part of parts) {
    current = categories.find(c =>
      c.uri === part && c.parentId === parentId
    );
    if (!current) return undefined;
    parentId = current.id;
  }

  return current;
}

// 获取分组的所有祖先（用于密码继承验证）
export function getCategoryAncestors(categories: Category[], categoryId: string): Category[] {
  const ancestors: Category[] = [];
  let current = categories.find(c => c.id === categoryId);

  while (current?.parentId) {
    const parent = categories.find(c => c.id === current!.parentId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  return ancestors;
}

// 获取分组的所有子孙
export function getCategoryDescendants(categories: Category[], categoryId: string): Category[] {
  const descendants: Category[] = [];
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = categories.filter(c => c.parentId === currentId);
    descendants.push(...children);
    queue.push(...children.map(c => c.id));
  }

  return descendants;
}
