import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { RootLayout } from "@/components/RootLayout";
import {
  SearchRoute,
  FavoritesRoute,
  MineRoute,
  PlaylistDetailRoute,
  LocalMusicRoute,
  MarketPlaylistDetailRoute,
  ArtistDetailRoute,
  AlbumDetailRoute,
  QueueRoute,
  HistoryRoute,
  SettingsRoute,
  TrashRoute,
  PodcastDetailRoute
} from "@/routes/RouteWrappers";
import { RouteErrorPage } from "@/components/RouteErrorPage";
import { PageLoader } from "@/components/PageLoader";

const AdminPage = lazy(() =>
  import("@/components/admin/AdminPage").then((m) => ({ default: m.AdminPage }))
);

// --- Router Config ---

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/search" replace />,
      },
      {
        path: "search",
        element: <SearchRoute />,
      },
      {
        path: "favorites",
        element: <FavoritesRoute />,
      },
      {
        path: "mine",
        element: <MineRoute />,
      },
      {
        path: "playlist/:id",
        element: <PlaylistDetailRoute />,
      },
      {
        path: "local",
        element: <LocalMusicRoute />,
      },
      {
        path: "netease-playlist/:id",
        element: <MarketPlaylistDetailRoute />,
      },
      {
        path: "netease-artist/:id",
        element: <ArtistDetailRoute />,
      },
      {
        path: "netease-album/:id",
        element: <AlbumDetailRoute />,
      },
      {
        path: "podcast/:id",
        element: <PodcastDetailRoute />,
      },
      {
        path: "queue",
        element: <QueueRoute />,
      },
      {
        path: "history",
        element: <HistoryRoute />,
      },
      {
        path: "settings",
        element: <SettingsRoute />,
      },
      {
        path: "settings/trash",
        element: <TrashRoute />,
      },
    ],
  },
  {
    path: "/admin",
    element: (
      <Suspense fallback={<PageLoader />}>
        <AdminPage />
      </Suspense>
    ),
  },
]);
