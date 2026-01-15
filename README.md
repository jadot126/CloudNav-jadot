# CloudNav

一个现代化的个人导航网站，基于 React + TypeScript 构建，部署在 Cloudflare Pages 上，使用 Cloudflare KV 进行数据存储。

## 功能特性

### 核心功能
- **网站直达**：首页按分组展示所有有访问权限的链接，快速直达目标网站
- **置顶收藏**：将常用链接置顶到 `/top` 页面，支持拖拽排序
- **链接管理**：添加、编辑、删除书签链接，支持自定义图标和描述
- **分组管理**：创建多级嵌套分组，支持拖拽排序
- **URI 路由**：每个分组可通过 URL 直接访问（如 `/tools`、`/tools/dev`）
- **搜索功能**：支持站内搜索和外部搜索引擎切换
- **智能深色模式**：根据时间自动切换（18:00-06:00 自动启用暗黑模式），也支持跟随系统主题或手动切换

### 安全特性
- **管理员密码**：首次访问时设置管理员密码，密码使用 SHA-256 哈希存储
- **管理员特权**：管理员登录后可访问所有分组，无需输入分组密码
- **分组密码保护**：为敏感分组设置独立密码
- **密码继承**：子分组可继承父分组的密码保护，父分组解锁后子分组自动解锁
- **密码过期**：可配置密码有效期
- **访问控制**：锁定分组的链接不会在首页和置顶收藏中显示
- **系统分类保护**：系统默认的 CloudNav 分类不可删除，URI 不可修改（仅允许修改名称和图标）
- **系统保留 URI**：`setup`、`api`、`admin`、`login`、`logout`、`auth`、`settings`、`config`、`top` 等 URI 被系统保留，不可被用户占用

### 数据管理
- **云端同步**：数据自动同步到 Cloudflare KV
- **本地缓存**：支持离线访问
- **WebDAV 备份**：支持备份到 WebDAV 服务器
- **导入导出**：支持浏览器书签导入和 JSON/HTML 导出

### 其他功能
- **AI 描述生成**：集成 Gemini/OpenAI API 自动生成链接描述
- **图标自动获取**：自动获取网站 favicon
- **二维码生成**：为链接生成二维码
- **浏览器扩展**：支持通过浏览器扩展快速添加链接和同步书签
- **响应式设计**：完美适配桌面和移动设备

### 浏览器扩展功能
- **侧边栏导航**：快捷键（Ctrl+Shift+E）打开侧边栏，快速访问收藏的链接
- **右键保存**：在网页上右键即可将当前页面保存到 CloudNav
- **书签双向同步**：
  - **上传到网站**：将浏览器指定文件夹的书签同步到网站指定文件夹
  - **同步到浏览器**：将网站指定文件夹的书签同步到浏览器指定位置
  - **同步模式**：支持合并（保留现有内容，仅添加新书签）和覆盖（清空目标位置后重新同步）两种模式
  - **文件夹选择**：支持选择浏览器书签栏、其他书签及其子文件夹作为同步源或目标
  - **设置保存**：自动保存选择的文件夹配置，下次打开无需重新选择
- **自动同步**：可配置定时自动上传书签到网站
- **数据刷新**：可配置数据自动刷新间隔，同步到浏览器前自动刷新最新数据
- **自动判重**：保存和同步时自动检测重复链接

## 部署说明

