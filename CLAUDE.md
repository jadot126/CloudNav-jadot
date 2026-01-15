# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudNav is a personal navigation site built with React + TypeScript, deployed on Cloudflare Pages with Cloudflare KV for data storage. The project supports nested category groups, URI-based routing, and password inheritance for access control.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start development server (with Mock API)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npx tsc --noEmit
```

## Deployment

- **Platform**: Cloudflare Pages
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Environment variables**:
  - `CLOUDNAV_KV`: KV namespace binding for data storage (required)

## Architecture

### Frontend (React + Vite)
- **Entry**: `src/index.tsx` → `src/App.tsx`
- **Types**: `src/types.ts` - Core interfaces
- **Components**: `src/components/` - Modal dialogs and UI components
  - `layout/` - Sidebar and Header components
  - `modals/` - Various modal dialogs
- **Hooks**: `src/hooks/` - Custom React hooks
  - `useCategories.ts` - Category tree management
  - `useLinks.ts` - Link filtering and sorting
  - `useSearch.ts` - Search functionality
- **Contexts**: `src/contexts/` - React Context providers
  - `AuthContext.tsx` - Authentication state
  - `DataContext.tsx` - Data management
- **Services**: `src/services/` - Business logic
- **Pages**: `src/pages/` - Page components
  - `InitSetupPage.tsx` - Initial admin password setup
- **Mock**: `src/mock/` - Mock API for local development

### Backend (Cloudflare Functions)
- **Location**: `functions/api/`
- **`storage.ts`**: Main API for CRUD operations, config management, URI routing
- **`link.ts`**: Dedicated endpoint for adding links (browser extension)
- **`webdav.ts`**: WebDAV proxy for backup functionality

### Data Storage (Cloudflare KV)
KV keys used:
- `app_data`: Main data (links and categories)
- `admin_config`: Admin password configuration (hashed)
- `ai_config`: AI service configuration
- `search_config`: External search sources configuration
- `website_config`: Site settings (title, favicon, password expiry)
- `favicon:{domain}`: Cached favicons (30-day TTL)
- `last_auth_time`: Password expiry tracking

### Key Data Types
```typescript
interface LinkItem {
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

interface Category {
  id: string;
  name: string;
  icon: string;
  uri: string;              // URL path segment
  parentId?: string;        // Parent category ID for nesting
  password?: string;        // Optional category-level password
  inheritPassword?: boolean; // Inherit parent's password
  order?: number;
  createdAt?: number;
}

interface AdminConfig {
  password: string;         // Hashed admin password
  initialized: boolean;
  createdAt: number;
}
```

## Key Features

### URI-based Routing
- Categories accessible via URL paths: `/tools`, `/tools/dev`, `/tools/dev/frontend`
- Nested category support with unlimited depth
- API endpoint: `GET /api/storage?uri={path}`

### Password Protection
- Admin password stored in KV (SHA-256 hashed)
- Category-level password protection
- Password inheritance from parent categories
- Session-level unlock state

### Authentication Flow
1. First visit: Check if admin is initialized
2. If not initialized: Redirect to `/setup` for password setup
3. Admin password stored in KV `admin_config` (hashed)
4. Client sends password via `x-auth-password` header
5. Token stored in localStorage with expiry tracking

### Data Sync
1. Optimistic UI update
2. Save to localStorage cache
3. Sync to Cloudflare KV if authenticated

### Local Development
- Mock API enabled automatically in development mode
- Uses localStorage to simulate KV storage
- Toggle via URL parameter: `?mock=true` or `?mock=false`

## Component Structure
- Modals handle specific features (LinkModal, CategoryManagerModal, SettingsModal, etc.)
- Main App.tsx manages global state and routing
- Drag-and-drop sorting via @dnd-kit
- Category tree with expand/collapse support

## Dependencies

Key packages:
- `react` / `react-dom` (v19)
- `react-router-dom` (v7) - Routing
- `@dnd-kit/core`, `@dnd-kit/sortable` - Drag and drop
- `lucide-react` - Icons
- `@google/genai` - AI integration
- `jszip` - Backup/export functionality
- `qrcode` - QR code generation
- `@cloudflare/workers-types` - Cloudflare Workers types
