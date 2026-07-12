"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type ShortcutConfig = {
  key: string;
  href: string;
  description: string;
  requiresPrefix?: boolean;
};

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const router = useRouter();
  const prefixKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement?.getAttribute("contenteditable") === "true"
    );
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = event.key.toLowerCase();

      if (prefixKeyRef.current === "g") {
        const shortcut = shortcuts.find(
          (s) => s.key === key && s.requiresPrefix !== false
        );

        if (shortcut) {
          event.preventDefault();
          router.push(shortcut.href);
        }

        prefixKeyRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else if (key === "g") {
        event.preventDefault();
        prefixKeyRef.current = "g";

        timeoutRef.current = setTimeout(() => {
          prefixKeyRef.current = null;
        }, 1000);
      } else {
        const shortcut = shortcuts.find(
          (s) => s.key === key && s.requiresPrefix === false
        );
        if (shortcut) {
          event.preventDefault();
          router.push(shortcut.href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [shortcuts, router, isInputFocused]);
}
