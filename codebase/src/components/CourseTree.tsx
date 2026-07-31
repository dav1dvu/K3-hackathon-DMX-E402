import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DayRecord, MaterialRecord } from "../types";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FileIcon } from "./icons";

type CourseTreeProps = {
  days: DayRecord[];
  activeMaterialId?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectMaterial: (day: DayRecord, material: MaterialRecord) => void;
  renderDayExtra?: (day: DayRecord) => ReactNode;
  renderMaterialActions?: (day: DayRecord, material: MaterialRecord) => ReactNode;
  renderDayFooter?: (day: DayRecord) => ReactNode;
  emptyLabel?: string;
};

export function CourseTree({
  days,
  activeMaterialId,
  collapsed,
  onToggleCollapsed,
  onSelectMaterial,
  renderDayExtra,
  renderMaterialActions,
  renderDayFooter,
  emptyLabel = "Chưa có buổi học nào.",
}: CourseTreeProps) {
  const [openDayIds, setOpenDayIds] = useState<string[]>([]);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (hasAutoOpenedRef.current || days.length === 0) return;
    hasAutoOpenedRef.current = true;
    const studyingDay = days.find((day) => day.materials.some((material) => material.id === activeMaterialId));
    setOpenDayIds([(studyingDay ?? days[0]).id]);
  }, [days, activeMaterialId]);

  const toggleDay = (dayId: string) => {
    setOpenDayIds((previous) => (
      previous.includes(dayId) ? previous.filter((id) => id !== dayId) : [...previous, dayId]
    ));
  };

  if (collapsed) {
    return (
      <button className="course-tree-expand" type="button" onClick={onToggleCollapsed} aria-label="Mở danh sách học liệu">
        <ChevronRightIcon />
      </button>
    );
  }

  return (
    <aside className="course-tree" aria-label="Học liệu môn học">
      <div className="course-tree-heading">
        <div>
          <strong>Học liệu môn học</strong>
          <span>Chương, slide và tài liệu đã upload</span>
        </div>
        <button className="course-tree-collapse" type="button" onClick={onToggleCollapsed} aria-label="Thu gọn danh sách">
          <ChevronLeftIcon />
        </button>
      </div>

      {days.length === 0 ? (
        <p className="course-tree-empty">{emptyLabel}</p>
      ) : (
        <div className="course-tree-list">
          {days.map((day) => {
            const isOpen = openDayIds.includes(day.id);
            const isStudying = day.materials.some((material) => material.id === activeMaterialId);
            return (
              <div className="course-day" key={day.id}>
                <div className="course-day-header">
                  <button
                    type="button"
                    className="course-day-toggle-button"
                    onClick={() => toggleDay(day.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="course-day-toggle">{isOpen ? <ChevronLeftIcon width={16} height={16} style={{ transform: "rotate(-90deg)" }} /> : <ChevronRightIcon width={16} height={16} />}</span>
                    <span className="course-day-title">
                      <strong>{day.title}</strong>
                      <small>
                        {day.materials.length} tài liệu · {day.published ? "PUBLISHED" : "DRAFT"}
                      </small>
                    </span>
                    {isStudying && <span className="badge badge-studying">STUDYING</span>}
                  </button>
                  {renderDayExtra?.(day)}
                </div>

                {isOpen && (
                  <div className="course-day-materials">
                    {day.materials.length === 0 ? (
                      <p className="course-tree-empty">Chưa có tài liệu.</p>
                    ) : (
                      day.materials.map((material) => {
                        const isActive = material.id === activeMaterialId;
                        return (
                          <div
                            key={material.id}
                            className={`course-material ${isActive ? "is-active" : ""}`}
                          >
                            <button
                              type="button"
                              className="course-material-select"
                              onClick={() => onSelectMaterial(day, material)}
                            >
                              <FileIcon width={17} height={17} />
                              <span>
                                <strong>{material.displayName}</strong>
                                <small>{material.pageCount ?? "?"} trang</small>
                              </span>
                              {isActive && <CheckIcon width={16} height={16} />}
                            </button>
                            {renderMaterialActions?.(day, material)}
                          </div>
                        );
                      })
                    )}
                    {renderDayFooter?.(day)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