### 前置要求
- [Node.js](https://nodejs.org/) 18+
- [Cloudflare 账户](https://dash.cloudflare.com/)

### Cloudflare Pages 部署

1. **Fork 本仓库**到你的 GitHub 账户

2. **创建 Cloudflare KV 命名空间**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 Workers & Pages → KV
   - 创建一个新的命名空间（如 `cloudnav-data`）

3. **创建 Cloudflare Pages 项目**
   - 进入 Workers & Pages → Create application → Pages
   - 连接你的 GitHub 仓库
   - 配置构建设置：
     - **构建命令**：`npm run build`
     - **输出目录**：`dist`
     - **Node.js 版本**：18

4. **绑定 KV 命名空间**
   - 进入项目设置 → Functions → KV namespace bindings
   - 添加绑定：
     - **变量名**：`CLOUDNAV_KV`
     - **KV 命名空间**：选择之前创建的命名空间

5. **部署**
   - 推送代码到 GitHub，Cloudflare Pages 会自动构建部署
   - 首次访问时会提示设置管理员密码
   - 管理员密码设置成功后，系统会自动创建默认的 CloudNav 分类和示例链接

### 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `CLOUDNAV_KV` | 是 | Cloudflare KV 命名空间绑定 |

## 开发说明

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-username/CloudNav.git
cd CloudNav

# 安装依赖
npm install

# 启动开发服务器（自动启用 Mock API）
npm run dev
```

开发服务器默认运行在 `http://localhost:3000`，Mock API 由 Vite 服务器中间件自动处理。

#### Mock API 说明

开发环境下，Vite 服务器会自动拦截 `/api/*` 请求并由内置的 Mock API 处理：

- **数据存储**：Mock 数据存储在项目根目录的 `.mock-data/` 文件夹中（已加入 `.gitignore`）
- **数据持久化**：重启开发服务器后数据仍然保留
- **清除数据**：删除 `.mock-data/` 目录即可重置所有数据

#### 浏览器扩展本地调试

由于 Mock API 现在由服务器端处理，浏览器扩展也可以连接到本地开发服务器：

1. 启动开发服务器：`npm run dev`
2. 在设置页面生成扩展时，`API_BASE` 填写 `http://localhost:3000`（或实际端口）
3. 安装生成的扩展，即可连接到本地 Mock API 进行调试

#### 切换到真实后端

如需在开发时连接到已部署的 Cloudflare Pages 后端，可以设置环境变量：

```bash
VITE_USE_REAL_API=true npm run dev
```

然后在 `vite.config.ts` 中配置 proxy 指向你的 Cloudflare Pages 域名。

### 构建

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview

# 类型检查
npx tsc --noEmit
```

### 项目结构

```
CloudNav/
├── src/
│   ├── components/       # React 组件
│   │   ├── layout/      # 布局组件（Sidebar, Header）
│   │   └── *.tsx        # 功能组件和弹窗
│   ├── contexts/        # React Context
│   ├── hooks/           # 自定义 Hooks
│   ├── pages/           # 页面组件
│   ├── services/        # 业务逻辑服务
│   │   └── extensionBuilder.ts  # 浏览器扩展生成服务
│   ├── templates/       # 模板文件
│   │   └── extension/   # 浏览器扩展模板
│   │       ├── manifest.template.json
│   │       ├── background.template.js
│   │       ├── sidebar.template.html
│   │       └── sidebar.template.js
│   ├── types.ts         # TypeScript 类型定义
│   ├── App.tsx          # 主应用组件
│   └── index.tsx        # 入口文件
├── scripts/
│   └── mockServer.ts    # Mock API 服务器（Vite 中间件）
├── functions/
│   └── api/             # Cloudflare Functions API
│       ├── storage.ts   # 主 API（数据 CRUD、配置管理）
│       ├── link.ts      # 链接添加 API（浏览器扩展用）
│       └── webdav.ts    # WebDAV 代理
├── .mock-data/          # Mock 数据存储（开发用，已忽略）
├── public/              # 静态资源
└── dist/                # 构建输出
```

### 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **路由**：React Router DOM 7
- **拖拽排序**：@dnd-kit
- **图标**：Lucide React
- **样式**：Tailwind CSS
- **AI 集成**：Google Generative AI
- **部署平台**：Cloudflare Pages + KV

### Mock API

开发环境下，Vite 服务器中间件会自动处理 `/api/*` 请求：

- **数据存储位置**：`.mock-data/` 目录（使用文件系统存储，支持持久化）
- **清除数据**：删除 `.mock-data/` 目录
- **支持的端点**：
  - `GET /api/storage` - 获取数据和配置
  - `POST /api/storage` - 保存数据和配置
  - `POST /api/link` - 添加链接（浏览器扩展用）

Mock API 同时支持主应用和浏览器扩展的本地调试。

## 鸣谢

本项目基于以下开源项目开发，特此感谢：

- [CloudNav](https://github.com/sese972010/CloudNav-) - 原始项目
- [CloudNav-abcd](https://github.com/Zmin2003/CloudNav-abcd) - 参考实现

感谢所有贡献者的付出！

## 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源协议发布。

```
Copyright 2024 CloudNav Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
