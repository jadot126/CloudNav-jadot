const CONFIG = {
    apiBase: "{{API_BASE}}",
    password: "{{PASSWORD}}"
};
const CACHE_KEY = 'cloudnav_data';
const SETTINGS_KEY = 'cloudnav_settings';
const STATUS_KEY = 'cloudnav_status';

// 侧边栏通信
let port = null;
try {
    port = chrome.runtime.connect({ name: 'cloudnav_sidebar' });
    chrome.windows.getCurrent((win) => {
        if (win && port) {
            port.postMessage({ type: 'init', windowId: win.id });
        }
    });
    port.onMessage.addListener((msg) => {
        if (msg.action === 'close_panel') {
            window.close();
        }
    });
} catch (e) {
    console.error('[CloudNav] Connection failed', e);
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('content');
    const searchInput = document.getElementById('search');
    const refreshBtn = document.getElementById('refresh');
    const dataRefreshTimeEl = document.getElementById('dataRefreshTime');
    const bookmarkSyncTimeEl = document.getElementById('bookmarkSyncTime');

    // 书签同步相关元素
    const syncToggle = document.getElementById('syncToggle');
    const syncPanel = document.getElementById('syncPanel');
    const targetFolderInput = document.getElementById('targetFolder');
    const browserFolderInput = document.getElementById('browserFolder');
    const modeMergeBtn = document.getElementById('modeMerge');
    const modeOverwriteBtn = document.getElementById('modeOverwrite');
    const uploadBtn = document.getElementById('uploadBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const syncProgress = document.getElementById('syncProgress');
    const syncMessage = document.getElementById('syncMessage');
    const syncProgressFill = document.getElementById('syncProgressFill');
    const confirmModal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');

    let allLinks = [];
    let allCategories = [];
    let expandedFolders = new Set();
    let syncMode = 'merge';
    let pendingAction = null;

    // 定时器
    let refreshTimer = null;
    let autoSyncTimer = null;

    // 设置相关元素
    const refreshIntervalInput = document.getElementById('refreshInterval');
    const autoSyncEnabledInput = document.getElementById('autoSyncEnabled');
    const autoSyncIntervalInput = document.getElementById('autoSyncInterval');
    const autoSyncIntervalRow = document.getElementById('autoSyncIntervalRow');
    const autoSyncStatus = document.getElementById('autoSyncStatus');

    // 默认设置
    let settings = {
        refreshInterval: 1,
        autoSyncEnabled: false,
        autoSyncInterval: 5,
        targetFolder: '',      // 保存选择的网站同步文件夹
        browserFolder: ''      // 保存选择的浏览器书签位置
    };

    // 加载设置
    const loadSettings = async () => {
        try {
            const stored = await chrome.storage.local.get(SETTINGS_KEY);
            if (stored[SETTINGS_KEY]) {
                settings = { ...settings, ...stored[SETTINGS_KEY] };
            }
            // 应用设置到UI
            refreshIntervalInput.value = settings.refreshInterval;
            autoSyncEnabledInput.checked = settings.autoSyncEnabled;
            autoSyncIntervalInput.value = settings.autoSyncInterval;
            autoSyncIntervalRow.style.display = settings.autoSyncEnabled ? 'flex' : 'none';
            // 文件夹选择会在数据加载后恢复
        } catch (e) {
            console.error('[CloudNav] 加载设置失败:', e);
        }
    };

    // 保存设置
    const saveSettings = async () => {
        settings.refreshInterval = parseInt(refreshIntervalInput.value) || 1;
        settings.autoSyncEnabled = autoSyncEnabledInput.checked;
        settings.autoSyncInterval = parseInt(autoSyncIntervalInput.value) || 5;
        settings.targetFolder = targetFolderInput.value;
        settings.browserFolder = browserFolderInput.value;

        try {
            await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
            console.log('[CloudNav] 设置已保存:', settings);
        } catch (e) {
            console.error('[CloudNav] 保存设置失败:', e);
        }

        // 重新启动定时器
        startTimers();
    };

    // 加载上次状态（上次刷新/同步时间）
    const loadStatus = async () => {
        try {
            const stored = await chrome.storage.local.get(STATUS_KEY);
            const s = stored[STATUS_KEY] || {};
            if (dataRefreshTimeEl) dataRefreshTimeEl.textContent = s.lastRefresh ? '上次刷新: ' + new Date(s.lastRefresh).toLocaleString() : '上次刷新: —';
            if (bookmarkSyncTimeEl) bookmarkSyncTimeEl.textContent = s.lastSync ? '书签同步: ' + new Date(s.lastSync).toLocaleString() : '书签同步: —';
        } catch (e) {
            console.error('[CloudNav] 加载状态失败:', e);
        }
    };

    const setLastRefresh = async (ts) => {
        try {
            if (dataRefreshTimeEl) dataRefreshTimeEl.textContent = '上次刷新: ' + new Date(ts).toLocaleString();
            const stored = await chrome.storage.local.get(STATUS_KEY);
            const s = stored[STATUS_KEY] || {};
            s.lastRefresh = ts;
            await chrome.storage.local.set({ [STATUS_KEY]: s });
        } catch (e) {
            console.error('[CloudNav] 保存刷新时间失败:', e);
        }
    };

    const setLastSync = async (ts) => {
        try {
            if (bookmarkSyncTimeEl) bookmarkSyncTimeEl.textContent = '书签同步: ' + new Date(ts).toLocaleString();
            const stored = await chrome.storage.local.get(STATUS_KEY);
            const s = stored[STATUS_KEY] || {};
            s.lastSync = ts;
            await chrome.storage.local.set({ [STATUS_KEY]: s });
        } catch (e) {
            console.error('[CloudNav] 保存同步时间失败:', e);
        }
    };

    // 启动定时器
    const startTimers = () => {
        // 清除现有定时器
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }

        // 数据刷新定时器
        const refreshMs = settings.refreshInterval * 60 * 1000;
        refreshTimer = setInterval(() => {
            console.log('[CloudNav] 定时刷新数据');
            loadData(true);
        }, refreshMs);
        console.log('[CloudNav] 数据刷新定时器已启动，间隔:', settings.refreshInterval, '分钟');

        // 自动同步定时器
        if (settings.autoSyncEnabled) {
            const syncMs = settings.autoSyncInterval * 60 * 1000;
            autoSyncTimer = setInterval(() => {
                console.log('[CloudNav] 定时自动同步书签');
                autoSyncBookmarks();
            }, syncMs);
            updateAutoSyncStatus('已启用，每 ' + settings.autoSyncInterval + ' 分钟同步一次');
            console.log('[CloudNav] 自动同步定时器已启动，间隔:', settings.autoSyncInterval, '分钟');
        } else {
            updateAutoSyncStatus('未启用');
        }
    };

    // 更新自动同步状态显示
    const updateAutoSyncStatus = (text) => {
        if (autoSyncStatus) {
            autoSyncStatus.textContent = text;
        }
    };

    // 自动同步书签到网站
    const autoSyncBookmarks = async () => {
        if (!CONFIG.password) {
            console.log('[CloudNav] 未配置密码，跳过自动同步');
            return;
        }

        const targetFolder = targetFolderInput.value;
        if (!targetFolder) {
            console.log('[CloudNav] 未选择目标文件夹，跳过自动同步');
            return;
        }

        try {
            updateAutoSyncStatus('正在同步...');
            const tree = await chrome.bookmarks.getTree();
            const bookmarks = parseBrowserBookmarks(tree);

            if (bookmarks.length === 0) {
                updateAutoSyncStatus('无书签可同步');
                return;
            }

            // 静默执行上传（合并模式）
            await executeUploadSilent(bookmarks, targetFolder);
            updateAutoSyncStatus('上次同步: ' + new Date().toLocaleTimeString());
            await setLastSync(Date.now());
        } catch (e) {
            console.error('[CloudNav] 自动同步失败:', e);
            updateAutoSyncStatus('同步失败: ' + e.message);
        }
    };

    // 填充文件夹下拉选项
    const populateFolderOptions = () => {
        // 清空现有选项
        targetFolderInput.innerHTML = '<option value="">-- 选择网站文件夹 --</option>';

        // 获取顶级分类（没有 parentId 的分类）
        const topLevelCategories = allCategories.filter(c => !c.parentId);

        // 按 order 排序
        topLevelCategories.sort((a, b) => (a.order || 0) - (b.order || 0));

        // 添加选项
        topLevelCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            targetFolderInput.appendChild(option);
        });

        // 添加"新建文件夹"选项
        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ 新建文件夹 (chrome)';
        targetFolderInput.appendChild(newOption);

        // 恢复之前选择的文件夹
        if (settings.targetFolder) {
            targetFolderInput.value = settings.targetFolder;
        }

        console.log('[CloudNav] 文件夹选项已更新，共', topLevelCategories.length, '个');
    };

    // 填充浏览器书签位置选项
    const populateBrowserFolderOptions = async () => {
        try {
            const tree = await chrome.bookmarks.getTree();
            const root = tree[0];

            browserFolderInput.innerHTML = '<option value="">-- 选择浏览器同步位置 --</option>';

            // 递归添加文件夹选项
            const addFolderOptions = (nodes, level = 0) => {
                for (const node of nodes) {
                    // 只添加文件夹（没有url的节点），排除根目录
                    if (!node.url && node.id !== '0') {
                        const option = document.createElement('option');
                        option.value = node.id;

                        // 根据ID或标题判断根目录类型
                        let displayName = node.title;
                        if (level === 0) {
                            if (node.id === '1' || node.title === '书签栏' || node.title === 'Bookmarks Bar') {
                                displayName = '📑 书签栏';
                            } else if (node.id === '2' || node.title === '其他书签' || node.title === 'Other Bookmarks') {
                                displayName = '📁 其他书签';
                            } else if (node.title === '移动设备书签' || node.title === 'Mobile Bookmarks') {
                                displayName = '📱 移动设备书签';
                            }
                        } else {
                            // 子目录添加缩进
                            displayName = '　'.repeat(level) + '└ ' + node.title;
                        }
                        option.textContent = displayName;
                        browserFolderInput.appendChild(option);

                        // 递归添加子文件夹（限制深度为5层，避免过深）
                        if (node.children && level < 5) {
                            addFolderOptions(node.children, level + 1);
                        }
                    }
                }
            };

            // 从根目录的子节点开始
            if (root.children) {
                addFolderOptions(root.children, 0);
            }

            // 恢复之前选择的浏览器文件夹
            if (settings.browserFolder) {
                browserFolderInput.value = settings.browserFolder;
            }

            console.log('[CloudNav] 浏览器书签位置选项已更新');
        } catch (e) {
            console.error('[CloudNav] 获取浏览器书签位置失败:', e);
        }
    };

    // 设置事件监听
    refreshIntervalInput.addEventListener('change', saveSettings);
    autoSyncEnabledInput.addEventListener('change', () => {
        autoSyncIntervalRow.style.display = autoSyncEnabledInput.checked ? 'flex' : 'none';
        saveSettings();
    });
    autoSyncIntervalInput.addEventListener('change', saveSettings);

    // 文件夹选择变化时保存设置
    targetFolderInput.addEventListener('change', saveSettings);
    browserFolderInput.addEventListener('change', saveSettings);

    // 浏览器书签位置选择器获得焦点时刷新可选文件夹
    browserFolderInput.addEventListener('focus', () => {
        populateBrowserFolderOptions();
    });

    // 切换同步面板
    syncToggle.addEventListener('click', () => {
        syncPanel.classList.toggle('active');
    });

    // 同步模式切换
    modeMergeBtn.addEventListener('click', () => {
        syncMode = 'merge';
        modeMergeBtn.classList.add('active');
        modeOverwriteBtn.classList.remove('active');
    });

    modeOverwriteBtn.addEventListener('click', () => {
        syncMode = 'overwrite';
        modeOverwriteBtn.classList.add('active');
        modeMergeBtn.classList.remove('active');
    });

    // 确认弹窗
    const showConfirm = (title, body, isDanger, onConfirm) => {
        modalTitle.innerHTML = title;
        modalBody.innerHTML = body;
        modalConfirm.className = isDanger ? 'modal-btn danger' : 'modal-btn confirm';
        pendingAction = onConfirm;
        confirmModal.classList.add('active');
    };

    modalCancel.addEventListener('click', () => {
        confirmModal.classList.remove('active');
        pendingAction = null;
    });

    modalConfirm.addEventListener('click', () => {
        confirmModal.classList.remove('active');
        if (pendingAction) pendingAction();
        pendingAction = null;
    });

    // 进度更新
    const updateProgress = (current, total, message) => {
        syncProgress.style.display = 'block';
        syncMessage.textContent = message;
        syncProgressFill.style.width = total > 0 ? `${(current / total) * 100}%` : '0%';
    };

    const hideProgress = () => {
        syncProgress.style.display = 'none';
    };

    // 生成 URI
    const generateUri = (name) => {
        return name.toLowerCase()
            .replace(/[\s\u4e00-\u9fa5]+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'folder';
    };

    // 生成唯一 URI（在同一父级下）
    const generateUniqueUri = (name, parentId, existingCategories) => {
        let baseUri = generateUri(name);
        let uri = baseUri;
        let counter = 1;

        // 检查是否存在相同 parentId 和 uri 的分类
        while (existingCategories.some(c => c.uri === uri && c.parentId === parentId)) {
            uri = `${baseUri}-${counter}`;
            counter++;
        }

        return uri;
    };

    // 获取网站图标
    const getFaviconUrl = (pageUrl) => {
        try {
            const url = new URL(chrome.runtime.getURL("/_favicon/"));
            url.searchParams.set("pageUrl", pageUrl);
            url.searchParams.set("size", "32");
            return url.toString();
        } catch (e) {
            return '';
        }
    };

    // 文件夹图标 SVG
    const folderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

    // 展开箭头 SVG
    const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    // 构建分类树
    const buildCategoryTree = (categories) => {
        const map = new Map();
        const roots = [];

        // 初始化所有节点
        categories.forEach(cat => {
            map.set(cat.id, { ...cat, children: [] });
        });

        // 构建树结构
        categories.forEach(cat => {
            const node = map.get(cat.id);
            if (cat.parentId && map.has(cat.parentId)) {
                map.get(cat.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        });

        // 按 order 排序
        const sortByOrder = (nodes) => {
            nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
            nodes.forEach(node => sortByOrder(node.children));
        };
        sortByOrder(roots);

        return roots;
    };

    // 获取分类下的所有链接数量（包括子分类）
    const getCategoryLinkCount = (catId, links, categories) => {
        let count = links.filter(l => l.categoryId === catId).length;
        const children = categories.filter(c => c.parentId === catId);
        children.forEach(child => {
            count += getCategoryLinkCount(child.id, links, categories);
        });
        return count;
    };

    // 切换文件夹展开状态
    const toggleFolder = (catId) => {
        if (expandedFolders.has(catId)) {
            expandedFolders.delete(catId);
        } else {
            expandedFolders.add(catId);
        }
        render(searchInput.value);
    };

    // 渲染树形结构
    const render = (filter = '') => {
        const q = filter.toLowerCase().trim();
        const isSearching = q.length > 0;

        // 过滤链接
        const filteredLinks = isSearching
            ? allLinks.filter(l =>
                l.title.toLowerCase().includes(q) ||
                l.url.toLowerCase().includes(q) ||
                (l.description && l.description.toLowerCase().includes(q))
            )
            : allLinks;

        if (filteredLinks.length === 0 && allCategories.length === 0) {
            container.innerHTML = '<div class="empty">暂无数据</div>';
            return;
        }

        if (isSearching && filteredLinks.length === 0) {
            container.innerHTML = '<div class="empty">无搜索结果</div>';
            return;
        }

        // 构建分类树
        const categoryTree = buildCategoryTree(allCategories);

        // 渲染节点
        const renderNode = (cat, level = 0) => {
            const catLinks = filteredLinks.filter(l => l.categoryId === cat.id);
            const hasChildren = cat.children.length > 0 || catLinks.length > 0;
            const isExpanded = expandedFolders.has(cat.id) || isSearching;
            const linkCount = getCategoryLinkCount(cat.id, filteredLinks, allCategories);
            const indentClass = `indent-${Math.min(level, 5)}`;

            // 如果搜索时该分类及子分类没有匹配的链接，跳过
            if (isSearching && linkCount === 0) {
                return '';
            }

            let html = `
                <div class="tree-row ${indentClass}" data-cat-id="${cat.id}">
                    <span class="tree-arrow ${isExpanded ? 'expanded' : ''} ${hasChildren ? '' : 'hidden'}">${arrowSvg}</span>
                    <span class="tree-icon">${folderIconSvg}</span>
                    <span class="tree-title">${cat.name}</span>
                    <span class="tree-count">${linkCount}</span>
                </div>
            `;

            if (hasChildren) {
                html += `<div class="tree-children ${isExpanded ? 'expanded' : ''}">`;

                // 先渲染子分类
                cat.children.forEach(child => {
                    html += renderNode(child, level + 1);
                });

                // 再渲染该分类下的链接
                catLinks.forEach(link => {
                    const iconSrc = link.icon || getFaviconUrl(link.url);
                    html += `
                        <a href="${link.url}" target="_blank" class="tree-row indent-${Math.min(level + 1, 5)}" title="${link.title}\n${link.url}">
                            <span class="tree-arrow hidden">${arrowSvg}</span>
                            <span class="tree-icon"><img src="${iconSrc}" onerror="this.style.display='none'"/></span>
                            <span class="tree-title">${link.title}</span>
                        </a>
                    `;
                });

                html += '</div>';
            }

            return html;
        };

        let html = '';
        categoryTree.forEach(cat => {
            html += renderNode(cat, 0);
        });

        // 渲染没有分类的链接（如果有的话）
        const uncategorizedLinks = filteredLinks.filter(l => !allCategories.some(c => c.id === l.categoryId));
        if (uncategorizedLinks.length > 0) {
            html += `
                <div class="tree-row indent-0" data-cat-id="__uncategorized__">
                    <span class="tree-arrow ${expandedFolders.has('__uncategorized__') || isSearching ? 'expanded' : ''}">${arrowSvg}</span>
                    <span class="tree-icon">${folderIconSvg}</span>
                    <span class="tree-title">未分类</span>
                    <span class="tree-count">${uncategorizedLinks.length}</span>
                </div>
                <div class="tree-children ${expandedFolders.has('__uncategorized__') || isSearching ? 'expanded' : ''}">
            `;
            uncategorizedLinks.forEach(link => {
                const iconSrc = link.icon || getFaviconUrl(link.url);
                html += `
                    <a href="${link.url}" target="_blank" class="tree-row indent-1" title="${link.title}\n${link.url}">
                        <span class="tree-arrow hidden">${arrowSvg}</span>
                        <span class="tree-icon"><img src="${iconSrc}" onerror="this.style.display='none'"/></span>
                        <span class="tree-title">${link.title}</span>
                    </a>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html || '<div class="empty">暂无数据</div>';
    };

    // 点击事件处理
    container.addEventListener('click', (e) => {
        const row = e.target.closest('.tree-row');
        if (!row) return;

        // 如果是链接，让默认行为处理
        if (row.tagName === 'A') return;

        // 如果是文件夹，切换展开状态
        const catId = row.dataset.catId;
        if (catId) {
            e.preventDefault();
            toggleFolder(catId);
        }
    });

    // 加载数据
    const loadData = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                const cached = await chrome.storage.local.get(CACHE_KEY);
                if (cached[CACHE_KEY]) {
                    const data = cached[CACHE_KEY];
                    allLinks = data.links || [];
                    allCategories = data.categories || [];
                    render(searchInput.value);
                    console.log('[CloudNav] 从缓存加载:', allLinks.length, '个链接');
                    // 使用缓存也更新刷新时间显示
                    await setLastRefresh(Date.now());
                    return;
                }
            }

            refreshBtn.classList.add('rotating');
            container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>同步中...</span></div>';

            const apiUrl = `${CONFIG.apiBase}/api/storage`;
            console.log('[CloudNav] 请求:', apiUrl);

            let res;
            try {
                res = await fetch(apiUrl, {
                    headers: CONFIG.password ? { 'x-auth-password': CONFIG.password } : {}
                });
            } catch (fetchError) {
                console.error('[CloudNav] 网络错误:', fetchError);
                throw new Error(`网络错误: ${fetchError.message || '无法连接'}`);
            }

            console.log('[CloudNav] 状态:', res.status);

            const text = await res.text();
            console.log('[CloudNav] 响应长度:', text.length);

            if (!res.ok) {
                let errorMsg = `请求失败 (${res.status})`;
                try {
                    const errorData = JSON.parse(text);
                    if (errorData.error) errorMsg = errorData.error;
                } catch (e) { }
                throw new Error(errorMsg);
            }

            if (!text || text.trim() === '') {
                throw new Error('服务器返回空响应');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('[CloudNav] JSON 解析失败:', text.substring(0, 100));
                throw new Error('数据格式错误');
            }

            console.log('[CloudNav] 加载成功:', data.links?.length || 0, '链接,', data.categories?.length || 0, '分类');

            allLinks = data.links || [];
            allCategories = data.categories || [];

            await chrome.storage.local.set({ [CACHE_KEY]: data });
            render(searchInput.value);
            populateFolderOptions();
            await setLastRefresh(Date.now());
        } catch (e) {
            console.error('[CloudNav] 错误:', e);
            container.innerHTML = `<div class="empty" style="color:#dc3545">${e.message}<br><br><small style="opacity:0.7">点击刷新重试</small></div>`;
        } finally {
            refreshBtn.classList.remove('rotating');
        }
    };

    // 递归获取浏览器书签（从指定节点开始）
    const parseBrowserBookmarks = (nodes, parentPath = '') => {
        const bookmarks = [];
        for (const node of nodes) {
            const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;
            if (node.url) {
                bookmarks.push({ title: node.title, url: node.url, path: parentPath || '根目录' });
            }
            if (node.children) {
                bookmarks.push(...parseBrowserBookmarks(node.children, currentPath));
            }
        }
        return bookmarks;
    };

    // 上传书签
    uploadBtn.addEventListener('click', async () => {
        if (!CONFIG.password) {
            alert('请先配置密码');
            return;
        }

        const browserFolderId = browserFolderInput.value;
        if (!browserFolderId) {
            alert('请选择浏览器同步位置');
            return;
        }

        const targetFolder = targetFolderInput.value;
        if (!targetFolder || targetFolder === '__new__') {
            alert('请选择网站目标文件夹');
            return;
        }

        try {
            updateProgress(0, 0, '获取浏览器书签...');

            // 获取选择的浏览器文件夹及其完整子树
            const [browserFolderTree] = await chrome.bookmarks.getSubTree(browserFolderId);
            const browserFolderName = browserFolderTree.title || '书签';

            // 获取该文件夹下的所有书签（包括子文件夹）
            const bookmarks = parseBrowserBookmarks(browserFolderTree.children || [], '');

            if (bookmarks.length === 0) {
                hideProgress();
                alert('选择的浏览器文件夹中没有书签');
                return;
            }

            hideProgress();
            const warning = syncMode === 'overwrite' ? `<p class="modal-warning">⚠️ 将清空网站 /${targetFolder} 下的所有内容</p>` : '';

            showConfirm(
                '上传书签',
                `<p>从 <strong>${browserFolderName}</strong> 同步 <strong>${bookmarks.length}</strong> 个书签</p><p>目标: <strong>/${targetFolder}</strong></p>${warning}`,
                syncMode === 'overwrite',
                () => executeUpload(bookmarks, targetFolder)
            );
        } catch (e) {
            hideProgress();
            alert('获取书签失败: ' + e.message);
        }
    });

    // 静默执行上传（用于自动同步，不显示弹窗）
    const executeUploadSilent = async (bookmarks, targetFolder) => {
        try {
            const res = await fetch(`${CONFIG.apiBase}/api/storage`, {
                headers: { 'x-auth-password': CONFIG.password }
            });
            if (!res.ok) throw new Error('获取数据失败');
            const data = await res.json();
            let newCategories = [...(data.categories || [])];
            let newLinks = [...(data.links || [])];

            let rootCategory = newCategories.find(c => c.name === targetFolder && !c.parentId);

            if (!rootCategory) {
                rootCategory = {
                    id: Date.now().toString(),
                    name: targetFolder,
                    icon: 'Chrome',
                    uri: generateUri(targetFolder),
                    order: newCategories.length,
                    createdAt: Date.now()
                };
                newCategories.push(rootCategory);
            }

            const categoryMap = new Map();
            categoryMap.set('根目录', rootCategory.id);

            const paths = [...new Set(bookmarks.map(b => b.path))].sort();
            for (const path of paths) {
                if (path === '根目录') continue;
                const parts = path.split('/').filter(Boolean);
                let currentParentId = rootCategory.id;
                let currentPath = '';

                for (const part of parts) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    if (!categoryMap.has(currentPath)) {
                        let category = newCategories.find(c => c.name === part && c.parentId === currentParentId);
                        if (!category) {
                            category = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                name: part,
                                icon: 'Folder',
                                uri: generateUniqueUri(part, currentParentId, newCategories),
                                parentId: currentParentId,
                                order: newCategories.length,
                                createdAt: Date.now()
                            };
                            newCategories.push(category);
                        }
                        categoryMap.set(currentPath, category.id);
                        currentParentId = category.id;
                    } else {
                        currentParentId = categoryMap.get(currentPath);
                    }
                }
            }

            let addedCount = 0;
            for (const bookmark of bookmarks) {
                const categoryId = categoryMap.get(bookmark.path) || rootCategory.id;

                const exists = newLinks.some(l =>
                    l.url.replace(/\/$/, '').toLowerCase() === bookmark.url.replace(/\/$/, '').toLowerCase() &&
                    l.categoryId === categoryId
                );

                if (!exists) {
                    newLinks.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        title: bookmark.title || '未命名',
                        url: bookmark.url,
                        categoryId: categoryId,
                        createdAt: Date.now(),
                        order: newLinks.filter(l => l.categoryId === categoryId).length
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                const saveRes = await fetch(`${CONFIG.apiBase}/api/storage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-password': CONFIG.password
                    },
                    body: JSON.stringify({ links: newLinks, categories: newCategories })
                });

                if (!saveRes.ok) throw new Error('保存失败');

                allLinks = newLinks;
                allCategories = newCategories;
                await chrome.storage.local.set({ [CACHE_KEY]: { links: newLinks, categories: newCategories } });
                render(searchInput.value);
                populateFolderOptions();
            }

            console.log('[CloudNav] 自动同步完成，添加', addedCount, '个书签');
        } catch (e) {
            console.error('[CloudNav] 自动同步失败:', e);
            throw e;
        }
    };

    // 执行上传 - 直接同步到选择的网站文件夹
    const executeUpload = async (bookmarks, targetFolder) => {
        try {
            uploadBtn.disabled = true;
            downloadBtn.disabled = true;

            updateProgress(0, 0, '获取网站数据...');
            const res = await fetch(`${CONFIG.apiBase}/api/storage`, {
                headers: { 'x-auth-password': CONFIG.password }
            });
            if (!res.ok) throw new Error('获取数据失败');
            const data = await res.json();
            let newCategories = [...(data.categories || [])];
            let newLinks = [...(data.links || [])];

            // 查找目标分类
            let rootCategory = newCategories.find(c => c.name === targetFolder && !c.parentId);

            if (!rootCategory) {
                alert(`未找到网站文件夹 "${targetFolder}"`);
                return;
            }

            // 覆盖模式：清空目标文件夹下的所有子内容（保留文件夹本身）
            if (syncMode === 'overwrite') {
                const getDescendantIds = (catId) => {
                    const ids = [];
                    newCategories.filter(c => c.parentId === catId).forEach(c => {
                        ids.push(c.id);
                        ids.push(...getDescendantIds(c.id));
                    });
                    return ids;
                };
                const childIds = getDescendantIds(rootCategory.id);
                // 删除子分类
                newCategories = newCategories.filter(c => !childIds.includes(c.id));
                // 删除目标分类及其子分类下的所有链接
                newLinks = newLinks.filter(l => l.categoryId !== rootCategory.id && !childIds.includes(l.categoryId));
            }

            const categoryMap = new Map();
            categoryMap.set('根目录', rootCategory.id);

            const paths = [...new Set(bookmarks.map(b => b.path))].sort();
            for (const path of paths) {
                if (path === '根目录') continue;
                const parts = path.split('/').filter(Boolean);
                let currentParentId = rootCategory.id;
                let currentPath = '';

                for (const part of parts) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    if (!categoryMap.has(currentPath)) {
                        let category = newCategories.find(c => c.name === part && c.parentId === currentParentId);
                        if (!category) {
                            category = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                name: part,
                                icon: 'Folder',
                                uri: generateUniqueUri(part, currentParentId, newCategories),
                                parentId: currentParentId,
                                order: newCategories.length,
                                createdAt: Date.now()
                            };
                            newCategories.push(category);
                        }
                        categoryMap.set(currentPath, category.id);
                        currentParentId = category.id;
                    } else {
                        currentParentId = categoryMap.get(currentPath);
                    }
                }
            }

            let addedCount = 0, skippedCount = 0;
            const total = bookmarks.length;

            for (let i = 0; i < bookmarks.length; i++) {
                const bookmark = bookmarks[i];
                const categoryId = categoryMap.get(bookmark.path) || rootCategory.id;

                updateProgress(i + 1, total, `处理: ${bookmark.title.substring(0, 20)}...`);

                const exists = newLinks.some(l =>
                    l.url.replace(/\/$/, '').toLowerCase() === bookmark.url.replace(/\/$/, '').toLowerCase() &&
                    l.categoryId === categoryId
                );

                if (exists && syncMode === 'merge') {
                    skippedCount++;
                } else {
                    newLinks.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        title: bookmark.title || '未命名',
                        url: bookmark.url,
                        categoryId: categoryId,
                        createdAt: Date.now(),
                        order: newLinks.filter(l => l.categoryId === categoryId).length
                    });
                    addedCount++;
                }
            }

            updateProgress(total, total, '保存中...');
            const saveRes = await fetch(`${CONFIG.apiBase}/api/storage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-password': CONFIG.password
                },
                body: JSON.stringify({ links: newLinks, categories: newCategories })
            });

            if (!saveRes.ok) throw new Error('保存失败');

            allLinks = newLinks;
            allCategories = newCategories;
            await chrome.storage.local.set({ [CACHE_KEY]: { links: newLinks, categories: newCategories } });
            render(searchInput.value);

            hideProgress();
            alert(`完成！添加 ${addedCount} 个，跳过 ${skippedCount} 个`);
            await setLastSync(Date.now());
        } catch (e) {
            hideProgress();
            alert('上传失败: ' + e.message);
        } finally {
            uploadBtn.disabled = false;
            downloadBtn.disabled = false;
        }
    };

    // 下载书签到浏览器
    downloadBtn.addEventListener('click', async () => {
        if (!CONFIG.password) {
            alert('请先配置密码');
            return;
        }

        // 先刷新网站数据
        try {
            downloadBtn.disabled = true;
            downloadBtn.textContent = '刷新数据中...';
            await loadData(true);
        } catch (e) {
            alert('刷新数据失败: ' + e.message);
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '↓ 同步到浏览器';
            return;
        }
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '↓ 同步到浏览器';

        const targetFolder = targetFolderInput.value || 'chrome';
        const targetCategory = allCategories.find(c => c.name === targetFolder && !c.parentId);

        if (!targetCategory) {
            alert(`未找到 "${targetFolder}" 分类`);
            return;
        }

        const browserFolderId = browserFolderInput.value;
        if (!browserFolderId) {
            alert('请选择浏览器同步位置');
            return;
        }

        const getDescendantIds = (catId) => {
            const ids = [catId];
            allCategories.filter(c => c.parentId === catId).forEach(c => {
                ids.push(...getDescendantIds(c.id));
            });
            return ids;
        };

        const categoryIds = getDescendantIds(targetCategory.id);
        const linksToSync = allLinks.filter(l => categoryIds.includes(l.categoryId));

        if (linksToSync.length === 0) {
            alert('该分类下没有书签');
            return;
        }

        // 获取浏览器文件夹名称用于显示
        let browserFolderName = '选择的位置';
        try {
            const [folder] = await chrome.bookmarks.get(browserFolderId);
            browserFolderName = folder.title || '书签栏';
        } catch (e) { }

        const warning = syncMode === 'overwrite' ? `<p class="modal-warning">⚠️ 将清空浏览器中 "${browserFolderName}" 的所有内容</p>` : '';

        showConfirm(
            '同步到浏览器',
            `<p>同步 <strong>${linksToSync.length}</strong> 个书签</p><p>来源: <strong>/${targetFolder}</strong> → 目标: <strong>${browserFolderName}</strong></p>${warning}`,
            syncMode === 'overwrite',
            () => executeDownload(targetCategory, linksToSync, browserFolderId)
        );
    });

    // 执行下载 - 直接同步到选择的浏览器位置
    const executeDownload = async (targetCategory, linksToSync, browserFolderId) => {
        try {
            uploadBtn.disabled = true;
            downloadBtn.disabled = true;

            updateProgress(0, 0, '准备同步...');

            // 覆盖模式：清空目标文件夹的所有内容
            if (syncMode === 'overwrite') {
                const existingItems = await chrome.bookmarks.getChildren(browserFolderId);
                for (const item of existingItems) {
                    if (item.url) {
                        await chrome.bookmarks.remove(item.id);
                    } else {
                        await chrome.bookmarks.removeTree(item.id);
                    }
                }
            }

            // 创建分类到浏览器文件夹的映射
            const folderMap = new Map();
            // 网站的目标分类直接对应浏览器选择的位置
            folderMap.set(targetCategory.id, browserFolderId);

            // 递归创建子文件夹
            const createFolders = async (parentCatId, parentFolderId) => {
                const childCategories = allCategories.filter(c => c.parentId === parentCatId);
                for (const cat of childCategories) {
                    const existingChildren = await chrome.bookmarks.getChildren(parentFolderId);
                    let folder = existingChildren.find(c => c.title === cat.name && !c.url);

                    if (!folder) {
                        folder = await chrome.bookmarks.create({
                            parentId: parentFolderId,
                            title: cat.name
                        });
                    }

                    folderMap.set(cat.id, folder.id);
                    await createFolders(cat.id, folder.id);
                }
            };

            await createFolders(targetCategory.id, browserFolderId);

            let addedCount = 0, skippedCount = 0;
            const total = linksToSync.length;

            for (let i = 0; i < linksToSync.length; i++) {
                const link = linksToSync[i];
                const folderId = folderMap.get(link.categoryId) || browserFolderId;

                updateProgress(i + 1, total, `同步: ${link.title.substring(0, 20)}...`);

                const existingBookmarks = await chrome.bookmarks.getChildren(folderId);
                const exists = existingBookmarks.some(b =>
                    b.url && b.url.replace(/\/$/, '').toLowerCase() === link.url.replace(/\/$/, '').toLowerCase()
                );

                if (exists && syncMode === 'merge') {
                    skippedCount++;
                    continue;
                }

                await chrome.bookmarks.create({
                    parentId: folderId,
                    title: link.title,
                    url: link.url
                });
                addedCount++;
            }

            hideProgress();
            alert(`完成！添加 ${addedCount} 个，跳过 ${skippedCount} 个`);
            await setLastSync(Date.now());
        } catch (e) {
            hideProgress();
            alert('同步失败: ' + e.message);
        } finally {
            uploadBtn.disabled = false;
            downloadBtn.disabled = false;
        }
    };

    // 初始化
    const init = async () => {
        await loadSettings();
        await loadStatus();
        await populateBrowserFolderOptions(); // 填充浏览器书签位置选项
        await loadData(true); // 侧边栏打开时强制刷新数据
        startTimers();
    };
    init();

    searchInput.addEventListener('input', (e) => render(e.target.value));
    refreshBtn.addEventListener('click', () => loadData(true));

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'refresh') {
            loadData(true);
        }
    });
});
