/**
 * Pagination classes for Alexi REST Framework
 *
 * Provides DRF-style pagination for list endpoints.
 *
 * @module @alexi/restframework/pagination/pagination
 */

import type { Model, QuerySet } from "@alexi/db";

// ============================================================================
// Types
// ============================================================================

/**
 * Pagination class constructor type
 */
export interface PaginationClass {
  new (): BasePagination;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T = unknown> {
  /** Total number of items across all pages */
  count: number;

  /** URL to the next page (null if no next page) */
  next: string | null;

  /** URL to the previous page (null if no previous page) */
  previous: string | null;

  /** Results for the current page */
  results: T[];
}

/**
 * Pagination context passed to pagination methods
 */
export interface PaginationContext {
  /** The current HTTP request */
  request: Request;

  /** The view/viewset processing the request */
  view?: unknown;
}

// ============================================================================
// Base Pagination
// ============================================================================

/**
 * Base pagination class
 *
 * All pagination classes should extend this class and implement
 * the paginateQueryset and getResponseData methods.
 *
 * @example
 * ```ts
 * class MyPagination extends BasePagination {
 *   pageSize = 20;
 *
 *   async paginateQueryset<T extends Model>(
 *     queryset: QuerySet<T>,
 *     context: PaginationContext
 *   ): Promise<QuerySet<T>> {
 *     // Apply pagination logic
 *     return queryset.limit(this.pageSize);
 *   }
 *
 *   async getResponseData<T>(
 *     data: T[],
 *     context: PaginationContext
 *   ): Promise<PaginatedResponse<T>> {
 *     return {
 *       count: await this.getCount(),
 *       next: this.getNextLink(context),
 *       previous: this.getPreviousLink(context),
 *       results: data,
 *     };
 *   }
 * }
 * ```
 */
export abstract class BasePagination {
  /**
   * Number of items per page
   */
  pageSize = 10;

  /**
   * Query parameter for page size override
   * Set to null to disable client-controlled page size
   */
  pageSizeQueryParam: string | null = null;

  /**
   * Maximum allowed page size (prevents abuse)
   */
  maxPageSize = 100;

  /**
   * Stored count for response generation
   */
  protected _count = 0;

  /**
   * Paginate the queryset
   *
   * @param queryset - The queryset to paginate
   * @param context - Pagination context with request info
   * @returns Paginated queryset
   */
  abstract paginateQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: PaginationContext,
  ): Promise<QuerySet<T>>;

  /**
   * Get the paginated response data
   *
   * @param data - The serialized data array
   * @param context - Pagination context
   * @returns Paginated response object
   */
  abstract getResponseData<T>(
    data: T[],
    context: PaginationContext,
  ): Promise<PaginatedResponse<T>>;

  /**
   * Get the effective page size
   *
   * Respects client-controlled page size if enabled, with max limit.
   */
  getPageSize(context: PaginationContext): number {
    if (this.pageSizeQueryParam) {
      const url = new URL(context.request.url);
      const requestedSize = url.searchParams.get(this.pageSizeQueryParam);
      if (requestedSize) {
        const parsed = parseInt(requestedSize, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return Math.min(parsed, this.maxPageSize);
        }
      }
    }
    return this.pageSize;
  }

  /**
   * Build a URL with updated query parameters
   */
  protected buildUrl(
    context: PaginationContext,
    params: Record<string, string | number>,
  ): string {
    const url = new URL(context.request.url);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}

// ============================================================================
// Page Number Pagination
// ============================================================================

/**
 * Simple page-number based pagination
 *
 * Uses `?page=N` to navigate between pages.
 *
 * @example
 * ```ts
 * class StandardPagination extends PageNumberPagination {
 *   pageSize = 25;
 *   pageSizeQueryParam = "page_size";
 *   maxPageSize = 100;
 * }
 *
 * class ArticleViewSet extends ModelViewSet {
 *   pagination_class = StandardPagination;
 * }
 * ```
 */
export class PageNumberPagination extends BasePagination {
  /**
   * Query parameter name for page number
   */
  pageQueryParam = "page";

  /**
   * Current page number (1-indexed)
   */
  protected _page = 1;

  /**
   * Total number of pages
   */
  protected _numPages = 1;

  override async paginateQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: PaginationContext,
  ): Promise<QuerySet<T>> {
    // Get total count before pagination
    this._count = await queryset.count();

    // Determine page size and current page
    const pageSize = this.getPageSize(context);
    this._page = this.getPageNumber(context);
    this._numPages = Math.ceil(this._count / pageSize);

    // Calculate offset
    const offset = (this._page - 1) * pageSize;

    // Apply pagination
    return queryset.offset(offset).limit(pageSize);
  }

