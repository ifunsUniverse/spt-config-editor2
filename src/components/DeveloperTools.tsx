import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { X, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface MockButton {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function DeveloperTools() {
  const [mockButtons, setMockButtons] = useState<MockButton[]>([]);
  const [resizeMode, setResizeMode] = useState(false);
  const [draggedButton, setDraggedButton] = useState<string | null>(null);

  const addMockButton = () => {
    const newButton: MockButton = {
      id: `btn-${Date.now()}`,
      label: "Mock Button",
      x: 100,
      y: 100,
      width: 120,
      height: 40,
    };
    setMockButtons([...mockButtons, newButton]);
    toast.success("Mock button added!");
  };

  const removeMockButton = (id: string) => {
    setMockButtons(mockButtons.filter(btn => btn.id !== id));
    toast.info("Mock button removed");
  };

  const updateButtonLabel = (id: string, label: string) => {
    setMockButtons(mockButtons.map(btn => 
      btn.id === id ? { ...btn, label } : btn
    ));
  };

  const handleDragStart = (id: string) => {
    setDraggedButton(id);
  };

  const handleDrag = (e: React.DragEvent, id: string) => {
    if (e.clientX === 0 && e.clientY === 0) return; // Ignore end of drag
    
    setMockButtons(mockButtons.map(btn => 
      btn.id === id 
        ? { ...btn, x: e.clientX - 60, y: e.clientY - 20 }
        : btn
    ));
  };

  const restoreLayout = () => {
    // Remove any custom resize styles
    const elements = document.querySelectorAll('[data-resizable]');
    elements.forEach(el => {
      (el as HTMLElement).style.width = '';
      (el as HTMLElement).style.height = '';
    });
    toast.success("Layout restored to default!");
  };

  return (
    <Card className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Developer Tools</h3>
        <p className="text-sm text-muted-foreground">
          Advanced tools for testing and development
        </p>
      </div>

      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label>Mock UI Elements</Label>
          <Button onClick={addMockButton} className="w-full" variant="outline">
            ➕ Add Mock Button
          </Button>
          {mockButtons.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              {mockButtons.length} mock button(s) active
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Label htmlFor="resize-mode" className="flex flex-col gap-1">
            <span className="font-medium">Resize Everything</span>
            <span className="text-xs text-muted-foreground">
              Enable resizing of all containers
            </span>
          </Label>
          <Switch
            id="resize-mode"
            checked={resizeMode}
            onCheckedChange={setResizeMode}
          />
        </div>

        {resizeMode && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Resize mode enabled. Use browser dev tools to adjust element sizes.
            </p>
            <Button onClick={restoreLayout} variant="outline" size="sm" className="w-full">
              Restore Default Layout
            </Button>
          </div>
        )}
      </div>

      {/* Render mock buttons */}
      {mockButtons.map(btn => (
        <div
          key={btn.id}
          draggable
          onDragStart={() => handleDragStart(btn.id)}
          onDrag={(e) => handleDrag(e, btn.id)}
          style={{
            position: 'fixed',
            left: btn.x,
            top: btn.y,
            width: btn.width,
            height: btn.height,
            zIndex: 9999,
          }}
          className="bg-primary text-primary-foreground rounded-md shadow-lg cursor-move flex items-center justify-center gap-2 px-2"
        >
          <GripVertical className="h-4 w-4" />
          <Input
            value={btn.label}
            onChange={(e) => updateButtonLabel(btn.id, e.target.value)}
            className="flex-1 h-6 text-xs bg-transparent border-none text-center p-0"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              removeMockButton(btn.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </Card>
  );
}
