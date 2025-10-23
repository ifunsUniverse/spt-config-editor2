import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface ModMetadata {
  name?: string;
  author?: string;
  version?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
}

interface ModMetadataViewerProps {
  metadata: ModMetadata;
  modName: string;
}

export const ModMetadataViewer = ({ metadata, modName }: ModMetadataViewerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
        >
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">{metadata.name || modName}</h4>
            {metadata.version && (
              <Badge variant="secondary" className="text-xs">
                v{metadata.version}
              </Badge>
            )}
          </div>

          {metadata.author && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Author</p>
              <p className="text-sm">{metadata.author}</p>
            </div>
          )}

          {metadata.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Description</p>
              <p className="text-sm leading-relaxed">{metadata.description}</p>
            </div>
          )}

          {metadata.license && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">License</p>
              <p className="text-sm">{metadata.license}</p>
            </div>
          )}

          {(metadata.homepage || metadata.repository) && (
            <div className="flex gap-2 pt-2 border-t">
              {metadata.homepage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => window.open(metadata.homepage, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                  Homepage
                </Button>
              )}
              {metadata.repository && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => window.open(metadata.repository, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                  GitHub
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