  override async getResponseData<T>(
    data: T[],
    context: PaginationContext,
  ): Promise<PaginatedResponse<T>> {
    return {
      count: this._count,
      next: this.getNextLink(context),
      previous: this.getPreviousLink(context),
      results: data,
    };
  }

  /**
   * Get the current page number from the request
   */
  protected getPageNumber(context: PaginationContext): number {
    const url = new URL(context.request.url);
    const pageStr = url.searchParams.get(this.pageQueryParam);
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      if (!isNaN(page) && page >= 1) {
        return page;
      }
    }
    return 1;
  }

  /**
   * Get the URL for the next page
   */
  protected getNextLink(context: PaginationContext): string | null {
    if (this._page >= this._numPages) {
      return null;
    }
    return this.buildUrl(context, {
      [this.pageQueryParam]: this._page + 1,
    });
  }

  /**
   * Get the URL for the previous page
   */
  protected getPreviousLink(context: PaginationContext): string | null {
    if (this._page <= 1) {
      return null;
    }
    return this.buildUrl(context, {
      [this.pageQueryParam]: this._page - 1,
    });
  }
}

// ============================================================================
// Limit Offset Pagination
// ============================================================================

/**
 * Limit/offset based pagination
 *
 * Uses `?limit=N&offset=M` for flexible pagination.
 *
 * @example
 * ```ts
 * class FlexiblePagination extends LimitOffsetPagination {
 *   defaultLimit = 20;
 *   maxLimit = 100;
 * }
 *
 * class ArticleViewSet extends ModelViewSet {
 *   pagination_class = FlexiblePagination;
 * }
 * ```
 */
export class LimitOffsetPagination extends BasePagination {
  /**
   * Query parameter name for limit
   */
  limitQueryParam = "limit";

  /**
   * Query parameter name for offset
   */
  offsetQueryParam = "offset";

  /**
   * Default limit when not specified
   */
  defaultLimit = 10;

  /**
   * Maximum allowed limit
   */
  maxLimit = 100;

  /**
   * Current offset value
   */
  protected _offset = 0;

  /**
   * Current limit value
   */
  protected _limit = 10;

  override async paginateQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: PaginationContext,
  ): Promise<QuerySet<T>> {
    // Get total count before pagination
    this._count = await queryset.count();

    // Determine limit and offset
    this._limit = this.getLimit(context);
    this._offset = this.getOffset(context);

    // Apply pagination
    return queryset.offset(this._offset).limit(this._limit);
  }

  override async getResponseData<T>(
    data: T[],
    context: PaginationContext,
  ): Promise<PaginatedResponse<T>> {
    return {
      count: this._count,
      next: this.getNextLink(context),
      previous: this.getPreviousLink(context),
      results: data,
    };
  }

  /**
   * Get the limit from the request
   */
  protected getLimit(context: PaginationContext): number {
    const url = new URL(context.request.url);
    const limitStr = url.searchParams.get(this.limitQueryParam);
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) {
        return Math.min(limit, this.maxLimit);
      }
    }
    return this.defaultLimit;
  }

  /**
   * Get the offset from the request
   */
  protected getOffset(context: PaginationContext): number {
    const url = new URL(context.request.url);
    const offsetStr = url.searchParams.get(this.offsetQueryParam);
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset) && offset >= 0) {
        return offset;
      }
    }
    return 0;
  }

  /**
   * Get the URL for the next page
   */
  protected getNextLink(context: PaginationContext): string | null {
    const nextOffset = this._offset + this._limit;
    if (nextOffset >= this._count) {
      return null;
    }
    return this.buildUrl(context, {
      [this.limitQueryParam]: this._limit,
      [this.offsetQueryParam]: nextOffset,
    });
  }

  /**
   * Get the URL for the previous page
   */
  protected getPreviousLink(context: PaginationContext): string | null {
    if (this._offset <= 0) {
      return null;
    }
    const prevOffset = Math.max(0, this._offset - this._limit);
    return this.buildUrl(context, {
      [this.limitQueryParam]: this._limit,
      [this.offsetQueryParam]: prevOffset,
    });
  }
}

// ============================================================================
// Cursor Pagination
// ============================================================================

/**
 * Cursor-based pagination for consistent ordering in large datasets
 *
 * Uses an opaque cursor token instead of page numbers.
 * Best for infinite scroll and real-time data where items may be inserted/deleted.
 *
 * @example
 * ```ts
 * class InfiniteScrollPagination extends CursorPagination {
 *   pageSize = 20;
 *   ordering = "-created_at";  // Required for cursor pagination
 * }
 *
 * class FeedViewSet extends ModelViewSet {
 *   pagination_class = InfiniteScrollPagination;
 * }
 * ```
 */
