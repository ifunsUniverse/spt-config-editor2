import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableBoxProps {
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export const ResizableBox = ({
  initialX = 100,
  initialY = 100,
  initialWidth = 200,
  initialHeight = 150,
  minWidth = 100,
  minHeight = 80,
}: ResizableBoxProps) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setPosition((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setSize((prev) => {
          let newWidth = prev.width;
          let newHeight = prev.height;
          let newX = position.x;
          let newY = position.y;

          if (isResizing.includes("right")) {
            newWidth = Math.max(minWidth, prev.width + deltaX);
          }
          if (isResizing.includes("left")) {
            newWidth = Math.max(minWidth, prev.width - deltaX);
            if (newWidth > minWidth) {
              newX = position.x + deltaX;
            }
          }
          if (isResizing.includes("bottom")) {
            newHeight = Math.max(minHeight, prev.height + deltaY);
          }
          if (isResizing.includes("top")) {
            newHeight = Math.max(minHeight, prev.height - deltaY);
            if (newHeight > minHeight) {
              newY = position.y + deltaY;
            }
          }

          if (newX !== position.x || newY !== position.y) {
            setPosition({ x: newX, y: newY });
          }

          return { width: newWidth, height: newHeight };
        });

        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, position, minWidth, minHeight]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      ref={boxRef}
      className={cn(
        "absolute bg-primary/10 border-2 border-primary rounded-lg shadow-lg backdrop-blur-sm",
        isDragging && "cursor-grabbing",
        !isDragging && !isResizing && "cursor-grab"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onMouseDown={handleDragStart}
    >
      {/* Resize handles */}
      {/* Top-left */}
      <div
        className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nwse-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("top-left")}
      />
      {/* Top */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-primary rounded-full cursor-ns-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("top")}
      />
      {/* Top-right */}
      <div
        className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-nesw-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("top-right")}
      />
      {/* Right */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-primary rounded-full cursor-ew-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("right")}
      />
      {/* Bottom-right */}
      <div
        className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-nwse-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("bottom-right")}
      />
      {/* Bottom */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-primary rounded-full cursor-ns-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("bottom")}
      />
      {/* Bottom-left */}
      <div
        className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nesw-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("bottom-left")}
      />
      {/* Left */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 bg-primary rounded-full cursor-ew-resize hover:scale-125 transition-transform"
        onMouseDown={handleResizeStart("left")}
      />

      {/* Content */}
      <div className="flex items-center justify-center h-full p-4 select-none pointer-events-none">
        <p className="text-sm font-medium text-primary">Drag & Resize</p>
      </div>
    </div>
  );
};
