export interface RestaurantSettings {
  id: string;
  name: string;
  phone_1: string;
  phone_2: string;
  tagline?: string | null;
  address?: string | null;
  logo_url?: string | null;
  developer_name: string;
  developer_phone: string;
  developer_credit_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  image_filename?: string | null;
  image_status?: string | null;
  sort_order: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: string;
  dish_name: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_url: string;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  category_id?: string | null;
  category_name?: string | null;
  menu_item_id?: string | null;
  status: string;
  uploaded_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

/** Access level for dashboard accounts. */
export type UserRole = 'admin' | 'user';

/** A dashboard account as exposed to the UI (never includes password data). */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCategories: number;
  totalMenuItems: number;
  totalMediaImages: number;
  itemsMissingImages: number;
  recentImages: MediaItem[];
}

export interface ImportResult {
  categories: number;
  items: number;
  errors: string[];
}

/** One entry in the image replacement history for a menu item. */
export interface ImageHistoryEntry {
  id: string;
  menu_item_id: string;
  replaced_at: string;
  previous_url: string;
  previous_filename?: string | null;
  storage_path?: string | null;
  is_current: boolean;
  replaced_by?: string | null;
  notes?: string | null;
}

/** Metadata record for a full backup. */
export interface BackupRecord {
  id: string;
  created_at: string;
  created_by?: string | null;
  label?: string | null;
  filename: string;
  storage_path?: string | null;
  download_url?: string | null;
  size_bytes?: number | null;
  category_count?: number | null;
  item_count?: number | null;
  image_count?: number | null;
  status: 'complete' | 'partial' | 'failed';
  manifest?: Record<string, unknown> | null;
}
