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

export function PenIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m17 3 4 4L7 21l-4 1 1-4Z"/></svg>;
}

export function HighlighterIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m9 11 4 4-6 6H3v-4Z"/><path d="m14.5 5.5 4 4"/><path d="M17.5 2.5 21.5 6.5 14 14l-4-4Z"/></svg>;
}

export function ZoomInIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>;
}

export function ZoomOutIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>;
}

export function DownloadIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
}

export function TrashIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/></svg>;
}

export function UndoIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M3 10h10a5 5 0 0 1 0 10H8"/><path d="m3 10 5-5m-5 5 5 5"/></svg>;
}

export function PlusIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M12 5v14M5 12h14"/></svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="m5 13 4 4 10-10"/></svg>;
}

export function LogoutIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>;
}

export function BookIcon(props: IconProps) {
  return <svg {...commonProps} {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>;
}

export function GraduationCapIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m2 9 10-5 10 5-10 5Z"/>
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>
      <path d="M22 9v7"/>
    </svg>
  );
}
