import { createBrowserRouter, Navigate } from "react-router-dom";
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
  TrashRoute
} from "@/routes/RouteWrappers";
import { RouteErrorPage } from "@/components/RouteErrorPage";

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
        path: "playlist-market/:id",
        element: <MarketPlaylistDetailRoute />,
      },
      {
        path: "artist/:id",
        element: <ArtistDetailRoute />,
      },
      {
        path: "album/:id",
        element: <AlbumDetailRoute />,
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
]);
