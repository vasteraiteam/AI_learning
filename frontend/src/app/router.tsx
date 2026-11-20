import { createBrowserRouter, Link, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import {
  CoursePage,
  CourseUnitPage,
  CoursesPage,
  GrowthPage,
  SpacePage,
  TodayPage,
  ToolsPage,
} from "../features/pages/StudentPages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: "courses", element: <CoursesPage /> },
      { path: "courses/:courseId", element: <CoursePage /> },
      { path: "courses/:courseId/units/:unitId", element: <CourseUnitPage /> },
      {
        path: "courses/:courseId/materials/:materialId",
        lazy: async () => ({
          Component: (await import("../features/material/MaterialPage"))
            .MaterialPage,
        }),
        hydrateFallbackElement: (
          <div className="page-content" role="status">
            正在打开资料…
          </div>
        ),
      },
      { path: "tools", element: <ToolsPage /> },
      { path: "space", element: <SpacePage /> },
      { path: "growth", element: <GrowthPage /> },
      {
        path: "404",
        element: (
          <div className="page-content">
            <h1>找不到页面</h1>
            <Link to="/">回到今天</Link>
          </div>
        ),
      },
      { path: "*", element: <Navigate to="/404" replace /> },
    ],
  },
]);
