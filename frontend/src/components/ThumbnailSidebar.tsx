import type { ComponentType } from "react";
import type { PageProps } from "react-pdf";

type ThumbnailSidebarProps = {
  totalPages: number;
  currentPage: number;
  onSelect: (pageNumber: number) => void;
  PageComponent: ComponentType<PageProps>;
};

export function ThumbnailSidebar({
  totalPages,
  currentPage,
  onSelect,
  PageComponent,
}: ThumbnailSidebarProps) {
  return (
    <aside className="thumbnail-sidebar" aria-label="Danh sách trang PDF">
      <div className="sidebar-heading"><span>Các trang</span><span>{totalPages}</span></div>
      {totalPages === 0 ? (
        <div className="thumbnail-empty">Đang đọc số trang...</div>
      ) : (
        <div className="thumbnail-list">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
            const isActive = pageNumber === currentPage;
            return (
              <button
                key={pageNumber}
                type="button"
                className={`thumbnail-item ${isActive ? "is-active" : ""}`}
                onClick={() => onSelect(pageNumber)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Mở trang ${pageNumber}`}
              >
                <span className="thumbnail-image-wrap" aria-hidden="true">
                  <PageComponent
                    pageNumber={pageNumber}
                    width={132}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={<span className="thumbnail-skeleton" />}
                  />
                </span>
                <span className="thumbnail-number">Trang {pageNumber}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

