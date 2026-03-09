import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";

export function useActivePlaylists() {
  return useMusicStore(
    useShallow((state) => state.playlists.filter((p) => !p.is_deleted))
  );
}
