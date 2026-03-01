import { Github } from "lucide-react"

export function Footer() {
  return (
    <footer className="flex items-center justify-center gap-2 py-2 text-foreground/60 hover:text-foreground/80 transition-colors">
      <a 
        href="https://github.com/DJChanahCJD/otter-music" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2"
      >
        <Github className="h-5 w-5" />
        <span className="text-sm">Otter Music</span>
      </a>
    </footer>
  )
}
