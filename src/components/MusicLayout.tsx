import React, { ReactNode, useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetTitle
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MusicLayoutProps {
  sidebar: ReactNode;
  children: ReactNode; // Main Content
  player: ReactNode;
}

export function MusicLayout({ sidebar, children, player }: MusicLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex items-center px-4 py-2 border-b h-auto min-h-12 pt-safe">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <div className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </div>
            {React.isValidElement(sidebar) 
              ? React.cloneElement(sidebar as React.ReactElement<any>, { 
                  onItemClick: () => setOpen(false) 
                }) 
              : sidebar}
          </SheetContent>
        </Sheet>
        <span className="ml-2 font-semibold">Otter Music</span>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Main Content */}
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>

      {/* Player Bar */}
      <div className="flex-none z-50">
        {player}
      </div>
    </div>
  );
}
