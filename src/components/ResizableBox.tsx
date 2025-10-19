import { useState } from "react";
import { Rnd } from "react-rnd";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ResizableBox = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Rnd
      default={{
        x: 200,
        y: 200,
        width: 400,
        height: 300,
      }}
      minWidth={250}
      minHeight={200}
      bounds="parent"
      dragHandleClassName="drag-handle"
      className="z-50"
    >
      <div className="w-full h-full bg-background/95 backdrop-blur-sm border-2 border-primary/50 rounded-lg shadow-2xl flex flex-col">
        <div className="drag-handle flex items-center justify-between p-3 border-b border-border cursor-move bg-primary/10">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Resizable Box</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/20"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <p className="text-sm text-muted-foreground">
            Drag the header to move this box. Resize from any edge or corner by dragging.
          </p>
        </div>
      </div>
    </Rnd>
  );
};
