/**
 * CloudNav WebDAV API
 *
 * 用于 WebDAV 备份和恢复功能
 * 作为代理服务器，解决浏览器跨域问题
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Access-Control-Max-Age': '86400',
};

// 处理 OPTIONS 请求（解决跨域预检）
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost = async (context: { request: Request }) => {
  const { request } = context;

  try {
    const body = await request.json() as any;
    const { operation, config, payload, filename } = body;

    if (!config || !config.url || !config.username || !config.password) {
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let baseUrl = config.url.trim();
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    const finalFilename = filename || 'cloudnav_backup.json';
    const fileUrl = baseUrl + finalFilename;

    const authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;

    let fetchUrl = baseUrl;
    let method = 'PROPFIND';
    let headers: Record<string, string> = {
      'Authorization': authHeader,
      'User-Agent': 'CloudNav/1.0'
    };
    let requestBody: string | undefined = undefined;

    if (operation === 'check') {
      fetchUrl = baseUrl;
      method = 'PROPFIND';
      headers['Depth'] = '0';
    } else if (operation === 'upload') {
      fetchUrl = fileUrl;
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(payload);
    } else if (operation === 'download') {
      fetchUrl = fileUrl;
      method = 'GET';
    } else if (operation === 'list') {
      // 列出目录中的文件
      fetchUrl = baseUrl;
      method = 'PROPFIND';
      headers['Depth'] = '1';
    } else if (operation === 'delete') {
      // 删除文件
      fetchUrl = fileUrl;
      method = 'DELETE';
    } else {
      return new Response(JSON.stringify({ error: 'Invalid operation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const response = await fetch(fetchUrl, {
      method,
      headers,
      body: requestBody
    });

    if (operation === 'download') {
      if (!response.ok) {
        if (response.status === 404) {
          return new Response(JSON.stringify({ error: 'Backup file not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify({ error: `WebDAV Error: ${response.status}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (operation === 'list') {
      if (!response.ok && response.status !== 207) {
        return new Response(JSON.stringify({ error: `WebDAV Error: ${response.status}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      // 返回原始 XML 响应，让前端解析
      const xmlText = await response.text();
      return new Response(JSON.stringify({ success: true, xml: xmlText }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const success = response.ok || response.status === 207 || response.status === 201 || response.status === 204;

    return new Response(JSON.stringify({ success, status: response.status }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
