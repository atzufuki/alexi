/**
 * Admin Config Service
 *
 * Fetches admin configuration from the REST API.
 * This allows the frontend to dynamically load model configurations
 * from the registered ModelAdmin classes on the backend.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

export interface ColumnConfig {
  field: string;
  label: string;
  sortable: boolean;
  isLink: boolean;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readOnly: boolean;
  choices?: { value: string; label: string }[];
}

export interface ModelConfig {
  name: string;
  apiEndpoint: string;
  verboseName: string;
  verboseNamePlural: string;
  columns: ColumnConfig[];
  fields: FieldConfig[];
  listFilter: string[];
  searchFields: string[];
  ordering: string[];
  listPerPage: number;
}

export interface AdminConfig {
  siteTitle: string;
  siteHeader: string;
  urlPrefix: string;
  models: ModelConfig[];
}

// =============================================================================
// Cache
// =============================================================================

let _cachedConfig: AdminConfig | null = null;
let _cachedModels: Map<string, ModelConfig> = new Map();

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get the base API URL
 */
function getApiUrl(): string {
  return globalThis.location?.origin ?? "http://localhost:8000";
}

/**
 * Fetch the full admin configuration
 */
export async function fetchAdminConfig(): Promise<AdminConfig> {
  if (_cachedConfig) {
    return _cachedConfig;
  }

  const response = await fetch(`${getApiUrl()}/admin/api/config/`, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch admin config: ${response.status}`);
  }

  const config: AdminConfig = await response.json();

  // Cache the config
  _cachedConfig = config;

  // Also cache individual models
  for (const model of config.models) {
    _cachedModels.set(model.name.toLowerCase(), model);
  }

  return config;
}

/**
 * Fetch configuration for a specific model
 */
export async function fetchModelConfig(
  modelName: string,
): Promise<ModelConfig | null> {
  const lowerName = modelName.toLowerCase();

  // Check cache first
  if (_cachedModels.has(lowerName)) {
    return _cachedModels.get(lowerName)!;
  }

  // If we have the full config cached, search there
  if (_cachedConfig) {
    const model = _cachedConfig.models.find(
      (m) => m.name.toLowerCase() === lowerName,
    );
    if (model) {
      _cachedModels.set(lowerName, model);
      return model;
    }
    return null;
  }

  // Fetch from API
  const response = await fetch(
    `${getApiUrl()}/admin/api/config/models/${modelName}/`,
    {
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch model config: ${response.status}`);
  }

  const model: ModelConfig = await response.json();

  // Cache it
  _cachedModels.set(lowerName, model);

  return model;
}

/**
 * Get list of all registered model names
 */
export async function fetchModelNames(): Promise<string[]> {
  const config = await fetchAdminConfig();
  return config.models.map((m) => m.name);
}

/**
 * Clear the configuration cache
 * Useful when the user logs out or config might have changed
 */
export function clearConfigCache(): void {
  _cachedConfig = null;
  _cachedModels.clear();
}

/**
 * Get site title from config
 */
export async function getSiteTitle(): Promise<string> {
  const config = await fetchAdminConfig();
  return config.siteTitle;
}

/**
 * Get site header from config
 */
export async function getSiteHeader(): Promise<string> {
  const config = await fetchAdminConfig();
  return config.siteHeader;
}
