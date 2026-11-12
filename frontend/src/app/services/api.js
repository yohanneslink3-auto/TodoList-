import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api', credentials: 'include' })
let refreshRequest

async function baseQuery(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions)
  const url = typeof args === 'string' ? args : args.url
  const skipRefresh = ['/auth/login', '/auth/register', '/auth/logout', '/auth/refresh'].includes(url)
  if (result.error?.status !== 401 || skipRefresh) return result

  if (!refreshRequest) {
    refreshRequest = rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
  }
  const refreshResult = await refreshRequest
  refreshRequest = undefined
  if (!refreshResult.error) {
    return rawBaseQuery(args, api, extraOptions)
  }

  if (url === '/auth/me') {
    return rawBaseQuery(args, api, extraOptions)
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Auth', 'Task', 'Category', 'Statistics', 'Notification'],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => '/auth/me',
      transformResponse: (response) => response.user,
      providesTags: ['Auth'],
    }),
    register: builder.mutation({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    login: builder.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    logout: builder.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    getTasks: builder.query({
      query: (params) => {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
          if (value !== '' && value !== undefined) searchParams.set(key, value)
        })
        searchParams.set('timezoneOffset', new Date().getTimezoneOffset())
        return `/tasks?${searchParams}`
      },
      providesTags: (result) => [
        { type: 'Task', id: 'LIST' },
        ...(result?.data ?? []).map(({ _id }) => ({ type: 'Task', id: _id })),
      ],
    }),
    createTask: builder.mutation({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: ['Task', 'Statistics'],
    }),
    updateTask: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Task', 'Statistics', 'Notification'],
    }),
    deleteTask: builder.mutation({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Task', 'Statistics', 'Notification'],
    }),
    getStatistics: builder.query({
      query: () => `/tasks/statistics?timezoneOffset=${new Date().getTimezoneOffset()}`,
      transformResponse: (response) => response.statistics,
      providesTags: ['Statistics'],
    }),
    getCategories: builder.query({
      query: () => '/categories',
      transformResponse: (response) => response.categories,
      providesTags: ['Category'],
    }),
    createCategory: builder.mutation({
      query: (body) => ({ url: '/categories', method: 'POST', body }),
      invalidatesTags: ['Category'],
    }),
    updateCategory: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Category', 'Task'],
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({ url: `/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Category', 'Task'],
    }),
    getNotifications: builder.query({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),
    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    dismissNotification: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
})

export const {
  useCreateCategoryMutation,
  useCreateTaskMutation,
  useDeleteCategoryMutation,
  useDismissNotificationMutation,
  useDeleteTaskMutation,
  useGetCategoriesQuery,
  useGetMeQuery,
  useGetNotificationsQuery,
  useGetStatisticsQuery,
  useGetTasksQuery,
  useLoginMutation,
  useLogoutMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useRegisterMutation,
  useUpdateCategoryMutation,
  useUpdateTaskMutation,
} = api
