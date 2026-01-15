/**
 * Mock API Server for Vite Development
 *
 * 这个模块提供服务器端的 Mock API 处理，用于 Vite 开发服务器中间件。
 * 使用文件存储替代 localStorage，支持插件和主应用同时访问。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

// 数据存储目录
const DATA_DIR = path.join(process.cwd(), '.mock-data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 模拟 KV 存储（使用文件系统）
const mockKV = {
  get(key: string): string | null {
    const filePath = path.join(DATA_DIR, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (e) {
      console.error(`[Mock KV] Failed to read ${key}:`, e);
    }
    return null;
  },

  put(key: string, value: string): void {
    const filePath = path.join(DATA_DIR, `${key}.json`);
    try {
      fs.writeFileSync(filePath, value, 'utf-8');
    } catch (e) {
      console.error(`[Mock KV] Failed to write ${key}:`, e);
    }
  },

  delete(key: string): void {
    const filePath = path.join(DATA_DIR, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`[Mock KV] Failed to delete ${key}:`, e);
    }
  }
};

// SHA-256 哈希函数
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 验证密码
function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

interface AdminConfig {
  password: string;
  initialized: boolean;
  createdAt: number;
}

// 获取管理员配置
function getAdminConfig(): AdminConfig | null {
  const configStr = mockKV.get('admin_config');
  if (!configStr) return null;
  try {
    return JSON.parse(configStr) as AdminConfig;
  } catch {
    return null;
  }
}

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Content-Type': 'application/json',
};

// 发送 JSON 响应
function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, corsHeaders);
  res.end(JSON.stringify(data));
}

// 解析请求体
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// 处理 GET /api/storage
function handleGetStorage(url: URL, headers: Record<string, string>): { status: number; data: any } {
  const searchParams = url.searchParams;
  const checkInit = searchParams.get('checkInit');
  const checkAuth = searchParams.get('checkAuth');
  const getConfig = searchParams.get('getConfig');

  // 检查是否已初始化
  if (checkInit === 'true') {
    const adminConfig = getAdminConfig();
    return {
      status: 200,
      data: { initialized: adminConfig?.initialized ?? false }
    };
  }

  // 检查认证状态
  if (checkAuth === 'true') {
    const adminConfig = getAdminConfig();
    return {
      status: 200,
      data: {
        hasPassword: adminConfig?.initialized ?? false,
        requiresAuth: adminConfig?.initialized ?? false,
        initialized: adminConfig?.initialized ?? false,
      }
    };
  }

  // 获取配置
  if (getConfig === 'ai') {
    const config = mockKV.get('ai_config');
    return { status: 200, data: config ? JSON.parse(config) : {} };
  }

  if (getConfig === 'search') {
    const config = mockKV.get('search_config');
    return { status: 200, data: config ? JSON.parse(config) : {} };
  }

  if (getConfig === 'website') {
    const config = mockKV.get('website_config');
    return { status: 200, data: config ? JSON.parse(config) : { passwordExpiryDays: 7 } };
  }

  if (getConfig === 'favicon') {
    const domain = searchParams.get('domain');
    if (!domain) {
      return { status: 400, data: { error: 'Domain parameter is required' } };
    }
    const icon = mockKV.get(`favicon_${domain}`);
    return { status: 200, data: { icon, cached: !!icon } };
  }

  // 根据 URI 路径获取分组数据
  const uriPath = searchParams.get('uri');
  if (uriPath) {
    const appDataStr = mockKV.get('app_data');
    if (!appDataStr) {
      return { status: 404, data: { error: '数据不存在' } };
    }

    const appData = JSON.parse(appDataStr);
    const categories = appData.categories || [];
    const links = appData.links || [];

    // 解析 URI 路径，查找对应分组
    const pathParts = uriPath.split('/').filter(Boolean);
    let currentCategory: any = null;
    let parentId: string | undefined = undefined;

    for (const part of pathParts) {
      currentCategory = categories.find((c: any) =>
        c.uri === part && c.parentId === parentId
      );
      if (!currentCategory) {
        return { status: 404, data: { error: '分组不存在', path: uriPath } };
      }
      parentId = currentCategory.id;
    }

    if (!currentCategory) {
      return { status: 404, data: { error: '分组不存在', path: uriPath } };
    }

    // 检查分组是否需要密码验证
    const needsAuth = currentCategory.password && currentCategory.password.length > 0;

    // 获取该分组下的所有链接
    const categoryLinks = links.filter((l: any) => l.categoryId === currentCategory.id);

    // 获取子分组
    const childCategories = categories.filter((c: any) => c.parentId === currentCategory.id);

    return {
      status: 200,
      data: {
        category: {
          id: currentCategory.id,
          name: currentCategory.name,
          icon: currentCategory.icon,
          uri: currentCategory.uri,
          parentId: currentCategory.parentId,
          inheritPassword: currentCategory.inheritPassword,
          needsAuth,
        },
        links: needsAuth ? [] : categoryLinks,
        children: childCategories.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          uri: c.uri,
          needsAuth: c.password && c.password.length > 0,
        })),
      }
    };
  }

  // 获取应用数据
  const data = mockKV.get('app_data');
  if (!data) {
    return { status: 200, data: { links: [], categories: [] } };
  }
  return { status: 200, data: JSON.parse(data) };
}

// 处理 POST /api/storage
function handlePostStorage(body: any, headers: Record<string, string>): { status: number; data: any } {
  const providedPassword = headers['x-auth-password'];

  // 初始化管理员
  if (body.initAdmin === true) {
    const existingConfig = getAdminConfig();
    if (existingConfig?.initialized) {
      return { status: 400, data: { error: '管理员已初始化，无法重新设置' } };
    }

    if (!body.password || body.password.length < 6) {
      return { status: 400, data: { error: '密码长度至少6位' } };
    }

    const hashedPassword = hashPassword(body.password);
    const adminConfig: AdminConfig = {
      password: hashedPassword,
      initialized: true,
      createdAt: Date.now(),
    };

    mockKV.put('admin_config', JSON.stringify(adminConfig));
    mockKV.put('last_auth_time', Date.now().toString());

    return { status: 200, data: { success: true, message: '管理员密码设置成功' } };
  }

  // 验证管理员密码
  if (body.authOnly === true || body.verifyAdmin === true) {
    const adminConfig = getAdminConfig();

    if (!adminConfig?.initialized) {
      return { status: 401, data: { error: '管理员未初始化', needInit: true } };
    }

    if (!providedPassword) {
      return { status: 401, data: { error: '请提供密码' } };
    }

    const isValid = verifyPassword(providedPassword, adminConfig.password);
    if (!isValid) {
      return { status: 401, data: { error: '密码错误' } };
    }

    mockKV.put('last_auth_time', Date.now().toString());
    return { status: 200, data: { success: true } };
  }

  // 验证分组密码
  if (body.verifyGroup === true) {
    const { groupId, password } = body;
    if (!groupId || !password) {
      return { status: 400, data: { error: '缺少分组ID或密码' } };
    }

    const appDataStr = mockKV.get('app_data');
    if (!appDataStr) {
      return { status: 404, data: { error: '数据不存在' } };
    }

    const appData = JSON.parse(appDataStr);
    const categories = appData.categories || [];

    const verifyGroupPassword = (catId: string, pwd: string): boolean => {
      const category = categories.find((c: any) => c.id === catId);
      if (!category) return false;
      if (category.password && category.password === pwd) return true;
      if (category.inheritPassword && category.parentId) {
        return verifyGroupPassword(category.parentId, pwd);
      }
      if (!category.password) return true;
      return false;
    };

    const isValid = verifyGroupPassword(groupId, password);
    return { status: 200, data: { success: isValid } };
  }

  // 保存图标缓存
  if (body.saveConfig === 'favicon') {
    const { domain, icon } = body;
    if (!domain || !icon) {
      return { status: 400, data: { error: 'Domain and icon are required' } };
    }
    mockKV.put(`favicon_${domain}`, icon);
    return { status: 200, data: { success: true } };
  }

  // 需要管理员验证的操作
  const adminConfig = getAdminConfig();

  if (!adminConfig?.initialized) {
    return { status: 401, data: { error: '管理员未初始化', needInit: true } };
  }

  if (!providedPassword) {
    return { status: 401, data: { error: '请提供密码' } };
  }

  const isValid = verifyPassword(providedPassword, adminConfig.password);
  if (!isValid) {
    return { status: 401, data: { error: '密码错误' } };
  }

  // 保存配置
  if (body.saveConfig === 'search') {
    mockKV.put('search_config', JSON.stringify(body.config));
    return { status: 200, data: { success: true } };
  }

  if (body.saveConfig === 'ai') {
    mockKV.put('ai_config', JSON.stringify(body.config));
    return { status: 200, data: { success: true } };
  }

  if (body.saveConfig === 'website') {
    mockKV.put('website_config', JSON.stringify(body.config));
    return { status: 200, data: { success: true } };
  }

  // 保存应用数据
  mockKV.put('app_data', JSON.stringify(body));
  return { status: 200, data: { success: true } };
}

// 处理 POST /api/link
function handlePostLink(body: any, headers: Record<string, string>): { status: number; data: any } {
  const providedPassword = headers['x-auth-password'];
  const adminConfig = getAdminConfig();

  if (!adminConfig?.initialized) {
    return { status: 401, data: { error: '管理员未初始化', needInit: true } };
  }

  if (!providedPassword) {
    return { status: 401, data: { error: '请提供密码' } };
  }

  const isValid = verifyPassword(providedPassword, adminConfig.password);
  if (!isValid) {
    return { status: 401, data: { error: '密码错误' } };
  }

  if (!body.title || !body.url) {
    return { status: 400, data: { error: 'Missing title or url' } };
  }

  const currentDataStr = mockKV.get('app_data');
  let currentData: { links: any[]; categories: any[] } = { links: [], categories: [] };

  if (currentDataStr) {
    currentData = JSON.parse(currentDataStr);
  }

  let targetCatId = body.categoryId || 'common';
  let targetCatName = '默认';

  if (currentData.categories.length > 0) {
    const cat = currentData.categories.find((c: any) => c.id === targetCatId);
    if (cat) {
      targetCatName = cat.name;
    } else {
      targetCatId = currentData.categories[0].id;
      targetCatName = currentData.categories[0].name;
    }
  }

  const newLink = {
    id: Date.now().toString(),
    title: body.title,
    url: body.url,
    description: body.description || '',
    categoryId: targetCatId,
    createdAt: Date.now(),
    pinned: false,
    icon: body.icon || undefined
  };

  currentData.links = [newLink, ...currentData.links];
  mockKV.put('app_data', JSON.stringify(currentData));

  return {
    status: 200,
    data: { success: true, link: newLink, categoryName: targetCatName }
  };
}

/**
 * Vite 中间件处理函数
 * 用于在 vite.config.ts 中配置
 */
