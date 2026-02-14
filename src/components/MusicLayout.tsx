import React, { ReactNode, useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetTitle
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
// import { LoadBalanceDialog } from "./LoadBalanceDialog";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "./ui/dropdown-menu";

interface MusicLayoutProps {
  sidebar: ReactNode;
  children: ReactNode; // Main Content
  player: ReactNode;
}

export function MusicLayout({ sidebar, children, player }: MusicLayoutProps) {
  const [open, setOpen] = useState(false);
  // const [isLoadBalanceOpen, setIsLoadBalanceOpen] = useState(false);

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
        {/* <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsLoadBalanceOpen(true)}>
                负载均衡
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div> */}
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
      {/* <LoadBalanceDialog 
        open={isLoadBalanceOpen} 
        onOpenChange={setIsLoadBalanceOpen} 
      /> */}
    </div>
  );
}
