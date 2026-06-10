import { useMusicStore } from "@/store/music-store";
import { aggregatedSourceOptions, type SourceConfig } from "@/types/music";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Radio, GripVertical, Eye, EyeOff } from "lucide-react";
import { SettingItem } from "./SettingItem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

function SortableSourceItem({
  config,
  onToggleEnabled,
  onToggleVisible,
}: {
  config: SourceConfig;
  onToggleEnabled: () => void;
  onToggleVisible: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.source });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const opt = aggregatedSourceOptions.find((o) => o.value === config.source)!;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox checked={config.enabled} onCheckedChange={onToggleEnabled} />

      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm text-foreground">{opt.label}</span>
        <span className="text-xs text-muted-foreground">{opt.description}</span>
      </div>

      <button
        className="shrink-0 text-muted-foreground hover:text-foreground p-1"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        title={config.visible ? "在搜索栏显示" : "搜索栏隐藏"}
      >
        {config.visible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function AggregatedSourceSelect() {
  const { sourceConfigs, setSourceConfigs } = useMusicStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sourceConfigs.findIndex((c) => c.source === active.id);
    const newIndex = sourceConfigs.findIndex((c) => c.source === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setSourceConfigs(arrayMove(sourceConfigs, oldIndex, newIndex));
  };

  const toggleEnabled = (source: string) => {
    const current = sourceConfigs;
    const enabledCount = current.filter((c) => c.enabled).length;
    const target = current.find((c) => c.source === source);
    if (!target) return;
    if (target.enabled && enabledCount <= 1) return;
    setSourceConfigs(
      current.map((c) =>
        c.source === source ? { ...c, enabled: !c.enabled } : c
      )
    );
  };

  const toggleVisible = (source: string) => {
    setSourceConfigs(
      sourceConfigs.map((c) =>
        c.source === source ? { ...c, visible: !c.visible } : c
      )
    );
  };

  const selectedLabels = sourceConfigs
    .filter((c) => c.enabled)
    .map(
      (c) => aggregatedSourceOptions.find((o) => o.value === c.source)?.label
    )
    .filter(Boolean)
    .join("\u3001");

  return (
    <SettingItem
      icon={Radio}
      title="聚合音源"
      action={
        <span className="text-sm truncate max-w-[140px]">{selectedLabels}</span>
      }
      onClick={() => setShowSourcePicker(!showSourcePicker)}
      showChevron
      isExpanded={showSourcePicker}
      expandedContent={
        <div onClick={(e) => e.stopPropagation()}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={sourceConfigs.map((c) => c.source)}
              strategy={verticalListSortingStrategy}
            >
              {sourceConfigs.map((config) => (
                <SortableSourceItem
                  key={config.source}
                  config={config}
                  onToggleEnabled={() => toggleEnabled(config.source)}
                  onToggleVisible={() => toggleVisible(config.source)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      }
    />
  );
}
