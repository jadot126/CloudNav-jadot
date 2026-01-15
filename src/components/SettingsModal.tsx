import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Bot, Key, Globe, Sparkles, PauseCircle, Wrench, Copy, Check, LayoutTemplate, RefreshCw, Download, Sidebar, Keyboard, Package, Zap } from 'lucide-react';
import { AIConfig, LinkItem, Category, SiteSettings } from '../types';
import { generateLinkDescription } from '../services/geminiService';
import { generateExtensionFiles, ExtensionConfig } from '../services/extensionBuilder';
import JSZip from 'jszip';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  siteSettings: SiteSettings;
  onSave: (config: AIConfig, siteSettings: SiteSettings) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  authToken: string | null;
}

const getRandomColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.random() * 20;
  const l = 45 + Math.random() * 15;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const generateSvgIcon = (text: string, color1: string, color2: string) => {
  let char = '';
  if (text && text.length > 0) {
    char = text.charAt(0);
    if (/^[a-zA-Z]$/.test(char)) {
      char = '云';
    }
  } else {
    char = '云';
  }

  const gradientId = 'g_' + Math.random().toString(36).substr(2, 9);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${color1}"/>
                <stop offset="100%" stop-color="${color2}"/>
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#${gradientId})" rx="16"/>
        <text x="50%" y="50%" dy=".35em" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="32" text-anchor="middle">${char}</text>
    </svg>`.trim();

  try {
    const encoded = window.btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch (e) {
    console.error("SVG Icon Generation Failed", e);
    return '';
  }
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, config, siteSettings, onSave, links, categories, onUpdateLinks, authToken
}) => {
  const [activeTab, setActiveTab] = useState<'site' | 'ai' | 'tools'>('site');
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);

  const [localSiteSettings, setLocalSiteSettings] = useState<SiteSettings>(() => ({
    title: siteSettings?.title || 'CloudNav - 我的导航',
    navTitle: siteSettings?.navTitle || 'CloudNav',
    favicon: siteSettings?.favicon || '',
    cardStyle: siteSettings?.cardStyle || 'detailed',
    passwordExpiryDays: siteSettings?.passwordExpiryDays ?? 7
  }));

  const [generatedIcons, setGeneratedIcons] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const shouldStopRef = useRef(false);

  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox'>('chrome');
  const [isZipping, setIsZipping] = useState(false);

  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});


  const updateGeneratedIcons = (text: string) => {
    const newIcons: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c1 = getRandomColor();
      const h2 = (parseInt(c1.split(',')[0].split('(')[1]) + 30 + Math.random() * 30) % 360;
      const c2 = `hsl(${h2}, 70%, 50%)`;
      newIcons.push(generateSvgIcon(text, c1, c2));
    }
    setGeneratedIcons(newIcons);
  };

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      const safeSettings: SiteSettings = {
        title: siteSettings?.title || 'CloudNav - 我的导航',
        navTitle: siteSettings?.navTitle || 'CloudNav',
        favicon: siteSettings?.favicon || '',
        cardStyle: siteSettings?.cardStyle || 'detailed',
        passwordExpiryDays: siteSettings?.passwordExpiryDays ?? 7
      };
      setLocalSiteSettings(safeSettings);
      if (generatedIcons.length === 0) {
        updateGeneratedIcons(safeSettings.navTitle);
      }

      setIsProcessing(false);
      setIsZipping(false);
      setProgress({ current: 0, total: 0 });
      shouldStopRef.current = false;
      setDomain(window.location.origin);
      const storedToken = localStorage.getItem('cloudnav_auth_token');
      if (storedToken) setPassword(storedToken);
    }
  }, [isOpen, config, siteSettings]);

  const handleChange = (key: keyof AIConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSiteChange = async (key: keyof SiteSettings, value: any) => {
    setLocalSiteSettings(prev => {
      const next = { ...prev, [key]: value };

      // 如果是身份验证过期天数修改，立即保存到 KV 空间
      if (key === 'passwordExpiryDays' && authToken) {
        saveWebsiteConfigToKV(next);
      }

      return next;
    });
  };

  // 保存网站配置到 KV 空间
  const saveWebsiteConfigToKV = async (siteSettings: SiteSettings) => {
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken || ''
        },
        body: JSON.stringify({
          saveConfig: 'website',
          config: siteSettings
        })
      });

      if (!response.ok) {
        console.error('Failed to save website config to KV:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving website config to KV:', error);
    }
  };

  const handleSave = () => {
    onSave(localConfig, localSiteSettings);
    onClose();
  };

  const handleBulkGenerate = async () => {
    if (!localConfig.apiKey) {
      alert("请先配置并保存 API Key");
      return;
    }

    const missingLinks = links.filter(l => !l.description);
    if (missingLinks.length === 0) {
      alert("所有链接都已有描述！");
      return;
    }

    if (!confirm(`发现 ${missingLinks.length} 个链接缺少描述，确定要使用 AI 自动生成吗？这可能需要一些时间。`)) return;

    setIsProcessing(true);
    shouldStopRef.current = false;
    setProgress({ current: 0, total: missingLinks.length });

    let currentLinks = [...links];

    for (let i = 0; i < missingLinks.length; i++) {
      if (shouldStopRef.current) break;

      const link = missingLinks[i];
      try {
        const desc = await generateLinkDescription(link.title, link.url, localConfig);
        currentLinks = currentLinks.map(l => l.id === link.id ? { ...l, description: desc } : l);
        onUpdateLinks(currentLinks);
        setProgress({ current: i + 1, total: missingLinks.length });
      } catch (e) {
        console.error(`Failed to generate for ${link.title}`, e);
      }
    }

    setIsProcessing(false);
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      // 降级方案：使用传统的复制方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [key]: false }));
        }, 2000);
      } catch (fallbackErr) {
        console.error('复制失败:', fallbackErr);
        alert('复制失败，请手动复制');
      }
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate extension files using the template service
  const extensionConfig: ExtensionConfig = useMemo(() => ({
    apiBase: domain,
    password: password,
    navTitle: localSiteSettings.navTitle || 'CloudNav',
    browserType: browserType,
  }), [domain, password, localSiteSettings.navTitle, browserType]);

  const extensionFiles = useMemo(() =>
    generateExtensionFiles(extensionConfig),
    [extensionConfig]
  );

  const renderCodeBlock = (filename: string, code: string) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">{filename}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadFile(filename, code)}
            className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            title="下载文件"
          >
            <Download size={12} />
            Download
          </button>
          <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
          <button
            onClick={() => handleCopy(code, filename)}
            className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            {copiedStates[filename] ? <Check size={12} /> : <Copy size={12} />}
            {copiedStates[filename] ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="bg-slate-900 p-3 overflow-auto max-h-[300px]">
        <pre className="text-[10px] md:text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );

  const generateIconBlob = async (): Promise<Blob | null> => {
    const iconUrl = localSiteSettings.favicon;
    if (!iconUrl) return null;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = iconUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas error');

      ctx.drawImage(img, 0, 0, 128, 128);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleDownloadIcon = async () => {
    const blob = await generateIconBlob();
    if (!blob) {
      alert("生成图片失败 (可能是跨域限制)。\n\n请尝试右键点击下方的预览图片，选择 '图片另存为...' 保存。");
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "icon.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Use generated extension files from template service
      zip.file("manifest.json", extensionFiles['manifest.json']);
      zip.file("background.js", extensionFiles['background.js']);
      zip.file("sidebar.html", extensionFiles['sidebar.html']);
      zip.file("sidebar.js", extensionFiles['sidebar.js']);

      const iconBlob = await generateIconBlob();
      if (iconBlob) {
        zip.file("icon.png", iconBlob);
      } else {
        console.warn("Could not generate icon for zip");
        zip.file("icon_missing.txt", "Icon generation failed due to CORS. Please save the icon manually.");
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "CloudNav-Ext.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
      alert("打包下载失败");
    } finally {
      setIsZipping(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'site', label: '网站设置', icon: LayoutTemplate },
    { id: 'ai', label: 'AI 设置', icon: Bot },
    { id: 'tools', label: '扩展工具', icon: Wrench },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-700 flex max-h-[90vh] flex-col md:flex-row">

        <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white dark:bg-slate-800">
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h3 className="text-lg font-semibold dark:text-white">设置</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5 dark:text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pb-12">

            {activeTab === 'site' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网页标题 (Title)</label>
                    <input
                      type="text"
                      value={localSiteSettings.title}
                      onChange={(e) => handleSiteChange('title', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">导航栏标题</label>
                    <input
                      type="text"
                      value={localSiteSettings.navTitle}
                      onChange={(e) => handleSiteChange('navTitle', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网站图标 (Favicon URL)</label>
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                        {localSiteSettings.favicon ? <img src={localSiteSettings.favicon} className="w-full h-full object-cover" /> : <Globe size={20} className="text-slate-400" />}
                      </div>
                      <input
                        type="text"
                        value={localSiteSettings.favicon}
                        onChange={(e) => handleSiteChange('favicon', e.target.value)}
                        placeholder="https://example.com/favicon.ico"
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">选择生成的随机图标 (点击右侧按钮刷新):</p>
                        <button
                          type="button"
                          onClick={() => updateGeneratedIcons(localSiteSettings.navTitle)}
                          className="text-xs flex items-center gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                        >
                          <RefreshCw size={12} /> 随机生成
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {generatedIcons.map((icon, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSiteChange('favicon', icon)}
                            className="w-8 h-8 rounded hover:ring-2 ring-blue-500 transition-all border border-slate-100 dark:border-slate-600"
                          >
                            <img src={icon} className="w-full h-full rounded" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">身份验证过期天数</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={localSiteSettings.passwordExpiryDays}
                        onChange={(e) => handleSiteChange('passwordExpiryDays', parseInt(e.target.value) || 0)}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">设置为 0 表示永久不退出，默认 7 天后自动退出</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI 提供商</label>
                  <select
                    value={localConfig.provider}
                    onChange={(e) => handleChange('provider', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI Compatible (ChatGPT, DeepSeek, Claude...)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={localConfig.apiKey}
                      onChange={(e) => handleChange('apiKey', e.target.value)}
                      placeholder="sk-..."
                      className="w-full pl-10 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Key 仅存储在本地浏览器缓存中，不会发送到我们的服务器。</p>
                </div>

                {localConfig.provider === 'openai' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base URL (API 地址)</label>
                    <input
                      type="text"
                      value={localConfig.baseUrl}
                      onChange={(e) => handleChange('baseUrl', e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">模型名称 (Model Name)</label>
                  <input
                    type="text"
                    value={localConfig.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    placeholder={localConfig.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-3.5-turbo"}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-semibold mb-2 dark:text-slate-200">批量操作</h4>
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>正在生成描述... ({progress.current}/{progress.total})</span>
                        <button onClick={() => { shouldStopRef.current = true; setIsProcessing(false); }} className="text-red-500 flex items-center gap-1 hover:underline">
                          <PauseCircle size={12} /> 停止
                        </button>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleBulkGenerate}
                      className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-2 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                    >
                      <Sparkles size={16} /> 一键补全所有缺失的描述
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-8 animate-in fade-in duration-300">

                <div className="space-y-3">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-                                -6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                    输入管理员密码
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">API 域名 (自动获取)</label>
                        <code className="block w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                          {domain}
                        </code>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">管理员密码 (Password)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={password}
                            readOnly
                            className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none font-mono"
                            placeholder="未登录 / 未设置"
                          />
                          <button onClick={() => handleCopy(password, 'pwd')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-blue-500 rounded text-slate-600 dark:text-slate-400 transition-colors">
                            {copiedStates['pwd'] ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">此密码对应您部署时设置的 PASSWORD 环境变量。</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                    选择浏览器类型
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setBrowserType('chrome')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'chrome' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                    >
                      <span className="font-semibold">Chrome / Edge</span>
                    </button>
                    <button
                      onClick={() => setBrowserType('firefox')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'firefox' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                    >
                      <span className="font-semibold">Mozilla Firefox</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                    配置步骤与代码
                  </h4>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h5 className="font-semibold text-sm mb-3 dark:text-slate-200">
                      安装指南 ({browserType === 'chrome' ? 'Chrome/Edge' : 'Firefox'}):
                    </h5>
                    <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                      <li>在电脑上新建文件夹 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">CloudNav-Pro</code>。</li>
                      <li><strong>[重要]</strong> 将下方图标保存为 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">icon.png</code>。</li>
                      <li>获取插件代码文件：
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-500">
                          <li><strong>方式一 (推荐)：</strong>点击下方的 <span className="text-blue-600 dark:text-blue-400 font-bold">"📦 一键下载所有文件"</span> 按钮，解压到该文件夹。</li>
                          <li><strong>方式二 (备用)：</strong>分别点击下方代码块的 <Download size={12} className="inline" /> 按钮下载或复制 <code className="bg-white dark:bg-slate-900 px-1 rounded">manifest.json</code>, <code className="bg-white dark:bg-slate-900 px-1 rounded">background.js</code> 等文件到该文件夹。</li>
                        </ul>
                      </li>
                      <li>
                        打开浏览器扩展管理页面
                        {browserType === 'chrome' ? (
                          <> (Chrome: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions</code>)</>
                        ) : (
                          <> (Firefox: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">about:debugging</code>)</>
                        )}。
                      </li>
                      <li className="text-blue-600 font-bold">操作关键点：</li>
                      <li>1. 开启右上角的 "开发者模式" (Chrome)。</li>
                      <li>2. 点击 "加载已解压的扩展程序"，选择包含上述文件的文件夹。</li>
                      <li>3. 前往 <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions/shortcuts</code>。</li>
                      <li>4. <strong>[重要]</strong> 找到 "打开/关闭 CloudNav 侧边栏"，设置快捷键 (如 Ctrl+Shift+E)。</li>
                    </ol>

                    <div className="mt-4 mb-4">
                      <button
                        onClick={handleDownloadZip}
                        disabled={isZipping}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                      >
                        <Package size={20} />
                        {isZipping ? '打包中...' : '📦 一键下载所有文件 (v7.6 Pro)'}
                      </button>
                    </div>

                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded border border-green-200 dark:border-green-900/50 text-sm space-y-2">
                      <div className="font-bold flex items-center gap-2"><Zap size={16} /> 完美交互方案 (v7.6):</div>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        <li><strong>左键 / 快捷键:</strong> 极速打开/关闭侧边栏 (无弹窗延迟)。</li>
                        <li><strong>网页右键:</strong> 直接展示分类列表 (支持判重警告)。</li>
                        <li><strong>图标右键:</strong> 同上，统一为级联菜单，直接保存。</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                        {localSiteSettings.favicon ? <img src={localSiteSettings.favicon} className="w-full h-full object-cover" /> : <Globe size={24} className="text-slate-400" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm dark:text-white">插件图标 (icon.png)</div>
                        <div className="text-xs text-slate-500">请保存此图片为 icon.png</div>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadIcon}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors"
                    >
                      <Download size={16} /> 下载图标
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <Sidebar size={18} className="text-purple-500" /> 核心配置
                    </div>
                    {renderCodeBlock('manifest.json', extensionFiles['manifest.json'])}
                    {renderCodeBlock('background.js', extensionFiles['background.js'])}

                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <Keyboard size={18} className="text-green-500" /> 侧边栏导航功能 (Sidebar)
                    </div>
                    {renderCodeBlock('sidebar.html', extensionFiles['sidebar.html'])}
                    {renderCodeBlock('sidebar.js', extensionFiles['sidebar.js'])}
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              <Save size={18} /> 保存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;