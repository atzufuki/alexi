/**
 * Pagination module for Alexi REST Framework
 *
 * Provides DRF-style pagination classes for list endpoints.
 *
 * @module @alexi/restframework/pagination
 *
 * @example
 * ```ts
 * import {
 *   PageNumberPagination,
 *   LimitOffsetPagination,
 *   CursorPagination,
 * } from "@alexi/restframework";
 *
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

export {
  BasePagination,
  CursorPagination,
  LimitOffsetPagination,
  PageNumberPagination,
} from "./pagination.ts";

export type {
  PaginatedResponse,
  PaginationClass,
  PaginationContext,
} from "./pagination.ts";
