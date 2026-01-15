/**
 * CloudNav Link API
 *
 * 用于浏览器扩展快速添加链接
 * 环境变量：仅需要 CLOUDNAV_KV
 */

interface Env {
  CLOUDNAV_KV: KVNamespace;
}

interface AdminConfig {
  password: string;
  initialized: boolean;
  createdAt: number;
}

// 简单的哈希函数
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Access-Control-Max-Age': '86400',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. 验证管理员密码
  const providedPassword = request.headers.get('x-auth-password');
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

  try {
    const newLinkData = await request.json() as any;

    // Validate input
    if (!newLinkData.title || !newLinkData.url) {
      return new Response(JSON.stringify({ error: 'Missing title or url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2. Fetch current data from KV
    const currentDataStr = await env.CLOUDNAV_KV.get('app_data');
    let currentData: { links: any[]; categories: any[] } = { links: [], categories: [] };

    if (currentDataStr) {
      currentData = JSON.parse(currentDataStr);
    }

    // 3. Determine Category
    let targetCatId = '';
    let targetCatName = '';

    // 3a. Check for explicit categoryId from request
    if (newLinkData.categoryId) {
      const explicitCat = currentData.categories.find((c: any) => c.id === newLinkData.categoryId);
      if (explicitCat) {
        targetCatId = explicitCat.id;
        targetCatName = explicitCat.name;
      }
    }

    // 3b. Fallback: Auto-detect if no explicit category or explicit one not found
    if (!targetCatId) {
      if (currentData.categories && currentData.categories.length > 0) {
        // Try to find specific keywords
        const keywords = ['收集', '未分类', 'inbox', 'temp', 'later'];
        const match = currentData.categories.find((c: any) =>
          keywords.some(k => c.name.toLowerCase().includes(k))
        );

        if (match) {
          targetCatId = match.id;
          targetCatName = match.name;
        } else {
          // Fallback to 'common' if exists, else first category
          const common = currentData.categories.find((c: any) => c.id === 'common');
          if (common) {
            targetCatId = 'common';
            targetCatName = common.name;
          } else {
            targetCatId = currentData.categories[0].id;
            targetCatName = currentData.categories[0].name;
          }
        }
      } else {
        // No categories exist at all
        targetCatId = 'common';
        targetCatName = '默认';
      }
    }

    // 4. Create new link object
    const newLink = {
      id: Date.now().toString(),
      title: newLinkData.title,
      url: newLinkData.url,
      description: newLinkData.description || '',
      categoryId: targetCatId,
      createdAt: Date.now(),
      pinned: false,
      icon: undefined
    };

    // 5. Append
    currentData.links = [newLink, ...(currentData.links || [])];

    // 6. Save back to KV
    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(currentData));

    return new Response(JSON.stringify({
      success: true,
      link: newLink,
      categoryName: targetCatName
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
