import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/useTranslation";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranslateButtonProps {
  text: string;
  label?: string;
}

export const TranslateButton = ({ text, label = "Translate" }: TranslateButtonProps) => {
  const { translate, isTranslating, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleTranslate = async () => {
    if (currentLanguage === "en") {
      setTranslatedText("Translation is only available when a non-English language is selected.");
      return;
    }

    const result = await translate(text);
    if (result) {
      setTranslatedText(result);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleTranslate}
        >
          {isTranslating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="h-4 w-4" />
              {label}
            </>
          )}
        </Button>
      </PopoverTrigger>
      {translatedText && (
        <PopoverContent className="w-96" align="start">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Translation</h4>
            <ScrollArea className="h-48">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {translatedText}
              </p>
            </ScrollArea>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};
