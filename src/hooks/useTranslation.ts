import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, LANGUAGE_OPTIONS } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export const useTranslation = () => {
  const { language } = useLanguage();
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = async (text: string): Promise<string | null> => {
    if (!text || language === "en") {
      return text;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: {
          text,
          targetLanguage: LANGUAGE_OPTIONS[language].label,
        },
      });

      if (error) {
        console.error("Translation error:", error);
        toast.error("Translation failed", {
          description: error.message || "Could not translate text",
        });
        return null;
      }

      return data.translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Translation failed", {
        description: "An error occurred during translation",
      });
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  return { translate, isTranslating, currentLanguage: language };
};
