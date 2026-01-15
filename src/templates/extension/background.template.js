// background.js - CloudNav Assistant v7.6
const CONFIG = {
  apiBase: "{{API_BASE}}",
  password: "{{PASSWORD}}"
};

let linkCache = [];
let categoryCache = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  refreshCache().then(buildMenus);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.cloudnav_data) {
        refreshCache().then(buildMenus);
    }
});

async function refreshCache() {
    const data = await chrome.storage.local.get('cloudnav_data');
    if (data && data.cloudnav_data) {
        linkCache = data.cloudnav_data.links || [];
        categoryCache = data.cloudnav_data.categories || [];
    }
    return;
}

const windowPorts = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'cloudnav_sidebar') return;
  port.onMessage.addListener((msg) => {
    if (msg.type === 'init' && msg.windowId) {
      windowPorts[msg.windowId] = port;
      port.onDisconnect.addListener(() => {
        if (windowPorts[msg.windowId] === port) {
          delete windowPorts[msg.windowId];
        }
      });
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
    const windowId = tab.windowId;
    const existingPort = windowPorts[windowId];

    if (existingPort) {
        try {
            existingPort.postMessage({ action: 'close_panel' });
        } catch (e) {
            delete windowPorts[windowId];
            chrome.sidePanel.open({ windowId });
        }
    } else {
        try {
            await chrome.sidePanel.open({ windowId: windowId });
        } catch (e) {
            console.error('Failed to open sidebar', e);
        }
    }
});

function buildMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "cloudnav_root",
            title: "⚡ 保存到 CloudNav",
            contexts: ["page", "link", "action"]
        });

        if (categoryCache.length > 0) {
            categoryCache.forEach(cat => {
                chrome.contextMenus.create({
                    id: `save_to_${cat.id}`,
                    parentId: "cloudnav_root",
                    title: cat.name,
                    contexts: ["page", "link", "action"]
                });
            });
        } else {
            chrome.contextMenus.create({
                id: "save_to_common",
                parentId: "cloudnav_root",
                title: "默认分类",
                contexts: ["page", "link", "action"]
            });
        }
    });
}

function updateMenuTitle(url) {
    if (!url) return;
    const cleanUrl = url.replace(/\/$/, '').toLowerCase();
    const exists = linkCache.some(l => l.url && l.url.replace(/\/$/, '').toLowerCase() === cleanUrl);
    const newTitle = exists ? "⚠️ 已存在 - 保存到 CloudNav" : "⚡ 保存到 CloudNav";
    chrome.contextMenus.update("cloudnav_root", { title: newTitle }, () => {
        if (chrome.runtime.lastError) { }
    });
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
   try {
       const tab = await chrome.tabs.get(activeInfo.tabId);
       if (tab && tab.url) updateMenuTitle(tab.url);
   } catch(e){}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
   if (changeInfo.status === 'complete' && tab.active && tab.url) {
       updateMenuTitle(tab.url);
   }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (String(info.menuItemId).startsWith("save_to_")) {
        const catId = String(info.menuItemId).replace("save_to_", "");
        const title = tab.title;
        const url = info.linkUrl || tab.url;
        const cleanUrl = url.replace(/\/$/, '').toLowerCase();
        const exists = linkCache.some(l => l.url.replace(/\/$/, '').toLowerCase() === cleanUrl);
        saveLink(title, url, catId);
    }
});

async function saveLink(title, url, categoryId, icon = '') {
    if (!CONFIG.password) {
        notify('保存失败', '未配置密码，请先在侧边栏登录。');
        return;
    }

    if (!icon) {
        try {
            const u = new URL(url);
            icon = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(u.origin)}&size=128`;
        } catch(e){}
    }

    try {
        const res = await fetch(`${CONFIG.apiBase}/api/link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': CONFIG.password
            },
            body: JSON.stringify({
                title: title || '未命名',
                url: url,
                categoryId: categoryId,
                icon: icon
            })
        });

        if (res.ok) {
            notify('保存成功', `已保存到 CloudNav`);
            chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
            const newLink = { id: Date.now().toString(), title, url, categoryId, icon };
            linkCache.unshift(newLink);
            updateMenuTitle(url);
        } else {
            notify('保存失败', `服务器错误: ${res.status}`);
        }
    } catch (e) {
        notify('保存失败', '网络请求错误');
    }
}

function notify(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: title,
        message: message,
        priority: 1
    });
}