export class CursorPagination extends BasePagination {
  /**
   * Query parameter name for cursor
   */
  cursorQueryParam = "cursor";

  /**
   * Field to order by (required for cursor pagination)
   * Use "-field" for descending order.
   */
  ordering: string | null = null;

  /**
   * Current cursor position
   */
  protected _cursor: string | null = null;

  /**
   * Whether there's a next page
   */
  protected _hasNext = false;

  /**
   * Whether there's a previous page
   */
  protected _hasPrevious = false;

  /**
   * Next cursor value
   */
  protected _nextCursor: string | null = null;

  /**
   * Previous cursor value
   */
  protected _previousCursor: string | null = null;

  override async paginateQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: PaginationContext,
  ): Promise<QuerySet<T>> {
    if (!this.ordering) {
      throw new Error("CursorPagination requires an ordering field");
    }

    const pageSize = this.getPageSize(context);
    this._cursor = this.getCursor(context);

    // Get ordering field and direction
    const isDescending = this.ordering.startsWith("-");
    const orderField = isDescending ? this.ordering.slice(1) : this.ordering;

    // Apply ordering
    let paginatedQs = queryset.orderBy(this.ordering);

    // Apply cursor filter if present
    if (this._cursor) {
      const cursorValue = this.decodeCursor(this._cursor);
      if (cursorValue !== null) {
        // Filter based on cursor position and direction
        const lookup = isDescending ? `${orderField}__lt` : `${orderField}__gt`;
        paginatedQs = paginatedQs.filter({ [lookup]: cursorValue });
      }
    }

    // Fetch one extra to determine if there's a next page
    const results = await paginatedQs.limit(pageSize + 1).fetch();
    const items = results.array();

    this._hasNext = items.length > pageSize;
    this._hasPrevious = this._cursor !== null;

    // Generate cursors for next/previous navigation
    if (items.length > 0) {
      const lastItem = items[Math.min(items.length - 1, pageSize - 1)];
      const orderValue = this.getFieldValue(lastItem, orderField);
      this._nextCursor = this._hasNext ? this.encodeCursor(orderValue) : null;

      // For previous, we'd need the first item's value
      // This is simplified - full implementation would need reverse queries
      const firstItem = items[0];
      const firstValue = this.getFieldValue(firstItem, orderField);
      this._previousCursor = this._hasPrevious
        ? this.encodeCursor(firstValue)
        : null;
    }

    // Return limited queryset (without extra item)
    return paginatedQs.limit(pageSize);
  }

  override async getResponseData<T>(
    data: T[],
    context: PaginationContext,
  ): Promise<PaginatedResponse<T>> {
    return {
      count: -1, // Cursor pagination doesn't provide total count efficiently
      next: this.getNextLink(context),
      previous: this.getPreviousLink(context),
      results: data,
    };
  }

  /**
   * Get the cursor from the request
   */
  protected getCursor(context: PaginationContext): string | null {
    const url = new URL(context.request.url);
    return url.searchParams.get(this.cursorQueryParam);
  }

  /**
   * Encode a cursor value to a URL-safe string
   */
  protected encodeCursor(value: unknown): string {
    const data = JSON.stringify({ v: value });
    // Use base64url encoding
    return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  /**
   * Decode a cursor string to its original value
   */
  protected decodeCursor(cursor: string): unknown {
    try {
      // Restore base64 padding and characters
      let base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) {
        base64 += "=";
      }
      const data = JSON.parse(atob(base64));
      return data.v;
    } catch {
      return null;
    }
  }

  /**
   * Get a field value from a model instance
   */
  protected getFieldValue(instance: Model, field: string): unknown {
    const fieldObj = (instance as unknown as Record<string, unknown>)[field];
    if (fieldObj && typeof fieldObj === "object" && "get" in fieldObj) {
      return (fieldObj as { get: () => unknown }).get();
    }
    return fieldObj;
  }

  /**
   * Get the URL for the next page
   */
  protected getNextLink(context: PaginationContext): string | null {
    if (!this._hasNext || !this._nextCursor) {
      return null;
    }
    return this.buildUrl(context, {
      [this.cursorQueryParam]: this._nextCursor,
    });
  }

  /**
   * Get the URL for the previous page
   */
  protected getPreviousLink(context: PaginationContext): string | null {
    // Cursor pagination previous links are complex - simplified here
    // Full implementation would need separate "direction" tracking
    return null;
  }
}
