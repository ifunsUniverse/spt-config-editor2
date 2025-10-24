import { useState } from "react";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeEditor } from "./ThemeEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SettingsDialogProps {
  devMode: boolean;
  onDevModeChange: (enabled: boolean) => void;
}

export function SettingsDialog({ devMode, onDevModeChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const [showThemeEditor, setShowThemeEditor] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Open settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your SPT Config Editor experience
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dev-mode" className="flex flex-col gap-1">
                  <span className="font-medium">Developer Mode</span>
                  <span className="text-sm text-muted-foreground">
                    Enable advanced developer tools and features
                  </span>
                </Label>
                <Switch
                  id="dev-mode"
                  checked={devMode}
                  onCheckedChange={onDevModeChange}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <RadioGroup value={theme} onValueChange={setTheme}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="flex items-center gap-2 font-normal cursor-pointer">
                      <Sun className="h-4 w-4" />
                      Light
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="flex items-center gap-2 font-normal cursor-pointer">
                      <Moon className="h-4 w-4" />
                      Dark
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system" className="flex items-center gap-2 font-normal cursor-pointer">
                      <Monitor className="h-4 w-4" />
                      System
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => setShowThemeEditor(!showThemeEditor)}
                  className="w-full"
                  variant="outline"
                >
                  🎨 {showThemeEditor ? "Hide" : "Open"} Theme Editor
                </Button>
                
                {showThemeEditor && (
                  <div className="mt-4">
                    <ThemeEditor />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="clear-history" className="flex flex-col gap-1">
                  <span className="font-medium">Clear Edit History</span>
                  <span className="text-sm text-muted-foreground">
                    Remove all recently edited mod history
                  </span>
                </Label>
                <Button
                  id="clear-history"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('editHistory');
                    window.location.reload();
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="clear-categories" className="flex flex-col gap-1">
                  <span className="font-medium">Reset Categories</span>
                  <span className="text-sm text-muted-foreground">
                    Remove all mod category assignments
                  </span>
                </Label>
                <Button
                  id="clear-categories"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('modCategories');
                    window.location.reload();
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
