/**
 * CloudNav Storage API
 *
 * 环境变量：仅需要 CLOUDNAV_KV
 * 管理员密码存储在 KV 的 admin_config 中
 */

interface Env {
  CLOUDNAV_KV: KVNamespace;
}

interface AdminConfig {
  password: string;      // 管理员密码（哈希存储）
  initialized: boolean;  // 是否已初始化
  createdAt: number;     // 创建时间
}

// 简单的哈希函数（生产环境建议使用更安全的方案）
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// 获取管理员配置
async function getAdminConfig(kv: KVNamespace): Promise<AdminConfig | null> {
  const configStr = await kv.get('admin_config');
  if (!configStr) return null;
  try {
    return JSON.parse(configStr) as AdminConfig;
  } catch {
    return null;
  }
}

// 统一的响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

// 处理 OPTIONS 请求（解决跨域预检）
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// GET: 获取数据
export const onRequestGet = async (context: { env: Env; request: Request }) => {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const checkInit = url.searchParams.get('checkInit');
    const checkAuth = url.searchParams.get('checkAuth');
    const getConfig = url.searchParams.get('getConfig');

    // 检查是否已初始化管理员
    if (checkInit === 'true') {
      const adminConfig = await getAdminConfig(env.CLOUDNAV_KV);
      return new Response(JSON.stringify({
        initialized: adminConfig?.initialized ?? false,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 检查认证状态（兼容旧接口）
    if (checkAuth === 'true') {
      const adminConfig = await getAdminConfig(env.CLOUDNAV_KV);
      return new Response(JSON.stringify({
        hasPassword: adminConfig?.initialized ?? false,
        requiresAuth: adminConfig?.initialized ?? false,
        initialized: adminConfig?.initialized ?? false,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 获取 AI 配置
    if (getConfig === 'ai') {
      const aiConfig = await env.CLOUDNAV_KV.get('ai_config');
      return new Response(aiConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 获取搜索配置
    if (getConfig === 'search') {
      const searchConfig = await env.CLOUDNAV_KV.get('search_config');
      return new Response(searchConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 获取网站配置
    if (getConfig === 'website') {
      const websiteConfig = await env.CLOUDNAV_KV.get('website_config');
      return new Response(websiteConfig || JSON.stringify({ passwordExpiryDays: 7 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 根据 URI 路径获取分组数据
    const uriPath = url.searchParams.get('uri');
    if (uriPath) {
      const appDataStr = await env.CLOUDNAV_KV.get('app_data');
      if (!appDataStr) {
        return new Response(JSON.stringify({ error: '数据不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
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
          return new Response(JSON.stringify({ error: '分组不存在', path: uriPath }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        parentId = currentCategory.id;
      }

      if (!currentCategory) {
        return new Response(JSON.stringify({ error: '分组不存在', path: uriPath }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 检查分组是否需要密码验证
      const needsAuth = currentCategory.password && currentCategory.password.length > 0;

      // 获取该分组下的所有链接
      const categoryLinks = links.filter((l: any) => l.categoryId === currentCategory.id);

      // 获取子分组
      const childCategories = categories.filter((c: any) => c.parentId === currentCategory.id);

      return new Response(JSON.stringify({
        category: {
          id: currentCategory.id,
          name: currentCategory.name,
          icon: currentCategory.icon,
          uri: currentCategory.uri,
          parentId: currentCategory.parentId,
          inheritPassword: currentCategory.inheritPassword,
          // 不返回密码本身，只返回是否需要验证
          needsAuth,
        },
        links: needsAuth ? [] : categoryLinks, // 如果需要验证，不返回链接
        children: childCategories.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          uri: c.uri,
          needsAuth: c.password && c.password.length > 0,
        })),
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 获取图标缓存
    if (getConfig === 'favicon') {
      const domain = url.searchParams.get('domain');
      if (!domain) {
        return new Response(JSON.stringify({ error: 'Domain parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const cachedIcon = await env.CLOUDNAV_KV.get(`favicon:${domain}`);
      return new Response(JSON.stringify({
        icon: cachedIcon || null,
        cached: !!cachedIcon
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 获取应用数据
    const data = await env.CLOUDNAV_KV.get('app_data');

    if (!data) {
      return new Response(JSON.stringify({ links: [], categories: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST: 保存数据
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const providedPassword = request.headers.get('x-auth-password');

  try {
    const body = await request.json() as Record<string, any>;

    // 初始化管理员密码（首次设置）
    if (body.initAdmin === true) {
      const existingConfig = await getAdminConfig(env.CLOUDNAV_KV);

      // 如果已经初始化，拒绝重新设置
      if (existingConfig?.initialized) {
        return new Response(JSON.stringify({ error: '管理员已初始化，无法重新设置' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
        return new Response(JSON.stringify({ error: '密码长度至少6位' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const hashedPassword = await hashPassword(body.password);
      const adminConfig: AdminConfig = {
        password: hashedPassword,
        initialized: true,
        createdAt: Date.now(),
      };

      await env.CLOUDNAV_KV.put('admin_config', JSON.stringify(adminConfig));
      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());

      return new Response(JSON.stringify({ success: true, message: '管理员密码设置成功' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 验证管理员密码
    if (body.authOnly === true || body.verifyAdmin === true) {
      const adminConfig = await getAdminConfig(env.CLOUDNAV_KV);

      if (!adminConfig?.initialized) {
        return new Response(JSON.stringify({ error: '管理员未初始化', needInit: true }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!providedPassword) {
        return new Response(JSON.stringify({ error: '请提供密码' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const isValid = await verifyPassword(providedPassword, adminConfig.password);
      if (!isValid) {
        return new Response(JSON.stringify({ error: '密码错误' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 检查密码是否过期
      const websiteConfigStr = await env.CLOUDNAV_KV.get('website_config');
      const websiteConfig = websiteConfigStr ? JSON.parse(websiteConfigStr) : { passwordExpiryDays: 7 };
      const passwordExpiryDays = websiteConfig.passwordExpiryDays || 7;

      if (passwordExpiryDays > 0) {
        const lastAuthTime = await env.CLOUDNAV_KV.get('last_auth_time');
        if (lastAuthTime) {
          const lastTime = parseInt(lastAuthTime);
          const now = Date.now();
          const expiryMs = passwordExpiryDays * 24 * 60 * 60 * 1000;

          if (now - lastTime > expiryMs) {
            return new Response(JSON.stringify({ error: '密码已过期，请重新登录' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        }
      }

      // 更新最后认证时间
      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 验证分组密码
    if (body.verifyGroup === true) {
      const { groupId, password } = body;
      if (!groupId || !password) {
        return new Response(JSON.stringify({ error: '缺少分组ID或密码' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 获取应用数据中的分组信息
      const appDataStr = await env.CLOUDNAV_KV.get('app_data');
      if (!appDataStr) {
        return new Response(JSON.stringify({ error: '数据不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const appData = JSON.parse(appDataStr);
      const categories = appData.categories || [];

      // 递归验证密码（支持继承）
      const verifyGroupPassword = (catId: string, pwd: string): boolean => {
        const category = categories.find((c: any) => c.id === catId);
        if (!category) return false;

        // 检查当前分组密码
        if (category.password && category.password === pwd) {
          return true;
        }

        // 如果启用继承且有父分组，检查父分组密码
        if (category.inheritPassword && category.parentId) {
          return verifyGroupPassword(category.parentId, pwd);
        }

        // 无密码保护的分组
        if (!category.password) {
          return true;
        }

        return false;
      };

      const isValid = verifyGroupPassword(groupId, password);
      return new Response(JSON.stringify({ success: isValid }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 保存图标缓存（无需密码）
    if (body.saveConfig === 'favicon') {
      const { domain, icon } = body;
      if (!domain || !icon) {
        return new Response(JSON.stringify({ error: 'Domain and icon are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put(`favicon:${domain}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 以下操作需要管理员验证
    const adminConfig = await getAdminConfig(env.CLOUDNAV_KV);

    if (!adminConfig?.initialized) {
      return new Response(JSON.stringify({ error: '管理员未初始化', needInit: true }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!providedPassword) {
      return new Response(JSON.stringify({ error: '请提供密码' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const isValid = await verifyPassword(providedPassword, adminConfig.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: '密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 保存搜索配置
    if (body.saveConfig === 'search') {
      await env.CLOUDNAV_KV.put('search_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 保存 AI 配置
    if (body.saveConfig === 'ai') {
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 保存网站配置
    if (body.saveConfig === 'website') {
      await env.CLOUDNAV_KV.put('website_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 保存应用数据（links + categories）
    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(body));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to save data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
