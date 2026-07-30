import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const commonProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function UploadIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>;
}

export function FileIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>;
}

export function SparkleIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4Z"/><path d="m18.5 13-.7 1.8-1.8.7 1.8.7.7 1.8.7-1.8 1.8-.7-1.8-.7Z"/><path d="m5.5 14-.7 1.8-1.8.7 1.8.7.7 1.8.7-1.8 1.8-.7-1.8-.7Z"/></svg>;
}

export function ChevronLeftIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m15 18-6-6 6-6"/></svg>;
}

export function ChevronRightIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m9 18 6-6-6-6"/></svg>;
}

export function SendIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>;
}

export function RotateIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>;
}

export function MenuIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

