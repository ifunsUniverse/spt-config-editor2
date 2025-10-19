import { useState } from "react";
import { Rnd } from "react-rnd";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DraggableBox = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Rnd
      default={{
        x: 100,
        y: 100,
        width: 320,
        height: 200,
      }}
      minWidth={200}
      minHeight={150}
      bounds="window"
      dragHandleClassName="drag-handle"
      className="z-50"
    >
      <div className="w-full h-full bg-background border border-border rounded-lg shadow-lg flex flex-col">
        <div className="drag-handle flex items-center justify-between p-3 border-b border-border cursor-move bg-muted/50">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Draggable Box</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <p className="text-sm text-muted-foreground">
            Drag the header to move this box around. Resize from any edge or corner.
          </p>
        </div>
      </div>
    </Rnd>
  );
};
