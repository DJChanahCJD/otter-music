export function getNeteaseBadge(fee: number) {
  switch (fee) {
    case 1: 
      return { label: "试听", className: "bg-purple-400 text-white" };
    case 4: 
      return { label: "付费", className: "bg-emerald-500 text-white" };
    // case 8: 
    //   return { label: "低质", className: "bg-zinc-500/10 text-zinc-500 border-zinc-200" };
    default: 
      return null; // fee: 0 或其他情况不显示标签
  }
}