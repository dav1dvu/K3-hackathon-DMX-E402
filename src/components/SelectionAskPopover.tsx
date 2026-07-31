import { useEffect, useState, type RefObject } from "react";
import { SparkleIcon } from "./icons";

type SelectionAskPopoverProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  onAsk: (selectedText: string) => void;
};

type PopoverPosition = {
  text: string;
  top: number;
  left: number;
};

export function SelectionAskPopover({ containerRef, onAsk }: SelectionAskPopoverProps) {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setPosition(null);
        return;
      }
      const text = selection.toString().trim();
      const anchorNode = selection.anchorNode;
      if (!text || !anchorNode || !container.contains(anchorNode)) {
        setPosition(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setPosition({
        text,
        top: rect.top - containerRect.top - 44,
        left: Math.min(Math.max(rect.left - containerRect.left, 0), Math.max(containerRect.width - 190, 0)),
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [containerRef]);

  if (!position) return null;

  return (
    <button
      type="button"
      className="selection-ask-popover"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onAsk(position.text);
        window.getSelection()?.removeAllRanges();
        setPosition(null);
      }}
    >
      <SparkleIcon width={15} height={15} />
      Hỏi AI về đoạn này
    </button>
  );
}