export async function handleMockApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 只处理 /api/ 请求
  if (!pathname.startsWith('/api/')) {
    return false;
  }

  // 处理 OPTIONS 请求（CORS 预检）
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return true;
  }

  // 获取请求头
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    }
  }

  console.log(`[Mock API] ${req.method} ${pathname}`);

  try {
    let result: { status: number; data: any };

    if (req.method === 'GET' && pathname === '/api/storage') {
      result = handleGetStorage(url, headers);
    } else if (req.method === 'POST' && pathname === '/api/storage') {
      const body = await parseBody(req);
      result = handlePostStorage(body, headers);
    } else if (req.method === 'POST' && pathname === '/api/link') {
      const body = await parseBody(req);
      result = handlePostLink(body, headers);
    } else {
      result = { status: 404, data: { error: 'Not found' } };
    }

    sendJson(res, result.status, result.data);
    return true;
  } catch (error) {
    console.error('[Mock API] Error:', error);
    sendJson(res, 500, { error: 'Internal server error' });
    return true;
  }
}

/**
 * 清除所有 Mock 数据
 */
export function clearMockData() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(DATA_DIR, file));
      }
      console.log('[Mock API] All mock data cleared');
    }
  } catch (e) {
    console.error('[Mock API] Failed to clear data:', e);
  }
}
