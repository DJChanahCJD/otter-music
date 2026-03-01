import { useMusicStore } from "@/store/music-store";
import { aggregatedSourceOptions } from "@/types/music";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Radio } from "lucide-react";
import { SettingItem } from "./SettingItem";

export function AggregatedSourceSelect() {
  const { aggregatedSources, setAggregatedSources } = useMusicStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const toggleSource = (value: string) => {
    const current = aggregatedSources;
    if (current.includes(value as any)) {
      if (current.length > 1) {
        setAggregatedSources(current.filter(s => s !== value));
      }
    } else {
      setAggregatedSources([...current, value as any]);
    }
  };

  const selectedLabels = aggregatedSources
    .map(s => aggregatedSourceOptions.find(o => o.value === s)?.label)
    .filter(Boolean)
    .join('、');

  return (
    <SettingItem
      icon={Radio}
      title="聚合音源"
      action={<span className="text-sm truncate max-w-[140px]">{selectedLabels}</span>}
      onClick={() => setShowSourcePicker(!showSourcePicker)}
      showChevron
      isExpanded={showSourcePicker}
      expandedContent={
        <div className="space-y-2">
          {aggregatedSourceOptions.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 py-2 cursor-pointer"
              onClick={e => e.stopPropagation()}
            >
              <Checkbox
                checked={aggregatedSources.includes(opt.value)}
                onCheckedChange={() => toggleSource(opt.value)}
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      }
    />
  );
}
