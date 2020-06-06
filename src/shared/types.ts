import {
  RouteComponentProps as _RouteComponentProps,
  RouteProps as _RouteProps,
  StaticRouterContext,
} from "react-router";
import React from "react";

declare global {
  interface Window {
    __SSR_DIRECTIVES__: any;
  }
}

export enum ArticleType {
  Wordpress = "wordpress",
  Slate = "slate",
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  sub_title: string;
  author: string;
  is_article_of_issue: boolean;
  is_promo: boolean;
  article_type: ArticleType;
  issue: number;
  user: number;
}

export interface ArticleContent {
  content_raw: string;
}

export interface Issue {
  id?: number;
  publish_date?: string;
  volume_num: number;
  issue_code: string;
  pdf?: string;
}

export interface User {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_editor: boolean;
  writer_name: string;
}

export interface APIError {
  detail?: string[];
  status_code: number;
}

export interface APIResponseSuccess<T> {
  success: true;
  data: T;
}

export interface APIResponseFailure<T extends APIError> {
  success: false;
  error: T;
}

export type APIResponse<
  T,
  U extends APIError = APIError,
  S extends APIResponseSuccess<T> = APIResponseSuccess<T>,
  F extends APIResponseFailure<U> = APIResponseFailure<U>
> = S | F;

export type APIGetHook<T, U extends APIError = APIError> = [
  T | undefined,
  U | undefined
];

export interface Pagination<T> {
  count: number;
  page: number;
  num_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type APIGetHookPaginated<T, U extends APIError = APIError> = [
  {
    next: (() => void) | null;
    previous: (() => void) | null;
    page: Pagination<T> | null;
  },
  U | undefined
];

export type PaginatedAPIResponse<
  T,
  U extends APIError = APIError
> = APIResponse<Pagination<T>, U, Required<APIResponseSuccess<Pagination<T>>>>;

export enum RequestState {
  NotStarted,
  Started,
  Complete,
}

export type APIMutateHook<S, T, U extends APIError = APIError> = [
  (body: S) => Promise<APIResponse<T, U>>,
  RequestState
];

export interface UserAPIError extends APIError {
  user?: string[];
  username?: string[];
  email?: string[];
  cur_password?: string[];
  password?: string[];
  writer_name?: string[];
}

export type UserAPIResponse = APIResponse<
  User,
  UserAPIError,
  Required<APIResponseSuccess<User>>
>;

export interface IssueAPIError extends APIError {
  non_field_errors?: string[];
}

export interface StaticRouterContextWithData<T = any>
  extends StaticRouterContext {
  data?: T;
}

interface RouteBaseProps extends Omit<_RouteProps, "render" | "component"> {
  title: string;
  key?: string | number;
  routeComponent?: React.ComponentType;
  routeProps?: any;
  loadData?: <T>() => Promise<T>;
}

export type RouteProps = RouteBaseProps &
  (
    | {
        render: (props: RouteComponentProps) => React.ReactNode;
      }
    | {
        component:
          | React.ComponentType<RouteComponentProps>
          | React.ComponentType<any>;
      }
  );

export type RouteComponentProps = _RouteComponentProps<any> & {
  route: RouteProps;
};
